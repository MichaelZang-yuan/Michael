import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST: Auto-create or append to a commission invoice for a school.
 * Called after a commission is claimed.
 */
export async function POST(request: Request) {
  const supabase = getSupabase();

  let body: {
    commission_id: string;
    student_id: string;
    student_name: string;
    student_number?: string;
    school_id: string;
    school_name: string;
    course_name?: string;
    enrollment_date?: string;
    tuition_fee?: number;
    commission_rate?: number;
    amount: number;
    created_by?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { commission_id, student_id, student_name, student_number, school_id, school_name, course_name, enrollment_date, tuition_fee, commission_rate, amount, created_by } = body;
  if (!commission_id || !student_id || !school_id || !amount) {
    return NextResponse.json({ error: "commission_id, student_id, school_id, and amount are required" }, { status: 400 });
  }

  // Check if there's an existing draft commission invoice for this school
  const { data: existingInvoice } = await supabase
    .from("commission_invoices")
    .select("id, subtotal, gst_amount, total")
    .eq("school_id", school_id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let invoiceId: string;
  let invoiceNumber: string;

  if (existingInvoice) {
    // Append to existing draft invoice
    invoiceId = existingInvoice.id;

    // Get invoice number for response
    const { data: inv } = await supabase.from("commission_invoices").select("invoice_number").eq("id", invoiceId).single();
    invoiceNumber = inv?.invoice_number ?? "";
  } else {
    // Generate new invoice number CI-0001
    const { data: counter } = await supabase
      .from("commission_invoice_counters")
      .select("next_number")
      .eq("id", "default")
      .single();

    const nextNum = counter?.next_number ?? 1;
    invoiceNumber = `CI-${String(nextNum).padStart(4, "0")}`;

    await supabase
      .from("commission_invoice_counters")
      .update({ next_number: nextNum + 1 })
      .eq("id", "default");

    // Create new commission invoice
    const { data: newInvoice, error: createErr } = await supabase
      .from("commission_invoices")
      .insert({
        invoice_number: invoiceNumber,
        school_id,
        school_name,
        status: "draft",
        subtotal: 0,
        gst_amount: 0,
        total: 0,
        created_by: created_by || null,
      })
      .select("id")
      .single();

    if (createErr || !newInvoice) {
      console.error("[commission-invoices] Create error:", createErr);
      return NextResponse.json({ error: createErr?.message || "Failed to create invoice" }, { status: 500 });
    }

    invoiceId = newInvoice.id;
  }

  // Build line item description
  const descParts = [`Commission for ${student_name}`];
  if (student_number) descParts[0] += ` (${student_number})`;
  if (course_name) descParts.push(course_name);
  if (enrollment_date) descParts.push(`Intake: ${enrollment_date}`);
  if (tuition_fee) descParts.push(`Tuition: $${tuition_fee.toLocaleString()}`);
  if (commission_rate) descParts.push(`@ ${commission_rate}%`);
  const description = descParts.join(" - ");

  // Insert line item
  const { data: lineItem, error: itemErr } = await supabase
    .from("commission_invoice_items")
    .insert({
      commission_invoice_id: invoiceId,
      commission_id,
      student_id,
      student_name,
      student_number: student_number || null,
      course_name: course_name || null,
      enrollment_date: enrollment_date || null,
      tuition_fee: tuition_fee || null,
      commission_rate: commission_rate || null,
      amount,
      description,
    })
    .select("id")
    .single();

  if (itemErr) {
    console.error("[commission-invoices] Line item error:", itemErr);
    return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }

  // Recalculate invoice totals
  const { data: allItems } = await supabase
    .from("commission_invoice_items")
    .select("amount")
    .eq("commission_invoice_id", invoiceId);

  const subtotal = (allItems ?? []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const gstAmount = Math.round(subtotal * 0.15 * 100) / 100;
  const total = Math.round((subtotal + gstAmount) * 100) / 100;

  await supabase.from("commission_invoices").update({
    subtotal,
    gst_amount: gstAmount,
    total,
    updated_at: new Date().toISOString(),
  }).eq("id", invoiceId);

  // Link commission to this invoice
  await supabase.from("commissions").update({
    commission_invoice_id: invoiceId,
    commission_invoice_item_id: lineItem?.id || null,
  }).eq("id", commission_id);

  return NextResponse.json({
    ok: true,
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    item_id: lineItem?.id,
    appended: !!existingInvoice,
  });
}

/**
 * GET: List commission invoices with optional filters.
 */
export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const schoolId = searchParams.get("school_id");

  let query = supabase
    .from("commission_invoices")
    .select("*, commission_invoice_items(count)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (schoolId) query = query.eq("school_id", schoolId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoices: data ?? [] });
}
