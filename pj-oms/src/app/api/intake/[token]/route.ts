import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/intake/[token] — load form data
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getAdminClient();

  const { data: form, error } = await supabase
    .from("intake_forms")
    .select("id, deal_id, form_type, status, form_data, draft_data, template_id, unique_token, language, progress, last_saved_at, submitted_at, client_name, client_email, sent_date, completed_date")
    .eq("unique_token", token)
    .single();

  if (error || !form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  if (form.status === "submitted" || form.status === "completed") {
    return NextResponse.json({ status: "submitted", form });
  }

  let template = null;
  if (form.template_id) {
    const { data: tmpl } = await supabase
      .from("intake_form_templates")
      .select("id, name, fields, language_options, category, description")
      .eq("id", form.template_id)
      .single();
    template = tmpl;
  }

  // Get deal info for display
  let deal = null;
  if (form.deal_id) {
    const { data: dealData } = await supabase
      .from("deals")
      .select("deal_number, visa_type, deal_type, contacts(first_name, last_name), companies(company_name)")
      .eq("id", form.deal_id)
      .single();
    deal = dealData;
  }

  return NextResponse.json({ status: form.status, form, template, deal });
}

// PUT /api/intake/[token] — save draft
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getAdminClient();

  let body: { draft_data?: Record<string, unknown>; language?: string; progress?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Verify token exists
  const { data: form } = await supabase
    .from("intake_forms")
    .select("id, status")
    .eq("unique_token", token)
    .single();

  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  if (form.status === "submitted" || form.status === "completed") {
    return NextResponse.json({ error: "Form already submitted" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    last_saved_at: new Date().toISOString(),
  };
  if (body.draft_data !== undefined) updates.draft_data = body.draft_data;
  if (body.language !== undefined) updates.language = body.language;
  if (body.progress !== undefined) updates.progress = body.progress;
  if (form.status === "sent") updates.status = "in_progress";

  const { error } = await supabase
    .from("intake_forms")
    .update(updates)
    .eq("id", form.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, last_saved_at: updates.last_saved_at });
}
