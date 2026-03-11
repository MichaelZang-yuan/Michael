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
 * Creates DRAFT ACCREC invoice in Xero
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

  console.log("[Xero create-invoice] Starting for invoice:", invoice_id);

  // Fetch invoice with related data
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("*, deals(deal_number, contacts(first_name, last_name, email), companies(company_name, email))")
    .eq("id", invoice_id)
    .single();

  if (invErr || !invoice) {
    console.error("[Xero create-invoice] Invoice not found:", invErr);
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.xero_invoice_id) {
    return NextResponse.json({ error: "Invoice already pushed to Xero", xero_invoice_id: invoice.xero_invoice_id }, { status: 400 });
  }

  // Get Xero access token and tenant
  const accessToken = await getXeroAccessToken();
  if (!accessToken) {
    console.error("[Xero create-invoice] No access token");
    return NextResponse.json({ error: "Xero not connected or token refresh failed" }, { status: 401 });
  }

  const tenants = await getXeroTenants();
  console.log("[Xero create-invoice] Tenants:", JSON.stringify(tenants));
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

  console.log("[Xero create-invoice] Contact:", contactName, contactEmail);

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

  // Fetch the payment stages for GST type per line item
  const stageIds = (invoice.payment_stage_ids ?? []) as string[];
  let stageGstMap: Record<string, string> = {};
  if (stageIds.length > 0) {
    const { data: stages } = await supabase
      .from("deal_payments")
      .select("id, gst_type")
      .in("id", stageIds);
    if (stages) {
      stageGstMap = Object.fromEntries(stages.map((s: { id: string; gst_type: string | null }) => [s.id, s.gst_type ?? "Exclusive"]));
    }
  }

  // Map GST type to Xero TaxType
  // Exclusive = 15% GST added on top → OUTPUT
  // Inclusive = 15% GST included → OUTPUT2
  // Zero Rated = no GST → NONE
  const gstToXeroTax = (gstType: string): string => {
    switch (gstType) {
      case "Inclusive": return "OUTPUT2";
      case "Exclusive": return "OUTPUT";
      case "Zero Rated": return "NONE";
      default: return "OUTPUT2";
    }
  };

  // Determine primary GST type (from first stage or fallback)
  const primaryGst = stageIds.length > 0 && stageGstMap[stageIds[0]]
    ? stageGstMap[stageIds[0]]
    : (invoice.gst_amount > 0 ? "Inclusive" : "Zero Rated");

  // Build Xero line items from invoice line_items
  const lineItems = invoice.line_items as { description: string; quantity: number; unit_price: number; amount: number }[];
  const xeroLineItems: XeroLineItem[] = lineItems.map((item) => ({
    Description: item.description,
    Quantity: item.quantity,
    UnitAmount: item.unit_price,
    AccountCode: "200",
    TaxType: gstToXeroTax(primaryGst),
  }));

  // DueDate: use invoice due_date, or issue_date + 30 days
  let dueDate = invoice.due_date;
  if (!dueDate && invoice.issue_date) {
    const d = new Date(invoice.issue_date);
    d.setDate(d.getDate() + 30);
    dueDate = d.toISOString().split("T")[0];
  }

  // Create draft invoice in Xero
  const xeroInvoice = await createXeroInvoice(accessToken, tenants.immigration, {
    Type: "ACCREC",
    Contact: { ContactID: xeroContactId },
    LineItems: xeroLineItems,
    Date: invoice.issue_date,
    DueDate: dueDate || undefined,
    Reference: invoice.invoice_number,
    CurrencyCode: invoice.currency || "NZD",
    Status: "DRAFT",
  });

  if (!xeroInvoice || xeroInvoice.error) {
    const errMsg = xeroInvoice?.error || "Unknown Xero error";
    console.error("[Xero create-invoice] Failed:", errMsg);
    return NextResponse.json({ error: `Xero API error: ${errMsg}` }, { status: 500 });
  }

  if (!xeroInvoice.InvoiceID) {
    return NextResponse.json({ error: "Xero returned no InvoiceID" }, { status: 500 });
  }

  // Save Xero invoice ID back to our invoices table
  await supabase
    .from("invoices")
    .update({ xero_invoice_id: xeroInvoice.InvoiceID })
    .eq("id", invoice_id);

  console.log("[Xero create-invoice] Success:", xeroInvoice.InvoiceID, xeroInvoice.InvoiceNumber);

  return NextResponse.json({
    ok: true,
    xero_invoice_id: xeroInvoice.InvoiceID,
    xero_invoice_number: xeroInvoice.InvoiceNumber,
  });
}
