import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { chequeStatus, depositAccountId } = body;

    if (!chequeStatus) {
      return NextResponse.json({ error: "chequeStatus is required" }, { status: 400 });
    }

    const validStatuses = ["Pending", "Deposited", "Cleared", "Bounced", "Returned"];
    if (!validStatuses.includes(chequeStatus)) {
      return NextResponse.json({ error: "Invalid cheque status" }, { status: 400 });
    }

    // Fetch current payment to get amount and existing deposit_account_id
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("payments")
      .select("amount, deposit_account_id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {
      cheque_status: chequeStatus,
      updated_at: new Date().toISOString(),
    };

    // Save deposit account when marking as Deposited
    if (depositAccountId) {
      updatePayload.deposit_account_id = depositAccountId;
    }

    // Update the payment status
    const { data, error } = await supabaseAdmin
      .from("payments")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    // When cheque is Cleared, insert a Deposit transaction so the DB trigger
    // (trg_update_account_balance) adds the amount to the bank account's current_balance
    if (chequeStatus === "Cleared") {
      const resolvedAccountId = depositAccountId || existing.deposit_account_id;

      if (resolvedAccountId) {
        const { error: txError } = await supabaseAdmin
          .from("account_transactions")
          .insert({
            transaction_no: `CHQ-CLR-${id.substring(0, 8).toUpperCase()}-${Date.now()}`,
            transaction_type: "Deposit",
            from_account_id: null,
            to_account_id: resolvedAccountId,
            amount: Number(existing.amount),
            transaction_date: new Date().toISOString().split("T")[0],
            description: `Cheque cleared — ref ${id.substring(0, 8).toUpperCase()}`,
          });

        if (txError) {
          // Log but don't fail the request — status was already updated
          console.error("Failed to create account transaction for cleared cheque:", txError);
        }
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("PATCH /api/payments/[id]/status error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
