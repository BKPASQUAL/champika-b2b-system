// app/api/attachments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = "attachments";

// Ensure the bucket exists (creates it on first use)
async function ensureBucket() {
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 20971520, // 20 MB
    allowedMimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  });
  // Ignore "already exists" error
  if (error && !error.message.includes("already exists")) {
    console.error("Bucket creation error:", error);
  }
}

// ─── GET: List attachments for an entity ───────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("document_attachments")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("GET /api/attachments error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── POST: Upload a new attachment ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    await ensureBucket();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as string | null;
    const entityId = formData.get("entityId") as string | null;
    const label = (formData.get("label") as string) || "";

    if (!file || !entityType || !entityId) {
      return NextResponse.json(
        { error: "file, entityType and entityId are required" },
        { status: 400 }
      );
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size exceeds 20 MB limit" },
        { status: 400 }
      );
    }

    // Build storage path:  attachments/{entityType}/{entityId}/{timestamp}-{random}.{ext}
    const ext = file.name.split(".").pop() ?? "bin";
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
    const filePath = `${entityType}/${entityId}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    // Save metadata to DB
    const { data, error: dbError } = await supabaseAdmin
      .from("document_attachments")
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        label: label || null,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/attachments error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
