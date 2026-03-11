import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getXeroAccessToken,
  getXeroTenants,
  findOrCreateXeroContact,
  createXeroInvoice,
  type XeroLineItem,
} from "@/lib/xero";

// Department → Service Fee Account Code mapping
const SERVICE_FEE_ACCOUNT_CODES: Record<string, string> = {
  china: "201",
  korea_japan: "201Korea",
  myanmar: "201Myamar", // Xero spelling
  thailand: "201Thai",
};

const INZ_FEE_ACCOUNT_CODE = "203";

function getServiceAccountCode(department: string | null): string {
  if (!department) return "201";
  return SERVICE_FEE_ACCOUNT_CODES[department] ?? "201";
}

/**
 * POST: Push a CRM invoice to Xero (PJ Immigration Limited)
 * Body: { invoice_id: string }
 * Creates DRAFT ACCREC invoice in Xero
 */
export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let body: { invoice_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { invoice_id } = body;
  if (!invoice_id) {
    return NextResponse.json({ error: "invoice_id is required" }, { status: 400 });
  }

  console.log("[Xero create-invoice] Starting for invoice:", invoice_id);

  // Fetch invoice with related data including deal's visa_type and created_by
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("*, deals(deal_number, visa_type, created_by, contacts(first_name, last_name, email), companies(company_name, email))")
    .eq("id", invoice_id)
    .single();

  if (invErr || !invoice) {
    console.error("[Xero create-invoice] Invoice not found:", invErr);
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.xero_invoice_id) {
    return NextResponse.json({ error: "Invoice already pushed to Xero", xero_invoice_id: invoice.xero_invoice_id }, { status: 400 });
  }

  const deal = invoice.deals as Record<string, unknown> | null;
  const visaType = (deal?.visa_type as string) ?? "";
  const dealCreatedBy = deal?.created_by as string | null;

  // Get department from deal creator's profile
  let department: string | null = null;
  if (dealCreatedBy) {
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("department")
      .eq("id", dealCreatedBy)
      .single();
    department = creatorProfile?.department ?? null;
  }
  console.log("[Xero create-invoice] visa_type:", visaType, "department:", department);

  // Get Xero access token and tenant
  const accessToken = await getXeroAccessToken();
  if (!accessToken) {
    console.error("[Xero create-invoice] No access token");
    return NextResponse.json({ error: "Xero not connected or token refresh failed" }, { status: 401 });
  }

  const tenants = await getXeroTenants();
  console.log("[Xero create-invoice] Tenants:", JSON.stringify(tenants));
  if (!tenants.immigration) {
    return NextResponse.json({ error: "PJ Immigration tenant not mapped in Xero" }, { status: 400 });
  }

  // Determine contact name and email
  const contact = deal?.contacts as { first_name: string; last_name: string; email?: string } | null;
  const company = deal?.companies as { company_name: string; email?: string } | null;

  const contactName = contact
    ? `${contact.first_name} ${contact.last_name}`
    : company?.company_name ?? "Unknown Client";
  const contactEmail = contact?.email ?? company?.email ?? undefined;

  console.log("[Xero create-invoice] Contact:", contactName, contactEmail);

  // Find or create contact in Xero
  const xeroContactId = await findOrCreateXeroContact(
    accessToken,
    tenants.immigration,
    contactName,
    contactEmail
  );

  if (!xeroContactId) {
    return NextResponse.json({ error: "Failed to find/create contact in Xero" }, { status: 500 });
  }

  // Fetch the payment stages for GST type and stage details
  const stageIds = (invoice.payment_stage_ids ?? []) as string[];
  let stageGstMap: Record<string, string> = {};
  let stageInfoMap: Record<string, { stage_name: string; stage_details: string; gst_type: string }> = {};
  if (stageIds.length > 0) {
    const { data: stages } = await supabase
      .from("deal_payments")
      .select("id, gst_type, stage_name, stage_details")
      .in("id", stageIds);
    if (stages) {
      for (const s of stages as { id: string; gst_type: string | null; stage_name: string | null; stage_details: string | null }[]) {
        stageGstMap[s.id] = s.gst_type ?? "Exclusive";
        stageInfoMap[s.id] = {
          stage_name: s.stage_name ?? "Payment",
          stage_details: s.stage_details ?? "",
          gst_type: s.gst_type ?? "Exclusive",
        };
      }
    }
  }

  // Map GST type to Xero TaxType
  const gstToXeroTax = (gstType: string): string => {
    switch (gstType) {
      case "Inclusive": return "OUTPUT2";
      case "Exclusive": return "OUTPUT";
      case "Zero Rated": return "NONE";
      default: return "OUTPUT2";
    }
  };

  // Determine primary GST type (from first stage or fallback)
  const primaryGst = stageIds.length > 0 && stageGstMap[stageIds[0]]
    ? stageGstMap[stageIds[0]]
    : (invoice.gst_amount > 0 ? "Inclusive" : "Zero Rated");

  // Account codes
  const svcAccountCode = getServiceAccountCode(department);

  // Determine fee type from line item description suffix
  const getFeeType = (desc: string): "service" | "inz" | "other" => {
    if (desc.includes("(INZ Fee)") || desc.includes("(INZ Application Fee)")) return "inz";
    if (desc.includes("(Other Fee)")) return "other";
    return "service"; // default: Service Fee
  };

  // Build improved description: "{visa_type} - {fee_label} - {stage_name}: {stage_details}"
  const buildDescription = (origDesc: string, feeType: "service" | "inz" | "other"): string => {
    const feeLabels = { service: "Service Fee", inz: "INZ Application Fee", other: "Other Fee" };
    const feeLabel = feeLabels[feeType];

    // Try to extract stage info from original description: "Stage I - details (Fee Type)"
    const match = origDesc.match(/^(.+?)\s*\((Service Fee|INZ Fee|Other Fee)\)$/);
    const stageInfo = match ? match[1].trim() : origDesc;

    const prefix = visaType ? `${visaType} - ` : "";
    return `${prefix}${feeLabel} - ${stageInfo}`;
  };

  // Build Xero line items
  const lineItems = invoice.line_items as { description: string; quantity: number; unit_price: number; amount: number }[];
  const xeroLineItems: XeroLineItem[] = lineItems.map((item) => {
    const feeType = getFeeType(item.description);
    const accountCode = feeType === "inz" ? INZ_FEE_ACCOUNT_CODE : svcAccountCode;

    return {
      Description: buildDescription(item.description, feeType),
      Quantity: item.quantity,
      UnitAmount: item.unit_price,
      AccountCode: accountCode,
      TaxType: gstToXeroTax(primaryGst),
    };
  });

  // DueDate: use invoice due_date, or issue_date + 30 days
  let dueDate = invoice.due_date;
  if (!dueDate && invoice.issue_date) {
    const d = new Date(invoice.issue_date);
    d.setDate(d.getDate() + 30);
    dueDate = d.toISOString().split("T")[0];
  }

  // Create draft invoice in Xero — Reference = visa_type
  const xeroInvoice = await createXeroInvoice(accessToken, tenants.immigration, {
    Type: "ACCREC",
    Contact: { ContactID: xeroContactId },
    LineItems: xeroLineItems,
    Date: invoice.issue_date,
    DueDate: dueDate || undefined,
    Reference: visaType || invoice.invoice_number,
    CurrencyCode: invoice.currency || "NZD",
    Status: "DRAFT",
  });

  if (!xeroInvoice || xeroInvoice.error) {
    const errMsg = xeroInvoice?.error || "Unknown Xero error";
    console.error("[Xero create-invoice] Failed:", errMsg);
    return NextResponse.json({ error: `Xero API error: ${errMsg}` }, { status: 500 });
  }

  if (!xeroInvoice.InvoiceID) {
    return NextResponse.json({ error: "Xero returned no InvoiceID" }, { status: 500 });
  }

  // Save Xero invoice ID back to our invoices table
  await supabase
    .from("invoices")
    .update({ xero_invoice_id: xeroInvoice.InvoiceID })
    .eq("id", invoice_id);

  console.log("[Xero create-invoice] Success:", xeroInvoice.InvoiceID, xeroInvoice.InvoiceNumber);

  return NextResponse.json({
    ok: true,
    xero_invoice_id: xeroInvoice.InvoiceID,
    xero_invoice_number: xeroInvoice.InvoiceNumber,
  });
}
