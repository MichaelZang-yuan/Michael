import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: { deal_id: string; additional_notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { deal_id, additional_notes } = body;
  if (!deal_id) {
    return NextResponse.json({ error: "deal_id is required" }, { status: 400 });
  }

  // Fetch deal data server-side using service role key
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select("*, contacts(first_name, last_name, email, nationality, passport_number, date_of_birth, gender, current_visa_type, address, employer, school, marital_status), companies(company_name, email, address)")
    .eq("id", deal_id)
    .single();

  if (dealErr || !deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  // Fetch applicants
  const { data: applicants } = await supabase
    .from("deal_applicants")
    .select("relationship, notes, contacts(first_name, last_name, nationality, passport_number, date_of_birth, gender)")
    .eq("deal_id", deal_id);

  // Fetch latest intake form data if available
  const { data: intakeForm } = await supabase
    .from("intake_forms")
    .select("form_data, draft_data, status")
    .eq("deal_id", deal_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const contact = deal.contacts;
  const clientName = contact
    ? `${contact.first_name} ${contact.last_name}`
    : deal.companies?.company_name ?? "Client";

  // Build context for the AI
  const contextParts: string[] = [];
  contextParts.push(`Client Name: ${clientName}`);
  if (contact?.nationality) contextParts.push(`Nationality: ${contact.nationality}`);
  if (contact?.passport_number) contextParts.push(`Passport Number: ${contact.passport_number}`);
  if (contact?.date_of_birth) contextParts.push(`Date of Birth: ${contact.date_of_birth}`);
  if (contact?.gender) contextParts.push(`Gender: ${contact.gender}`);
  if (contact?.current_visa_type) contextParts.push(`Current Visa: ${contact.current_visa_type}`);
  if (contact?.address) contextParts.push(`Address: ${contact.address}`);
  if (contact?.employer) contextParts.push(`Employer: ${contact.employer}`);
  if (contact?.school) contextParts.push(`School: ${contact.school}`);
  if (contact?.marital_status) contextParts.push(`Marital Status: ${contact.marital_status}`);
  if (deal.visa_type) contextParts.push(`Visa Type Applied For: ${deal.visa_type}`);
  if (deal.deal_type) contextParts.push(`Deal Type: ${deal.deal_type.replace(/_/g, " ")}`);
  if (deal.description) contextParts.push(`Case Description: ${deal.description}`);

  if (applicants && applicants.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appInfo = applicants.map((a: any) => {
      const c = a.contacts;
      if (!c) return "";
      const contact = Array.isArray(c) ? c[0] : c;
      if (!contact) return "";
      return `${contact.first_name} ${contact.last_name} (${a.relationship ?? "applicant"}, ${contact.nationality ?? "unknown nationality"})`;
    }).filter(Boolean).join("; ");
    if (appInfo) contextParts.push(`Other Applicants: ${appInfo}`);
  }

  if (intakeForm && (intakeForm.status === "submitted" || intakeForm.status === "completed")) {
    const formData = intakeForm.form_data ?? intakeForm.draft_data ?? {};
    const relevantFields = Object.entries(formData)
      .filter(([, v]) => v !== null && v !== undefined && v !== "" && typeof v !== "object")
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
      .slice(0, 20);
    if (relevantFields.length > 0) {
      contextParts.push(`\nIntake Form Data:\n${relevantFields.join("\n")}`);
    }
  }

  const systemPrompt = `You are an expert New Zealand Licensed Immigration Adviser writing a formal cover letter to Immigration New Zealand (INZ) in support of a visa application.

Write a professional, well-structured cover letter that:
1. Is addressed to "Immigration Officer, Immigration New Zealand"
2. Clearly states the type of visa being applied for
3. Introduces the applicant(s) and provides relevant background
4. Explains why the application should be approved, referencing relevant immigration criteria
5. Highlights key supporting evidence and documents
6. Is written in a formal, professional tone
7. Ends with a polite closing requesting favourable consideration
8. Uses proper letter formatting with paragraphs

${additional_notes ? `IMPORTANT: The Licensed Immigration Adviser has provided additional notes below. These notes contain critical context about the client's circumstances, strengths, and key points to emphasize. You MUST prioritize these notes and use them to personalize the cover letter. Do NOT write generic boilerplate — tailor every paragraph to reflect the adviser's specific guidance.` : ""}

Do NOT include placeholder brackets like [insert date]. Use the information provided to write a complete letter. If certain information is not available, omit that section rather than using placeholders.

Sign the letter as "Licensed Immigration Adviser" without a specific name (the adviser will add their details).`;

  let userPrompt = `Write a cover letter to INZ for the following visa application:\n\n${contextParts.join("\n")}`;
  if (additional_notes?.trim()) {
    userPrompt += `\n\n--- ADVISER'S ADDITIONAL NOTES (prioritize this information) ---\n${additional_notes.trim()}`;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[generate-cover-letter] Anthropic API error:", response.status, errText);
      return NextResponse.json(
        { error: `Generation failed: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const textContent = data.content?.find((c: { type: string }) => c.type === "text");
    const content = textContent?.text?.trim() ?? "";

    if (!content) {
      return NextResponse.json(
        { error: "No content generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({ content });
  } catch (err) {
    console.error("[generate-cover-letter] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
