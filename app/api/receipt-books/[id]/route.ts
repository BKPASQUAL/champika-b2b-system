import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const updateReceiptBookSchema = z.object({
  bookNumber: z.string().optional(),
  startNumber: z.number().int().optional(),
  endNumber: z.number().int().optional(),
  currentNumber: z.number().int().optional(),
  assignedToUserId: z.string().optional(),
  status: z.enum(["Active", "Completed", "Cancelled"]).optional(),
  performedByName: z.string().optional().nullable(),
  performedByEmail: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: book, error: bookErr } = await supabaseAdmin
      .from("receipt_books")
      .select("*")
      .eq("id", id)
      .single();

    if (bookErr || !book) {
      return NextResponse.json({ error: "Receipt book not found" }, { status: 404 });
    }

    const { data: audits } = await supabaseAdmin
      .from("receipt_book_audits")
      .select("*")
      .eq("receipt_book_id", id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ ...book, audits: audits || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const val = updateReceiptBookSchema.parse(body);

    const { data: oldBook, error: fetchErr } = await supabaseAdmin
      .from("receipt_books")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !oldBook) {
      return NextResponse.json({ error: "Receipt book not found" }, { status: 404 });
    }

    let assignedUserName = oldBook.assigned_to_user_name;
    let newUserId = oldBook.assigned_to_user_id;

    if (val.assignedToUserId && val.assignedToUserId !== oldBook.assigned_to_user_id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", val.assignedToUserId)
        .single();

      if (profile) {
        newUserId = profile.id;
        assignedUserName = profile.full_name || profile.email || "Unknown";
      }
    }

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (val.bookNumber) updates.book_number = val.bookNumber;
    if (val.startNumber !== undefined) updates.start_number = val.startNumber;
    if (val.endNumber !== undefined) updates.end_number = val.endNumber;
    if (val.currentNumber !== undefined) updates.current_number = val.currentNumber;
    if (val.status) updates.status = val.status;
    updates.assigned_to_user_id = newUserId;
    updates.assigned_to_user_name = assignedUserName;

    const { data: updatedBook, error: updateErr } = await supabaseAdmin
      .from("receipt_books")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Build diff notes for Audit Log
    const changes: string[] = [];
    if (val.bookNumber && val.bookNumber !== oldBook.book_number) {
      changes.push(`Book #: ${oldBook.book_number} → ${val.bookNumber}`);
    }
    if (val.startNumber !== undefined && val.startNumber !== oldBook.start_number) {
      changes.push(`Start #: ${oldBook.start_number} → ${val.startNumber}`);
    }
    if (val.endNumber !== undefined && val.endNumber !== oldBook.end_number) {
      changes.push(`End #: ${oldBook.end_number} → ${val.endNumber}`);
    }
    if (val.assignedToUserId && val.assignedToUserId !== oldBook.assigned_to_user_id) {
      changes.push(`Assigned User: ${oldBook.assigned_to_user_name} → ${assignedUserName}`);
    }
    if (val.status && val.status !== oldBook.status) {
      changes.push(`Status: ${oldBook.status} → ${val.status}`);
    }

    const actionType = val.assignedToUserId && val.assignedToUserId !== oldBook.assigned_to_user_id
      ? "ASSIGNED"
      : val.status && val.status !== oldBook.status
      ? "STATUS_CHANGED"
      : "EDITED";

    await supabaseAdmin.from("receipt_book_audits").insert({
      receipt_book_id: id,
      action_type: actionType,
      book_number: updatedBook.book_number,
      start_number_old: oldBook.start_number,
      start_number_new: updatedBook.start_number,
      end_number_old: oldBook.end_number,
      end_number_new: updatedBook.end_number,
      assigned_to_old_id: oldBook.assigned_to_user_id,
      assigned_to_old_name: oldBook.assigned_to_user_name,
      assigned_to_new_id: updatedBook.assigned_to_user_id,
      assigned_to_new_name: updatedBook.assigned_to_user_name,
      performed_by_name: val.performedByName || "Admin",
      performed_by_email: val.performedByEmail || null,
      notes: val.notes || (changes.length > 0 ? changes.join(" | ") : "Receipt book updated"),
    });

    return NextResponse.json(updatedBook);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const performedByName = searchParams.get("performedByName") || "Admin";

    const { data: book, error: fetchErr } = await supabaseAdmin
      .from("receipt_books")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !book) {
      return NextResponse.json({ error: "Receipt book not found" }, { status: 404 });
    }

    const { data: cancelledBook, error: updateErr } = await supabaseAdmin
      .from("receipt_books")
      .update({ status: "Cancelled", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await supabaseAdmin.from("receipt_book_audits").insert({
      receipt_book_id: id,
      action_type: "CANCELLED",
      book_number: book.book_number,
      start_number_old: book.start_number,
      end_number_old: book.end_number,
      assigned_to_old_id: book.assigned_to_user_id,
      assigned_to_old_name: book.assigned_to_user_name,
      performed_by_name: performedByName,
      notes: `Receipt book #${book.book_number} cancelled`,
    });

    return NextResponse.json(cancelledBook);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
