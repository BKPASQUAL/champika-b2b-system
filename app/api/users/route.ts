import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createUserSchema } from "@/lib/validations/user";
import { ZodError } from "zod";

// GET: Fetch users (optionally filtered by role) with Business info
export async function GET(request: NextRequest) {
  try {
    // 1. Extract 'role' from query params (e.g., /api/users?role=rep)
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");

    // 2. Build the base query
    let query = supabaseAdmin
      .from("profiles")
      .select(
        `
        *,
        businesses (
          name
        )
      `
      )
      .order("created_at", { ascending: false });

    // 3. Apply role filter if provided
    if (role) {
      query = query.eq("role", role);
    }

    const { data: profiles, error } = await query;

    if (error) throw error;

    // 4. Map to response format
    const users = profiles.map((profile: any) => ({
      id: profile.id,
      fullName: profile.full_name,
      username: profile.username,
      email: profile.email,
      role: profile.role,
      status: profile.is_active ? "Active" : "Inactive",
      lastActive: profile.updated_at,
      businessId: profile.business_id,
      businessName: profile.businesses?.name,
    }));

    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new user with Business ID
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // 1. Create User in Supabase Auth
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

    if (authError)
      return NextResponse.json({ error: authError.message }, { status: 400 });
    if (!authData.user)
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );

    // 2. Create Profile Record
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authData.user.id,
        full_name: validatedData.fullName,
        username: validatedData.username,
        email: validatedData.email,
        role: validatedData.role,
        is_active: validatedData.status === "Active",
        business_id: validatedData.businessId || null, // Save Business ID
      });

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
