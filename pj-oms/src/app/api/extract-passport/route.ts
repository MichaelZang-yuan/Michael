import { NextResponse } from "next/server";

type ExtractedPassport = {
  full_name: string | null;
  passport_number: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  expiry_date: string | null;
  gender: string | null;
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

  const extractPrompt = `Extract the following information from this passport image or document.
Return ONLY a JSON object with these exact fields:
- full_name: full name as shown on the passport (combine surname and given names)
- passport_number: the passport number
- nationality: nationality / country of citizenship
- date_of_birth: date of birth in YYYY-MM-DD format
- expiry_date: passport expiry date in YYYY-MM-DD format
- gender: "male" or "female" (lowercase)

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
      console.error("[extract-passport] Anthropic API error:", response.status, errText);
      return NextResponse.json(
        { error: `Extraction failed: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const textContent = data.content?.find((c: { type: string }) => c.type === "text");
    const rawText = textContent?.text?.trim() ?? "";

    let parsed: ExtractedPassport;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("[extract-passport] Failed to parse JSON:", rawText);
      return NextResponse.json(
        { error: "Could not parse extracted data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      full_name: parsed.full_name ?? null,
      passport_number: parsed.passport_number ?? null,
      nationality: parsed.nationality ?? null,
      date_of_birth: parsed.date_of_birth ?? null,
      expiry_date: parsed.expiry_date ?? null,
      gender: parsed.gender ?? null,
    });
  } catch (err) {
    console.error("[extract-passport] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
