import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type NotificationBody = {
  email_type: string;
  deal_id?: string;
  contact_id?: string;
  company_id?: string;
  recipient_email: string;
  recipient_name: string;
  extra_data?: Record<string, unknown>;
  sent_by?: string;
};

function buildEmailContent(
  emailType: string,
  dealNumber: string,
  clientName: string,
  visaType: string | null,
  liaName: string | null,
  extraData: Record<string, unknown>
): { subject: string; html: string } {
  const base = `<p style="color:#555;font-size:14px;line-height:1.6">`;
  const sign = `<p style="color:#555;font-size:14px;margin-top:20px">Regards,<br><strong>PJ Operation & Management System</strong></p>`;

  switch (emailType) {
    case "welcome":
      return {
        subject: `Welcome to PJ - Your ${visaType ?? "Application"} ${dealNumber}`,
        html: `${base}Dear ${clientName},</p>
${base}Thank you for choosing PJ. We are pleased to confirm that we have received your application/enquiry and will be assisting you with your <strong>${visaType ?? "application"}</strong>.</p>
${base}Your case reference number is: <strong>${dealNumber}</strong>${liaName ? `<br>Your assigned consultant is: <strong>${liaName}</strong>` : ""}</p>
${base}We will be in touch shortly with the next steps. If you have any questions, please don't hesitate to contact us.</p>
${sign}`,
      };

    case "contract_sent": {
      const contractLink = extraData?.contract_link as string | undefined;
      const liaSignature = liaName
        ? `<p style="color:#555;font-size:14px;margin:0"><strong>${liaName}</strong></p>`
        : "";
      return {
        subject: `Contract Ready for Signing - ${dealNumber}`,
        html: `${base}Dear ${clientName},</p>
${base}Thank you for choosing PJ International to assist you with your immigration matters.</p>
${base}We are pleased to confirm your engagement with our services following our recent discussions. To formally begin our professional relationship, we kindly ask you to review and sign the Immigration Services Agreement.</p>
${contractLink ? `<p style="margin:20px 0"><a href="${contractLink}" style="background:#1e3a5f;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px">Review &amp; Sign Contract →</a></p>
${base}Or copy this link into your browser:<br><a href="${contractLink}" style="color:#2563eb;font-size:13px">${contractLink}</a></p>` : ""}
${base}The agreement outlines the services we will provide, the associated fees, and your responsibilities as a client. Signing this agreement ensures a clear, transparent, and compliant working relationship.</p>
${base}For your reference, we also encourage you to review the following documents, available here:</p>
<ul style="color:#555;font-size:14px;line-height:2;padding-left:20px">
  <li><a href="https://exxvgcbtgkjltwzjoyxd.supabase.co/storage/v1/object/public/attachments/reference-docs/V10%20Code%20of%20Conduct%202014.pdf" style="color:#2563eb">Licensed Immigration Advisers Code of Conduct 2014</a></li>
  <li><a href="https://exxvgcbtgkjltwzjoyxd.supabase.co/storage/v1/object/public/attachments/reference-docs/V09%20Professional%20Standards.pdf" style="color:#2563eb">IAA's Professional Standards</a></li>
  <li><a href="https://exxvgcbtgkjltwzjoyxd.supabase.co/storage/v1/object/public/attachments/reference-docs/V11.%20Internal%20Complaint%20Procedure.pdf" style="color:#2563eb">PJ International's Internal Compliance Procedure</a></li>
  <li><a href="https://exxvgcbtgkjltwzjoyxd.supabase.co/storage/v1/object/public/attachments/reference-docs/V16%20Terms%20and%20Conditions.pdf" style="color:#2563eb">PJ International's Terms and Conditions</a></li>
</ul>
${base}Please take a moment to read through these documents. If you have any questions or need further clarification before signing, feel free to contact us.</p>
${base}We look forward to working with you and supporting you throughout your immigration journey.</p>
<p style="color:#555;font-size:14px;margin-top:20px">Warm regards,<br>
${liaSignature}
Licensed Immigration Adviser<br>
PJ International</p>`,
      };
    }

    case "contract_signed":
      return {
        subject: `Contract Confirmed - ${dealNumber}`,
        html: `${base}Dear ${clientName},</p>
${base}Thank you! We have confirmed that your service agreement for case <strong>${dealNumber}</strong> has been fully executed.</p>
${base}We will shortly send you a client information form to collect the details required to progress your application. Please watch for our next email.</p>
${sign}`,
      };

    case "intake_form_sent": {
      const intakeLink = extraData?.intake_link as string | undefined;
      return {
        subject: `Please Complete Your Information Form - ${dealNumber}`,
        html: `${base}Dear ${clientName},</p>
${base}To progress your <strong>${visaType ?? "application"}</strong> (case: <strong>${dealNumber}</strong>), we need to collect some information from you.</p>
${base}Please click the link below to complete your client information form at your earliest convenience:</p>
<p style="margin:20px 0"><a href="${intakeLink ?? "#"}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Complete Your Form →</a></p>
${intakeLink ? `${base}Or copy this link into your browser:<br><a href="${intakeLink}" style="color:#2563eb">${intakeLink}</a></p>` : ""}
${base}If you have any questions, please contact your consultant${liaName ? ` <strong>${liaName}</strong>` : ""}.</p>
${sign}`,
      };
    }

    case "payment_received": {
      const amount = extraData?.amount as number | undefined;
      const description = extraData?.description as string | undefined;
      const paidDate = extraData?.paid_date as string | undefined;
      return {
        subject: `Payment Received - Receipt for ${dealNumber}`,
        html: `${base}Dear ${clientName},</p>
${base}We confirm receipt of your payment for case <strong>${dealNumber}</strong>.</p>
<table style="border-collapse:collapse;width:100%;max-width:400px;margin:16px 0">
  <tr><td style="padding:8px;border:1px solid #ddd;color:#555;font-size:14px"><strong>Case Reference</strong></td><td style="padding:8px;border:1px solid #ddd;color:#555;font-size:14px">${dealNumber}</td></tr>
  ${description ? `<tr><td style="padding:8px;border:1px solid #ddd;color:#555;font-size:14px"><strong>Description</strong></td><td style="padding:8px;border:1px solid #ddd;color:#555;font-size:14px">${description}</td></tr>` : ""}
  ${amount ? `<tr><td style="padding:8px;border:1px solid #ddd;color:#555;font-size:14px"><strong>Amount</strong></td><td style="padding:8px;border:1px solid #ddd;color:#555;font-size:14px">$${amount.toLocaleString()} NZD</td></tr>` : ""}
  ${paidDate ? `<tr><td style="padding:8px;border:1px solid #ddd;color:#555;font-size:14px"><strong>Date</strong></td><td style="padding:8px;border:1px solid #ddd;color:#555;font-size:14px">${paidDate}</td></tr>` : ""}
</table>
${base}Please keep this email as your receipt. Thank you for your payment.</p>
${sign}`,
      };
    }

    case "application_submitted": {
      const submittedDate = extraData?.submitted_date as string | undefined;
      return {
        subject: `Application Submitted - ${dealNumber}`,
        html: `${base}Dear ${clientName},</p>
${base}We are pleased to inform you that your <strong>${visaType ?? "application"}</strong> (case: <strong>${dealNumber}</strong>) has been formally submitted to Immigration New Zealand${submittedDate ? ` on <strong>${submittedDate}</strong>` : ""}.</p>
${base}The processing time can vary. We will notify you as soon as we receive an update from Immigration New Zealand. In the meantime, please ensure you do not travel outside New Zealand without consulting us first (if applicable).</p>
${base}If you have any questions, please contact your consultant${liaName ? ` <strong>${liaName}</strong>` : ""}.</p>
${sign}`,
      };
    }

    case "application_approved":
      return {
        subject: `Congratulations! Application Approved - ${dealNumber}`,
        html: `${base}Dear ${clientName},</p>
${base}Congratulations! 🎉 We are delighted to inform you that your <strong>${visaType ?? "application"}</strong> (case: <strong>${dealNumber}</strong>) has been <strong>approved</strong> by Immigration New Zealand.</p>
${base}Your consultant${liaName ? ` <strong>${liaName}</strong>` : ""} will be in touch shortly with detailed information about your visa/permit conditions and next steps.</p>
${base}Thank you for trusting PJ with your immigration journey. We wish you all the best!</p>
${sign}`,
      };

    case "application_declined":
      return {
        subject: `Application Update - ${dealNumber}`,
        html: `${base}Dear ${clientName},</p>
${base}We regret to inform you that your <strong>${visaType ?? "application"}</strong> (case: <strong>${dealNumber}</strong>) has not been approved at this time.</p>
${base}Your consultant${liaName ? ` <strong>${liaName}</strong>` : ""} will contact you shortly to discuss the decision in detail and explore the options available to you, which may include a reconsideration, appeal, or an alternative immigration pathway.</p>
${base}Please don't be discouraged — we are committed to helping you find the best way forward.</p>
${sign}`,
      };

    case "intake_completed":
      return {
        subject: `Client Information Form Completed - ${dealNumber}`,
        html: `${base}Hi${liaName ? ` ${liaName}` : ""},</p>
${base}The client <strong>${clientName}</strong> has completed their information form for case <strong>${dealNumber}</strong>.</p>
${base}Please log in to review the submitted information and proceed with the application.</p>
${sign}`,
      };

    default:
      return {
        subject: `Update - ${dealNumber}`,
        html: `${base}Dear ${clientName},</p>
${base}You have an update for your case <strong>${dealNumber}</strong>. Please contact your consultant for details.</p>
${sign}`,
      };
  }
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured" }, { status: 500 });
  }

  let body: NotificationBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email_type, deal_id, contact_id, company_id, recipient_email, recipient_name, extra_data, sent_by } = body;

  if (!email_type || !recipient_email) {
    return NextResponse.json({ error: "email_type and recipient_email are required" }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Fetch deal details if deal_id provided
  let dealNumber = extra_data?.deal_number as string | undefined ?? "";
  let visaType: string | null = null;
  let liaName: string | null = null;
  let resolvedContactId = contact_id ?? null;
  let resolvedCompanyId = company_id ?? null;

  if (deal_id) {
    const { data: dealData } = await supabaseAdmin
      .from("deals")
      .select("deal_number, visa_type, deal_type, contact_id, company_id, assigned_lia:profiles!assigned_lia_id(full_name)")
      .eq("id", deal_id)
      .single();

    if (dealData) {
      dealNumber = dealData.deal_number ?? dealNumber;
      visaType = dealData.visa_type ?? dealData.deal_type ?? null;
      const liaProfile = dealData.assigned_lia as unknown as { full_name: string | null } | null;
      liaName = liaProfile?.full_name ?? null;
      if (!resolvedContactId) resolvedContactId = dealData.contact_id ?? null;
      if (!resolvedCompanyId) resolvedCompanyId = dealData.company_id ?? null;
    }
  }

  const { subject, html } = buildEmailContent(
    email_type,
    dealNumber,
    recipient_name,
    visaType,
    liaName,
    extra_data ?? {}
  );

  const fullHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="border-bottom:2px solid #1e3a5f;padding-bottom:16px;margin-bottom:24px">
    <h2 style="color:#1e3a5f;margin:0;font-size:18px">PJ Operation & Management System</h2>
  </div>
  ${html}
  <div style="border-top:1px solid #eee;margin-top:32px;padding-top:16px">
    <p style="color:#999;font-size:12px;margin:0">This is an automated notification from PJ Operation & Management System.</p>
  </div>
</body>
</html>`;

  let emailStatus: "sent" | "failed" = "failed";
  let emailError: string | undefined;

  try {
    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: recipient_email,
      subject,
      html: fullHtml,
    });

    if (error) {
      emailError = error.message;
    } else {
      emailStatus = "sent";
    }
  } catch (err) {
    emailError = err instanceof Error ? err.message : "Send failed";
  }

  // Log to email_logs
  await supabaseAdmin.from("email_logs").insert({
    deal_id: deal_id ?? null,
    contact_id: resolvedContactId,
    company_id: resolvedCompanyId,
    email_type,
    recipient_email,
    recipient_name,
    subject,
    body: html,
    status: emailStatus,
    sent_by: sent_by ?? null,
  });

  if (emailStatus === "failed") {
    return NextResponse.json({ error: emailError ?? "Email send failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
