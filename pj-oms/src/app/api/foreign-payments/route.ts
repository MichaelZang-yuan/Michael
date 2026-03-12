import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * POST: Record a foreign currency payment
 */
export async function POST(request: Request) {
  const supabase = getSupabase();
  let body: {
    invoice_id?: string;
    deal_id?: string;
    amount: number;
    currency: "CNY" | "THB";
    exchange_rate?: number;
    nzd_equivalent?: number;
    payment_date?: string;
    payment_method?: string;
    payment_reference?: string;
    notes?: string;
    recorded_by?: string;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { invoice_id, deal_id, amount, currency, exchange_rate, nzd_equivalent, payment_date, payment_method, payment_reference, notes, recorded_by } = body;
  if (!amount || !currency) {
    return NextResponse.json({ error: "amount and currency are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("foreign_currency_payments")
    .insert({
      invoice_id: invoice_id || null,
      deal_id: deal_id || null,
      amount,
      currency,
      exchange_rate: exchange_rate || null,
      nzd_equivalent: nzd_equivalent || null,
      payment_date: payment_date || new Date().toISOString().split("T")[0],
      payment_method: payment_method || null,
      payment_reference: payment_reference || null,
      notes: notes || null,
      recorded_by: recorded_by || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If linked to an invoice, update invoice paid_amount
  if (invoice_id && nzd_equivalent) {
    const { data: inv } = await supabase.from("invoices").select("paid_amount, total, status").eq("id", invoice_id).single();
    if (inv) {
      const newPaid = Number(inv.paid_amount || 0) + nzd_equivalent;
      const total = Number(inv.total || 0);
      let newStatus = inv.status;
      if (newPaid >= total) newStatus = "paid";
      else if (newPaid > 0) newStatus = "partial";
      await supabase.from("invoices").update({ paid_amount: newPaid, status: newStatus }).eq("id", invoice_id);
    }
  }

  return NextResponse.json({ ok: true, payment: data });
}

/**
 * GET: List foreign currency payments
 */
export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const currency = searchParams.get("currency");
  const status = searchParams.get("status");

  let query = supabase
    .from("foreign_currency_payments")
    .select("*, invoices(invoice_number, deal_id, deals(deal_number, contacts(first_name, last_name), companies(company_name)))")
    .order("payment_date", { ascending: false });

  if (currency) query = query.eq("currency", currency);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data ?? [] });
}
