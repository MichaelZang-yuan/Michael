import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getXeroAccessToken, getXeroTenants, syncSingleInvoice } from "@/lib/xero";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get Xero access token
  const accessToken = await getXeroAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Xero not connected or token refresh failed" }, { status: 401 });
  }

  // Get immigration tenant
  const tenants = await getXeroTenants();
  const tenantId = tenants.immigration;
  if (!tenantId) {
    return NextResponse.json({ error: "PJ Immigration tenant not mapped" }, { status: 400 });
  }

  // Fetch all invoices that need syncing
  const { data: invoices, error: queryErr } = await supabase
    .from("invoices")
    .select("id, xero_invoice_id, total, paid_amount, status, payment_stage_ids")
    .not("xero_invoice_id", "is", null)
    .not("status", "in", '("paid","cancelled")');

  if (queryErr) {
    console.error("[Xero cron] Query error:", queryErr.message);
    return NextResponse.json({ error: "Failed to query invoices" }, { status: 500 });
  }

  if (!invoices || invoices.length === 0) {
    return NextResponse.json({ ok: true, total_checked: 0, updated: 0, new_payments: 0, errors: [] });
  }

  console.log("[Xero cron] Found", invoices.length, "invoices to sync");

  let updated = 0;
  let newPayments = 0;
  const errors: string[] = [];

  for (const inv of invoices) {
    try {
      const result = await syncSingleInvoice(supabase, accessToken, tenantId, inv);
      if (result.error) {
        errors.push(`${inv.id}: ${result.error}`);
      } else {
        if (result.synced_payments > 0 || result.new_status !== inv.status) {
          updated++;
        }
        newPayments += result.synced_payments;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${inv.id}: ${msg}`);
      console.error("[Xero cron] Error syncing invoice:", inv.id, msg);
    }

    // Rate limit: 500ms delay between invoices
    await new Promise(r => setTimeout(r, 500));
  }

  // Log to activity_logs
  await supabase.from("activity_logs").insert({
    action: "xero_auto_sync",
    entity_type: "system",
    details: {
      total_checked: invoices.length,
      updated,
      new_payments: newPayments,
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  console.log("[Xero cron] Complete. Checked:", invoices.length, "Updated:", updated, "New payments:", newPayments, "Errors:", errors.length);

  return NextResponse.json({
    ok: true,
    total_checked: invoices.length,
    updated,
    new_payments: newPayments,
    errors,
  });
}
