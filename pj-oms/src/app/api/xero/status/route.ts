import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ connected: false });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const { data } = await supabase
    .from("xero_tokens")
    .select(
      "id, tenant_id_immigration, tenant_id_international, tenant_name_immigration, tenant_name_international, connected_at"
    )
    .limit(1)
    .single();

  if (!data) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    tenantImmigration: data.tenant_name_immigration,
    tenantInternational: data.tenant_name_international,
    connectedAt: data.connected_at,
    needsMapping:
      !data.tenant_id_immigration || !data.tenant_id_international,
  });
}
