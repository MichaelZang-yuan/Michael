import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const BUCKET = "attachments";

export async function POST(request: Request) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY not set" },
      { status: 500 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  await supabaseAdmin.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null; // "schools" | "students"
  const id = formData.get("id") as string | null;

  if (!file || !type || !id) {
    return NextResponse.json(
      { error: "Missing file, type (schools|students), or id" },
      { status: 400 }
    );
  }

  if (type !== "schools" && type !== "students") {
    return NextResponse.json(
      { error: "type must be 'schools' or 'students'" },
      { status: 400 }
    );
  }

  const sanitizedName = file.name.replace(/[/\\]/g, "_");
  const path = `${type}/${id}/${Date.now()}-${sanitizedName}`;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (error) {
      console.error("[upload] storage error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("[upload] unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
