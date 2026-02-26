import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: {
    toEmail: string;
    salesName: string;
    studentName: string;
    studentId: string;
    commissionYear: number;
    amount: number;
    claimedDate: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { toEmail, salesName, studentName, studentId, commissionYear, amount, claimedDate } = body;
  if (!toEmail || !studentName || !studentId) {
    return NextResponse.json(
      { error: "toEmail, studentName, and studentId are required" },
      { status: 400 }
    );
  }

  const subject = `Commission Claimed - ${studentName}`;
  const html = `
<p>Hi ${salesName || "there"},</p>

<p>The Year ${commissionYear ?? 1} commission for student ${studentName} has been claimed.</p>

<p><strong>Amount:</strong> $${amount ?? "0"} NZD<br>
<strong>Claimed Date:</strong> ${claimedDate ?? new Date().toISOString().split("T")[0]}</p>

<p>You can view the details in the PJ Commission Management System:<br>
<a href="https://pjcommission.com/students/${studentId}">https://pjcommission.com/students/${studentId}</a></p>

<p>Regards,<br>
PJ Commission System</p>
`;

  try {
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: toEmail,
      subject,
      html,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
