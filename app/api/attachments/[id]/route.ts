// app/api/attachments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ─── DELETE: Remove an attachment ──────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the record first to get the storage path
    const { data: attachment, error: fetchError } = await supabaseAdmin
      .from("document_attachments")
      .select("file_path")
      .eq("id", id)
      .single();

    if (fetchError || !attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Remove from Supabase Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from("attachments")
      .remove([attachment.file_path]);

    if (storageError) {
      // Log but don't block DB deletion
      console.error("Storage deletion error:", storageError);
    }

    // Remove from DB
    const { error: dbError } = await supabaseAdmin
      .from("document_attachments")
      .delete()
      .eq("id", id);

    if (dbError) throw dbError;

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/attachments/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
