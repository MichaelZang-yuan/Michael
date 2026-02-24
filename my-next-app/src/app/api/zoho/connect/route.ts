import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL("/dashboard?zoho=error", request.url));
  }

  const authUrl = new URL("https://accounts.zoho.com.au/oauth/v2/auth");
  authUrl.searchParams.set("scope", "ZohoCRM.modules.deals.ALL,ZohoCRM.modules.contacts.READ");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("access_type", "offline");

  return NextResponse.redirect(authUrl.toString());
}
