import { NextResponse } from "next/server";

type ExtractedVisa = {
  visa_type: string | null;
  visa_expiry_date: string | null;
  visa_conditions: string | null;
  visa_number: string | null;
  entry_permission: string | null;
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: { base64Data: string; fileType: "pdf" | "image"; mediaType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { base64Data, fileType, mediaType: customMediaType } = body;
  if (!base64Data || !fileType) {
    return NextResponse.json(
      { error: "base64Data and fileType are required" },
      { status: 400 }
    );
  }

  const mediaType = customMediaType ?? (fileType === "pdf" ? "application/pdf" : "image/jpeg");
  const contentType = fileType === "pdf" ? "document" : "image";

  const extractPrompt = `Extract the following information from this visa / visa sticker / eVisa image or document.
Return ONLY a JSON object with these exact fields:
- visa_type: the type of visa (e.g. "Student Visa", "Work Visa", "Visitor Visa", "Resident Visa", "Partnership Visa", etc.)
- visa_expiry_date: visa expiry date in YYYY-MM-DD format
- visa_conditions: any visa conditions mentioned (e.g. "May study full-time. May work up to 20 hours per week.")
- visa_number: the visa number or application number if visible
- entry_permission: entry permission type, e.g. "Single" or "Multiple"

If a field cannot be found, use null. Return only the JSON, no other text.`;

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
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: contentType,
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: extractPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[extract-visa] Anthropic API error:", response.status, errText);
      return NextResponse.json(
        { error: `Extraction failed: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const textContent = data.content?.find((c: { type: string }) => c.type === "text");
    const rawText = textContent?.text?.trim() ?? "";

    let parsed: ExtractedVisa;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("[extract-visa] Failed to parse JSON:", rawText);
      return NextResponse.json(
        { error: "Could not parse extracted data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      visa_type: parsed.visa_type ?? null,
      visa_expiry_date: parsed.visa_expiry_date ?? null,
      visa_conditions: parsed.visa_conditions ?? null,
      visa_number: parsed.visa_number ?? null,
      entry_permission: parsed.entry_permission ?? null,
    });
  } catch (err) {
    console.error("[extract-visa] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
