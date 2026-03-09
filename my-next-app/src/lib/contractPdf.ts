import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "attachments";

/**
 * Generate a PDF from contract HTML and upload it to Supabase Storage.
 * Returns the public URL, or null on failure.
 */
export async function generateAndUploadContractPdf(
  contractHtml: string,
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
<body>${contractHtml}</body></html>`;

    await page.setContent(fullHtml, { waitUntil: "load", timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" },
      printBackground: true,
    });

    await browser.close();
    browser = undefined;

    // Sanitise filename for storage path
    const safeName = filename.replace(/[^a-zA-Z0-9\-_.]/g, "_");
    const path = `deals/${dealId}/${Date.now()}-${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[contractPdf] Storage upload error:", uploadErr);
      return null;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return urlData.publicUrl;
  } catch (e) {
    console.error("[contractPdf] Error generating PDF:", e);
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}
