import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PUT — Approve or decline an approval
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: {
    action: "approve" | "decline";
    reviewed_by: string;
    decline_reason?: string;
    lia_notes?: string;
    changes_made?: unknown[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, reviewed_by, decline_reason, lia_notes, changes_made } = body;
  if (!action || !reviewed_by) {
    return NextResponse.json({ error: "action and reviewed_by are required" }, { status: 400 });
  }

  // Fetch approval
  const { data: approval, error: fetchErr } = await supabase
    .from("deal_approvals")
    .select("*, deals(deal_number, assigned_sales_id, assigned_copywriter_id, contact_id, company_id, contacts(first_name, last_name, email), companies(company_name, email))")
    .eq("id", id)
    .single();

  if (fetchErr || !approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  if (approval.status !== "pending") {
    return NextResponse.json({ error: "Approval is not pending" }, { status: 400 });
  }

  const deal = approval.deals as Record<string, unknown>;
  const dealNumber = deal?.deal_number as string ?? "";
  const contact = deal?.contacts as { first_name: string; last_name: string; email: string | null } | null;
  const company = deal?.companies as { company_name: string; email: string | null } | null;
  const clientName = contact ? `${contact.first_name} ${contact.last_name}` : company?.company_name ?? "Unknown";

  // Fetch reviewer name
  const { data: reviewerProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", reviewed_by)
    .single();
  const reviewerName = reviewerProfile?.full_name ?? "LIA";

  if (action === "approve") {
    // Update approval
    await supabase
      .from("deal_approvals")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        lia_notes: lia_notes || null,
        changes_made: changes_made || [],
      })
      .eq("id", id);

    // Update deal
    await supabase
      .from("deals")
      .update({ approval_status: "approved" })
      .eq("id", approval.deal_id);

    // Notify Sales
    const salesId = deal?.assigned_sales_id as string;
    if (salesId) {
      await supabase.from("notifications").insert({
        user_id: salesId,
        title: "Deal Approved",
        message: `Your deal ${dealNumber} has been approved by ${reviewerName}.`,
        type: "deal_approval_result",
        deal_id: approval.deal_id,
        link: `/deals/${approval.deal_id}`,
      });
    }

    // Notify Copywriter
    const copywriterId = deal?.assigned_copywriter_id as string;
    if (copywriterId && copywriterId !== salesId) {
      await supabase.from("notifications").insert({
        user_id: copywriterId,
        title: "Deal Approved",
        message: `Deal ${dealNumber} has been approved by ${reviewerName}.`,
        type: "deal_approval_result",
        deal_id: approval.deal_id,
        link: `/deals/${approval.deal_id}`,
      });
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      user_id: reviewed_by,
      action: "deal_approved",
      entity_type: "deals",
      entity_id: approval.deal_id,
      details: { deal_number: dealNumber, lia_notes },
    });

    // Trigger auto-send (Stage 1 Invoice + Contract + Email)
    const autoSendResults = await triggerAutoSend(approval.deal_id, reviewed_by);

    return NextResponse.json({ ok: true, action: "approved", auto_send: autoSendResults });
  } else {
    // Decline
    if (!decline_reason) {
      return NextResponse.json({ error: "decline_reason is required" }, { status: 400 });
    }

    await supabase
      .from("deal_approvals")
      .update({
        status: "declined",
        decline_reason,
        reviewed_at: new Date().toISOString(),
        lia_notes: lia_notes || null,
      })
      .eq("id", id);

    await supabase
      .from("deals")
      .update({ approval_status: "declined" })
      .eq("id", approval.deal_id);

    // Notify Sales
    const salesId = deal?.assigned_sales_id as string;
    if (salesId) {
      await supabase.from("notifications").insert({
        user_id: salesId,
        title: "Deal Declined",
        message: `Your deal ${dealNumber} has been declined by ${reviewerName}. Reason: ${decline_reason}`,
        type: "deal_approval_result",
        deal_id: approval.deal_id,
        link: `/deals/${approval.deal_id}`,
      });
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      user_id: reviewed_by,
      action: "deal_declined",
      entity_type: "deals",
      entity_id: approval.deal_id,
      details: { deal_number: dealNumber, decline_reason },
    });

    return NextResponse.json({ ok: true, action: "declined" });
  }
}

// ─── Auto-send logic ─────────────────────────────────────────────────────────

async function triggerAutoSend(dealId: string, userId: string) {
  const results: { step: string; success: boolean; error?: string; data?: unknown }[] = [];

  // Fetch deal + payments
  const { data: deal } = await supabase
    .from("deals")
    .select("*, contacts(first_name, last_name, email), companies(company_name, email)")
    .eq("id", dealId)
    .single();

  if (!deal) {
    results.push({ step: "fetch_deal", success: false, error: "Deal not found" });
    return results;
  }

  const contact = deal.contacts as { first_name: string; last_name: string; email: string | null } | null;
  const company = deal.companies as { company_name: string; email: string | null } | null;
  const clientEmail = contact?.email ?? company?.email ?? "";
  const clientName = contact ? `${contact.first_name} ${contact.last_name}` : company?.company_name ?? "Unknown";

  // 1) Auto-generate Stage 1 Invoice
  try {
    const { data: stages } = await supabase
      .from("deal_payments")
      .select("id, stage_name, currency")
      .eq("deal_id", dealId)
      .order("created_at");

    const stageOne = stages?.find((s: { stage_name: string | null }) => s.stage_name === "Stage I");

    if (stageOne) {
      // Check if invoice already exists for this stage
      const { data: existingInvoices } = await supabase
        .from("invoices")
        .select("id, payment_stage_ids")
        .eq("deal_id", dealId);

      const alreadyHasInvoice = existingInvoices?.some((inv: { payment_stage_ids: string[] }) =>
        inv.payment_stage_ids?.includes(stageOne.id)
      );

      if (!alreadyHasInvoice) {
        const invoiceRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? "" : ""}${process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/invoices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deal_id: dealId,
            currency: (stageOne as { currency: string | null }).currency || "NZD",
            payment_stage_ids: [stageOne.id],
            contact_id: deal.contact_id || undefined,
            company_id: deal.company_id || undefined,
            created_by: userId,
          }),
        });

        if (invoiceRes.ok) {
          const invoiceData = await invoiceRes.json();
          results.push({ step: "invoice_create", success: true, data: { invoice_id: invoiceData.invoice?.id } });

          // Send invoice email
          if (clientEmail && invoiceData.invoice?.id) {
            try {
              const sendRes = await fetch(`${process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/invoices/${invoiceData.invoice.id}/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: clientEmail }),
              });
              results.push({ step: "invoice_send", success: sendRes.ok, error: sendRes.ok ? undefined : "Failed to send invoice email" });
            } catch (err) {
              results.push({ step: "invoice_send", success: false, error: String(err) });
            }
          }
        } else {
          results.push({ step: "invoice_create", success: false, error: "Invoice API returned error" });
        }
      } else {
        results.push({ step: "invoice_create", success: true, data: { skipped: true, reason: "Already exists" } });
      }
    } else {
      results.push({ step: "invoice_create", success: true, data: { skipped: true, reason: "No Stage I found" } });
    }
  } catch (err) {
    results.push({ step: "invoice_create", success: false, error: String(err) });
  }

  // 2) Auto-generate Contract
  try {
    const contractRes = await fetch(`${process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/contracts/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deal_id: dealId }),
    });

    if (contractRes.ok) {
      const contractData = await contractRes.json();
      results.push({ step: "contract_generate", success: true, data: { contract_id: contractData.contract_id } });

      // Send contract to client
      if (contractData.contract_id) {
        try {
          // First send contract (creates token)
          const sendRes = await fetch(`${process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/contracts/${contractData.contract_id}/send`, {
            method: "POST",
          });

          if (sendRes.ok) {
            const sendData = await sendRes.json();
            results.push({ step: "contract_send", success: true });

            // Send email notification to client
            if (clientEmail && sendData.token) {
              const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
              const contractLink = `${baseUrl}/contract/sign/${sendData.token}`;
              try {
                await fetch(`${baseUrl}/api/send-notification`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    email_type: "contract_sent",
                    deal_id: dealId,
                    recipient_email: clientEmail,
                    recipient_name: clientName,
                    extra_data: { contract_link: contractLink, deal_number: deal.deal_number },
                    sent_by: userId,
                  }),
                });
                results.push({ step: "contract_email", success: true });
              } catch (err) {
                results.push({ step: "contract_email", success: false, error: String(err) });
              }
            }
          } else {
            results.push({ step: "contract_send", success: false, error: "Failed to send contract" });
          }
        } catch (err) {
          results.push({ step: "contract_send", success: false, error: String(err) });
        }
      }
    } else {
      results.push({ step: "contract_generate", success: false, error: "Contract generate API returned error" });
    }
  } catch (err) {
    results.push({ step: "contract_generate", success: false, error: String(err) });
  }

  // Log auto-send results
  await supabase.from("activity_logs").insert({
    user_id: userId,
    action: "deal_auto_send_triggered",
    entity_type: "deals",
    entity_id: dealId,
    details: { results },
  });

  return results;
}
