import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const { isIncorrect } = await request.json();

    if (typeof isIncorrect !== "boolean") {
      return NextResponse.json(
        { error: "isIncorrect parameter must be a boolean value" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("invoices")
      .update({ is_incorrect: isIncorrect })
      .eq("id", id)
      .select("id, is_incorrect")
      .single();

    if (error) {
      console.error("Database error toggling is_incorrect flag:", error);
      throw error;
    }

    return NextResponse.json({
      message: "Invoice incorrect status updated successfully",
      data,
    });
  } catch (error: any) {
    console.error("API Error updating invoice incorrect status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
