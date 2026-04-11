import { NextRequest, NextResponse } from "next/server";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { ensureCustomerInAgency, generateInterBranchBill } from "@/app/lib/inter-branch-billing";

export async function POST(request: NextRequest) {
  try {
    const { customerName } = await request.json();

    let targetBusinessId: string | null = null;
    let invoicePrefix = "SI";

    if (customerName?.includes("Retail")) {
      targetBusinessId = BUSINESS_IDS.CHAMPIKA_RETAIL;
      invoicePrefix = "SI-RE"; // Sierra -> Retail
    } else if (customerName?.includes("Distribution")) {
      targetBusinessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;
      invoicePrefix = "SI-DI"; // Sierra -> Distribution
    }

    if (!targetBusinessId) {
      return NextResponse.json({ error: "Invalid customer" }, { status: 400 });
    }

    // Always resolve customer within Sierra Agency to prevent cross-portal ID contamination
    const customerId = await ensureCustomerInAgency(BUSINESS_IDS.SIERRA_AGENCY, customerName);

    if (!customerId) {
      return NextResponse.json({ error: "Could not resolve customer" }, { status: 400 });
    }

    await generateInterBranchBill({
      agencyBusinessId: BUSINESS_IDS.SIERRA_AGENCY,
      agencyName: "Sierra",
      invoicePrefix,
      customerId,
      customerName,
      targetBusinessId,
    });

    return NextResponse.json({
      message: "Sierra inter-branch bill processed",
      invoicePrefix,
      customerName,
    });
  } catch (error: any) {
    console.error("Sierra inter-branch bill error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
