import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const patchSchema = z.object({
  notes: z.string().optional().nullable(),
});

// PATCH /api/activity-records/[id] — update classification answers
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const val = patchSchema.parse(body);

    const updateData: Record<string, any> = {};
    if (val.notes !== undefined) updateData.notes = val.notes;

    const { data, error } = await supabaseAdmin
      .from("activity_records")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ record: data });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating activity record:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/activity-records/[id] — fetch a single record
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("activity_records")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    return NextResponse.json({ record: data });
  } catch (error: any) {
    console.error("Error fetching activity record:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
