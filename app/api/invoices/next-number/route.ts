import { NextRequest, NextResponse } from "next/server";
import { getNextInvoiceNumber, getNextOrangeManualRef } from "@/lib/invoice-books";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const salesRepId = searchParams.get("salesRepId");

    const result = await getNextInvoiceNumber(businessId, salesRepId);
    // Orange bills also get an automatic Manual Ref (CINV…)
    const manualRef =
      businessId === BUSINESS_IDS.ORANGE_AGENCY ? await getNextOrangeManualRef() : null;
    return NextResponse.json({ ...result, manualRef });
  } catch (error: any) {
    console.error("Error getting next invoice number:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
