import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("location_assignments")
      .select("user_id")
      .eq("location_id", id);

    if (error) throw error;

    return NextResponse.json({
      assignedUserIds: data.map((item: any) => item.user_id),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userIds } = body; // Array of user IDs

    if (!Array.isArray(userIds)) {
      return NextResponse.json(
        { error: "Invalid data format" },
        { status: 400 }
      );
    }

    // 1. Delete existing assignments for this location
    // Note: In a production app you might want to soft delete or handle this more gracefully
    const { error: deleteError } = await supabaseAdmin
      .from("location_assignments")
      .delete()
      .eq("location_id", id);

    if (deleteError) throw deleteError;

    // 2. Insert new assignments
    if (userIds.length > 0) {
      const inserts = userIds.map((userId: string) => ({
        location_id: id,
        user_id: userId,
      }));

      const { error: insertError } = await supabaseAdmin
        .from("location_assignments")
        .insert(inserts);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
