import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function fillPlaceholders(content: string, data: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

function buildPaymentTable(payments: { description: string | null; payment_type: string | null; amount: number }[]): string {
  if (!payments.length) return "";
  const rows = payments.map(p =>
    `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${p.description ?? p.payment_type?.replace(/_/g, " ") ?? "Payment"}</td>` +
    `<td style="text-align:right;padding:4px 8px;border-bottom:1px solid #eee;">NZ$${p.amount.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}</td></tr>`
  ).join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:13px;margin:8px 0;">` +
    `<thead><tr><th style="text-align:left;padding:4px 8px;border-bottom:2px solid #ccc;font-weight:600;">Stage / Description</th>` +
    `<th style="text-align:right;padding:4px 8px;border-bottom:2px solid #ccc;font-weight:600;">Amount</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`;
}

export async function POST(req: NextRequest) {
  try {
    const { deal_id } = await req.json();
    if (!deal_id) return NextResponse.json({ error: "deal_id required" }, { status: 400 });

    // Fetch deal with contact/company info
    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .select("*, contacts(first_name, last_name, email, phone, address, passport_number, nationality, date_of_birth), companies(company_name, email, address)")
      .eq("id", deal_id)
      .single();
    if (dealErr || !deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    // Fetch assigned LIA
    let liaName = "";
    if (deal.assigned_lia_id) {
      const { data: lia } = await supabase.from("profiles").select("full_name").eq("id", deal.assigned_lia_id).single();
      liaName = lia?.full_name ?? "";
    }

    // Fetch payments
    const { data: payments } = await supabase
      .from("deal_payments")
      .select("description, payment_type, amount")
      .eq("deal_id", deal_id)
      .order("created_at");

    // Determine template type and language
    const targetType = deal.deal_type === "individual_visa" ? "individual" : "company";
    const langMap: Record<string, string> = { en: "english", zh: "chinese", th: "thai" };
    const language = langMap[deal.preferred_language ?? "en"] ?? "english";

    // Find best matching template
    const { data: templates } = await supabase
      .from("contract_templates")
      .select("*")
      .eq("is_active", true)
      .eq("target_type", targetType)
      .eq("language", language);

    const template = templates?.[0];
    if (!template?.content) {
      return NextResponse.json({ error: "No matching active contract template found" }, { status: 404 });
    }

    // Build placeholder data
    const contact = deal.contacts as { first_name: string; last_name: string; email: string | null; phone: string | null; address: string | null; passport_number: string | null; nationality: string | null; date_of_birth: string | null } | null;
    const company = deal.companies as { company_name: string; email: string | null; address: string | null } | null;
    const fmtAmt = (n: number) => `NZ$${n.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}`;
    const today = new Date().toLocaleDateString("en-NZ", { year: "numeric", month: "long", day: "numeric" });
    const serviceFee = deal.service_fee ?? 0;
    const paymentStagesTable = buildPaymentTable(payments ?? []);

    const placeholders: Record<string, string> = {
      date: today,
      date_today: today,
      client_name: contact ? `${contact.first_name} ${contact.last_name}` : (company?.company_name ?? ""),
      client_email: contact?.email ?? company?.email ?? "",
      client_mobile: contact?.phone ?? "",
      client_phone: contact?.phone ?? "",
      client_address: contact?.address ?? company?.address ?? "",
      client_family_name: contact?.last_name ?? "",
      client_first_name: contact?.first_name ?? "",
      client_family_members: "",
      company_name: company?.company_name ?? "",
      company_address: company?.address ?? "",
      service_type: deal.visa_type ? `${deal.visa_type} Visa` : (deal.deal_type?.replace(/_/g, " ") ?? ""),
      visa_type: deal.visa_type ?? "",
      deal_number: deal.deal_number ?? "",
      total_service_fee: serviceFee > 0 ? fmtAmt(serviceFee) : "TBA",
      service_fee: serviceFee > 0 ? fmtAmt(serviceFee) : "TBA",
      inz_application_fee: deal.inz_application_fee != null ? fmtAmt(deal.inz_application_fee) : "TBA",
      government_fee: deal.inz_application_fee != null ? fmtAmt(deal.inz_application_fee) : "TBA",
      currency: "NZ",
      refund_percentage: String(deal.refund_percentage ?? 50),
      payment_stages_table: paymentStagesTable,
      lia_name: liaName,
      adviser_signature: `<div style="border-bottom:1px solid #333;width:240px;height:60px;display:inline-block;"></div>`,
      client_signature: `<div style="border-bottom:1px solid #333;width:240px;height:60px;display:inline-block;"></div>`,
    };

    const contractHtml = fillPlaceholders(template.content, placeholders);

    // Update or create deal_contracts record
    const { data: existing } = await supabase
      .from("deal_contracts")
      .select("id, status")
      .eq("deal_id", deal_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.status === "draft") {
      await supabase.from("deal_contracts").update({
        contract_html: contractHtml,
        content: contractHtml,
        template_id: template.id,
        language: deal.preferred_language ?? "en",
      }).eq("id", existing.id);
      return NextResponse.json({ contract_id: existing.id });
    }

    // Create new
    const year = new Date().getFullYear();
    const { count } = await supabase.from("deal_contracts").select("*", { count: "exact", head: true });
    const num = String((count ?? 0) + 1).padStart(3, "0");
    const { data: newContract, error: insertErr } = await supabase.from("deal_contracts").insert({
      deal_id,
      contract_number: `CON-${year}-${num}`,
      contract_type: targetType,
      status: "draft",
      template_id: template.id,
      content: contractHtml,
      contract_html: contractHtml,
      language: deal.preferred_language ?? "en",
    }).select().single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    return NextResponse.json({ contract_id: newContract.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
