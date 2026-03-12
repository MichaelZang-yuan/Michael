import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST: Generate a PDF for a commission invoice.
 * Creates an HTML-based invoice, converts to PDF via Supabase storage.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch invoice with line items
  const { data: invoice, error } = await supabase
    .from("commission_invoices")
    .select("*, commission_invoice_items(*)")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const items = (invoice.commission_invoice_items ?? []) as {
    student_name: string;
    student_number: string | null;
    course_name: string | null;
    enrollment_date: string | null;
    tuition_fee: number | null;
    commission_rate: number | null;
    amount: number;
    description: string | null;
  }[];

  // Build HTML invoice
  const itemRows = items.map((item) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.description || item.student_name}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${Number(item.amount).toFixed(2)}</td>
    </tr>
  `).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${invoice.invoice_number}</title></head>
<body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#333">
  <div style="display:flex;justify-content:space-between;margin-bottom:40px">
    <div>
      <h1 style="margin:0;color:#1e3a5f">PJ International Ltd</h1>
      <p style="margin:4px 0;color:#666">Commission Invoice</p>
    </div>
    <div style="text-align:right">
      <h2 style="margin:0;color:#1e3a5f">${invoice.invoice_number}</h2>
      <p style="margin:4px 0;color:#666">Date: ${invoice.issue_date}</p>
      <p style="margin:4px 0;color:#666">Due: ${invoice.due_date}</p>
    </div>
  </div>

  <div style="margin-bottom:30px">
    <h3 style="margin:0 0 4px;color:#1e3a5f">Bill To:</h3>
    <p style="margin:0;font-size:16px">${invoice.school_name}</p>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <thead>
      <tr style="background:#1e3a5f;color:white">
        <th style="padding:10px;text-align:left">Description</th>
        <th style="padding:10px;text-align:right">Amount (${invoice.currency})</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div style="text-align:right;margin-top:20px">
    <p style="margin:4px 0">Subtotal: $${Number(invoice.subtotal).toFixed(2)}</p>
    <p style="margin:4px 0">GST (15%): $${Number(invoice.gst_amount).toFixed(2)}</p>
    <p style="margin:4px 0;font-size:18px;font-weight:bold;color:#1e3a5f">Total: $${Number(invoice.total).toFixed(2)} ${invoice.currency}</p>
  </div>

  <div style="margin-top:40px;padding-top:20px;border-top:2px solid #1e3a5f;color:#666;font-size:12px">
    <p><strong>Bank Details:</strong> PJ International Ltd | ANZ Bank | 06-0241-0548818-00</p>
    <p>Please use invoice number ${invoice.invoice_number} as payment reference.</p>
  </div>
</body>
</html>`;

  // Upload HTML as a file to Supabase storage
  const filename = `${invoice.invoice_number}.html`;
  const storagePath = `commission-invoices/${filename}`;

  const { error: uploadErr } = await supabase.storage
    .from("invoices")
    .upload(storagePath, new Blob([html], { type: "text/html" }), {
      contentType: "text/html",
      upsert: true,
    });

  if (uploadErr) {
    console.error("[commission-invoice pdf] Upload error:", uploadErr);
    return NextResponse.json({ error: "Failed to generate invoice document" }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from("invoices").getPublicUrl(storagePath);

  return NextResponse.json({ ok: true, url: urlData.publicUrl });
}
