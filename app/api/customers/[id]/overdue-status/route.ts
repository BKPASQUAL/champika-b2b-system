import { NextRequest, NextResponse } from "next/server";
import { checkCustomerOverdueStatus } from "@/lib/customer-overdue";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || undefined;
    const userRole = searchParams.get("role") || undefined;
    const businessId = searchParams.get("businessId") || undefined;
    const isRep = searchParams.get("isRep") === "true" || userRole === "rep";

    const status = await checkCustomerOverdueStatus(id, { userId, userRole, businessId, isRep });
    return NextResponse.json(status);
  } catch (error: any) {
    console.error("Error checking customer overdue status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check customer overdue status" },
      { status: 500 }
    );
  }
}
