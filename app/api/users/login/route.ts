// app/api/users/login/route.ts
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

    // 3. Fetch User Profile AND Business Details
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        role, 
        is_active, 
        full_name,
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

    // 4. Construct Response
    // FIX: Handle Supabase returning relations as arrays
    // @ts-ignore
    const rawBusiness = profile.businesses;
    // Check if it's an array and take the first item, otherwise use it directly
    const businessData = Array.isArray(rawBusiness)
      ? rawBusiness[0]
      : rawBusiness;

    return NextResponse.json({
      message: "Login successful",
      role: profile.role,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        // @ts-ignore
        name: profile.full_name || authData.user.email,
      },
      // Check if businessData exists before accessing properties
      business: businessData
        ? {
            id: businessData.id,
            name: businessData.name,
            description: businessData.description,
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
    console.error("Login Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
