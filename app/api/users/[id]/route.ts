import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { updateUserSchema } from "@/lib/validations/user";

// PATCH: Update user details including Business
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // Check for duplicate phone (if phone is being updated)
    const phoneValue = validatedData.phone !== undefined ? (validatedData.phone || null) : undefined;
    if (phoneValue) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("phone", phoneValue)
        .neq("id", id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "Phone number is already in use by another user" },
          { status: 400 }
        );
      }
    }

    // Update Profile Data
    const profileUpdates: any = {};
    if (validatedData.fullName)
      profileUpdates.full_name = validatedData.fullName;
    if (validatedData.username)
      profileUpdates.username = validatedData.username;
    if (validatedData.role) profileUpdates.role = validatedData.role;
    if (validatedData.status)
      profileUpdates.is_active = validatedData.status === "Active";
    // Keep profiles.email in sync so username-based login still works
    if (validatedData.email) profileUpdates.email = validatedData.email;

    // Allow updating phone (undefined = not changing, null/string = set value)
    if (phoneValue !== undefined) {
      profileUpdates.phone = phoneValue;
    }

    // Allow updating business_id (check undefined to distinguish between clearing and not updating)
    if (validatedData.businessId !== undefined) {
      profileUpdates.business_id = validatedData.businessId || null;
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdates)
      .eq("id", id);

    if (profileError) {
      if (profileError.code === "23505" && profileError.message?.includes("profiles_username_key")) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 400 }
        );
      }
      throw profileError;
    }

    // Sync user_business_access if accessibleBusinessIds provided (office role)
    if (
      validatedData.accessibleBusinessIds !== undefined &&
      (validatedData.role === "office" || (!validatedData.role && validatedData.businessId !== undefined))
    ) {
      const primaryId = validatedData.businessId || null;
      const ids = validatedData.accessibleBusinessIds ?? [];

      // Delete existing records
      await supabaseAdmin
        .from("user_business_access")
        .delete()
        .eq("user_id", id);

      // Insert new records
      if (ids.length > 0) {
        const rows = ids.map((bid) => ({
          user_id: id,
          business_id: bid,
          is_primary: bid === primaryId,
        }));
        await supabaseAdmin.from("user_business_access").insert(rows);
      }
    }

    // Update Auth Data (Email/Password)
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

// Include GET and DELETE functions as they were (no major changes needed unless you fetch specific fields in GET)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Fetch profile with business info
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("*, businesses(name)")
      .eq("id", id)
      .single();

    if (error || !profile)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Fetch all accessible businesses for office users
    let accessibleBusinessIds: string[] = [];
    if (profile.role === "office") {
      const { data: accessRows } = await supabaseAdmin
        .from("user_business_access")
        .select("business_id")
        .eq("user_id", id);

      if (accessRows && accessRows.length > 0) {
        accessibleBusinessIds = accessRows.map((r: any) => r.business_id);
      } else if (profile.business_id) {
        accessibleBusinessIds = [profile.business_id];
      }
    }

    return NextResponse.json({
      id: profile.id,
      full_name: profile.full_name,
      username: profile.username,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      is_active: profile.is_active,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      business_id: profile.business_id,
      business_name: profile.businesses?.name,
      accessible_business_ids: accessibleBusinessIds,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
