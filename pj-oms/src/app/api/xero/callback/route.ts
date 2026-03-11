import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/settings/xero?error=no_code", request.url));
  }

  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const redirectUri = process.env.XERO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("[Xero callback] Missing env vars");
    return NextResponse.redirect(new URL("/settings/xero?error=config", request.url));
  }

  // Exchange code for tokens
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenRes = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token) {
    console.error("[Xero callback] Token exchange failed:", tokenData);
    return NextResponse.redirect(new URL("/settings/xero?error=token", request.url));
  }

  const expiresIn = tokenData.expires_in ?? 1800;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Fetch connected tenants
  const connRes = await fetch("https://api.xero.com/connections", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const connections = await connRes.json().catch(() => []);
  const tenants = Array.isArray(connections)
    ? (connections as { tenantId: string; tenantName: string }[])
    : [];

  // Auto-map tenants by name
  let tenantIdImmigration: string | null = null;
  let tenantNameImmigration: string | null = null;
  let tenantIdInternational: string | null = null;
  let tenantNameInternational: string | null = null;

  for (const t of tenants) {
    const name = t.tenantName.toLowerCase();
    if (name.includes("immigration")) {
      tenantIdImmigration = t.tenantId;
      tenantNameImmigration = t.tenantName;
    }
    if (name.includes("international")) {
      tenantIdInternational = t.tenantId;
      tenantNameInternational = t.tenantName;
    }
  }

  // If only one tenant, assign both
  if (tenants.length === 1) {
    const t = tenants[0];
    if (!tenantIdImmigration) {
      tenantIdImmigration = t.tenantId;
      tenantNameImmigration = t.tenantName;
    }
    if (!tenantIdInternational) {
      tenantIdInternational = t.tenantId;
      tenantNameInternational = t.tenantName;
    }
  }

  // Save to DB
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("[Xero callback] SUPABASE_SERVICE_ROLE_KEY not set");
    return NextResponse.redirect(new URL("/settings/xero?error=db", request.url));
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const tokenRow = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: expiresAt,
    tenant_id_immigration: tenantIdImmigration,
    tenant_id_international: tenantIdInternational,
    tenant_name_immigration: tenantNameImmigration,
    tenant_name_international: tenantNameInternational,
    connected_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("xero_tokens")
    .select("id")
    .limit(1)
    .single();

  if (existing) {
    await supabase.from("xero_tokens").update(tokenRow).eq("id", existing.id);
  } else {
    await supabase.from("xero_tokens").insert(tokenRow);
  }

  // Redirect to settings page — if tenants need manual mapping, user can do it there
  const needsMapping = !tenantIdImmigration || !tenantIdInternational;
  const redirectUrl = needsMapping
    ? "/settings/xero?connected=true&needs_mapping=true"
    : "/settings/xero?connected=true";

  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
