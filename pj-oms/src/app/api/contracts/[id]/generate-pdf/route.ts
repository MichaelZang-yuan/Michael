import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateAndUploadContractPdf } from "@/lib/contractPdf";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SUFFIX_MAP: Record<string, string> = {
  draft: "Contract-Draft",
  lia_signed: "Contract-LIA-Signed",
  fully_signed: "Contract-Fully-Signed",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const type = (body.type as string) || "draft";

    const { data: contract, error: contractErr } = await supabase
      .from("deal_contracts")
      .select("id, deal_id, contract_html, content")
      .eq("id", id)
      .single();

    if (contractErr || !contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const { data: deal } = await supabase
      .from("deals")
      .select("deal_number")
      .eq("id", contract.deal_id)
      .single();

    const dealNumber = deal?.deal_number ?? "Contract";
    const suffix = SUFFIX_MAP[type] ?? "Contract";
    const filename = `${dealNumber}-${suffix}.pdf`;

    const html = contract.contract_html ?? contract.content ?? "";
    if (!html) {
      return NextResponse.json({ error: "No contract content" }, { status: 400 });
    }

    const url = await generateAndUploadContractPdf(html, contract.deal_id, filename);
    if (!url) {
      return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
