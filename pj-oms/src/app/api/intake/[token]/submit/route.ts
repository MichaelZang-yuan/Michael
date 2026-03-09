import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/intake/[token]/submit — submit the form
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getAdminClient();

  let body: { data: Record<string, unknown>; language?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: formData, language } = body;

  // Verify form exists and is not already submitted
  const { data: form } = await supabase
    .from("intake_forms")
    .select("id, deal_id, status, template_id, contact_id")
    .eq("unique_token", token)
    .single();

  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  if (form.status === "submitted" || form.status === "completed") {
    return NextResponse.json({ error: "Form already submitted" }, { status: 400 });
  }

  // Extract client name and email from form data
  const clientName = extractClientName(formData);
  const clientEmail = extractClientEmail(formData);

  // Update form to submitted
  const { error: updateError } = await supabase
    .from("intake_forms")
    .update({
      form_data: formData,
      draft_data: formData,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      last_saved_at: new Date().toISOString(),
      language: language ?? "en",
      client_name: clientName,
      client_email: clientEmail,
      progress: 100,
      completed_date: new Date().toISOString().split("T")[0],
    })
    .eq("id", form.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Send notification email to LIA/Sales (non-critical)
  if (form.deal_id) {
    try {
      const { data: deal } = await supabase
        .from("deals")
        .select("deal_number, assigned_lia:profiles!assigned_lia_id(full_name, id), assigned_sales:profiles!assigned_sales_id(full_name, id)")
        .eq("id", form.deal_id)
        .single();

      if (deal) {
        const liaProfile = deal.assigned_lia as unknown as { full_name: string; id: string } | null;
        const salesProfile = deal.assigned_sales as unknown as { full_name: string; id: string } | null;

        // Get recipient email from profiles
        const recipientId = liaProfile?.id ?? salesProfile?.id;
        if (recipientId) {
          const { data: recipientProfile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", recipientId)
            .single();

          if (recipientProfile?.email) {
            const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost")
              ? "http://localhost:3000"
              : "https://pjcommission.com";

            await fetch(`${baseUrl}/api/send-notification`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email_type: "intake_completed",
                deal_id: form.deal_id,
                recipient_email: recipientProfile.email,
                recipient_name: liaProfile?.full_name ?? salesProfile?.full_name ?? "Team",
                extra_data: {
                  deal_number: deal.deal_number,
                  client_name: clientName,
                },
              }),
            }).catch(() => {});
          }
        }
      }
    } catch {
      // Non-critical — don't fail the submission
    }
  }

  return NextResponse.json({
    success: true,
    client_name: clientName,
    client_email: clientEmail,
  });
}

function extractClientName(data: Record<string, unknown>): string {
  // Try name fields
  const nameObj = data["full_name"] as Record<string, string> | undefined;
  if (nameObj && typeof nameObj === "object") {
    const parts = [nameObj.first_name, nameObj.middle_name, nameObj.last_name].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
  }
  // Fallback to text fields
  for (const key of ["full_name", "name", "legal_name", "form_filler_name"]) {
    if (typeof data[key] === "string" && data[key]) return data[key] as string;
  }
  return "";
}

function extractClientEmail(data: Record<string, unknown>): string {
  for (const key of ["email", "client_email", "form_filler_email"]) {
    if (typeof data[key] === "string" && data[key]) return data[key] as string;
  }
  return "";
}
