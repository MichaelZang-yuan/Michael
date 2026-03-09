import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const { data: contract, error: fetchErr } = await supabase
      .from("deal_contracts")
      .select("id, deal_id, status")
      .eq("id", id)
      .single();
    if (fetchErr || !contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    if (contract.status === "sent_to_client" || contract.status === "completed") {
      return NextResponse.json({ error: "Contract already sent to client" }, { status: 400 });
    }

    const token = crypto.randomUUID();

    const { error } = await supabase
      .from("deal_contracts")
      .update({
        status: "sent_to_client",
        client_sign_token: token,
        sent_date: new Date().toISOString().split("T")[0],
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, token });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
