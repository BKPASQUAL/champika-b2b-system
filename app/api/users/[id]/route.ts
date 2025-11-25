import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { updateUserSchema } from "@/lib/validations/user";

// PATCH: Update user details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // 1. Update Profile Data
    const profileUpdates: any = {};
    if (validatedData.fullName)
      profileUpdates.full_name = validatedData.fullName;
    if (validatedData.username)
      profileUpdates.username = validatedData.username;
    if (validatedData.role) profileUpdates.role = validatedData.role;
    // Only update status here if sent (status toggle has its own route usually)
    if (validatedData.status)
      profileUpdates.is_active = validatedData.status === "Active";

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdates)
      .eq("id", id);

    if (profileError) throw profileError;

    // 2. Update Auth Data (Email/Password)
    const authUpdates: any = {};
    if (validatedData.email) authUpdates.email = validatedData.email;
    if (validatedData.password && validatedData.password.trim() !== "") {
      authUpdates.password = validatedData.password;
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } =
        await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
      if (authError) throw authError;
    }

    return NextResponse.json({ message: "User updated successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Update failed" },
      { status: 500 }
    );
  }
}

// DELETE: Remove user (Cascades to Profile)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;
    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
