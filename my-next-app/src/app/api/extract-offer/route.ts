import { NextResponse } from "next/server";

type ExtractedData = {
  student_name: string | null;
  student_number: string | null;
  school_name: string | null;
  enrollment_date: string | null;
  tuition_fee: number | null;
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

  if (fileType !== "pdf" && fileType !== "image") {
    return NextResponse.json(
      { error: "fileType must be 'pdf' or 'image'" },
      { status: 400 }
    );
  }

  const mediaType = customMediaType ?? (fileType === "pdf" ? "application/pdf" : "image/jpeg");
  const contentType = fileType === "pdf" ? "document" : "image";

  const extractPrompt = `Extract the following information from this offer letter or invoice. 
Return ONLY a JSON object with these exact fields:
- student_name: full name of the student
- student_number: student ID number
- school_name: name of the institution
- enrollment_date: course start date in YYYY-MM-DD format. Look for these field names (in order of priority):
  * Programme Commences / Program Commences (formal course start - PREFER this if present alongside Orientation)
  * Date course starts / Course start date / Start date
  * Commencement Date
  * International Orientation Commences
  * Any date field whose name contains "start" or "commence"
  * If both "Orientation date" and "Programme Commences" exist, use Programme Commences (formal start date)
- tuition_fee: ONLY the tuition fee amount as a number. Look for these field names:
  * Tuition Fees / Tuition Fee
  * International Student Course Fee / Course Fee
  * Programme Fee / Program Fee
  * Fees Payable (BUT: if Fees Payable is a total/sum of multiple fees, prefer the separate Tuition Fee row instead of the total)
  * EXCLUDE: administration fees, registration fees, total amounts that combine multiple fee types

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
        model: "claude-opus-4-6",
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
      console.error("[extract-offer] Anthropic API error:", response.status, errText);
      return NextResponse.json(
        { error: `Extraction failed: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const textContent = data.content?.find((c: { type: string }) => c.type === "text");
    const rawText = textContent?.text?.trim() ?? "";

    let parsed: ExtractedData;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("[extract-offer] Failed to parse JSON:", rawText);
      return NextResponse.json(
        { error: "Could not parse extracted data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      student_name: parsed.student_name ?? null,
      student_number: parsed.student_number ?? null,
      school_name: parsed.school_name ?? null,
      enrollment_date: parsed.enrollment_date ?? null,
      tuition_fee: parsed.tuition_fee ?? null,
    });
  } catch (err) {
    console.error("[extract-offer] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
