import { createClient } from "@supabase/supabase-js";

const ZOHO_TOKEN_URL = "https://accounts.zoho.com.au/oauth/v2/token";
const ZOHO_CRM_BASE = "https://www.zohoapis.com.au/crm/v2";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key);
}

function fuzzyMatch(str1: string, str2: string): boolean {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  return s1.includes(s2) || s2.includes(s1);
}

function contactFullNameMatchesParts(contact: Record<string, unknown>, parts: string[]): boolean {
  const fullName = String(contact.Full_Name ?? "").toLowerCase();
  return parts.every((p) => p.toLowerCase() !== "" && fullName.includes(p.toLowerCase()));
}

function getContactSearchVariants(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];
  if (parts.length === 1) return [trimmed];

  const [first, second, ...rest] = parts;
  const variants: string[] = [];

  if (parts.length === 2) {
    variants.push(
      `${first} ${second}`,
      `${second} ${first}`,
      `${first.toUpperCase()} ${second}`,
      `${second} ${first.toUpperCase()}`
    );
  } else {
    const original = parts.join(" ");
    const reversed = [...parts].reverse().join(" ");
    variants.push(original, reversed);
    variants.push(`${first.toUpperCase()} ${parts.slice(1).join(" ")}`);
    variants.push(`${parts.slice(0, -1).join(" ")} ${parts[parts.length - 1]!.toUpperCase()}`);
  }

  return [...new Set(variants)];
}

function parseDateFromDeal(deal: Record<string, unknown>): Date | null {
  const dateFields = [
    "Course_Start_Date",
    "Start_Date",
    "Enrollment_Date",
    "Closing_Date",
    "Created_Time",
  ];
  for (const key of dateFields) {
    const val = deal[key];
    if (typeof val === "string") {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
    }
  }
  for (const [key, val] of Object.entries(deal)) {
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function dateDiffDays(d1: Date, d2: Date): number {
  const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
  const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
  return Math.abs(Math.round((t1 - t2) / (1000 * 60 * 60 * 24)));
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

export type UpdateDealResult = {
  success: boolean;
  error?: string;
  dealName?: string;
  dealId?: string;
  previousStage?: string;
};

export async function updateDealStatus(
  studentName: string,
  schoolName: string,
  enrollmentDate: string | null
): Promise<UpdateDealResult> {
  console.log("[Zoho] Searching for contact:", studentName);

  const accessToken = await getZohoAccessToken();
  if (!accessToken) {
    const err = "No Zoho access token (not connected or refresh failed)";
    console.error("[Zoho]", err);
    return { success: false, error: err };
  }

  async function searchContactsByCriteria(criteria: string): Promise<{ data?: unknown[] }> {
    const url = `${ZOHO_CRM_BASE}/Contacts/search?criteria=${encodeURIComponent(criteria)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return {};
    return { data: data?.data ?? [] };
  }

  const variants = getContactSearchVariants(studentName);
  const nameParts = studentName.trim().split(/\s+/).filter(Boolean);

  let contacts: Record<string, unknown>[] = [];

  for (const variant of variants) {
    const criteria = `(Full_Name:equals:${variant})`;
    const result = await searchContactsByCriteria(criteria);
    const found = (result.data ?? []) as Record<string, unknown>[];
    console.log("[Zoho] Tried variant:", variant, "-> found", found.length, "contacts");

    if (found.length > 0) {
      contacts = found;
      console.log("[Zoho] Using contacts from variant:", variant);
      break;
    }
  }

  if (contacts.length === 0 && nameParts.length > 1) {
    console.log("[Zoho] Full-name variants failed, trying each part separately...");
    const contactsByPart: Record<string, Record<string, unknown>[]> = {};
    for (const part of nameParts) {
      const criteria = `(Full_Name:equals:${part})`;
      const result = await searchContactsByCriteria(criteria);
      const found = (result.data ?? []) as Record<string, unknown>[];
      contactsByPart[part] = found;
      console.log("[Zoho] Part", part, "->", found.length, "contacts");
    }

    const idSets = nameParts.map((p) => new Set((contactsByPart[p] ?? []).map((c) => String(c.id)).filter(Boolean)));
    const commonIds = idSets.reduce<Set<string>>((acc, ids, i) => {
      if (i === 0) return new Set(ids);
      return new Set([...acc].filter((id) => ids.has(id)));
    }, new Set());

    if (commonIds.size > 0) {
      const byId = new Map<string, Record<string, unknown>>();
      for (const part of nameParts) {
        for (const c of contactsByPart[part] ?? []) {
          const id = String(c.id);
          if (commonIds.has(id) && !byId.has(id)) byId.set(id, c);
        }
      }
      contacts = [...commonIds]
        .map((id) => byId.get(id))
        .filter((c): c is Record<string, unknown> => !!c && contactFullNameMatchesParts(c, nameParts));
      console.log("[Zoho] Intersection found", contacts.length, "contacts containing all parts");
    }
  }

  if (contacts.length === 0 && nameParts.length === 1) {
    const result = await searchContactsByCriteria(`(Full_Name:equals:${nameParts[0]})`);
    contacts = (result.data ?? []) as Record<string, unknown>[];
  }

  if (contacts.length === 0) {
    const err = `No contact found for student="${studentName}" (tried variants: ${variants.join(", ")})`;
    console.warn("[Zoho]", err);
    return { success: false, error: err };
  }

  const targetEnrollmentDate = enrollmentDate ? new Date(enrollmentDate) : null;
  const matchingDeals: Record<string, unknown>[] = [];

  for (const contact of contacts as { id: string }[]) {
    const dealsUrl = `${ZOHO_CRM_BASE}/Contacts/${contact.id}/Deals?fields=Deal_Name,Stage,Account_Name,Closing_Date,Course_Start_Date,Start_Date,Created_Time`;
    const dealsRes = await fetch(dealsUrl, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    const dealsData = await dealsRes.json().catch(() => ({}));
    console.log("[Zoho] Deals for contact", contact.id, ":", JSON.stringify(dealsData));

    if (!dealsRes.ok) continue;

    const deals = dealsData?.data ?? [];
    for (const d of deals as Record<string, unknown>[]) {
      const dealName = String(d.Deal_Name ?? "");
      const accountName = String(d.Account_Name ?? "");

      if (fuzzyMatch(schoolName, dealName) || fuzzyMatch(schoolName, accountName)) {
        matchingDeals.push(d);
      }
    }
  }

  console.log("[Zoho] Matching deals:", JSON.stringify(matchingDeals));

  let bestDeal: Record<string, unknown> | null = null;
  if (matchingDeals.length === 0) {
  } else if (targetEnrollmentDate && matchingDeals.length > 0) {
    let bestDiff = Infinity;
    for (const d of matchingDeals) {
      const dealDate = parseDateFromDeal(d);
      if (dealDate) {
        const diff = dateDiffDays(dealDate, targetEnrollmentDate);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestDeal = d;
        }
      } else if (bestDeal === null) {
        bestDeal = d;
      }
    }
    if (bestDeal === null) bestDeal = matchingDeals[0];
  } else {
    bestDeal = matchingDeals[0];
  }

  if (!bestDeal?.id) {
    const err = `No matching deal for student="${studentName}", school="${schoolName}"${enrollmentDate ? `, enrollment="${enrollmentDate}"` : ""}`;
    console.warn("[Zoho]", err);
    return { success: false, error: err };
  }

  const previousStage = String(bestDeal.Stage ?? "");
  const dealName = String(bestDeal.Deal_Name ?? bestDeal.id);

  const updateRes = await fetch(`${ZOHO_CRM_BASE}/Deals/${bestDeal.id}`, {
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

  return {
    success: true,
    dealName,
    dealId: String(bestDeal.id),
    previousStage,
  };
}
