import { NextResponse } from "next/server";

type ChecklistItem = {
  item_name: string;
  required: boolean;
  notes: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: { visa_type: string; description?: string; applicant_info?: string; deal_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { visa_type, description, applicant_info, deal_type } = body;
  if (!visa_type) {
    return NextResponse.json({ error: "visa_type is required" }, { status: 400 });
  }

  const systemPrompt = `You are an expert New Zealand immigration consultant. You have deep knowledge of document requirements for all NZ visa types including:
- AEWV (Accredited Employer Work Visa)
- SV (Student Visa)
- RV (Resident Visa)
- WV (Work Visa - general)
- Partnership (Partner of a New Zealander)
- SMC (Skilled Migrant Category)
- Visitor Visa
- Post Study Work Visa
- Essential Skills Work Visa

For each visa type, you know exactly which documents are required, which are optional/supporting, and any special notes about document requirements.

Return a JSON object with an "items" array. Each item has:
- item_name: name of the document (e.g. "Passport", "Police Certificate")
- required: boolean (true if mandatory, false if supporting/optional)
- notes: brief note about the document requirement (e.g. "Must be valid for at least 6 months beyond intended stay", "Certified translation required if not in English")`;

  const userPrompt = `Generate a comprehensive document checklist for a New Zealand ${visa_type} visa application.
${description ? `\nCase description: ${description}` : ""}
${applicant_info ? `\nApplicant info: ${applicant_info}` : ""}
${deal_type ? `\nDeal type: ${deal_type}` : ""}

Return ONLY the JSON object with the "items" array, no other text.`;

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
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[generate-checklist] Anthropic API error:", response.status, errText);
      return NextResponse.json(
        { error: `Generation failed: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const textContent = data.content?.find((c: { type: string }) => c.type === "text");
    const rawText = textContent?.text?.trim() ?? "";

    let parsed: { items: ChecklistItem[] };
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("[generate-checklist] Failed to parse JSON:", rawText);
      return NextResponse.json(
        { error: "Could not parse generated checklist" },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: parsed.items ?? [] });
  } catch (err) {
    console.error("[generate-checklist] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
