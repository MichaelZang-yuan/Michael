import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const BUCKET = "attachments";

export async function GET(request: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY not set" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "schools" | "students"
  const id = searchParams.get("id");

  if (!type || !id) {
    return NextResponse.json(
      { error: "Missing type or id query params" },
      { status: 400 }
    );
  }

  if (type !== "schools" && type !== "students") {
    return NextResponse.json(
      { error: "type must be 'schools' or 'students'" },
      { status: 400 }
    );
  }

  const folder = `${type}/${id}`;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: files, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(folder, { sortBy: { column: "created_at", order: "desc" } });

    if (error) {
      if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
        return NextResponse.json({ files: [] });
      }
      console.error("[attachments] list error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const items = (files ?? [])
      .filter((f) => f.name && !f.name.startsWith("."))
      .map((f) => {
        const path = `${folder}/${f.name}`;
        const { data: urlData } = supabaseAdmin.storage
          .from(BUCKET)
          .getPublicUrl(path);
        return {
          name: f.name,
          url: urlData.publicUrl,
          createdAt: f.created_at ?? null,
        };
      });

    return NextResponse.json({ files: items });
  } catch (err) {
    console.error("[attachments] unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "List failed" },
      { status: 500 }
    );
  }
}
