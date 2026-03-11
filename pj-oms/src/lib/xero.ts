import { createClient } from "@supabase/supabase-js";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key);
}

/** Get a valid Xero access token, refreshing if needed */
export async function getXeroAccessToken(): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase
    .from("xero_tokens")
    .select("refresh_token, access_token, expires_at")
    .limit(1)
    .single();

  if (!row?.refresh_token) return null;

  const expiresAt = new Date(row.expires_at);
  const now = new Date();
  if (expiresAt.getTime() - now.getTime() > 60 * 1000) {
    return row.access_token;
  }

  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    }).toString(),
  });

  const tokenData = await res.json().catch(() => ({}));
  if (!res.ok || !tokenData.access_token) {
    console.error("[Xero] Token refresh failed:", tokenData);
    return null;
  }

  const expiresIn = tokenData.expires_in ?? 1800;
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { data: existing } = await supabase
    .from("xero_tokens")
    .select("id")
    .limit(1)
    .single();
  if (existing) {
    await supabase
      .from("xero_tokens")
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? row.refresh_token,
        expires_at: newExpiresAt,
      })
      .eq("id", existing.id);
  }

  return tokenData.access_token;
}

/** Get the stored tenant IDs */
export async function getXeroTenants(): Promise<{
  immigration: string | null;
  international: string | null;
}> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("xero_tokens")
    .select("tenant_id_immigration, tenant_id_international")
    .limit(1)
    .single();
  return {
    immigration: data?.tenant_id_immigration ?? null,
    international: data?.tenant_id_international ?? null,
  };
}

/** Fetch connected tenants from Xero Connections API */
export async function fetchXeroConnections(
  accessToken: string
): Promise<{ tenantId: string; tenantName: string; tenantType: string }[]> {
  const res = await fetch(XERO_CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error("[Xero] Failed to fetch connections:", await res.text());
    return [];
  }
  const data = await res.json();
  return (data as { tenantId: string; tenantName: string; tenantType: string }[]).map(
    (c) => ({
      tenantId: c.tenantId,
      tenantName: c.tenantName,
      tenantType: c.tenantType,
    })
  );
}

// ─── Xero Contacts ───

export async function getXeroContacts(
  accessToken: string,
  tenantId: string,
  nameOrEmail?: string
): Promise<Record<string, unknown>[]> {
  let url = `${XERO_API_BASE}/Contacts`;
  if (nameOrEmail) {
    // Xero expects the where clause to NOT be double-encoded in the value
    const escaped = nameOrEmail.replace(/"/g, '\\"');
    url += `?where=${encodeURIComponent(`Name=="${escaped}"`)}`;
  }
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-Tenant-Id": tenantId,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    console.error("[Xero] Get contacts failed:", res.status, await res.text().catch(() => ""));
    return [];
  }
  const data = await res.json();
  return data?.Contacts ?? [];
}

export async function createXeroContact(
  accessToken: string,
  tenantId: string,
  contact: {
    Name: string;
    FirstName?: string;
    LastName?: string;
    EmailAddress?: string;
  }
): Promise<{ ContactID: string } | null> {
  const reqBody = JSON.stringify({ Contacts: [contact] });
  console.log("[Xero] Creating contact:", reqBody);
  const res = await fetch(`${XERO_API_BASE}/Contacts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-Tenant-Id": tenantId,
      "Content-Type": "application/json",
    },
    body: reqBody,
  });
  const resText = await res.text();
  if (!res.ok) {
    console.error("[Xero] Create contact failed:", res.status, resText);
    return null;
  }
  const data = JSON.parse(resText);
  return data?.Contacts?.[0] ?? null;
}

// ─── Xero Invoices ───

export type XeroLineItem = {
  Description: string;
  Quantity: number;
  UnitAmount: number;
  AccountCode: string;
  TaxType: string;
};

export type XeroInvoicePayload = {
  Type: "ACCREC";
  Contact: { ContactID: string };
  LineItems: XeroLineItem[];
  Date?: string;
  DueDate?: string;
  Reference?: string;
  CurrencyCode?: string;
  Status?: "DRAFT" | "SUBMITTED" | "AUTHORISED";
  InvoiceNumber?: string;
};

export async function createXeroInvoice(
  accessToken: string,
  tenantId: string,
  invoice: XeroInvoicePayload
): Promise<{ InvoiceID: string; InvoiceNumber: string; error?: string } | null> {
  const reqBody = JSON.stringify({ Invoices: [invoice] });
  console.log("[Xero] Creating invoice, tenant:", tenantId, "payload:", reqBody);
  const res = await fetch(`${XERO_API_BASE}/Invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-Tenant-Id": tenantId,
      "Content-Type": "application/json",
    },
    body: reqBody,
  });
  const resText = await res.text();
  if (!res.ok) {
    console.error("[Xero] Create invoice failed:", res.status, resText);
    // Try to parse error message
    try {
      const errData = JSON.parse(resText);
      return { InvoiceID: "", InvoiceNumber: "", error: errData?.Message || errData?.Detail || resText };
    } catch {
      return { InvoiceID: "", InvoiceNumber: "", error: resText };
    }
  }
  const data = JSON.parse(resText);
  console.log("[Xero] Invoice created successfully:", JSON.stringify(data?.Invoices?.[0]?.InvoiceID));
  const inv = data?.Invoices?.[0];
  return inv ? { InvoiceID: inv.InvoiceID, InvoiceNumber: inv.InvoiceNumber } : null;
}

export async function updateXeroInvoice(
  accessToken: string,
  tenantId: string,
  invoiceId: string,
  updates: Partial<XeroInvoicePayload>
): Promise<{ InvoiceID: string; InvoiceNumber: string } | null> {
  const res = await fetch(`${XERO_API_BASE}/Invoices/${invoiceId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-Tenant-Id": tenantId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ Invoices: [{ InvoiceID: invoiceId, ...updates }] }),
  });
  const resText = await res.text();
  if (!res.ok) {
    console.error("[Xero] Update invoice failed:", res.status, resText);
    return null;
  }
  const data = JSON.parse(resText);
  const inv = data?.Invoices?.[0];
  return inv ? { InvoiceID: inv.InvoiceID, InvoiceNumber: inv.InvoiceNumber } : null;
}

export async function getXeroInvoice(
  accessToken: string,
  tenantId: string,
  invoiceId: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${XERO_API_BASE}/Invoices/${invoiceId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-Tenant-Id": tenantId,
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.Invoices?.[0] ?? null;
}

/** Find or create a contact in Xero, returning the ContactID */
export async function findOrCreateXeroContact(
  accessToken: string,
  tenantId: string,
  name: string,
  email?: string
): Promise<string | null> {
  const existing = await getXeroContacts(accessToken, tenantId, name);
  if (existing.length > 0) {
    return (existing[0] as { ContactID: string }).ContactID;
  }
  const created = await createXeroContact(accessToken, tenantId, {
    Name: name,
    EmailAddress: email || undefined,
  });
  return created?.ContactID ?? null;
}
