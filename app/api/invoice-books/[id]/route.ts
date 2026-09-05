import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const updateInvoiceBookSchema = z.object({
  currentNumber: z.number().int().optional(),
  status: z.enum(["Active", "Completed", "Cancelled"]).optional(),
  assignedToUserId: z.string().optional(),
  notes: z.string().optional(),
  performedByName: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const val = updateInvoiceBookSchema.parse(body);

    const { data: existing, error: findErr } = await supabaseAdmin
      .from("invoice_books")
      .select("*")
      .eq("id", id)
      .single();

    if (findErr || !existing) {
      return NextResponse.json({ error: "Invoice book not found" }, { status: 404 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (val.currentNumber !== undefined) updates.current_number = val.currentNumber;
    if (val.status !== undefined) updates.status = val.status;

    if (val.assignedToUserId) {
      const { data: u } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", val.assignedToUserId)
        .single();
      if (u) {
        updates.assigned_to_user_id = u.id;
        updates.assigned_to_user_name = u.full_name || u.email;
      }
    }

    // Auto-mark completed if current_number exceeds end_number
    const targetCurrent = updates.current_number ?? existing.current_number;
    if (targetCurrent > existing.end_number && !updates.status) {
      updates.status = "Completed";
    }

    const { data: updatedBook, error: updateErr } = await supabaseAdmin
      .from("invoice_books")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Log audit
    try {
      await supabaseAdmin.from("invoice_book_audits").insert({
        invoice_book_id: id,
        action_type: val.status === "Completed" ? "COMPLETED" : "EDITED",
        book_number: existing.book_number,
        start_number_old: existing.start_number,
        end_number_old: existing.end_number,
        assigned_to_old_name: existing.assigned_to_user_name,
        performed_by_name: val.performedByName || "Admin",
        notes: val.notes || `Invoice book updated: current_number=${targetCurrent}, status=${updates.status || existing.status}`,
      });
    } catch {
      // Optional audit log fail
    }

    return NextResponse.json(updatedBook);
  } catch (error: any) {
    console.error("Error updating invoice book:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { error } = await supabaseAdmin.from("invoice_books").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
