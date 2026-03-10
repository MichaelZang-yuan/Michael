import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateAndUploadCoverLetterPdf } from "@/lib/coverLetterPdf";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: coverLetter, error: clErr } = await supabase
      .from("cover_letters")
      .select("id, deal_id, content")
      .eq("id", id)
      .single();

    if (clErr || !coverLetter) {
      return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });
    }

    if (!coverLetter.content) {
      return NextResponse.json({ error: "No cover letter content" }, { status: 400 });
    }

    const { data: deal } = await supabase
      .from("deals")
      .select("deal_number")
      .eq("id", coverLetter.deal_id)
      .single();

    const dealNumber = deal?.deal_number ?? "Deal";
    const filename = `${dealNumber}-Cover-Letter.pdf`;

    const url = await generateAndUploadCoverLetterPdf(
      coverLetter.content,
      coverLetter.deal_id,
      filename
    );

    if (!url) {
      return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
    }

    // Update pdf_url on the cover letter record
    await supabase
      .from("cover_letters")
      .update({ pdf_url: url })
      .eq("id", id);

    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
