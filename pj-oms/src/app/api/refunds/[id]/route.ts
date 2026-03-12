import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * GET: Fetch a single refund request
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("refund_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ refund: data });
}

/**
 * PATCH: Update a refund request (approve, reject, process, complete)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabase();

  let body: {
    action: "approve" | "reject" | "process" | "complete" | "cancel";
    approved_refund?: number;
    review_notes?: string;
    reviewed_by?: string;
    actual_refund?: number;
    refund_method?: string;
    bank_account_details?: string;
    completed_by?: string;
    deduction_details?: { description: string; amount: number }[];
    total_deductions?: number;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;

  // Fetch current refund
  const { data: refund, error: fetchErr } = await supabase
    .from("refund_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !refund) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();
  let updates: Record<string, unknown> = { updated_at: now };

  switch (action) {
    case "approve":
      if (refund.status !== "pending") return NextResponse.json({ error: "Can only approve pending requests" }, { status: 400 });
      updates = {
        ...updates,
        status: "approved",
        approved_refund: body.approved_refund ?? refund.calculated_refund,
        review_notes: body.review_notes || null,
        reviewed_by: body.reviewed_by || null,
        reviewed_at: now,
      };
      if (body.deduction_details) {
        updates.deduction_details = body.deduction_details;
        updates.total_deductions = body.total_deductions ?? 0;
      }
      break;

    case "reject":
      if (refund.status !== "pending") return NextResponse.json({ error: "Can only reject pending requests" }, { status: 400 });
      updates = {
        ...updates,
        status: "rejected",
        review_notes: body.review_notes || null,
        reviewed_by: body.reviewed_by || null,
        reviewed_at: now,
      };
      break;

    case "process":
      if (refund.status !== "approved") return NextResponse.json({ error: "Can only process approved requests" }, { status: 400 });
      updates = {
        ...updates,
        status: "processing",
        actual_refund: body.actual_refund ?? refund.approved_refund,
        refund_method: body.refund_method || null,
        bank_account_details: body.bank_account_details || null,
      };
      break;

    case "complete":
      if (refund.status !== "processing") return NextResponse.json({ error: "Can only complete processing requests" }, { status: 400 });
      updates = {
        ...updates,
        status: "completed",
        actual_refund: body.actual_refund ?? refund.actual_refund ?? refund.approved_refund,
        completed_by: body.completed_by || null,
        completed_at: now,
      };
      // Update deal status to cancelled if full refund
      if (refund.deal_id) {
        await supabase.from("deals").update({ status: "cancelled" }).eq("id", refund.deal_id);
      }
      break;

    case "cancel":
      updates = { ...updates, status: "cancelled" };
      break;

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { error: updateErr } = await supabase.from("refund_requests").update(updates).eq("id", id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: updates.status });
}
