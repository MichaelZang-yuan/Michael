import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY not set" },
      { status: 500 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. 先删除 commissions 表里 student_id = 当前学生 id 的所有记录
    const { error: commissionsError } = await supabaseAdmin
      .from("commissions")
      .delete()
      .eq("student_id", id);

    if (commissionsError) {
      console.error("[API students delete] commissions error:", commissionsError);
      return NextResponse.json(
        { error: commissionsError.message },
        { status: 400 }
      );
    }

    // 2. 再删除 students 表里这个学生的记录
    const { error: studentError } = await supabaseAdmin
      .from("students")
      .delete()
      .eq("id", id);

    if (studentError) {
      console.error("[API students delete] student error:", studentError);
      return NextResponse.json(
        { error: studentError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API students delete] unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
