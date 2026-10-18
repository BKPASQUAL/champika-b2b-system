import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getOverdueBlockingConfig,
  saveOverdueBlockingConfig,
  isOverdueBlockingEnforcedForUser,
  OverdueBlockingConfig,
} from "@/lib/customer-overdue";

export async function GET() {
  try {
    const config = await getOverdueBlockingConfig();

    // Fetch all staff / rep profiles
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select(`
        id,
        full_name,
        username,
        email,
        role,
        business_id,
        businesses (
          name
        )
      `)
      .order("full_name", { ascending: true });

    if (profErr) {
      console.error("Error fetching profiles for overdue blocking config:", profErr);
    }

    const users = (profiles || []).map((p: any) => {
      const enforcement = isOverdueBlockingEnforcedForUser(config, p.id, p.role);
      const hasExplicitOverride = Boolean(
        config.userOverrides && typeof config.userOverrides[p.id] === "boolean"
      );

      return {
        id: p.id,
        fullName: p.full_name || p.username || "Unknown",
        username: p.username,
        email: p.email,
        role: p.role || "staff",
        businessName: p.businesses?.name || null,
        isEnforced: enforcement.isEnforced,
        hasExplicitOverride,
        explicitValue: hasExplicitOverride ? config.userOverrides[p.id] : null,
      };
    });

    return NextResponse.json({
      config,
      users,
    });
  } catch (error: any) {
    console.error("GET /api/settings/customer-overdue-blocking error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      globalEnabled,
      defaultEnforced,
      exemptRoles,
      userOverrides,
      userId,
      isEnforced,
      bulkUserIds,
      bulkEnforced,
      adminName,
    } = body;

    const currentConfig = await getOverdueBlockingConfig();
    const updatePayload: Partial<OverdueBlockingConfig> = {};

    if (typeof globalEnabled === "boolean") {
      updatePayload.globalEnabled = globalEnabled;
    }
    if (typeof defaultEnforced === "boolean") {
      updatePayload.defaultEnforced = defaultEnforced;
    }
    if (Array.isArray(exemptRoles)) {
      updatePayload.exemptRoles = exemptRoles;
    }
    if (userOverrides && typeof userOverrides === "object") {
      updatePayload.userOverrides = {
        ...currentConfig.userOverrides,
        ...userOverrides,
      };
    }

    // Single user toggle convenience
    if (userId && typeof isEnforced === "boolean") {
      updatePayload.userOverrides = {
        ...(updatePayload.userOverrides || currentConfig.userOverrides || {}),
        [userId]: isEnforced,
      };
    }

    // Bulk user toggle convenience (e.g. enforce all or exempt all)
    if (Array.isArray(bulkUserIds) && typeof bulkEnforced === "boolean") {
      const mergedOverrides = {
        ...(updatePayload.userOverrides || currentConfig.userOverrides || {}),
      };
      bulkUserIds.forEach((uid: string) => {
        mergedOverrides[uid] = bulkEnforced;
      });
      updatePayload.userOverrides = mergedOverrides;
    }

    const updated = await saveOverdueBlockingConfig(updatePayload, adminName);

    return NextResponse.json({
      success: true,
      config: updated,
    });
  } catch (error: any) {
    console.error("POST /api/settings/customer-overdue-blocking error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
