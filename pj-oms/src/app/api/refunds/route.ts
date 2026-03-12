import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * POST: Create a refund request
 */
export async function POST(request: Request) {
  const supabase = getSupabase();
  let body: {
    deal_id: string;
    deal_number: string;
    client_name: string;
    total_paid: number;
    refund_percentage: number;
    calculated_refund: number;
    deduction_details?: { description: string; amount: number }[];
    total_deductions?: number;
    reason: string;
    notes?: string;
    requested_by?: string;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { deal_id, deal_number, client_name, total_paid, refund_percentage, calculated_refund, deduction_details, total_deductions, reason, notes, requested_by } = body;
  if (!deal_id || !reason || total_paid == null) {
    return NextResponse.json({ error: "deal_id, total_paid, and reason are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("refund_requests")
    .insert({
      deal_id,
      deal_number: deal_number || "",
      client_name: client_name || "",
      total_paid,
      refund_percentage: refund_percentage || 0,
      calculated_refund: calculated_refund || 0,
      deduction_details: deduction_details || [],
      total_deductions: total_deductions || 0,
      reason,
      notes: notes || null,
      requested_by: requested_by || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, refund: data });
}

/**
 * GET: List refund requests with optional status filter
 */
export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("refund_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ refunds: data ?? [] });
}
