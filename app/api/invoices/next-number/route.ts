import { NextRequest, NextResponse } from "next/server";
import { getNextInvoiceNumber } from "@/lib/invoice-books";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const salesRepId = searchParams.get("salesRepId");

    const result = await getNextInvoiceNumber(businessId, salesRepId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error getting next invoice number:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
