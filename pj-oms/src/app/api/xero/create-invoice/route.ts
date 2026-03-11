import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getXeroAccessToken,
  getXeroTenants,
  findOrCreateXeroContact,
  createXeroInvoice,
  type XeroLineItem,
} from "@/lib/xero";

/**
 * POST: Push a CRM invoice to Xero (PJ Immigration Limited)
 * Body: { invoice_id: string }
 * Only NZD invoices, creates DRAFT ACCREC invoice in Xero
 */
export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let body: { invoice_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { invoice_id } = body;
  if (!invoice_id) {
    return NextResponse.json({ error: "invoice_id is required" }, { status: 400 });
  }

  // Fetch invoice with related data
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("*, deals(deal_number, contacts(first_name, last_name, email), companies(company_name, email))")
    .eq("id", invoice_id)
    .single();

  if (invErr || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.xero_invoice_id) {
    return NextResponse.json({ error: "Invoice already pushed to Xero", xero_invoice_id: invoice.xero_invoice_id }, { status: 400 });
  }

  if (invoice.currency !== "NZD") {
    return NextResponse.json({ error: "Only NZD invoices can be pushed to Xero" }, { status: 400 });
  }

  // Get Xero access token and tenant
  const accessToken = await getXeroAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Xero not connected or token refresh failed" }, { status: 401 });
  }

  const tenants = await getXeroTenants();
  if (!tenants.immigration) {
    return NextResponse.json({ error: "PJ Immigration tenant not mapped in Xero" }, { status: 400 });
  }

  // Determine contact name and email
  const deal = invoice.deals as Record<string, unknown> | null;
  const contact = deal?.contacts as { first_name: string; last_name: string; email?: string } | null;
  const company = deal?.companies as { company_name: string; email?: string } | null;

  const contactName = contact
    ? `${contact.first_name} ${contact.last_name}`
    : company?.company_name ?? "Unknown Client";
  const contactEmail = contact?.email ?? company?.email ?? undefined;

  // Find or create contact in Xero
  const xeroContactId = await findOrCreateXeroContact(
    accessToken,
    tenants.immigration,
    contactName,
    contactEmail
  );

  if (!xeroContactId) {
    return NextResponse.json({ error: "Failed to find/create contact in Xero" }, { status: 500 });
  }

  // Build Xero line items from invoice line_items
  const lineItems = invoice.line_items as { description: string; quantity: number; unit_price: number; amount: number }[];
  const xeroLineItems: XeroLineItem[] = lineItems.map((item) => ({
    Description: item.description,
    Quantity: item.quantity,
    UnitAmount: item.unit_price,
    AccountCode: "200",
    TaxType: invoice.gst_amount > 0 ? "OUTPUT2" : "NONE",
  }));

  // Create draft invoice in Xero
  const xeroInvoice = await createXeroInvoice(accessToken, tenants.immigration, {
    Type: "ACCREC",
    Contact: { ContactID: xeroContactId },
    LineItems: xeroLineItems,
    Date: invoice.issue_date,
    DueDate: invoice.due_date || undefined,
    Reference: invoice.invoice_number,
    CurrencyCode: "NZD",
    Status: "DRAFT",
  });

  if (!xeroInvoice) {
    return NextResponse.json({ error: "Failed to create invoice in Xero" }, { status: 500 });
  }

  // Save Xero invoice ID back to our invoices table
  await supabase
    .from("invoices")
    .update({ xero_invoice_id: xeroInvoice.InvoiceID })
    .eq("id", invoice_id);

  return NextResponse.json({
    ok: true,
    xero_invoice_id: xeroInvoice.InvoiceID,
    xero_invoice_number: xeroInvoice.InvoiceNumber,
  });
}
