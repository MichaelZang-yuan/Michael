import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.XERO_CLIENT_ID;
  const redirectUri = process.env.XERO_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL("/settings/xero?error=config", request.url));
  }

  const authUrl = new URL("https://login.xero.com/identity/connect/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set(
    "scope",
    "openid profile email accounting.transactions accounting.contacts offline_access"
  );

  return NextResponse.redirect(authUrl.toString());
}
