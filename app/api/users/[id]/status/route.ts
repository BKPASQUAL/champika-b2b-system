import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { toggleStatusSchema } from "@/lib/validations/user";
import { ZodError } from "zod";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { isActive } = toggleStatusSchema.parse(body);

    // 1. Update Profile Status
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. (Optional) Handle Auth Ban logic
    // If inactive, ban user to prevent token refresh
    const banDuration = isActive ? "none" : "876000h"; // 100 years
    await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: banDuration,
    });

    return NextResponse.json({
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      status: isActive ? "Active" : "Inactive",
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid status format" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
