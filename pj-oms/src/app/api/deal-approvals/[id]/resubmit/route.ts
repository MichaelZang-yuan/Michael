import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — Resubmit a declined approval
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { requested_by: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Fetch the old approval
  const { data: oldApproval, error: fetchErr } = await supabase
    .from("deal_approvals")
    .select("deal_id, assigned_to")
    .eq("id", id)
    .single();

  if (fetchErr || !oldApproval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  // Cancel the old one
  await supabase
    .from("deal_approvals")
    .update({ status: "cancelled" })
    .eq("id", id);

  // Create new pending approval
  const { data: newApproval, error: insertErr } = await supabase
    .from("deal_approvals")
    .insert({
      deal_id: oldApproval.deal_id,
      requested_by: body.requested_by,
      assigned_to: oldApproval.assigned_to,
      status: "pending",
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Update deal status
  await supabase
    .from("deals")
    .update({ approval_status: "pending_approval" })
    .eq("id", oldApproval.deal_id);

  // Fetch info for notification
  const { data: dealData } = await supabase
    .from("deals")
    .select("deal_number")
    .eq("id", oldApproval.deal_id)
    .single();

  const { data: requesterProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", body.requested_by)
    .single();

  // Notify LIA
  await supabase.from("notifications").insert({
    user_id: oldApproval.assigned_to,
    title: "Deal Resubmitted for Approval",
    message: `${requesterProfile?.full_name ?? "A sales member"} has resubmitted deal ${dealData?.deal_number ?? ""} for your approval.`,
    type: "deal_approval_request",
    deal_id: oldApproval.deal_id,
    link: `/deals/${oldApproval.deal_id}`,
  });

  // Log activity
  await supabase.from("activity_logs").insert({
    user_id: body.requested_by,
    action: "deal_approval_resubmitted",
    entity_type: "deals",
    entity_id: oldApproval.deal_id,
    details: { deal_number: dealData?.deal_number },
  });

  return NextResponse.json({ ok: true, approval: newApproval });
}
