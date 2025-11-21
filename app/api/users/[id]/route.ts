import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { updateUserSchema } from "@/lib/validations/user";
import { ZodError } from "zod";

// GET: Fetch single user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

// PATCH: Update user details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    const validatedData = updateUserSchema.parse(body);

    const profileUpdates: any = {};
    if (validatedData.fullName)
      profileUpdates.full_name = validatedData.fullName;
    if (validatedData.username)
      profileUpdates.username = validatedData.username;
    if (validatedData.role) profileUpdates.role = validatedData.role;
    if (validatedData.status)
      profileUpdates.is_active = validatedData.status === "Active";

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdates)
      .eq("id", id);

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    const authUpdates: any = {};
    if (validatedData.email) authUpdates.email = validatedData.email;
    if (validatedData.password && validatedData.password.trim().length > 0) {
      authUpdates.password = validatedData.password;
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } =
        await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ message: "User updated successfully" });
  } catch (error) {
    if (error instanceof ZodError) {
      // CHANGE: Use .issues instead of .errors
      return NextResponse.json(
        { error: "Validation Error", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// DELETE: Remove user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
