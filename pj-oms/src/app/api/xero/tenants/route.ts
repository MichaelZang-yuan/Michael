import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getXeroAccessToken, fetchXeroConnections } from "@/lib/xero";

/** GET: Return connected Xero tenants + current mapping */
export async function GET() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const { data: row } = await supabase
    .from("xero_tokens")
    .select(
      "tenant_id_immigration, tenant_id_international, tenant_name_immigration, tenant_name_international"
    )
    .limit(1)
    .single();

  if (!row) {
    return NextResponse.json({ connected: false, tenants: [], mapping: null });
  }

  // Fetch live tenant list from Xero
  const accessToken = await getXeroAccessToken();
  let tenants: { tenantId: string; tenantName: string; tenantType: string }[] = [];
  if (accessToken) {
    tenants = await fetchXeroConnections(accessToken);
  }

  return NextResponse.json({
    connected: true,
    tenants,
    mapping: {
      immigration: {
        tenantId: row.tenant_id_immigration,
        tenantName: row.tenant_name_immigration,
      },
      international: {
        tenantId: row.tenant_id_international,
        tenantName: row.tenant_name_international,
      },
    },
  });
}

/** POST: Save tenant mapping */
export async function POST(request: Request) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  let body: {
    tenant_id_immigration: string;
    tenant_name_immigration: string;
    tenant_id_international: string;
    tenant_name_international: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const { data: existing } = await supabase
    .from("xero_tokens")
    .select("id")
    .limit(1)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Not connected to Xero" }, { status: 400 });
  }

  await supabase
    .from("xero_tokens")
    .update({
      tenant_id_immigration: body.tenant_id_immigration,
      tenant_name_immigration: body.tenant_name_immigration,
      tenant_id_international: body.tenant_id_international,
      tenant_name_international: body.tenant_name_international,
    })
    .eq("id", existing.id);

  return NextResponse.json({ ok: true });
}
