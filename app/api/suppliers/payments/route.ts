// app/api/suppliers/payments/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// Validation Schema
const paymentSchema = z.object({
  purchaseId: z.string().min(1, "Purchase ID is required"),
  supplierId: z.string().min(1, "Supplier ID is required"),
  accountId: z.string().min(1, "Account is required"),
  amount: z.number().min(1, "Amount must be valid"),
  date: z.string(),
  method: z.string(),
  chequeNumber: z.string().optional(),
  chequeDate: z.string().optional(),
  notes: z.string().optional(),
});

const actionSchema = z.object({
  paymentId: z.string(),
  action: z.enum(["passed", "returned"]),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    let query = supabaseAdmin
      .from("supplier_payments")
      .select(
        `
        *,
        purchases!inner (
          purchase_id,
          business_id
        ),
        suppliers ( name ),
        bank_accounts ( account_name )
      `
      )
      .order("payment_date", { ascending: false });

    if (businessId) {
      query = query.eq("purchases.business_id", businessId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const formatted = data.map((p: any) => ({
      id: p.id,
      payment_date: p.payment_date,
      amount: p.amount,
      payment_method: p.payment_method,
      cheque_number: p.cheque_number,
      cheque_date: p.cheque_date,
      cheque_status: p.cheque_status,
      notes: p.notes,
      company_account_id: p.company_account_id,
      company_accounts: p.bank_accounts
        ? {
            id: p.company_account_id,
            account_name: p.bank_accounts.account_name,
          }
        : null,
      purchases: {
        purchase_id: p.purchases?.purchase_id,
        suppliers: { name: p.suppliers?.name },
      },
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = paymentSchema.parse(body);

    // 1. Generate Payment Number
    const { count } = await supabaseAdmin
      .from("supplier_payments")
      .select("*", { count: "exact", head: true });
    const paymentNo = `SP-${(count || 0) + 1001}`;

    // 2. Insert Payment
    const { data: payment, error: payError } = await supabaseAdmin
      .from("supplier_payments")
      .insert({
        payment_number: paymentNo,
        purchase_id: val.purchaseId,
        supplier_id: val.supplierId,
        company_account_id: val.accountId,
        amount: val.amount,
        payment_date: val.date,
        payment_method: val.method,
        cheque_number: val.method === "cheque" ? val.chequeNumber : null,
        cheque_date: val.method === "cheque" ? val.chequeDate : null,
        cheque_status: val.method === "cheque" ? "pending" : null,
        notes: val.notes,
      })
      .select()
      .single();

    if (payError) throw payError;

    // 3. Update Purchase (Paid Amount & Status)
    const { data: purchase } = await supabaseAdmin
      .from("purchases")
      .select("total_amount, paid_amount")
      .eq("id", val.purchaseId)
      .single();

    if (purchase) {
      const newPaid = (purchase.paid_amount || 0) + val.amount;
      const newStatus = newPaid >= purchase.total_amount ? "Paid" : "Partial";

      await supabaseAdmin
        .from("purchases")
        .update({ paid_amount: newPaid, payment_status: newStatus })
        .eq("id", val.purchaseId);
    }

    // 4. Update Supplier (Reduce Due Payment)
    const { data: supplier } = await supabaseAdmin
      .from("suppliers")
      .select("due_payment")
      .eq("id", val.supplierId)
      .single();

    if (supplier) {
      await supabaseAdmin
        .from("suppliers")
        .update({
          due_payment: Math.max(0, (supplier.due_payment || 0) - val.amount),
        })
        .eq("id", val.supplierId);
    }

    // 5. Account Transaction (Withdrawal) - Only if NOT a cheque (or if you count cheques immediately)
    // Usually cheques are recorded when printed/issued, but funds leave when cleared.
    // For simplicity, we record it now or you can wait for clearance.
    // Let's record Bank Transfer/Cash immediately.
    if (val.method !== "cheque") {
      await supabaseAdmin.from("account_transactions").insert({
        transaction_no: `TXN-${Date.now()}`,
        transaction_type: "Withdrawal",
        from_account_id: val.accountId, // Money leaves account
        amount: val.amount,
        description: `Supplier Payment: ${paymentNo}`,
        transaction_date: val.date,
        reference_no: paymentNo,
      });
    }

    return NextResponse.json(
      { message: "Payment recorded", id: payment.id },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const val = actionSchema.parse(body);

    const { data: payment } = await supabaseAdmin
      .from("supplier_payments")
      .select("*")
      .eq("id", val.paymentId)
      .single();

    if (!payment)
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    if (val.action === "passed") {
      await supabaseAdmin
        .from("supplier_payments")
        .update({ cheque_status: "passed" })
        .eq("id", val.paymentId);

      // Record the withdrawal now that cheque passed
      await supabaseAdmin.from("account_transactions").insert({
        transaction_no: `CHQ-${Date.now()}`,
        transaction_type: "Withdrawal",
        from_account_id: payment.company_account_id,
        amount: payment.amount,
        description: `Cheque Cleared: ${payment.cheque_number}`,
        transaction_date: new Date().toISOString(),
        reference_no: payment.cheque_number,
        cheque_status: "Passed",
      });
    } else if (val.action === "returned") {
      await supabaseAdmin
        .from("supplier_payments")
        .update({ cheque_status: "returned" })
        .eq("id", val.paymentId);

      // Reverse the Purchase Payment logic
      const { data: purchase } = await supabaseAdmin
        .from("purchases")
        .select("paid_amount")
        .eq("id", payment.purchase_id)
        .single();

      if (purchase) {
        await supabaseAdmin
          .from("purchases")
          .update({
            paid_amount: Math.max(0, purchase.paid_amount - payment.amount),
            payment_status: "Partial", // Revert to partial/unpaid
          })
          .eq("id", payment.purchase_id);
      }

      // Reverse Supplier Balance (Add debt back)
      const { data: supplier } = await supabaseAdmin
        .from("suppliers")
        .select("due_payment")
        .eq("id", payment.supplier_id)
        .single();
      if (supplier) {
        await supabaseAdmin
          .from("suppliers")
          .update({ due_payment: supplier.due_payment + payment.amount })
          .eq("id", payment.supplier_id);
      }
    }

    return NextResponse.json({ message: "Status updated" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
