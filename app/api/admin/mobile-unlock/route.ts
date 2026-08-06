import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import crypto from "crypto";

const DEFAULT_PIN = "889900";

// Fetch admin unlock PIN from app_settings or fallback
async function getAdminPin(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "invoice_unlock_pin")
      .maybeSingle();

    if (data?.value?.pin) {
      return String(data.value.pin);
    }
  } catch (err) {
    console.error("Error fetching PIN:", err);
  }
  return process.env.INVOICE_UNLOCK_PIN || DEFAULT_PIN;
}

// GET: Load Request & Invoice details for Mobile Phone Page
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId");

  if (!requestId) {
    return NextResponse.json({ error: "requestId parameter is required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("invoice_unlock_requests")
      .select(`
        *,
        invoices (
          id,
          invoice_no,
          total_amount,
          orders (
            status
          ),
          customers (
            shop_name
          )
        )
      `)
      .eq("id", requestId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Unlock request not found or expired" }, { status: 404 });
    }

    return NextResponse.json({
      id: data.id,
      invoiceId: data.invoice_id,
      invoiceNo: data.invoices?.invoice_no || data.invoice_id.substring(0, 8),
      shopName: data.invoices?.customers?.shop_name || "Customer",
      totalAmount: data.invoices?.total_amount || 0,
      orderStatus: data.invoices?.orders?.status || "Locked",
      requestedByName: data.requested_by_name || "Staff / Sales Rep",
      reason: data.reason,
      status: data.status,
      createdAt: data.created_at,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Mobile PIN Verification & Approval
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, pin, adminName } = body;

    if (!requestId || !pin) {
      return NextResponse.json({ error: "requestId and Admin PIN are required" }, { status: 400 });
    }

    const correctPin = await getAdminPin();
    if (String(pin).trim() !== String(correctPin).trim()) {
      return NextResponse.json({ error: "Incorrect Admin PIN / Passcode" }, { status: 400 });
    }

    // Generate secure single-use unlock token
    const unlockToken = `ULK-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("invoice_unlock_requests")
      .update({
        status: "approved",
        approved_by_name: adminName || "Mobile Phone Admin",
        approved_at: new Date().toISOString(),
        expires_at: expiresAt,
        unlock_token: unlockToken,
      })
      .eq("id", requestId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log in invoice_history for audit
    if (data?.invoice_id) {
      try {
        await supabaseAdmin.from("invoice_history").insert({
          invoice_id: data.invoice_id,
          previous_data: { event: "MOBILE_QR_UNLOCKED", requestId },
          changed_by: adminName || "Mobile Phone Admin",
          change_reason: `Unlocked via Mobile Phone QR Code Scan. Reason: ${data.reason}`,
        });
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      unlockToken,
      message: "Invoice unlocked successfully from mobile phone!",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
