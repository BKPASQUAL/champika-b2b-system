import { NextRequest, NextResponse } from "next/server";
import { applyReturnToInvoice } from "@/lib/return-invoice-adjust";

export const dynamic = "force-dynamic";

// Reduce a bill by a return that was not linked to it when it was made.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { invoiceId, invoiceNo } = await request.json();

    const result = await applyReturnToInvoice(id, { invoiceId, invoiceNo });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Apply return to bill error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
