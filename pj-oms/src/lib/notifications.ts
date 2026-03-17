import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function createNotification({
  supabase,
  userId,
  title,
  message,
  type,
  dealId,
  link,
  sendEmail,
}: {
  supabase?: SupabaseClient;
  userId: string;
  title: string;
  message: string;
  type: string;
  dealId?: string;
  link?: string;
  sendEmail?: boolean;
}): Promise<void> {
  const client = supabase ?? getAdminClient();

  const { data: notification } = await client.from("notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    deal_id: dealId ?? null,
    link: link ?? null,
    email_sent: false,
  }).select("id").single();

  if (sendEmail && notification) {
    try {
      // Get user email
      const { data: profile } = await client
        .from("profiles")
        .select("email, full_name")
        .eq("id", userId)
        .single();

      if (profile?.email) {
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";

        const res = await fetch(`${baseUrl}/api/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email_type: type,
            deal_id: dealId,
            recipient_email: profile.email,
            recipient_name: profile.full_name ?? "Team",
            extra_data: { title, message },
          }),
        });

        if (res.ok) {
          await client
            .from("notifications")
            .update({ email_sent: true })
            .eq("id", notification.id);
        }
      }
    } catch (err) {
      console.warn("[notifications] Failed to send email:", err);
    }
  }
}

export async function notifyDealTeam({
  supabase,
  dealId,
  title,
  message,
  type,
  roles,
  excludeUserId,
  sendEmail,
}: {
  supabase?: SupabaseClient;
  dealId: string;
  title: string;
  message: string;
  type: string;
  roles: ("sales" | "lia" | "copywriter")[];
  excludeUserId?: string;
  sendEmail?: boolean;
}): Promise<void> {
  const client = supabase ?? getAdminClient();

  const { data: deal } = await client
    .from("deals")
    .select("assigned_sales_id, assigned_lia_id, assigned_copywriter_id, created_by")
    .eq("id", dealId)
    .single();

  if (!deal) return;

  const userIds = new Set<string>();
  if (roles.includes("sales")) {
    if (deal.assigned_sales_id) userIds.add(deal.assigned_sales_id);
    if (deal.created_by) userIds.add(deal.created_by);
  }
  if (roles.includes("lia") && deal.assigned_lia_id) {
    userIds.add(deal.assigned_lia_id);
  }
  if (roles.includes("copywriter") && deal.assigned_copywriter_id) {
    userIds.add(deal.assigned_copywriter_id);
  }

  if (excludeUserId) userIds.delete(excludeUserId);

  const link = `/deals/${dealId}`;

  for (const userId of userIds) {
    await createNotification({
      supabase: client,
      userId,
      title,
      message,
      type,
      dealId,
      link,
      sendEmail,
    });
  }
}

export async function notifyAllAdmins({
  supabase,
  title,
  message,
  type,
  dealId,
  link,
}: {
  supabase?: SupabaseClient;
  title: string;
  message: string;
  type: string;
  dealId?: string;
  link?: string;
}): Promise<void> {
  const client = supabase ?? getAdminClient();

  const { data: admins } = await client
    .from("profiles")
    .select("id")
    .overlaps("roles", ["admin"]);

  if (!admins) return;

  for (const admin of admins) {
    await createNotification({
      supabase: client,
      userId: admin.id,
      title,
      message,
      type,
      dealId,
      link,
    });
  }
}
