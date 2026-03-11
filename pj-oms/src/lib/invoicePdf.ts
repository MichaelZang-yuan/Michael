import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "attachments";

/**
 * Generate a PDF from invoice HTML and upload it to Supabase Storage.
 * Returns the public URL, or null on failure.
 */
export async function generateAndUploadInvoicePdf(
  invoiceHtml: string,
  dealId: string,
  filename: string
): Promise<string | null> {
  let browser;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    const fullHtml = `<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;">${invoiceHtml}</body></html>`;

    await page.setContent(fullHtml, { waitUntil: "load", timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      printBackground: true,
    });

    await browser.close();
    browser = undefined;

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
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}
