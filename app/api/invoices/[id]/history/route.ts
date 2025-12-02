import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Fetch history logs
    const { data: history, error } = await supabaseAdmin
      .from("invoice_history")
      .select("*")
      .eq("invoice_id", id)
      .order("changed_at", { ascending: false });

    if (error) throw error;

    // Enrich with User Names (Manually fetching profiles to ensure reliability)
    // We collect all unique user IDs from the history logs
    const userIds = Array.from(
      new Set(history.map((h) => h.changed_by).filter(Boolean))
    );

    let userMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      if (profiles) {
        profiles.forEach((p) => {
          userMap[p.id] = p.full_name;
        });
      }
    }

    // Map the response
    const formattedHistory = history.map((h) => ({
      id: h.id,
      changedAt: h.changed_at,
      changedBy: userMap[h.changed_by] || "Unknown User",
      reason: h.change_reason || "General Update",
      // We can process 'previous_data' here if we want to show specific diffs
      previousTotal: h.previous_data?.total_amount || 0,
      previousStatus: h.previous_data?.status || "N/A",
    }));

    return NextResponse.json(formattedHistory);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
