import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const performedByName = body.performedByName || "Admin";

    const { data: book, error: fetchErr } = await supabaseAdmin
      .from("receipt_books")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !book) {
      return NextResponse.json({ error: "Receipt book not found" }, { status: 404 });
    }

    const { data: updatedBook, error: updateErr } = await supabaseAdmin
      .from("receipt_books")
      .update({ status: "Completed", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await supabaseAdmin.from("receipt_book_audits").insert({
      receipt_book_id: id,
      action_type: "COMPLETED",
      book_number: book.book_number,
      start_number_old: book.start_number,
      end_number_old: book.end_number,
      assigned_to_old_id: book.assigned_to_user_id,
      assigned_to_old_name: book.assigned_to_user_name,
      performed_by_name: performedByName,
      notes: `Receipt book #${book.book_number} marked as completed`,
    });

    return NextResponse.json(updatedBook);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
