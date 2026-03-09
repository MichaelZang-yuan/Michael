import { NextRequest, NextResponse } from "next/server";
import { updateDealStatus } from "@/lib/zoho";

export async function POST(request: NextRequest) {
  let body: { studentName?: string; schoolName?: string; enrollmentDate?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const studentName = body.studentName?.trim();
  const schoolName = body.schoolName?.trim() ?? "";
  const enrollmentDate = body.enrollmentDate?.trim() || null;

  if (!studentName) {
    return NextResponse.json({ success: false, error: "studentName required" }, { status: 400 });
  }

  try {
    const result = await updateDealStatus(studentName, schoolName, enrollmentDate);
    return NextResponse.json(
      result.success
        ? { success: true, dealName: result.dealName, dealId: result.dealId, previousStage: result.previousStage }
        : { success: false, error: result.error }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[Zoho update-deal]", err);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
