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

    // When cheque is Cleared, record transaction and directly update bank account balance
    if (chequeStatus === "Cleared") {
      const resolvedAccountId = depositAccountId || existing.deposit_account_id;

      if (resolvedAccountId) {
        const { error: txError } = await supabaseAdmin
          .from("account_transactions")
          .insert({
            transaction_no: `CHQ-CLR-${id.substring(0, 8).toUpperCase()}-${Date.now()}`,
            transaction_type: "Cheque Cleared",
            from_account_id: null,
            to_account_id: resolvedAccountId,
            amount: Number(existing.amount),
            transaction_date: new Date().toISOString().split("T")[0],
            description: `Cheque cleared — ref ${id.substring(0, 8).toUpperCase()}`,
            payment_id: id,
          });

        if (txError) {
          console.error("Failed to create account transaction for cleared cheque:", txError);
        }

        // Directly update bank account current_balance
        const { data: accountData, error: fetchBalanceError } = await supabaseAdmin
          .from("bank_accounts")
          .select("current_balance")
          .eq("id", resolvedAccountId)
          .single();

        if (fetchBalanceError || !accountData) {
          console.error("Failed to fetch account balance:", fetchBalanceError);
        } else {
          const newBalance = Number(accountData.current_balance || 0) + Number(existing.amount);
          const { error: balanceError } = await supabaseAdmin
            .from("bank_accounts")
            .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
            .eq("id", resolvedAccountId);

          if (balanceError) {
            console.error("Failed to update account balance:", balanceError);
          }
        }
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("PATCH /api/payments/[id]/status error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
