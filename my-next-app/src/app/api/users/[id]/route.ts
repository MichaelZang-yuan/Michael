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
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();

  if (profile?.role === "admin") {
    return NextResponse.json(
      { error: "Cannot delete admin users" },
      { status: 403 }
    );
  }

  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(id);

  if (deleteAuthError) {
    console.error("[API users delete] auth error:", deleteAuthError);
    return NextResponse.json(
      { error: deleteAuthError.message },
      { status: 400 }
    );
  }

  await supabase.from("profiles").delete().eq("id", id);

  return NextResponse.json({ success: true });
}
