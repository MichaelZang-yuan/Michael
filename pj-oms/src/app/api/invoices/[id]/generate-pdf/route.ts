import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateAndUploadInvoicePdf } from "@/lib/invoicePdf";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch invoice with deal, contact, company
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, deals(deal_number, contact_id, company_id, contacts(first_name, last_name, email, phone, address), companies(company_name, email, address))")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    console.error("[generate-pdf] Invoice not found:", error);
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const deal = invoice.deals as Record<string, unknown> | null;
  const contact = deal?.contacts as Record<string, unknown> | null;
  const company = deal?.companies as Record<string, unknown> | null;

  const clientName = contact
    ? `${contact.first_name} ${contact.last_name}`
    : (company?.company_name as string) ?? "Client";

  const pdfData = {
    invoice_number: invoice.invoice_number,
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    currency: invoice.currency,
    client_name: clientName,
    client_email: (contact?.email as string) ?? (company?.email as string) ?? null,
    client_address: (contact?.address as string) ?? (company?.address as string) ?? null,
    client_phone: (contact?.phone as string) ?? null,
    deal_number: (deal?.deal_number as string) ?? null,
    line_items: invoice.line_items as { description: string; quantity: number; unit_price: number; amount: number }[],
    subtotal: invoice.subtotal,
    gst_amount: invoice.gst_amount,
    total: invoice.total,
    notes: invoice.notes,
  };

  const filename = `${invoice.invoice_number}.pdf`;
  const pdfUrl = await generateAndUploadInvoicePdf(pdfData, invoice.deal_id, filename);

  if (!pdfUrl) {
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }

  // Update invoice with pdf_url
  await supabase.from("invoices").update({ pdf_url: pdfUrl }).eq("id", id);

  return NextResponse.json({ ok: true, url: pdfUrl });
}
