import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: invoice, error } = await supabase
    .from("commission_invoices")
    .select("*, commission_invoice_items(*), commission_invoice_payments(*)")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json({ invoice });
}

/**
 * DELETE: Delete a commission invoice (draft only, not pushed to Xero).
 * Unlinks all associated commissions but does NOT delete the commissions themselves.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: invoice, error } = await supabase
    .from("commission_invoices")
    .select("id, status, xero_invoice_id")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.xero_invoice_id) {
    return NextResponse.json(
      { error: "Cannot delete: already pushed to Xero. Please void in Xero first." },
      { status: 400 }
    );
  }

  if (invoice.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft invoices can be deleted" },
      { status: 400 }
    );
  }

  // Unlink all commissions referencing this invoice
  await supabase
    .from("commissions")
    .update({ commission_invoice_id: null, commission_invoice_item_id: null })
    .eq("commission_invoice_id", id);

  // Delete invoice (cascade will delete items and payments)
  await supabase.from("commission_invoices").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}

/**
 * PUT: Update a commission invoice.
 * Can modify: notes, due_date, line item amounts, add/remove items.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let body: {
    notes?: string;
    due_date?: string;
    items_to_remove?: string[]; // commission_invoice_item ids
    items_to_add?: string[]; // commission ids to add
    item_amounts?: Record<string, number>; // item_id -> new amount
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: invoice, error: invErr } = await supabase
    .from("commission_invoices")
    .select("*, commission_invoice_items(*)")
    .eq("id", id)
    .single();

  if (invErr || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Update basic fields
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.due_date !== undefined) updates.due_date = body.due_date;

  // Remove items
  if (body.items_to_remove && body.items_to_remove.length > 0) {
    for (const itemId of body.items_to_remove) {
      // Find commission linked to this item and unlink it
      const { data: item } = await supabase
        .from("commission_invoice_items")
        .select("commission_id")
        .eq("id", itemId)
        .single();

      if (item?.commission_id) {
        await supabase.from("commissions").update({
          commission_invoice_id: null,
          commission_invoice_item_id: null,
        }).eq("id", item.commission_id);
      }

      await supabase.from("commission_invoice_items").delete().eq("id", itemId);
    }
  }

  // Add items (commission IDs)
  if (body.items_to_add && body.items_to_add.length > 0) {
    for (const commissionId of body.items_to_add) {
      // Get commission details
      const { data: comm } = await supabase
        .from("commissions")
        .select("id, amount, tuition_fee, commission_rate, enrollment_date, student_id")
        .eq("id", commissionId)
        .single();

      if (!comm) continue;

      // Get student info
      const { data: student } = await supabase
        .from("students")
        .select("full_name, student_number")
        .eq("id", comm.student_id)
        .single();

      const studentName = student?.full_name ?? "Unknown";
      const studentNumber = student?.student_number ?? null;

      const descParts = [`Commission for ${studentName}`];
      if (studentNumber) descParts[0] += ` (${studentNumber})`;
      if (comm.enrollment_date) descParts.push(`Intake: ${comm.enrollment_date}`);
      if (comm.tuition_fee) descParts.push(`Tuition: $${Number(comm.tuition_fee).toLocaleString()}`);
      if (comm.commission_rate) descParts.push(`@ ${(Number(comm.commission_rate) * 100).toFixed(0)}%`);

      const { data: lineItem } = await supabase
        .from("commission_invoice_items")
        .insert({
          commission_invoice_id: id,
          commission_id: commissionId,
          student_id: comm.student_id,
          student_name: studentName,
          student_number: studentNumber,
          enrollment_date: comm.enrollment_date || null,
          tuition_fee: comm.tuition_fee || null,
          commission_rate: comm.commission_rate || null,
          amount: comm.amount,
          description: descParts.join(" - "),
        })
        .select("id")
        .single();

      // Link commission to this invoice
      await supabase.from("commissions").update({
        commission_invoice_id: id,
        commission_invoice_item_id: lineItem?.id || null,
      }).eq("id", commissionId);
    }
  }

  // Update item amounts
  if (body.item_amounts) {
    for (const [itemId, newAmount] of Object.entries(body.item_amounts)) {
      await supabase.from("commission_invoice_items").update({ amount: newAmount }).eq("id", itemId);
    }
  }

  // Recalculate totals
  const { data: allItems } = await supabase
    .from("commission_invoice_items")
    .select("amount")
    .eq("commission_invoice_id", id);

  if (allItems && allItems.length > 0) {
    const subtotal = allItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gstAmount = Math.round(subtotal * 0.15 * 100) / 100;
    const total = Math.round((subtotal + gstAmount) * 100) / 100;
    updates.subtotal = subtotal;
    updates.gst_amount = gstAmount;
    updates.total = total;
  } else {
    // No items left — delete the invoice
    await supabase.from("commission_invoices").delete().eq("id", id);
    return NextResponse.json({ ok: true, deleted: true });
  }

  await supabase.from("commission_invoices").update(updates).eq("id", id);

  return NextResponse.json({ ok: true });
}
