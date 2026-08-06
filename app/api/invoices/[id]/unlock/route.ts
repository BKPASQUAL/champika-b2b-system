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
    console.error("Error fetching PIN from app_settings:", err);
  }
  return process.env.INVOICE_UNLOCK_PIN || DEFAULT_PIN;
}

// POST: Verify PIN or Request Admin Approval
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;

  try {
    const body = await request.json();
    const { action, pin, reason, userId, userName } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "Reason for edit is required" }, { status: 400 });
    }

    // 1. Action: Verify PIN / OTP (Instant Unlock)
    if (action === "verify_pin") {
      const correctPin = await getAdminPin();

      if (!pin || String(pin).trim() !== String(correctPin).trim()) {
        return NextResponse.json(
          { error: "Incorrect Admin PIN / OTP code" },
          { status: 400 }
        );
      }

      // Generate secure 1-time unlock token
      const unlockToken = `ULK-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 mins

      // Try inserting into DB (if table exists)
      const { data, error } = await supabaseAdmin
        .from("invoice_unlock_requests")
        .insert({
          invoice_id: invoiceId,
          requested_by: userId || null,
          requested_by_name: userName || "Staff",
          reason: reason.trim(),
          status: "approved",
          approved_by_name: "Instant PIN Verification",
          approved_at: new Date().toISOString(),
          expires_at: expiresAt,
          unlock_token: unlockToken,
        })
        .select()
        .single();

      if (error) {
        console.warn("Notice: invoice_unlock_requests insert fallback:", error.message);
      }

      // Log in invoice_history for audit trail
      try {
        await supabaseAdmin.from("invoice_history").insert({
          invoice_id: invoiceId,
          previous_data: { event: "ONE_TIME_EDIT_UNLOCKED", method: "ADMIN_PIN" },
          changed_by: userName || userId || "Staff",
          change_reason: `Unlocked for One-Time Edit via Admin Passcode. Reason: ${reason.trim()}`,
        });
      } catch (e) {}

      return NextResponse.json({
        success: true,
        unlockToken,
        message: "Passcode verified! Invoice unlocked for one-time editing.",
      });
    }

    // 2. Action: Request Admin Approval
    if (action === "request_approval") {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 60 mins

      const { data, error } = await supabaseAdmin
        .from("invoice_unlock_requests")
        .insert({
          invoice_id: invoiceId,
          requested_by: userId || null,
          requested_by_name: userName || "Sales Rep / Office User",
          reason: reason.trim(),
          status: "pending",
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to submit request:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Log request attempt in invoice_history
      try {
        await supabaseAdmin.from("invoice_history").insert({
          invoice_id: invoiceId,
          previous_data: { event: "UNLOCK_REQUEST_SUBMITTED", requestId: data.id },
          changed_by: userName || userId || "Staff",
          change_reason: `Submitted request for Admin Edit Approval. Reason: ${reason.trim()}`,
        });
      } catch (e) {}

      return NextResponse.json({
        success: true,
        requestId: data.id,
        message: "Unlock request submitted! Waiting for Admin approval.",
      });
    }

    return NextResponse.json({ error: "Invalid action specified" }, { status: 400 });
  } catch (error: any) {
    console.error("Unlock Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: Check Request Status for an Invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId");

  try {
    let query = supabaseAdmin
      .from("invoice_unlock_requests")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false });

    if (requestId) {
      query = query.eq("id", requestId);
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ status: "none" });
    }

    return NextResponse.json({
      id: data.id,
      status: data.status,
      unlockToken: data.unlock_token || null,
      reason: data.reason,
      approvedByName: data.approved_by_name || null,
      requestedAt: data.created_at,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
