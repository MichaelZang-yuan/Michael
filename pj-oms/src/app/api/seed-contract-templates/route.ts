import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { insertContractTemplates } from "@/lib/contract-templates-data";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // Require admin Bearer token (same pattern as seed-intake-templates)
  const auth = req.headers.get("authorization");
  const adminToken = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!auth || auth !== `Bearer ${adminToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const error = await insertContractTemplates(supabase);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: "6 contract templates inserted." });
}
