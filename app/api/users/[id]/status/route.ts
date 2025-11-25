import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { toggleStatusSchema } from "@/lib/validations/user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { isActive } = toggleStatusSchema.parse(body);

    // 1. Update Profile
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) throw error;

    // 2. Ban/Unban in Auth (Prevents login immediately)
    const banDuration = isActive ? "none" : "876000h"; // 100 years ban
    await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: banDuration,
    });

    return NextResponse.json({ message: "Status updated" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
