import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST: Record a payment against an invoice.
 * Automatically matches to payment stages if amount matches exactly.
 * Updates invoice paid_amount and status accordingly.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let body: {
    amount: number;
    payment_date?: string;
    payment_method?: string;
    notes?: string;
    created_by?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { amount, payment_date, payment_method, notes, created_by } = body;
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "amount must be positive" }, { status: 400 });
  }

  // Fetch invoice
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, total, paid_amount, status, payment_stage_ids, deal_id")
    .eq("id", invoiceId)
    .single();

  if (invErr || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const currentPaid = Number(invoice.paid_amount) || 0;
  const newPaid = currentPaid + amount;
  const total = Number(invoice.total) || 0;

  // Determine new status
  let newStatus = invoice.status;
  if (newPaid >= total) {
    newStatus = "paid";
  } else if (newPaid > 0) {
    newStatus = "partial";
  }

  // Try to match payment to a stage
  let matchedStageId: string | null = null;
  let matchedFeeType: string | null = null;

  const stageIds = (invoice.payment_stage_ids ?? []) as string[];
  if (stageIds.length > 0) {
    const { data: stages } = await supabase
      .from("deal_payments")
      .select("id, service_fee_amount, inz_fee_amount, other_fee_amount, is_paid, service_fee_paid, inz_fee_paid, other_fee_paid, paid_amount_total")
      .in("id", stageIds);

    if (stages) {
      for (const s of stages) {
        if (s.is_paid) continue; // skip already fully paid

        const svc = Number(s.service_fee_amount) || 0;
        const inz = Number(s.inz_fee_amount) || 0;
        const other = Number(s.other_fee_amount) || 0;
        const stageTotal = svc + inz + other;

        // Check exact match: total stage amount
        if (Math.abs(amount - stageTotal) < 0.01 && stageTotal > 0) {
          matchedStageId = s.id;
          matchedFeeType = "total";
          // Mark entire stage as paid
          await supabase.from("deal_payments").update({
            is_paid: true,
            paid_at: new Date().toISOString(),
            status: "paid",
            paid_date: payment_date || new Date().toISOString().split("T")[0],
            payment_method: payment_method || "bank_transfer",
            service_fee_paid: true,
            inz_fee_paid: true,
            other_fee_paid: true,
            paid_amount_total: stageTotal,
          }).eq("id", s.id);
          break;
        }

        // Check exact match: service_fee
        if (!s.service_fee_paid && svc > 0 && Math.abs(amount - svc) < 0.01) {
          matchedStageId = s.id;
          matchedFeeType = "service_fee";
          const updates: Record<string, unknown> = { service_fee_paid: true, paid_amount_total: (Number(s.paid_amount_total) || 0) + svc };
          // Check if all fees now paid
          if ((s.inz_fee_paid || inz === 0) && (s.other_fee_paid || other === 0)) {
            updates.is_paid = true;
            updates.paid_at = new Date().toISOString();
            updates.status = "paid";
            updates.paid_date = payment_date || new Date().toISOString().split("T")[0];
            updates.payment_method = payment_method || "bank_transfer";
          }
          await supabase.from("deal_payments").update(updates).eq("id", s.id);
          break;
        }

        // Check exact match: inz_fee
        if (!s.inz_fee_paid && inz > 0 && Math.abs(amount - inz) < 0.01) {
          matchedStageId = s.id;
          matchedFeeType = "inz_fee";
          const updates: Record<string, unknown> = { inz_fee_paid: true, paid_amount_total: (Number(s.paid_amount_total) || 0) + inz };
          if ((s.service_fee_paid || svc === 0) && (s.other_fee_paid || other === 0)) {
            updates.is_paid = true;
            updates.paid_at = new Date().toISOString();
            updates.status = "paid";
            updates.paid_date = payment_date || new Date().toISOString().split("T")[0];
            updates.payment_method = payment_method || "bank_transfer";
          }
          await supabase.from("deal_payments").update(updates).eq("id", s.id);
          break;
        }

        // Check exact match: other_fee
        if (!s.other_fee_paid && other > 0 && Math.abs(amount - other) < 0.01) {
          matchedStageId = s.id;
          matchedFeeType = "other_fee";
          const updates: Record<string, unknown> = { other_fee_paid: true, paid_amount_total: (Number(s.paid_amount_total) || 0) + other };
          if ((s.service_fee_paid || svc === 0) && (s.inz_fee_paid || inz === 0)) {
            updates.is_paid = true;
            updates.paid_at = new Date().toISOString();
            updates.status = "paid";
            updates.paid_date = payment_date || new Date().toISOString().split("T")[0];
            updates.payment_method = payment_method || "bank_transfer";
          }
          await supabase.from("deal_payments").update(updates).eq("id", s.id);
          break;
        }
      }
    }
  }

  // Insert payment record
  const { data: payment, error: payErr } = await supabase
    .from("invoice_payments")
    .insert({
      invoice_id: invoiceId,
      amount,
      payment_date: payment_date || new Date().toISOString().split("T")[0],
      payment_method: payment_method || null,
      notes: notes || null,
      matched_stage_id: matchedStageId,
      matched_fee_type: matchedFeeType,
      created_by: created_by || null,
    })
    .select()
    .single();

  if (payErr) {
    console.error("[record-payment] Insert error:", payErr);
    return NextResponse.json({ error: payErr.message }, { status: 500 });
  }

  // Update invoice
  await supabase.from("invoices").update({
    paid_amount: newPaid,
    paid_date: newPaid >= total ? (payment_date || new Date().toISOString().split("T")[0]) : null,
    status: newStatus,
  }).eq("id", invoiceId);

  return NextResponse.json({
    ok: true,
    payment,
    invoice_status: newStatus,
    matched_stage_id: matchedStageId,
    matched_fee_type: matchedFeeType,
  });
}

/** GET: List payments for an invoice */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("invoice_payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ payments: data ?? [] });
}
