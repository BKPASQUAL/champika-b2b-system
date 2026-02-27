import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Validation Schema
const loginSchema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Validate Input - Accept any identifier
    const { identifier, password } = loginSchema.parse({
      identifier: body.email,
      password: body.password
    });

    const cookieStore = await cookies();

    // 2. Initialize Supabase with Cookie Management (Critical for Auth)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // 3. Determine actual email if username was provided
    let loginEmail = identifier;
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

    if (!isEmail) {
      const { data: profileData, error: profileLookupError } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("username", identifier)
        .single();
        
      if (profileLookupError || !profileData?.email) {
         return NextResponse.json(
          { error: "Invalid username or password" },
          { status: 401 }
        );
      }
      loginEmail = profileData.email;
    }

    // 4. Authenticate
    // This will now automatically set the session cookies on the response
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

    if (authError) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 }
      );
    }

    // 4. Fetch User Profile with Business Information
    // We use the same supabase client which is now authenticated as the user
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

    // 5. Extract Business Information
    const businessInfo = Array.isArray(profile.businesses)
      ? profile.businesses[0]
      : profile.businesses;

    // 6. Return Success
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
