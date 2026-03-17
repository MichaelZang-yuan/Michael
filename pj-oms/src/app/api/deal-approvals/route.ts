import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — Create approval request
export async function POST(request: Request) {
  let body: { deal_id: string; requested_by: string; assigned_to: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { deal_id, requested_by, assigned_to } = body;
  if (!deal_id || !requested_by || !assigned_to) {
    return NextResponse.json({ error: "deal_id, requested_by, and assigned_to are required" }, { status: 400 });
  }

  // Cancel any existing pending approvals for this deal
  await supabase
    .from("deal_approvals")
    .update({ status: "cancelled" })
    .eq("deal_id", deal_id)
    .eq("status", "pending");

  // Create new approval record
  const { data: approval, error: approvalErr } = await supabase
    .from("deal_approvals")
    .insert({
      deal_id,
      requested_by,
      assigned_to,
      status: "pending",
    })
    .select()
    .single();

  if (approvalErr) {
    return NextResponse.json({ error: approvalErr.message }, { status: 500 });
  }

  // Update deal approval_status
  await supabase
    .from("deals")
    .update({ approval_status: "pending_approval" })
    .eq("id", deal_id);

  // Fetch deal info and names for notification
  const { data: dealData } = await supabase
    .from("deals")
    .select("deal_number, contact_id, contacts(first_name, last_name), companies(company_name)")
    .eq("id", deal_id)
    .single();

  const { data: requesterProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", requested_by)
    .single();

  const contacts = dealData?.contacts as unknown as { first_name: string; last_name: string } | null;
  const companies = dealData?.companies as unknown as { company_name: string } | null;
  const clientName = contacts
    ? `${contacts.first_name} ${contacts.last_name}`
    : companies?.company_name ?? "Unknown";

  // Create notification for LIA
  await supabase.from("notifications").insert({
    user_id: assigned_to,
    title: "New Deal Approval Request",
    message: `${requesterProfile?.full_name ?? "A sales member"} has requested your approval for deal ${dealData?.deal_number ?? ""} (${clientName}).`,
    type: "deal_approval_request",
    deal_id,
    link: `/deals/${deal_id}`,
  });

  // Log activity
  await supabase.from("activity_logs").insert({
    user_id: requested_by,
    action: "deal_approval_requested",
    entity_type: "deals",
    entity_id: deal_id,
    details: { deal_number: dealData?.deal_number, assigned_to },
  });

  return NextResponse.json({ ok: true, approval });
}
