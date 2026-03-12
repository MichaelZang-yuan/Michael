import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    .from("commission_invoices")
    .select("id, total, paid_amount, status")
    .eq("id", id)
    .single();

  if (invErr || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const currentPaid = Number(invoice.paid_amount) || 0;
  const newPaid = currentPaid + amount;
  const total = Number(invoice.total) || 0;

  let newStatus = invoice.status;
  if (newPaid >= total) {
    newStatus = "paid";
  } else if (newPaid > 0) {
    newStatus = "partial";
  }

  // Insert payment record
  const { data: payment, error: payErr } = await supabase
    .from("commission_invoice_payments")
    .insert({
      commission_invoice_id: id,
      amount,
      payment_date: payment_date || new Date().toISOString().split("T")[0],
      payment_method: payment_method || null,
      notes: notes || null,
      created_by: created_by || null,
    })
    .select()
    .single();

  if (payErr) {
    return NextResponse.json({ error: payErr.message }, { status: 500 });
  }

  // Update invoice
  await supabase.from("commission_invoices").update({
    paid_amount: newPaid,
    status: newStatus,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  return NextResponse.json({ ok: true, payment, invoice_status: newStatus });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("commission_invoice_payments")
    .select("*")
    .eq("commission_invoice_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ payments: data ?? [] });
}
