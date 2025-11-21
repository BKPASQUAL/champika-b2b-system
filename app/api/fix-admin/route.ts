import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Initialize Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET() {
  const EMAIL = "admin@zavora.farm";
  const PASSWORD = "securepassword123";

  try {
    // 1. Get the User ID from Auth System
    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users.find((u) => u.email === EMAIL);
    let userId = "";

    if (existingUser) {
      console.log(`User found (ID: ${existingUser.id}). Updating password...`);
      // Update password just in case
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: PASSWORD,
        email_confirm: true,
      });
      userId = existingUser.id;
    } else {
      console.log("User not found. Creating new...");
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Zavora Admin" },
      });
      if (error) throw error;
      userId = data.user.id;
    }

    // 2. FORCE CREATE/UPDATE PROFILE
    // This fixes the "User profile not found" error
    console.log(`Fixing profile for ID: ${userId}...`);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId, // <--- This links it to the Auth User
        email: EMAIL,
        full_name: "Zavora Admin",
        username: "admin",
        role: "admin",
        is_active: true,
        updated_at: new Date().toISOString(),
      });

    if (profileError) throw profileError;

    return NextResponse.json({
      success: true,
      message: "Profile repaired successfully!",
      login_at: "http://localhost:3000/login",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
