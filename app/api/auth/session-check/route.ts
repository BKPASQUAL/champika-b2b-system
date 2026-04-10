import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBusinessRoute } from "@/app/config/business-constants";

function getRoleRoute(role: string): string {
  switch (role) {
    case "rep": return "/dashboard/rep";
    case "delivery": return "/dashboard/delivery";
    case "admin":
    case "super_admin": return "/dashboard/admin";
    default: return "/dashboard/office";
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();

    // Only attempt auto-login if the remember-me cookie is present
    const rememberCookie = cookieStore.get("champika_rm");
    if (!rememberCookie) {
      return NextResponse.json({ valid: false });
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Validate session (refreshes access token if needed)
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      // Session expired — clear remember-me cookie
      const response = NextResponse.json({ valid: false });
      response.cookies.delete("champika_rm");
      return response;
    }

    // Fetch profile + business
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(`role, is_active, full_name, business_id, businesses(id, name, description)`)
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !profile.is_active) {
      return NextResponse.json({ valid: false });
    }

    const businessInfo = Array.isArray(profile.businesses)
      ? profile.businesses[0]
      : profile.businesses;

    const redirectPath =
      profile.role === "office"
        ? getBusinessRoute(businessInfo?.id ?? null)
        : getRoleRoute(profile.role);

    const name: string = profile.full_name || "User";

    return NextResponse.json({
      valid: true,
      redirectPath,
      user: {
        id: user.id,
        name,
        email: user.email ?? "",
        role: profile.role,
        businessId: businessInfo?.id ?? null,
        businessName: businessInfo?.name ?? null,
        businessDescription: businessInfo?.description ?? null,
        initials: name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .substring(0, 2)
          .toUpperCase(),
      },
    });
  } catch (err) {
    console.error("Session check error:", err);
    return NextResponse.json({ valid: false });
  }
}
