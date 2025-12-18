import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplierId, batchId, allocations, negotiatedAmount, approvalNote } =
      body;

    if (!supplierId || !batchId || !allocations) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Fetch Batch Details
    const { data: batch, error: batchError } = await supabaseAdmin
      .from("supplier_return_batches")
      .select("*")
      .eq("id", batchId)
      .single();

    if (batchError || !batch) throw new Error("Batch not found");

    const totalBookValue = Number(batch.total_value);
    const finalCreditAmount = Number(negotiatedAmount);
    const lossAmount = totalBookValue - finalCreditAmount;

    const totalAllocated = allocations.reduce(
      (sum: number, a: any) => sum + Number(a.amount),
      0
    );

    if (totalAllocated > finalCreditAmount + 1) {
      return NextResponse.json(
        {
          error: `Cannot allocate ${totalAllocated} when agreed credit is ${finalCreditAmount}.`,
        },
        { status: 400 }
      );
    }

    // 2. Create Payment (Credit Note)
    // Only if there's a credit value (negotiatedAmount > 0)
    // Or if we just want to record the loss (0 credit)

    // We loop allocations to pay bills
    for (const alloc of allocations) {
      if (alloc.amount <= 0) continue;

      const { count } = await supabaseAdmin
        .from("supplier_payments")
        .select("*", { count: "exact", head: true });
      const paymentNo = `CN-${(count || 0) + 1001}`;

      await supabaseAdmin.from("supplier_payments").insert({
        payment_number: paymentNo,
        purchase_id: alloc.purchaseId,
        supplier_id: supplierId,
        amount: alloc.amount,
        payment_date: new Date().toISOString(),
        payment_method: "return_credit",
        notes: `Ref: ${batch.batch_number}. Book Val: ${totalBookValue}. Loss: ${lossAmount}. Approved: ${approvalNote}`,
      });

      // Update Bill Status
      const { data: purchase } = await supabaseAdmin
        .from("purchases")
        .select("total_amount, paid_amount")
        .eq("id", alloc.purchaseId)
        .single();

      if (purchase) {
        const newPaid = (purchase.paid_amount || 0) + alloc.amount;
        const newStatus = newPaid >= purchase.total_amount ? "Paid" : "Partial";

        await supabaseAdmin
          .from("purchases")
          .update({ paid_amount: newPaid, payment_status: newStatus })
          .eq("id", alloc.purchaseId);
      }
    }

    // 3. Update Batch Status
    await supabaseAdmin
      .from("supplier_return_batches")
      .update({ status: "Completed" })
      .eq("id", batchId);

    // 4. Update Linked Items Status
    await supabaseAdmin
      .from("inventory_returns")
      .update({
        status: "Completed",
        reason: `[CLAIMED: ${batch.batch_number}]`,
      })
      .eq("return_batch_id", batchId);

    // 5. Update Supplier Balance
    const { data: sup } = await supabaseAdmin
      .from("suppliers")
      .select("due_payment")
      .eq("id", supplierId)
      .single();

    if (sup) {
      await supabaseAdmin
        .from("suppliers")
        .update({
          due_payment: Math.max(0, (sup.due_payment || 0) - totalAllocated),
        })
        .eq("id", supplierId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Claim API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
