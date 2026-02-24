import { createClient } from "@supabase/supabase-js";

const ZOHO_TOKEN_URL = "https://accounts.zoho.com.au/oauth/v2/token";
const ZOHO_CRM_BASE = "https://www.zohoapis.com.au/crm/v2";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key);
}

export async function getZohoAccessToken(): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase
    .from("zoho_tokens")
    .select("refresh_token, access_token, expires_at")
    .limit(1)
    .single();

  if (!row?.refresh_token) return null;

  const expiresAt = new Date(row.expires_at);
  const now = new Date();
  if (expiresAt.getTime() - now.getTime() > 60 * 1000) {
    return row.access_token;
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  const params = new URLSearchParams({
    refresh_token: row.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch(ZOHO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const tokenData = await res.json().catch(() => ({}));
  if (!res.ok || !tokenData.access_token) {
    console.error("[Zoho] Token refresh failed:", tokenData);
    return null;
  }

  const expiresIn = tokenData.expires_in ?? 3600;
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { data: existing } = await supabase.from("zoho_tokens").select("id").limit(1).single();
  if (existing) {
    await supabase
      .from("zoho_tokens")
      .update({
        access_token: tokenData.access_token,
        expires_at: newExpiresAt,
      })
      .eq("id", existing.id);
  }

  return tokenData.access_token;
}

export async function updateDealStatus(
  studentName: string,
  schoolName: string,
  courseName: string
): Promise<{ success: boolean; error?: string }> {
  console.log("[Zoho] Searching for contact:", studentName);

  const accessToken = await getZohoAccessToken();
  if (!accessToken) {
    const err = "No Zoho access token (not connected or refresh failed)";
    console.error("[Zoho]", err);
    return { success: false, error: err };
  }

  const criteria = `(Contact_Name:equals:${studentName})`;
  const searchUrl = `${ZOHO_CRM_BASE}/Deals/search?criteria=${encodeURIComponent(criteria)}`;

  const searchRes = await fetch(searchUrl, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  });

  const searchData = await searchRes.json().catch(() => ({}));
  console.log("[Zoho] Zoho search response:", JSON.stringify(searchData));

  if (!searchRes.ok) {
    const errMsg = searchData?.message ?? searchData?.code ?? JSON.stringify(searchData);
    console.error("[Zoho] Search failed:", errMsg);
    return { success: false, error: `Search failed: ${errMsg}` };
  }

  const deals = searchData?.data ?? [];
  console.log("[Zoho] Found deals:", JSON.stringify(deals));

  const schoolLower = schoolName.toLowerCase();
  const courseLower = courseName.toLowerCase();

  const deal = deals.find((d: Record<string, unknown>) => {
    const dealName = String(d.Deal_Name ?? "").toLowerCase();
    const accountName = String(d.Account_Name ?? "").toLowerCase();
    return (
      (dealName.includes(schoolLower) || accountName.includes(schoolLower)) &&
      (courseLower ? dealName.includes(courseLower) || accountName.includes(courseLower) : true)
    );
  });

  if (!deal?.id) {
    const err = `No matching deal for student="${studentName}", school="${schoolName}", course="${courseName}"`;
    console.warn("[Zoho]", err);
    return { success: false, error: err };
  }

  const updateRes = await fetch(`${ZOHO_CRM_BASE}/Deals/${deal.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: [{ Stage: "Completed with Commission" }],
    }),
  });

  const updateData = await updateRes.json().catch(() => ({}));
  console.log("[Zoho] Update result:", JSON.stringify(updateData));

  if (!updateRes.ok) {
    const errMsg = updateData?.message ?? updateData?.code ?? JSON.stringify(updateData);
    console.error("[Zoho] Update deal failed:", errMsg);
    return { success: false, error: `Update failed: ${errMsg}` };
  }

  return { success: true };
}
