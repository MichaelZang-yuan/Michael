import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY not set" },
      { status: 500 }
    );
  }

  let body: { email?: string; full_name?: string; role?: string; department?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const email = body.email?.trim();
  const full_name = body.full_name?.trim();
  const role = body.role ?? "sales";
  const department = body.department ?? "china";

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    );
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: "Welcome123!",
    email_confirm: true,
    user_metadata: { full_name: full_name || null },
  });

  if (createError) {
    console.error("[API users create] auth error:", createError);
    return NextResponse.json(
      { error: createError.message },
      { status: 400 }
    );
  }

  if (!user.user) {
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: user.user.id,
        full_name: full_name || null,
        email,
        role,
        department,
      },
      { onConflict: "id" }
    );

  if (profileError) {
    console.error("[API users create] profile insert error:", profileError);
    return NextResponse.json(
      { error: "User created but failed to save profile." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.user.id,
      full_name: full_name || null,
      email,
      role,
      department,
      created_at: new Date().toISOString(),
    },
  });
}
