import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getXeroAccessToken, getXeroTenants, getXeroInvoice } from "@/lib/xero";

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

  // Fetch Invoice from Xero (includes Payments array)
  const xeroInv = await getXeroInvoice(accessToken, tenantId, invoice.xero_invoice_id);
  if (!xeroInv) {
    console.error("[Xero sync-invoice] Failed to fetch Xero invoice:", invoice.xero_invoice_id);
    return NextResponse.json({ error: "Failed to fetch invoice from Xero" }, { status: 500 });
  }

  console.log("[Xero sync-invoice] Xero status:", xeroInv.Status, "AmountPaid:", xeroInv.AmountPaid);

  // Map Xero status to OMS status
  const xeroStatus = xeroInv.Status as string;
  const xeroAmountPaid = Number(xeroInv.AmountPaid) || 0;
  const xeroTotal = Number(xeroInv.Total) || Number(invoice.total) || 0;

  // Process Xero Payments
  const xeroPayments = (xeroInv.Payments ?? []) as {
    PaymentID: string;
    Amount: number;
    Date: string;
    Reference?: string;
  }[];

  let syncedCount = 0;
  const stageIds = (invoice.payment_stage_ids ?? []) as string[];

  for (const xp of xeroPayments) {
    if (!xp.PaymentID) continue;

    // Check if already synced
    const { data: existing } = await supabase
      .from("invoice_payments")
      .select("id")
      .eq("xero_payment_id", xp.PaymentID)
      .maybeSingle();

    if (existing) continue; // Already synced

    const paymentAmount = Number(xp.Amount) || 0;
    if (paymentAmount <= 0) continue;

    // Parse Xero date format: "/Date(1234567890000+0000)/" or "YYYY-MM-DD"
    let paymentDate = new Date().toISOString().split("T")[0];
    if (xp.Date) {
      const msMatch = xp.Date.match(/\/Date\((\d+)/);
      if (msMatch) {
        paymentDate = new Date(Number(msMatch[1])).toISOString().split("T")[0];
      } else if (/^\d{4}-\d{2}-\d{2}/.test(xp.Date)) {
        paymentDate = xp.Date.split("T")[0];
      }
    }

    // Smart stage matching
    let matchedStageId: string | null = null;
    let matchedFeeType: string | null = null;

    if (stageIds.length > 0) {
      const { data: stages } = await supabase
        .from("deal_payments")
        .select("id, service_fee_amount, inz_fee_amount, other_fee_amount, is_paid, service_fee_paid, inz_fee_paid, other_fee_paid, paid_amount_total")
        .in("id", stageIds);

      if (stages) {
        for (const s of stages) {
          if (s.is_paid) continue;

          const svc = Number(s.service_fee_amount) || 0;
          const inz = Number(s.inz_fee_amount) || 0;
          const other = Number(s.other_fee_amount) || 0;
          const stageTotal = svc + inz + other;

          // Exact match: total stage
          if (Math.abs(paymentAmount - stageTotal) < 0.01 && stageTotal > 0) {
            matchedStageId = s.id;
            matchedFeeType = "total";
            await supabase.from("deal_payments").update({
              is_paid: true, paid_at: new Date().toISOString(), status: "paid",
              paid_date: paymentDate, payment_method: "xero_sync",
              service_fee_paid: true, inz_fee_paid: true, other_fee_paid: true,
              paid_amount_total: stageTotal,
            }).eq("id", s.id);
            break;
          }

          // Exact match: service_fee
          if (!s.service_fee_paid && svc > 0 && Math.abs(paymentAmount - svc) < 0.01) {
            matchedStageId = s.id;
            matchedFeeType = "service_fee";
            const updates: Record<string, unknown> = { service_fee_paid: true, paid_amount_total: (Number(s.paid_amount_total) || 0) + svc };
            if ((s.inz_fee_paid || inz === 0) && (s.other_fee_paid || other === 0)) {
              Object.assign(updates, { is_paid: true, paid_at: new Date().toISOString(), status: "paid", paid_date: paymentDate, payment_method: "xero_sync" });
            }
            await supabase.from("deal_payments").update(updates).eq("id", s.id);
            break;
          }

          // Exact match: inz_fee
          if (!s.inz_fee_paid && inz > 0 && Math.abs(paymentAmount - inz) < 0.01) {
            matchedStageId = s.id;
            matchedFeeType = "inz_fee";
            const updates: Record<string, unknown> = { inz_fee_paid: true, paid_amount_total: (Number(s.paid_amount_total) || 0) + inz };
            if ((s.service_fee_paid || svc === 0) && (s.other_fee_paid || other === 0)) {
              Object.assign(updates, { is_paid: true, paid_at: new Date().toISOString(), status: "paid", paid_date: paymentDate, payment_method: "xero_sync" });
            }
            await supabase.from("deal_payments").update(updates).eq("id", s.id);
            break;
          }

          // Exact match: other_fee
          if (!s.other_fee_paid && other > 0 && Math.abs(paymentAmount - other) < 0.01) {
            matchedStageId = s.id;
            matchedFeeType = "other_fee";
            const updates: Record<string, unknown> = { other_fee_paid: true, paid_amount_total: (Number(s.paid_amount_total) || 0) + other };
            if ((s.service_fee_paid || svc === 0) && (s.inz_fee_paid || inz === 0)) {
              Object.assign(updates, { is_paid: true, paid_at: new Date().toISOString(), status: "paid", paid_date: paymentDate, payment_method: "xero_sync" });
            }
            await supabase.from("deal_payments").update(updates).eq("id", s.id);
            break;
          }
        }
      }
    }

    // Insert payment record
    await supabase.from("invoice_payments").insert({
      invoice_id,
      amount: paymentAmount,
      payment_date: paymentDate,
      payment_method: "xero_sync",
      notes: xp.Reference ? `Xero ref: ${xp.Reference}` : "Synced from Xero",
      matched_stage_id: matchedStageId,
      matched_fee_type: matchedFeeType,
      xero_payment_id: xp.PaymentID,
    });

    syncedCount++;
    console.log("[Xero sync-invoice] Synced payment:", xp.PaymentID, "amount:", paymentAmount, "matched:", matchedFeeType);
  }

  // Update OMS invoice status based on Xero state
  let newStatus = invoice.status;
  if (xeroStatus === "PAID") {
    newStatus = "paid";
  } else if (xeroStatus === "AUTHORISED" && xeroAmountPaid > 0 && xeroAmountPaid < xeroTotal) {
    newStatus = "partial";
  } else if (xeroStatus === "AUTHORISED" && xeroAmountPaid === 0) {
    newStatus = "sent";
  }

  await supabase.from("invoices").update({
    paid_amount: xeroAmountPaid,
    paid_date: newStatus === "paid" ? new Date().toISOString().split("T")[0] : null,
    status: newStatus,
  }).eq("id", invoice_id);

  console.log("[Xero sync-invoice] Done. Synced:", syncedCount, "Status:", newStatus);

  return NextResponse.json({
    ok: true,
    synced_payments: syncedCount,
    invoice_status: newStatus,
    paid_amount: xeroAmountPaid,
  });
}
