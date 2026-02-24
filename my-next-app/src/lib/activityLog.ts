import type { SupabaseClient } from "@supabase/supabase-js";

export async function logActivity(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: object
) {
  try {
    const { error } = await supabase.from("activity_logs").insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      details: details ?? null,
    });
    if (error) console.error("Activity log error:", error);
  } catch (e) {
    console.error("Activity log exception:", e);
  }
}
