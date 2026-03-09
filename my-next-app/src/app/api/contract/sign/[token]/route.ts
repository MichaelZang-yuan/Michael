import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — load contract for public sign page
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: contract, error } = await supabase
    .from("deal_contracts")
    .select("id, status, contract_html, content, client_signed_at, deal_id")
    .eq("client_sign_token", token)
    .single();

  if (error || !contract) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });

  // Fetch deal + client info for display
  const { data: deal } = await supabase
    .from("deals")
    .select("deal_number, contacts(first_name, last_name), companies(company_name)")
    .eq("id", contract.deal_id)
    .single();

  return NextResponse.json({
    id: contract.id,
    status: contract.status,
    html: contract.contract_html ?? contract.content ?? "",
    client_signed_at: contract.client_signed_at,
    client_name: deal?.contacts
      ? (() => { const c = (deal.contacts as unknown as { first_name: string; last_name: string }[])[0]; return c ? `${c.first_name} ${c.last_name}` : ""; })()
      : (deal?.companies as unknown as { company_name: string }[] | null)?.[0]?.company_name ?? "",
    deal_number: deal?.deal_number ?? "",
  });
}

// POST — client submits signature
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { signature } = await req.json();

    if (!signature) return NextResponse.json({ error: "signature required" }, { status: 400 });

    const { data: contract, error: fetchErr } = await supabase
      .from("deal_contracts")
      .select("id, status, contract_html, content, deal_id")
      .eq("client_sign_token", token)
      .single();

    if (fetchErr || !contract) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
    if (contract.status === "completed") return NextResponse.json({ error: "Already signed" }, { status: 400 });
    if (contract.status !== "sent_to_client") return NextResponse.json({ error: "Contract is not ready for client signature" }, { status: 400 });

    // Embed client signature into contract_html
    const now = new Date();
    const signDate = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    const currentHtml = contract.contract_html ?? contract.content ?? "";
    const sigImg = `<img src="${signature}" style="max-height:80px;max-width:240px;" alt="Client signature" />`;
    let updatedHtml = currentHtml.includes("{{client_signature}}")
      ? currentHtml.replace("{{client_signature}}", sigImg)
      : currentHtml;
    if (updatedHtml.includes("{{client_sign_date}}")) {
      updatedHtml = updatedHtml.replace("{{client_sign_date}}", signDate);
    }

    const { error } = await supabase
      .from("deal_contracts")
      .update({
        client_signature: signature,
        client_signed_at: new Date().toISOString(),
        client_signed_date: new Date().toISOString().split("T")[0],
        status: "completed",
        completed_date: new Date().toISOString().split("T")[0],
        contract_html: updatedHtml,
      })
      .eq("id", contract.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-advance deal status to contracted if still in draft/quoted
    const { data: deal } = await supabase.from("deals").select("status").eq("id", contract.deal_id).single();
    if (deal && ["draft", "quoted"].includes(deal.status)) {
      await supabase.from("deals").update({ status: "contracted" }).eq("id", contract.deal_id);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
