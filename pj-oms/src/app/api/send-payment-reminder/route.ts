import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured" }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let body: {
    invoice_id: string;
    invoice_type: "crm" | "commission";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { invoice_id, invoice_type } = body;
  if (!invoice_id || !invoice_type) {
    return NextResponse.json({ error: "invoice_id and invoice_type are required" }, { status: 400 });
  }

  let clientName = "";
  let clientEmail = "";
  let invoiceNumber = "";
  let amount = 0;
  let dueDate = "";

  if (invoice_type === "crm") {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("invoice_number, total, paid_amount, due_date, deal_id, deals(contacts(first_name, last_name, email), companies(company_name, email))")
      .eq("id", invoice_id)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    invoiceNumber = invoice.invoice_number;
    amount = Number(invoice.total) - Number(invoice.paid_amount || 0);
    dueDate = invoice.due_date || "";

    const deal = invoice.deals as unknown as Record<string, unknown> | null;
    const contact = deal?.contacts as unknown as Record<string, unknown> | null;
    const company = deal?.companies as unknown as Record<string, unknown> | null;
    clientName = contact ? `${contact.first_name} ${contact.last_name}` : (company?.company_name as string) ?? "Client";
    clientEmail = (contact?.email as string) ?? (company?.email as string) ?? "";
  } else {
    const { data: invoice } = await supabase
      .from("commission_invoices")
      .select("invoice_number, total, paid_amount, due_date, school_name, school_id, schools(contact_email)")
      .eq("id", invoice_id)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    invoiceNumber = invoice.invoice_number;
    amount = Number(invoice.total) - Number(invoice.paid_amount || 0);
    dueDate = invoice.due_date || "";
    clientName = invoice.school_name;
    const school = invoice.schools as unknown as Record<string, unknown> | null;
    clientEmail = (school?.contact_email as string) ?? "";
  }

  if (!clientEmail) {
    return NextResponse.json({ error: "No email address found for this client/school" }, { status: 400 });
  }

  const subject = `Payment Reminder - Invoice ${invoiceNumber}`;
  const html = `
<p>Dear ${clientName},</p>

<p>This is a friendly reminder that Invoice <strong>${invoiceNumber}</strong> for <strong>$${amount.toFixed(2)} NZD</strong> was due on <strong>${dueDate}</strong>.</p>

<p>Please arrange payment at your earliest convenience.</p>

<p><strong>Bank Details:</strong><br>
Account Name: PJ International Ltd<br>
Bank: ANZ Bank<br>
Account Number: 06-0241-0548818-00<br>
Reference: ${invoiceNumber}</p>

<p>If you have already made this payment, please disregard this reminder.</p>

<p>Kind regards,<br>
PJ International Ltd</p>
`;

  try {
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: clientEmail,
      subject,
      html,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id, sent_to: clientEmail });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
