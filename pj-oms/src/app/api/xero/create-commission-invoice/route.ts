import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getXeroAccessToken,
  getXeroTenants,
  findOrCreateXeroContact,
  createXeroInvoice,
  updateXeroInvoice,
  getXeroInvoice,
  type XeroLineItem,
} from "@/lib/xero";

/**
 * POST: Create or append to a Xero commission invoice (PJ International Limited)
 * Called after a commission is claimed.
 * Body: { commission_id: string, student_name: string, school_name: string, amount: number, year: string }
 *
 * Logic:
 * - Find existing DRAFT Xero invoice for the same school → append line item
 * - If none exists → create a new DRAFT ACCREC invoice for the school
 * - Save Xero invoice ID on the commission record
 */
export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let body: {
    commission_id: string;
    student_name: string;
    school_name: string;
    amount: number;
    year: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { commission_id, student_name, school_name, amount, year } = body;
  if (!commission_id || !student_name || !school_name || !amount) {
    return NextResponse.json(
      { error: "commission_id, student_name, school_name, and amount are required" },
      { status: 400 }
    );
  }

  // Get Xero access token and PJ International tenant
  const accessToken = await getXeroAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Xero not connected or token refresh failed" },
      { status: 401 }
    );
  }

  const tenants = await getXeroTenants();
  if (!tenants.international) {
    return NextResponse.json(
      { error: "PJ International tenant not mapped in Xero" },
      { status: 400 }
    );
  }

  // Find or create school contact in Xero
  const xeroContactId = await findOrCreateXeroContact(
    accessToken,
    tenants.international,
    school_name
  );

  if (!xeroContactId) {
    return NextResponse.json(
      { error: "Failed to find/create school contact in Xero" },
      { status: 500 }
    );
  }

  // Check if there's an existing DRAFT invoice for this school in our commissions
  const { data: existingCommissions } = await supabase
    .from("commissions")
    .select("xero_invoice_id")
    .not("xero_invoice_id", "is", null)
    .neq("xero_invoice_id", "");

  // Check which Xero invoices are still DRAFT
  let appendedToExisting = false;
  let xeroInvoiceId: string | null = null;
  let xeroInvoiceNumber: string | null = null;

  if (existingCommissions && existingCommissions.length > 0) {
    // Get unique Xero invoice IDs
    const xeroIds = [
      ...new Set(existingCommissions.map((c) => c.xero_invoice_id as string)),
    ];

    for (const id of xeroIds) {
      const xeroInv = await getXeroInvoice(accessToken, tenants.international, id);
      if (!xeroInv) continue;

      // Check if it's DRAFT and same school contact
      const invContact = xeroInv.Contact as { ContactID?: string } | undefined;
      if (
        xeroInv.Status === "DRAFT" &&
        invContact?.ContactID === xeroContactId
      ) {
        // Append line item to existing invoice
        const existingLines = (xeroInv.LineItems as XeroLineItem[]) || [];
        const newLine: XeroLineItem = {
          Description: `Commission - ${student_name} (${year})`,
          Quantity: 1,
          UnitAmount: amount,
          AccountCode: "200",
          TaxType: "NONE",
        };

        const updatedInv = await updateXeroInvoice(
          accessToken,
          tenants.international,
          id,
          {
            LineItems: [...existingLines, newLine],
          }
        );

        if (updatedInv) {
          xeroInvoiceId = updatedInv.InvoiceID;
          xeroInvoiceNumber = updatedInv.InvoiceNumber;
          appendedToExisting = true;
          break;
        }
      }
    }
  }

  // If no existing DRAFT invoice found, create new one
  if (!appendedToExisting) {
    const lineItem: XeroLineItem = {
      Description: `Commission - ${student_name} (${year})`,
      Quantity: 1,
      UnitAmount: amount,
      AccountCode: "200",
      TaxType: "NONE",
    };

    const xeroInvoice = await createXeroInvoice(
      accessToken,
      tenants.international,
      {
        Type: "ACCREC",
        Contact: { ContactID: xeroContactId },
        LineItems: [lineItem],
        Date: new Date().toISOString().split("T")[0],
        CurrencyCode: "NZD",
        Status: "DRAFT",
        Reference: `Commission Invoice - ${school_name}`,
      }
    );

    if (!xeroInvoice) {
      return NextResponse.json(
        { error: "Failed to create Xero invoice" },
        { status: 500 }
      );
    }

    xeroInvoiceId = xeroInvoice.InvoiceID;
    xeroInvoiceNumber = xeroInvoice.InvoiceNumber;
  }

  // Save Xero invoice ID on the commission record
  if (xeroInvoiceId) {
    await supabase
      .from("commissions")
      .update({ xero_invoice_id: xeroInvoiceId })
      .eq("id", commission_id);
  }

  return NextResponse.json({
    ok: true,
    xero_invoice_id: xeroInvoiceId,
    xero_invoice_number: xeroInvoiceNumber,
    appended: appendedToExisting,
  });
}
