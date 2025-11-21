import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createUserSchema } from "@/lib/validations/user";
import { ZodError } from "zod";

// GET: Fetch all users
export async function GET() {
  try {
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = profiles.map((profile) => ({
      id: profile.id,
      fullName: profile.full_name,
      username: profile.username,
      email: profile.email,
      role: profile.role,
      status: profile.is_active ? "Active" : "Inactive",
      lastActive: profile.updated_at,
    }));

    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST: Create a new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validatedData = createUserSchema.parse(body);

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: validatedData.email,
        password: validatedData.password,
        email_confirm: true,
        user_metadata: {
          full_name: validatedData.fullName,
          role: validatedData.role,
        },
      });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: validatedData.fullName,
        username: validatedData.username,
        role: validatedData.role,
        is_active: validatedData.status === "Active",
      })
      .eq("id", authData.user.id);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "User created successfully", userId: authData.user.id },
      { status: 201 }
    );
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
