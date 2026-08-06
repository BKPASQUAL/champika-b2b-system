import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import crypto from "crypto";

// GET: List pending and recent unlock requests for Admin
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "pending";

    const { data, error } = await supabaseAdmin
      .from("invoice_unlock_requests")
      .select(`
        *,
        invoices (
          id,
          invoice_no,
          total_amount,
          customer_id,
          orders (
            status
          ),
          customers (
            shop_name
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error querying unlock requests:", error.message);
      return NextResponse.json([]);
    }

    const filtered = (data || []).filter((r: any) => {
      if (statusFilter === "all") return true;
      return r.status === statusFilter;
    });

    return NextResponse.json(filtered);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Approve or Reject a request
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, action, adminId, adminName } = body;

    if (!requestId || !action) {
      return NextResponse.json({ error: "requestId and action are required" }, { status: 400 });
    }

    if (action === "approve") {
      const unlockToken = `ULK-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 60 mins

      const { data, error } = await supabaseAdmin
        .from("invoice_unlock_requests")
        .update({
          status: "approved",
          approved_by: adminId || null,
          approved_by_name: adminName || "Admin",
          approved_at: new Date().toISOString(),
          expires_at: expiresAt,
          unlock_token: unlockToken,
        })
        .eq("id", requestId)
        .select()
        .single();

      if (error) throw error;

      // Log approval in invoice history
      if (data?.invoice_id) {
        try {
          await supabaseAdmin.from("invoice_history").insert({
            invoice_id: data.invoice_id,
            previous_data: { event: "UNLOCK_REQUEST_APPROVED", requestId },
            changed_by: adminName || "Admin",
            change_reason: `Admin approved edit request. Reason: ${data.reason}`,
          });
        } catch (e) {}
      }

      return NextResponse.json({
        success: true,
        message: "Unlock request approved!",
        unlockToken,
      });
    }

    if (action === "reject") {
      const { data, error } = await supabaseAdmin
        .from("invoice_unlock_requests")
        .update({
          status: "rejected",
          approved_by: adminId || null,
          approved_by_name: adminName || "Admin",
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: "Unlock request rejected.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
