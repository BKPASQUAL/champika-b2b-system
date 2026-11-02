import { NextRequest, NextResponse } from "next/server";
import { createShareToken, getCustomerAccount } from "@/lib/customer-account";

// GET: outstanding invoices, cheques and recent payments for one customer,
// plus a signed share token for the public customer page.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const account = await getCustomerAccount(id);
    if (!account) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    return NextResponse.json({ ...account, shareToken: createShareToken(id) });
  } catch (error: any) {
    console.error("Customer account error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
