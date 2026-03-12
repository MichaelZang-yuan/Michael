import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  console.log("[Xero getToken] Starting token retrieval...");
  const supabase = getSupabaseAdmin();
  const { data: row, error: rowErr } = await supabase
    .from("xero_tokens")
    .select("refresh_token, access_token, expires_at")
    .limit(1)
    .single();

  if (rowErr) {
    console.error("[Xero getToken] DB query error:", rowErr.message);
    return null;
  }
  if (!row?.refresh_token) {
    console.error("[Xero getToken] No refresh_token in xero_tokens table");
    return null;
  }

  const expiresAt = new Date(row.expires_at);
  const now = new Date();
  const remainingMs = expiresAt.getTime() - now.getTime();
  console.log("[Xero getToken] Token expires_at:", row.expires_at, "remaining:", Math.round(remainingMs / 1000), "seconds");

  if (remainingMs > 60 * 1000) {
    console.log("[Xero getToken] Token still valid, returning existing token:", row.access_token?.slice(0, 10) + "...");
    return row.access_token;
  }

  console.log("[Xero getToken] Token expired or expiring soon, refreshing...");
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[Xero getToken] Missing env vars: XERO_CLIENT_ID=", !!clientId, "XERO_CLIENT_SECRET=", !!clientSecret);
    return null;
  }
  console.log("[Xero getToken] Client ID:", clientId.slice(0, 8) + "...");

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

  console.log("[Xero getToken] Refresh response status:", res.status, "content-type:", res.headers.get("content-type"));
  const resText = await res.text();
  let tokenData: Record<string, unknown> = {};
  try {
    tokenData = JSON.parse(resText);
  } catch {
    console.error("[Xero getToken] Refresh returned non-JSON:", resText.slice(0, 500));
    return null;
  }

  if (!res.ok || !tokenData.access_token) {
    console.error("[Xero getToken] Token refresh failed:", JSON.stringify(tokenData));
    return null;
  }

  console.log("[Xero getToken] Refresh successful, new token:", (tokenData.access_token as string).slice(0, 10) + "...");

  const expiresIn = (tokenData.expires_in as number) ?? 1800;
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { data: existing } = await supabase
    .from("xero_tokens")
    .select("id")
    .limit(1)
    .single();
  if (existing) {
    const { error: updateErr } = await supabase
      .from("xero_tokens")
      .update({
        access_token: tokenData.access_token as string,
        refresh_token: (tokenData.refresh_token as string) ?? row.refresh_token,
        expires_at: newExpiresAt,
      })
      .eq("id", existing.id);
    if (updateErr) {
      console.error("[Xero getToken] Failed to save refreshed token:", updateErr.message);
    } else {
      console.log("[Xero getToken] Token saved to DB, expires_at:", newExpiresAt);
    }
  }

  return tokenData.access_token as string;
}

/** Get the stored tenant IDs */
export async function getXeroTenants(): Promise<{
  immigration: string | null;
  international: string | null;
}> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("xero_tokens")
    .select("tenant_id_immigration, tenant_id_international")
    .limit(1)
    .single();
  if (error) console.error("[Xero getTenants] DB error:", error.message);
  console.log("[Xero getTenants] immigration:", data?.tenant_id_immigration, "international:", data?.tenant_id_international);
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
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const resText = await res.text();
  if (!res.ok) {
    console.error("[Xero] Failed to fetch connections:", res.status, resText);
    return [];
  }
  let data: unknown;
  try { data = JSON.parse(resText); } catch {
    console.error("[Xero] Connections: non-JSON response:", resText.slice(0, 500));
    return [];
  }
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
  const resText = await res.text();
  if (!res.ok) {
    console.error("[Xero] Get contacts failed:", res.status, resText);
    return [];
  }
  try {
    const data = JSON.parse(resText);
    return data?.Contacts ?? [];
  } catch {
    console.error("[Xero] Get contacts: non-JSON response:", resText.slice(0, 500));
    return [];
  }
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
      Accept: "application/json",
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
  console.log("[Xero] POST URL:", `${XERO_API_BASE}/Invoices`);
  const res = await fetch(`${XERO_API_BASE}/Invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Xero-Tenant-Id": tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: reqBody,
  });
  const resText = await res.text();
  console.log("[Xero] Create invoice response — status:", res.status, "content-type:", res.headers.get("content-type"));
  if (!res.ok) {
    console.error("[Xero] Create invoice failed:", res.status, "body:", resText);
    // Try to parse error message
    try {
      const errData = JSON.parse(resText);
      return { InvoiceID: "", InvoiceNumber: "", error: errData?.Message || errData?.Detail || resText };
    } catch {
      return { InvoiceID: "", InvoiceNumber: "", error: resText };
    }
  }
  try {
    const data = JSON.parse(resText);
    console.log("[Xero] Invoice created successfully:", JSON.stringify(data?.Invoices?.[0]?.InvoiceID));
    const inv = data?.Invoices?.[0];
    return inv ? { InvoiceID: inv.InvoiceID, InvoiceNumber: inv.InvoiceNumber } : null;
  } catch {
    console.error("[Xero] Create invoice: non-JSON success response:", resText.slice(0, 500));
    return { InvoiceID: "", InvoiceNumber: "", error: "Xero returned non-JSON response" };
  }
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
      Accept: "application/json",
    },
    body: JSON.stringify({ Invoices: [{ InvoiceID: invoiceId, ...updates }] }),
  });
  const resText = await res.text();
  if (!res.ok) {
    console.error("[Xero] Update invoice failed:", res.status, resText);
    return null;
  }
  try {
    const data = JSON.parse(resText);
    const inv = data?.Invoices?.[0];
    return inv ? { InvoiceID: inv.InvoiceID, InvoiceNumber: inv.InvoiceNumber } : null;
  } catch {
    console.error("[Xero] Update invoice: non-JSON response:", resText.slice(0, 500));
    return null;
  }
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
  if (!res.ok) {
    console.error("[Xero] Get invoice failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  try {
    const data = await res.json();
    return data?.Invoices?.[0] ?? null;
  } catch {
    console.error("[Xero] Get invoice: non-JSON response");
    return null;
  }
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

// ─── Sync Single Invoice ───

export async function syncSingleInvoice(
  supabase: SupabaseClient,
  accessToken: string,
  tenantId: string,
  invoice: { id: string; xero_invoice_id: string; total: number; paid_amount: number; status: string; payment_stage_ids: string[] }
): Promise<{ synced_payments: number; new_status: string; paid_amount: number; error?: string }> {
  // Fetch Invoice from Xero (includes Payments array)
  const xeroInv = await getXeroInvoice(accessToken, tenantId, invoice.xero_invoice_id);
  if (!xeroInv) {
    console.error("[Xero syncSingleInvoice] Failed to fetch Xero invoice:", invoice.xero_invoice_id);
    return { synced_payments: 0, new_status: invoice.status, paid_amount: Number(invoice.paid_amount) || 0, error: "Failed to fetch invoice from Xero" };
  }

  console.log("[Xero syncSingleInvoice] Xero status:", xeroInv.Status, "AmountPaid:", xeroInv.AmountPaid);

  const xeroStatus = xeroInv.Status as string;
  const xeroAmountPaid = Number(xeroInv.AmountPaid) || 0;
  const xeroTotal = Number(xeroInv.Total) || Number(invoice.total) || 0;

  // Process Xero Payments
  const xeroPayments = (xeroInv.Payments ?? []) as {
    PaymentID: string;
    Amount: number;
    Date: string;
    Reference?: string;
  }[];

  let syncedCount = 0;
  const stageIds = (invoice.payment_stage_ids ?? []) as string[];

  for (const xp of xeroPayments) {
    if (!xp.PaymentID) continue;

    // Check if already synced
    const { data: existing } = await supabase
      .from("invoice_payments")
      .select("id")
      .eq("xero_payment_id", xp.PaymentID)
      .maybeSingle();

    if (existing) continue;

    const paymentAmount = Number(xp.Amount) || 0;
    if (paymentAmount <= 0) continue;

    // Parse Xero date format: "/Date(1234567890000+0000)/" or "YYYY-MM-DD"
    let paymentDate = new Date().toISOString().split("T")[0];
    if (xp.Date) {
      const msMatch = xp.Date.match(/\/Date\((\d+)/);
      if (msMatch) {
        paymentDate = new Date(Number(msMatch[1])).toISOString().split("T")[0];
      } else if (/^\d{4}-\d{2}-\d{2}/.test(xp.Date)) {
        paymentDate = xp.Date.split("T")[0];
      }
    }

    // Smart stage matching
    let matchedStageId: string | null = null;
    let matchedFeeType: string | null = null;

    if (stageIds.length > 0) {
      const { data: stages } = await supabase
        .from("deal_payments")
        .select("id, service_fee_amount, inz_fee_amount, other_fee_amount, is_paid, service_fee_paid, inz_fee_paid, other_fee_paid, paid_amount_total")
        .in("id", stageIds);

      if (stages) {
        for (const s of stages) {
          if (s.is_paid) continue;

          const svc = Number(s.service_fee_amount) || 0;
          const inz = Number(s.inz_fee_amount) || 0;
          const other = Number(s.other_fee_amount) || 0;
          const stageTotal = svc + inz + other;

          // Exact match: total stage
          if (Math.abs(paymentAmount - stageTotal) < 0.01 && stageTotal > 0) {
            matchedStageId = s.id;
            matchedFeeType = "total";
            await supabase.from("deal_payments").update({
              is_paid: true, paid_at: new Date().toISOString(), status: "paid",
              paid_date: paymentDate, payment_method: "xero_sync",
              service_fee_paid: true, inz_fee_paid: true, other_fee_paid: true,
              paid_amount_total: stageTotal,
            }).eq("id", s.id);
            break;
          }

          // Exact match: service_fee
          if (!s.service_fee_paid && svc > 0 && Math.abs(paymentAmount - svc) < 0.01) {
            matchedStageId = s.id;
            matchedFeeType = "service_fee";
            const updates: Record<string, unknown> = { service_fee_paid: true, paid_amount_total: (Number(s.paid_amount_total) || 0) + svc };
            if ((s.inz_fee_paid || inz === 0) && (s.other_fee_paid || other === 0)) {
              Object.assign(updates, { is_paid: true, paid_at: new Date().toISOString(), status: "paid", paid_date: paymentDate, payment_method: "xero_sync" });
            }
            await supabase.from("deal_payments").update(updates).eq("id", s.id);
            break;
          }

          // Exact match: inz_fee
          if (!s.inz_fee_paid && inz > 0 && Math.abs(paymentAmount - inz) < 0.01) {
            matchedStageId = s.id;
            matchedFeeType = "inz_fee";
            const updates: Record<string, unknown> = { inz_fee_paid: true, paid_amount_total: (Number(s.paid_amount_total) || 0) + inz };
            if ((s.service_fee_paid || svc === 0) && (s.other_fee_paid || other === 0)) {
              Object.assign(updates, { is_paid: true, paid_at: new Date().toISOString(), status: "paid", paid_date: paymentDate, payment_method: "xero_sync" });
            }
            await supabase.from("deal_payments").update(updates).eq("id", s.id);
            break;
          }

          // Exact match: other_fee
          if (!s.other_fee_paid && other > 0 && Math.abs(paymentAmount - other) < 0.01) {
            matchedStageId = s.id;
            matchedFeeType = "other_fee";
            const updates: Record<string, unknown> = { other_fee_paid: true, paid_amount_total: (Number(s.paid_amount_total) || 0) + other };
            if ((s.service_fee_paid || svc === 0) && (s.inz_fee_paid || inz === 0)) {
              Object.assign(updates, { is_paid: true, paid_at: new Date().toISOString(), status: "paid", paid_date: paymentDate, payment_method: "xero_sync" });
            }
            await supabase.from("deal_payments").update(updates).eq("id", s.id);
            break;
          }
        }
      }
    }

    // Insert payment record
    await supabase.from("invoice_payments").insert({
      invoice_id: invoice.id,
      amount: paymentAmount,
      payment_date: paymentDate,
      payment_method: "xero_sync",
      notes: xp.Reference ? `Xero ref: ${xp.Reference}` : "Synced from Xero",
      matched_stage_id: matchedStageId,
      matched_fee_type: matchedFeeType,
      xero_payment_id: xp.PaymentID,
    });

    syncedCount++;
    console.log("[Xero syncSingleInvoice] Synced payment:", xp.PaymentID, "amount:", paymentAmount, "matched:", matchedFeeType);
  }

  // Update OMS invoice status based on Xero state
  let newStatus = invoice.status;
  if (xeroStatus === "PAID") {
    newStatus = "paid";
  } else if (xeroStatus === "AUTHORISED" && xeroAmountPaid > 0 && xeroAmountPaid < xeroTotal) {
    newStatus = "partial";
  } else if (xeroStatus === "AUTHORISED" && xeroAmountPaid === 0) {
    newStatus = "sent";
  }

  await supabase.from("invoices").update({
    paid_amount: xeroAmountPaid,
    paid_date: newStatus === "paid" ? new Date().toISOString().split("T")[0] : null,
    status: newStatus,
  }).eq("id", invoice.id);

  console.log("[Xero syncSingleInvoice] Done. Synced:", syncedCount, "Status:", newStatus);

  return { synced_payments: syncedCount, new_status: newStatus, paid_amount: xeroAmountPaid };
}
