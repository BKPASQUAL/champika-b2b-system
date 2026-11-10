// app/api/suppliers/vouchers/route.ts
// Supplier payment vouchers — created when cheques are handed over to someone.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_PO_PREFIXES } from "@/app/config/business-constants";
import { z } from "zod";

const createSchema = z.object({
  paymentIds: z.array(z.string()).min(1, "Select at least one cheque"),
  receiverName: z.string().trim().optional(),
  receiverNic: z.string().trim().optional(),
  receiverDesignation: z.string().trim().optional(),
  receiverPhone: z.string().trim().optional(),
  voucherDate: z.string().min(1),
  notes: z.string().optional(),
  preparedBy: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    let query = supabaseAdmin
      .from("supplier_payment_vouchers")
      .select("*")
      .order("created_at", { ascending: false });

    if (businessId) query = query.eq("business_id", businessId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const val = createSchema.parse(await request.json());

    // 1. Load the payments being handed over
    const { data: payments, error: payErr } = await supabaseAdmin
      .from("supplier_payments")
      .select(
        `
        id, amount, payment_method, cheque_number, cheque_date, cheque_status,
        supplier_id, voucher_id, company_account_id,
        purchases ( id, purchase_id, invoice_no, purchase_date, total_amount, business_id ),
        suppliers ( name ),
        bank_accounts ( account_name, account_number )
      `
      )
      .in("id", val.paymentIds);

    if (payErr) throw payErr;
    if (!payments || payments.length !== val.paymentIds.length) {
      return NextResponse.json({ error: "Some payments were not found" }, { status: 404 });
    }

    const supplierIds = new Set(payments.map((p: any) => p.supplier_id));
    if (supplierIds.size > 1) {
      return NextResponse.json(
        { error: "All cheques on one voucher must be for the same supplier" },
        { status: 400 }
      );
    }

    const already = payments.filter((p: any) => p.voucher_id);
    if (already.length) {
      return NextResponse.json(
        { error: `Cheque ${(already[0] as any).cheque_number ?? ""} is already on a voucher` },
        { status: 400 }
      );
    }

    const first: any = payments[0];
    const businessId: string | null = first.purchases?.business_id ?? null;

    // 2. Build cheque + invoice snapshots
    const chequeMap = new Map<string, any>();
    for (const p of payments as any[]) {
      const key = p.cheque_number || `no-cheque-${p.id}`;
      const row = chequeMap.get(key) ?? {
        cheque_number: p.cheque_number,
        cheque_date: p.cheque_date,
        payment_method: p.payment_method,
        account_name: p.bank_accounts?.account_name ?? null,
        account_number: p.bank_accounts?.account_number ?? null,
        amount: 0,
      };
      row.amount += Number(p.amount) || 0;
      chequeMap.set(key, row);
    }
    const cheques = [...chequeMap.values()].sort((a, b) =>
      String(a.cheque_date ?? "").localeCompare(String(b.cheque_date ?? ""))
    );

    const invoices = (payments as any[])
      .map((p) => ({
        payment_id: p.id,
        purchase_id: p.purchases?.purchase_id ?? null,
        invoice_no: p.purchases?.invoice_no ?? null,
        invoice_date: p.purchases?.purchase_date ?? null,
        invoice_total: Number(p.purchases?.total_amount) || 0,
        paid_amount: Number(p.amount) || 0,
        cheque_number: p.cheque_number ?? null,
      }))
      .sort((a, b) => String(a.invoice_date ?? "").localeCompare(String(b.invoice_date ?? "")));

    const totalAmount = invoices.reduce((s, i) => s + i.paid_amount, 0);

    // 3. Voucher number: PV-<business prefix>-<running no>, retry on clash
    const prefix = (businessId && BUSINESS_PO_PREFIXES[businessId]) || "G";
    let voucher: any = null;
    for (let attempt = 0; attempt < 5 && !voucher; attempt++) {
      const { count } = await supabaseAdmin
        .from("supplier_payment_vouchers")
        .select("*", { count: "exact", head: true })
        .like("voucher_number", `PV-${prefix}-%`);
      const voucherNumber = `PV-${prefix}-${String((count || 0) + 1 + attempt).padStart(4, "0")}`;

      const { data, error } = await supabaseAdmin
        .from("supplier_payment_vouchers")
        .insert({
          voucher_number: voucherNumber,
          business_id: businessId,
          supplier_id: first.supplier_id,
          supplier_name: first.suppliers?.name ?? null,
          voucher_date: val.voucherDate,
          receiver_name: val.receiverName || null,
          receiver_nic: val.receiverNic || null,
          receiver_designation: val.receiverDesignation || null,
          receiver_phone: val.receiverPhone || null,
          total_amount: totalAmount,
          payment_ids: val.paymentIds,
          cheques,
          invoices,
          notes: val.notes || null,
          prepared_by: val.preparedBy || null,
        })
        .select()
        .single();

      if (!error) voucher = data;
      else if (error.code !== "23505") throw error; // 23505 = duplicate voucher number
    }
    if (!voucher) throw new Error("Could not generate a voucher number, please try again");

    // 4. Link payments to the voucher
    const { error: linkErr } = await supabaseAdmin
      .from("supplier_payments")
      .update({ voucher_id: voucher.id })
      .in("id", val.paymentIds);
    if (linkErr) throw linkErr;

    return NextResponse.json(voucher, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
