import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "attachments";

/**
 * Generate a PDF from cover letter plain text and upload to Supabase Storage.
 * Returns the public URL, or null on failure.
 */
export async function generateAndUploadCoverLetterPdf(
  content: string,
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

    // Convert plain text to formatted HTML letter
    const paragraphs = content.split(/\n\n+/).map(p => {
      const lines = p.split(/\n/).map(l => l.trim()).filter(Boolean);
      return `<p>${lines.join("<br/>")}</p>`;
    }).join("\n");

    const fullHtml = `<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 25mm 25mm 25mm 25mm; }
    body {
      font-family: "Times New Roman", Georgia, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #111;
      max-width: 100%;
    }
    p { margin: 0 0 12pt 0; }
  </style>
</head>
<body>${paragraphs}</body></html>`;

    await page.setContent(fullHtml, { waitUntil: "load", timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "25mm", bottom: "25mm", left: "25mm", right: "25mm" },
      printBackground: true,
    });

    await browser.close();
    browser = undefined;

    const safeName = filename.replace(/[^a-zA-Z0-9\-_.]/g, "_");
    const path = `deals/${dealId}/${Date.now()}-${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[coverLetterPdf] Storage upload error:", uploadErr);
      return null;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return urlData.publicUrl;
  } catch (e) {
    console.error("[coverLetterPdf] Error generating PDF:", e);
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}
