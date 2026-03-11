import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "attachments";

const CURRENCY_SYMBOLS: Record<string, string> = {
  NZD: "NZ$",
  CNY: "\u00A5",
  THB: "\u0E3F",
};

const BANK_INFO: Record<string, { bank: string; name: string; account: string; swift: string; note?: string }> = {
  NZD: {
    bank: "ANZ Bank New Zealand",
    name: "PJ Immigration Services Limited",
    account: "06-0193-0812587-00",
    swift: "ANZBNZ22",
  },
  CNY: {
    bank: "ANZ Bank New Zealand",
    name: "PJ Immigration Services Limited",
    account: "06-0193-0812587-00",
    swift: "ANZBNZ22",
    note: "Please include your invoice number as payment reference",
  },
  THB: {
    bank: "ANZ Bank New Zealand",
    name: "PJ Immigration Services Limited",
    account: "06-0193-0812587-00",
    swift: "ANZBNZ22",
    note: "Please include your invoice number as payment reference",
  },
};

type InvoiceLineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

type InvoicePdfData = {
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  currency: string;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  client_phone: string | null;
  deal_number: string | null;
  line_items: InvoiceLineItem[];
  subtotal: number;
  gst_amount: number;
  total: number;
  notes: string | null;
};

function fmtCurrency(n: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? "$";
  return sym + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generate a PDF invoice using jsPDF (no Puppeteer/Chromium needed).
 * Returns a Buffer of the PDF.
 */
export function generateInvoicePdfBuffer(data: InvoicePdfData): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 0;

  // ─── Header bar ───
  doc.setFillColor(30, 58, 95); // #1e3a5f
  doc.rect(0, 0, pageWidth, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", margin, 18);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(data.invoice_number, margin, 27);

  // Company info (right side)
  doc.setFontSize(9);
  const companyLines = [
    "PJ Immigration Services Limited",
    "Level 2, 109 Queen Street",
    "Auckland CBD, New Zealand",
    "info@pjimmigration.co.nz",
  ];
  const rightX = pageWidth - margin;
  companyLines.forEach((line, i) => {
    doc.text(line, rightX, 12 + i * 5, { align: "right" });
  });

  y = 45;

  // ─── Bill To + Invoice Meta ───
  doc.setTextColor(100, 116, 139); // #64748b
  doc.setFontSize(9);
  doc.text("BILL TO", margin, y);

  doc.setTextColor(30, 41, 59); // #1e293b
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(data.client_name, margin, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  let clientY = y + 13;
  if (data.client_email) { doc.text(data.client_email, margin, clientY); clientY += 5; }
  if (data.client_address) { doc.text(data.client_address, margin, clientY); clientY += 5; }
  if (data.client_phone) { doc.text(data.client_phone, margin, clientY); clientY += 5; }

  // Right side meta
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  let metaY = y;
  doc.setFont("helvetica", "bold");
  doc.text("Issue Date:", rightX - 40, metaY);
  doc.setFont("helvetica", "normal");
  doc.text(data.issue_date, rightX, metaY, { align: "right" });
  metaY += 6;
  if (data.due_date) {
    doc.setFont("helvetica", "bold");
    doc.text("Due Date:", rightX - 40, metaY);
    doc.setFont("helvetica", "normal");
    doc.text(data.due_date, rightX, metaY, { align: "right" });
    metaY += 6;
  }
  doc.setFont("helvetica", "bold");
  doc.text("Currency:", rightX - 40, metaY);
  doc.setFont("helvetica", "normal");
  doc.text(data.currency, rightX, metaY, { align: "right" });
  metaY += 6;
  if (data.deal_number) {
    doc.setFont("helvetica", "bold");
    doc.text("Reference:", rightX - 40, metaY);
    doc.setFont("helvetica", "normal");
    doc.text(data.deal_number, rightX, metaY, { align: "right" });
  }

  y = Math.max(clientY, metaY) + 10;

  // ─── Line Items Table ───
  const tableBody = data.line_items.map((item) => [
    item.description,
    String(item.quantity),
    fmtCurrency(item.unit_price, data.currency),
    fmtCurrency(item.amount, data.currency),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit Price", "Amount"]],
    body: tableBody,
    theme: "plain",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [100, 116, 139],
      fontSize: 9,
      fontStyle: "bold",
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 41, 59],
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 20 },
      2: { halign: "right", cellWidth: 35 },
      3: { halign: "right", cellWidth: 35 },
    },
    margin: { left: margin, right: margin },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // ─── Totals ───
  const totalsX = pageWidth - margin - 60;
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  doc.text("Subtotal", totalsX, y);
  doc.text(fmtCurrency(data.subtotal, data.currency), rightX, y, { align: "right" });
  y += 6;

  doc.text("GST (15%)", totalsX, y);
  doc.text(fmtCurrency(data.gst_amount, data.currency), rightX, y, { align: "right" });
  y += 3;

  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.line(totalsX, y, rightX, y);
  y += 6;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Total", totalsX, y);
  doc.text(fmtCurrency(data.total, data.currency), rightX, y, { align: "right" });
  y += 12;

  // ─── Bank Details ───
  const bankInfo = BANK_INFO[data.currency] ?? BANK_INFO.NZD;
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.roundedRect(margin, y, pageWidth - margin * 2, bankInfo.note ? 40 : 35, 3, 3, "FD");

  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text("Payment Details", margin + 5, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105); // #475569
  doc.text(`Bank: ${bankInfo.bank}`, margin + 5, y); y += 5;
  doc.text(`Account Name: ${bankInfo.name}`, margin + 5, y); y += 5;
  doc.text(`Account Number: ${bankInfo.account}`, margin + 5, y); y += 5;
  doc.text(`Swift Code: ${bankInfo.swift}`, margin + 5, y); y += 5;
  if (bankInfo.note) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(bankInfo.note, margin + 5, y);
    y += 5;
  }

  y += 5;

  // ─── Notes ───
  if (data.notes) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 95);
    doc.text("Notes", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const noteLines = doc.splitTextToSize(data.notes, pageWidth - margin * 2);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 5 + 5;
  }

  // ─── Footer ───
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // #94a3b8
  doc.text("Thank you for choosing PJ Immigration Services Limited", pageWidth / 2, y, { align: "center" });

  // Return as Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

/**
 * Generate an invoice PDF and upload to Supabase Storage.
 * Returns the public URL, or null on failure.
 */
export async function generateAndUploadInvoicePdf(
  data: InvoicePdfData,
  dealId: string,
  filename: string
): Promise<string | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const pdfBuffer = generateInvoicePdfBuffer(data);

    const safeName = filename.replace(/[^a-zA-Z0-9\-_.]/g, "_");
    const path = `deals/${dealId}/invoices/${Date.now()}-${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[invoicePdf] Storage upload error:", uploadErr);
      return null;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return urlData.publicUrl;
  } catch (e) {
    console.error("[invoicePdf] Error generating PDF:", e);
    return null;
  }
}
