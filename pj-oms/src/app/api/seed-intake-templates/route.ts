import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { insertIntakeTemplates } from "@/lib/intake-templates-seed";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  // Verify admin via auth header
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: { user } } = await anonClient.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile } = await adminClient.from("profiles").select("role, roles").eq("id", user.id).single();
  if (!profile || !(profile.roles?.includes("admin") || profile.role === "admin")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const results = await insertIntakeTemplates(adminClient);
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    return NextResponse.json({ success: false, results, errors }, { status: 500 });
  }
  return NextResponse.json({ success: true, results });
}
