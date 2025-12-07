// app/api/auth/login/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Validation Schema
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Validate Input
    const { email, password } = loginSchema.parse(body);

    // 2. Authenticate with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 }
      );
    }

    // 3. Fetch User Profile with Business Information
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        role, 
        is_active, 
        full_name, 
        username,
        business_id,
        businesses (
          id,
          name,
          description
        )
      `
      )
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    if (!profile.is_active) {
      return NextResponse.json(
        { error: "Account is inactive. Contact administrator." },
        { status: 403 }
      );
    }

    // 4. Extract Business Information
    const businessInfo = Array.isArray(profile.businesses)
      ? profile.businesses[0]
      : profile.businesses;

    // 5. Return Success with Complete Context
    return NextResponse.json({
      message: "Login successful",
      role: profile.role,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: profile.full_name || "User",
        username: profile.username || "",
      },
      business: businessInfo
        ? {
            id: businessInfo.id,
            name: businessInfo.name,
            description: businessInfo.description,
          }
        : null,
      session: authData.session,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
