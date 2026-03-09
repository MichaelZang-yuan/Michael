import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/dashboard?zoho=error", request.url));
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("[Zoho callback] Missing ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, or ZOHO_REDIRECT_URI");
    return NextResponse.redirect(new URL("/dashboard?zoho=error", request.url));
  }

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch("https://accounts.zoho.com.au/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token || !tokenData.refresh_token) {
    console.error("[Zoho callback] Token exchange failed:", tokenData);
    return NextResponse.redirect(new URL("/dashboard?zoho=error", request.url));
  }

  const expiresIn = tokenData.expires_in ?? 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("[Zoho callback] SUPABASE_SERVICE_ROLE_KEY not set");
    return NextResponse.redirect(new URL("/dashboard?zoho=error", request.url));
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const { data: existing } = await supabase.from("zoho_tokens").select("id").limit(1).single();
  if (existing) {
    const { error: updateError } = await supabase
      .from("zoho_tokens")
      .update({
        refresh_token: tokenData.refresh_token,
        access_token: tokenData.access_token,
        expires_at: expiresAt,
      })
      .eq("id", existing.id);
    if (updateError) {
      console.error("[Zoho callback] Update failed:", updateError);
      return NextResponse.redirect(new URL("/dashboard?zoho=error", request.url));
    }
  } else {
    const { error: insertError } = await supabase.from("zoho_tokens").insert({
      refresh_token: tokenData.refresh_token,
      access_token: tokenData.access_token,
      expires_at: expiresAt,
    });
    if (insertError) {
      console.error("[Zoho callback] Insert failed:", insertError);
      return NextResponse.redirect(new URL("/dashboard?zoho=error", request.url));
    }
  }

  return NextResponse.redirect(new URL("/dashboard?zoho=connected", request.url));
}
