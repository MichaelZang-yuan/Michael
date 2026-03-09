import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { signature, signed_by } = await req.json();

    if (!signature) return NextResponse.json({ error: "signature required" }, { status: 400 });

    const { data: contract, error: fetchErr } = await supabase
      .from("deal_contracts")
      .select("id, status, contract_html, content")
      .eq("id", id)
      .single();
    if (fetchErr || !contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

    const now = new Date();
    const signDate = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    const currentHtml = contract.contract_html ?? contract.content ?? "";
    const sigImg = `<img src="${signature}" style="max-height:80px;max-width:240px;" alt="Adviser signature" />`;
    let updatedHtml = currentHtml.includes("{{adviser_signature}}")
      ? currentHtml.replace("{{adviser_signature}}", sigImg)
      : currentHtml;
    if (updatedHtml.includes("{{adviser_sign_date}}")) {
      updatedHtml = updatedHtml.replace("{{adviser_sign_date}}", signDate);
    }

    const { error } = await supabase
      .from("deal_contracts")
      .update({
        adviser_signature: signature,
        adviser_signed_at: now.toISOString(),
        adviser_signed_by: signed_by ?? null,
        status: "lia_signed",
        lia_signed_date: now.toISOString().split("T")[0],
        contract_html: updatedHtml,
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
