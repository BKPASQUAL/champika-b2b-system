import { NextRequest, NextResponse } from "next/server";
import {
  getCustomerUnlockRequests,
  createCustomerUnlockRequest,
  updateCustomerUnlockRequestStatus,
  CustomerUnlockType,
} from "@/lib/customer-overdue";

// GET: List customer unlock requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const customerId = searchParams.get("customerId") || undefined;

    const requests = await getCustomerUnlockRequests({ status, customerId });
    return NextResponse.json(requests);
  } catch (error: any) {
    console.error("Error fetching customer unlock requests:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch customer unlock requests" },
      { status: 500 }
    );
  }
}

// POST: Rep or Distribution user submits an unlock request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerId,
      customerName,
      requestedBy,
      requestedByName,
      requestedByEmail,
      requestedByRole,
      unlockType,
      reason,
      overdueDetails,
    } = body;

    if (!customerId) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    }
    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "A valid reason for unlock is required" }, { status: 400 });
    }

    const validTypes: CustomerUnlockType[] = ["one_time", "7_days", "14_days"];
    const targetType: CustomerUnlockType = validTypes.includes(unlockType) ? unlockType : "one_time";

    const newRequest = await createCustomerUnlockRequest({
      customerId,
      customerName,
      requestedBy,
      requestedByName,
      requestedByEmail,
      requestedByRole,
      unlockType: targetType,
      reason: reason.trim(),
      overdueDetails,
    });

    return NextResponse.json(
      { success: true, message: "Unlock request submitted successfully", data: newRequest },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating customer unlock request:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit unlock request" },
      { status: 500 }
    );
  }
}

// PATCH: Admin approves or rejects request
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, action, unlockType, durationDays, adminId, adminName, adminNotes } = body;

    if (!requestId || !action) {
      return NextResponse.json({ error: "requestId and action are required" }, { status: 400 });
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid action. Must be 'approve' or 'reject'" }, { status: 400 });
    }

    const updated = await updateCustomerUnlockRequestStatus({
      requestId,
      action,
      unlockType,
      durationDays,
      adminId,
      adminName,
      adminNotes,
    });

    return NextResponse.json({
      success: true,
      message: action === "approve" ? "Customer unlocked successfully!" : "Unlock request rejected.",
      data: updated,
    });
  } catch (error: any) {
    console.error("Error updating customer unlock request:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update unlock request" },
      { status: 500 }
    );
  }
}
