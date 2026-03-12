import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST: Undo a commission claim — remove it from the commission invoice.
 * 1. Find commission_invoice_item linked to this commission
 * 2. Delete the line item
 * 3. Recalculate invoice totals
 * 4. If last item, delete the entire invoice
 * 5. Clear commission_invoice_id / commission_invoice_item_id on commission
 */
export async function POST(request: Request) {
  const supabase = getSupabase();

  let body: { commission_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { commission_id } = body;
  if (!commission_id) {
    return NextResponse.json({ error: "commission_id is required" }, { status: 400 });
  }

  // 1. Get commission to find linked invoice
  const { data: commission } = await supabase
    .from("commissions")
    .select("id, commission_invoice_id, commission_invoice_item_id")
    .eq("id", commission_id)
    .single();

  if (!commission) {
    return NextResponse.json({ error: "Commission not found" }, { status: 404 });
  }

  let had_xero_invoice = false;
  let invoice_deleted = false;

  if (commission.commission_invoice_id) {
    // Check if invoice has xero_invoice_id
    const { data: invoice } = await supabase
      .from("commission_invoices")
      .select("id, xero_invoice_id")
      .eq("id", commission.commission_invoice_id)
      .single();

    if (invoice?.xero_invoice_id) {
      had_xero_invoice = true;
    }

    // 2. Delete the line item
    if (commission.commission_invoice_item_id) {
      await supabase
        .from("commission_invoice_items")
        .delete()
        .eq("id", commission.commission_invoice_item_id);
    } else {
      // Fallback: delete by commission_id
      await supabase
        .from("commission_invoice_items")
        .delete()
        .eq("commission_id", commission_id);
    }

    // 3. Check remaining items
    const { data: remainingItems } = await supabase
      .from("commission_invoice_items")
      .select("id, amount")
      .eq("commission_invoice_id", commission.commission_invoice_id);

    if (!remainingItems || remainingItems.length === 0) {
      // 4. Last item — delete the entire invoice
      await supabase
        .from("commission_invoices")
        .delete()
        .eq("id", commission.commission_invoice_id);
      invoice_deleted = true;
    } else {
      // Recalculate totals
      const subtotal = remainingItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const gstAmount = Math.round(subtotal * 0.15 * 100) / 100;
      const total = Math.round((subtotal + gstAmount) * 100) / 100;

      await supabase.from("commission_invoices").update({
        subtotal,
        gst_amount: gstAmount,
        total,
        updated_at: new Date().toISOString(),
      }).eq("id", commission.commission_invoice_id);
    }
  }

  // 5. Clear invoice links on commission
  await supabase.from("commissions").update({
    commission_invoice_id: null,
    commission_invoice_item_id: null,
  }).eq("id", commission_id);

  return NextResponse.json({
    ok: true,
    had_xero_invoice,
    invoice_deleted,
  });
}
