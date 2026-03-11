import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let body: {
    deal_id: string;
    currency: string;
    payment_stage_ids: string[];
    notes?: string;
    issue_date?: string;
    due_date?: string;
    contact_id?: string;
    company_id?: string;
    created_by?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { deal_id, currency, payment_stage_ids, notes, issue_date, due_date, contact_id, company_id, created_by } = body;

  if (!deal_id || !currency || !payment_stage_ids?.length) {
    return NextResponse.json({ error: "deal_id, currency, and payment_stage_ids are required" }, { status: 400 });
  }

  // Fetch selected payment stages
  const { data: stages, error: stagesErr } = await supabase
    .from("deal_payments")
    .select("*")
    .in("id", payment_stage_ids);

  if (stagesErr || !stages?.length) {
    return NextResponse.json({ error: "Failed to fetch payment stages" }, { status: 400 });
  }

  // Build line items from stages
  const lineItems: { description: string; quantity: number; unit_price: number; amount: number }[] = [];
  for (const s of stages) {
    const svc = s.service_fee_amount || 0;
    const inz = s.inz_fee_amount || 0;
    const other = s.other_fee_amount || 0;
    const stageName = s.stage_name || "Payment";
    const details = s.stage_details ? ` - ${s.stage_details}` : "";

    if (svc > 0) {
      lineItems.push({ description: `${stageName}${details} (Service Fee)`, quantity: 1, unit_price: svc, amount: svc });
    }
    if (inz > 0) {
      lineItems.push({ description: `${stageName}${details} (INZ Fee)`, quantity: 1, unit_price: inz, amount: inz });
    }
    if (other > 0) {
      lineItems.push({ description: `${stageName}${details} (Other Fee)`, quantity: 1, unit_price: other, amount: other });
    }
  }

  // Calculate totals
  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  // GST: check gst_type of stages — only apply GST for Exclusive stages
  const hasExclusiveGst = stages.some((s: Record<string, unknown>) => s.gst_type === "Exclusive");
  const gstAmount = hasExclusiveGst ? Math.round(subtotal * 0.15 * 100) / 100 : 0;
  const total = subtotal + gstAmount;

  // Generate invoice number atomically
  const currencyUpper = currency.toUpperCase();
  const prefix = currencyUpper === "NZD" ? "INV" : `INV-${currencyUpper}`;

  // Read + increment counter
  const { data: counter } = await supabase
    .from("invoice_counters")
    .select("last_number")
    .eq("currency", currencyUpper)
    .single();

  const nextNum = (counter?.last_number ?? 0) + 1;

  await supabase
    .from("invoice_counters")
    .update({ last_number: nextNum })
    .eq("currency", currencyUpper);

  const invoiceNumber = `${prefix}-${String(nextNum).padStart(4, "0")}`;

  // Insert invoice
  const { data: invoice, error: insertErr } = await supabase
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      deal_id,
      contact_id: contact_id || null,
      company_id: company_id || null,
      currency: currencyUpper,
      status: "draft",
      line_items: lineItems,
      payment_stage_ids,
      subtotal,
      gst_amount: gstAmount,
      total,
      notes: notes || null,
      issue_date: issue_date || new Date().toISOString().split("T")[0],
      due_date: due_date || null,
      created_by: created_by || null,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, invoice });
}
