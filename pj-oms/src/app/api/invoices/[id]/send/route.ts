import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const resend = new Resend(apiKey);

  let body: { email?: string } = {};
  try { body = await request.json(); } catch {}

  // Fetch invoice
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, deals(deal_number, contacts(first_name, last_name, email), companies(company_name, email))")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Generate PDF if not already done
  if (!invoice.pdf_url) {
    const genRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? "" : ""}${request.url.replace(/\/send$/, "/generate-pdf")}`, {
      method: "POST",
    });
    if (!genRes.ok) {
      return NextResponse.json({ error: "Failed to generate PDF before sending" }, { status: 500 });
    }
    const genData = await genRes.json();
    invoice.pdf_url = genData.url;
  }

  const deal = invoice.deals as Record<string, unknown> | null;
  const contact = deal?.contacts as Record<string, unknown> | null;
  const company = deal?.companies as Record<string, unknown> | null;

  const recipientEmail = body.email
    || (contact?.email as string)
    || (company?.email as string);

  if (!recipientEmail) {
    return NextResponse.json({ error: "No recipient email available" }, { status: 400 });
  }

  const clientName = contact
    ? `${contact.first_name} ${contact.last_name}`
    : (company?.company_name as string) ?? "Client";

  const CURRENCY_SYMBOLS: Record<string, string> = { NZD: "NZ$", CNY: "\u00A5", THB: "\u0E3F" };
  const sym = CURRENCY_SYMBOLS[invoice.currency] ?? "$";

  const html = `
<p>Dear ${clientName},</p>
<p>Please find your invoice <strong>${invoice.invoice_number}</strong> for ${sym}${Number(invoice.total).toFixed(2)} ${invoice.currency}.</p>
${invoice.pdf_url ? `<p>You can view/download the invoice PDF here:<br><a href="${invoice.pdf_url}">${invoice.pdf_url}</a></p>` : ""}
${invoice.due_date ? `<p><strong>Due Date:</strong> ${invoice.due_date}</p>` : ""}
<p>If you have any questions, please don't hesitate to contact us.</p>
<p>Kind regards,<br>PJ Immigration Limited</p>
`;

  try {
    const { data: emailData, error: emailErr } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: recipientEmail,
      subject: `Invoice ${invoice.invoice_number} - PJ Immigration Limited`,
      html,
    });

    if (emailErr) {
      return NextResponse.json({ error: emailErr.message }, { status: 500 });
    }

    // Update invoice status
    await supabase.from("invoices").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_to_email: recipientEmail,
    }).eq("id", id);

    return NextResponse.json({ ok: true, emailId: emailData?.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
