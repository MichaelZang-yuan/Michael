import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getXeroAccessToken,
  getXeroTenants,
  findOrCreateXeroContact,
  createXeroInvoice,
  type XeroLineItem,
} from "@/lib/xero";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch invoice with line items
  const { data: invoice, error: invErr } = await supabase
    .from("commission_invoices")
    .select("*, commission_invoice_items(*)")
    .eq("id", id)
    .single();

  if (invErr || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.xero_invoice_id) {
    return NextResponse.json({ error: "Already pushed to Xero" }, { status: 400 });
  }

  if (invoice.status === "cancelled") {
    return NextResponse.json({ error: "Cannot push cancelled invoice" }, { status: 400 });
  }

  // Get Xero access token and PJ International tenant
  const accessToken = await getXeroAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Xero not connected or token refresh failed" }, { status: 401 });
  }

  const tenants = await getXeroTenants();
  if (!tenants.international) {
    return NextResponse.json({ error: "PJ International tenant not mapped in Xero" }, { status: 400 });
  }

  // Find or create school contact in Xero
  const xeroContactId = await findOrCreateXeroContact(
    accessToken,
    tenants.international,
    invoice.school_name
  );

  if (!xeroContactId) {
    return NextResponse.json({ error: "Failed to find/create school contact in Xero" }, { status: 500 });
  }

  // Build line items
  const items = (invoice.commission_invoice_items ?? []) as {
    description: string;
    amount: number;
    student_name: string;
  }[];

  const lineItems: XeroLineItem[] = items.map((item) => ({
    Description: item.description || `Commission for ${item.student_name}`,
    Quantity: 1,
    UnitAmount: Number(item.amount),
    AccountCode: "200",
    TaxType: "OUTPUT2",
  }));

  if (lineItems.length === 0) {
    return NextResponse.json({ error: "No line items to push" }, { status: 400 });
  }

  // Create Xero invoice
  const xeroInvoice = await createXeroInvoice(
    accessToken,
    tenants.international,
    {
      Type: "ACCREC",
      Contact: { ContactID: xeroContactId },
      LineItems: lineItems,
      Date: invoice.issue_date,
      DueDate: invoice.due_date,
      CurrencyCode: invoice.currency || "NZD",
      Status: "AUTHORISED",
      Reference: `Commission Invoice ${invoice.invoice_number}`,
    }
  );

  if (!xeroInvoice || !xeroInvoice.InvoiceID) {
    return NextResponse.json(
      { error: xeroInvoice?.error || "Failed to create Xero invoice" },
      { status: 500 }
    );
  }

  // Update local invoice with Xero reference
  await supabase.from("commission_invoices").update({
    xero_invoice_id: xeroInvoice.InvoiceID,
    xero_tenant_id: tenants.international,
    status: "sent",
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  return NextResponse.json({
    ok: true,
    xero_invoice_id: xeroInvoice.InvoiceID,
    xero_invoice_number: xeroInvoice.InvoiceNumber,
  });
}
