import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  contactPerson: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(9).optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["Active", "Inactive", "Pending"]).optional(),
  duePayment: z.number().optional(),
});

// GET Single Supplier
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { data, error } = await supabaseAdmin
      .from("suppliers")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// UPDATE Supplier
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const val = updateSchema.parse(body);

    const dbUpdates: any = {};
    if (val.name) dbUpdates.name = val.name;
    if (val.contactPerson) dbUpdates.contact_person = val.contactPerson;
    if (val.email !== undefined) dbUpdates.email = val.email;
    if (val.phone) dbUpdates.phone = val.phone;
    if (val.address !== undefined) dbUpdates.address = val.address;
    if (val.category) dbUpdates.category = val.category;
    if (val.status) dbUpdates.status = val.status;
    if (val.duePayment !== undefined) dbUpdates.due_payment = val.duePayment;
    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from("suppliers")
      .update(dbUpdates)
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ message: "Supplier updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE Supplier
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { error } = await supabaseAdmin
      .from("suppliers")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ message: "Supplier deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
