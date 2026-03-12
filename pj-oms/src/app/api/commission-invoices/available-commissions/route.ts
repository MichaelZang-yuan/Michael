import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET: List commissions that are claimed but not yet linked to a commission invoice.
 * Optional filter by school_id.
 */
export async function GET(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("school_id");

  // Get commissions that are claimed and have no invoice linked
  let query = supabase
    .from("commissions")
    .select("id, student_id, year, amount, tuition_fee, commission_rate, enrollment_date, students!inner(full_name, student_number, school_id)")
    .eq("status", "claimed")
    .is("commission_invoice_id", null)
    .order("created_at", { ascending: false });

  if (schoolId) {
    query = query.eq("students.school_id", schoolId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ commissions: data ?? [] });
}
