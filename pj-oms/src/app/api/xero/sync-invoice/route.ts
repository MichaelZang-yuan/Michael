import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getXeroAccessToken, getXeroTenants, syncSingleInvoice } from "@/lib/xero";

/**
 * POST: Sync a Xero Invoice's payment status back to OMS.
 * Body: { invoice_id: string }
 *
 * Fetches the Invoice from Xero, syncs payments, updates OMS invoice status,
 * and triggers smart stage matching for each new payment.
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

  console.log("[Xero sync-invoice] Starting for invoice:", invoice_id);

  // Fetch OMS invoice
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, xero_invoice_id, total, paid_amount, status, payment_stage_ids")
    .eq("id", invoice_id)
    .single();

  if (invErr || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!invoice.xero_invoice_id) {
    return NextResponse.json({ error: "Invoice not pushed to Xero yet" }, { status: 400 });
  }

  // Get Xero access token and tenant
  const accessToken = await getXeroAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Xero not connected or token refresh failed" }, { status: 401 });
  }

  const tenants = await getXeroTenants();
  // Use immigration tenant for CRM invoices
  const tenantId = tenants.immigration;
  if (!tenantId) {
    return NextResponse.json({ error: "PJ Immigration tenant not mapped" }, { status: 400 });
  }

  const result = await syncSingleInvoice(supabase, accessToken, tenantId, invoice);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    synced_payments: result.synced_payments,
    invoice_status: result.new_status,
    paid_amount: result.paid_amount,
  });
}
