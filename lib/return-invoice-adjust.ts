import { supabaseAdmin } from "@/lib/supabase-admin";

export interface ApplyReturnResult {
  ok: boolean;
  error?: string;
  credit?: number; // LKR value taken off the bill
  invoiceNo?: string;
  newTotal?: number;
  newDue?: number;
}

const APPLYING_TAG = "[APPLYING]";

// Mark the return as "being applied" only if nobody changed it since we read it.
// Stops two requests (e.g. two open tabs) from deducting the same return twice.
async function claimReturn(id: string, oldReason: string | null): Promise<boolean> {
  const claimed = `${oldReason || ""} ${APPLYING_TAG}`.trim();
  let q = supabaseAdmin.from("inventory_returns").update({ reason: claimed }).eq("id", id);
  q = oldReason === null ? q.is("reason", null) : q.eq("reason", oldReason);
  const { data } = await q.select("id");
  return !!data && data.length > 0;
}

async function releaseReturn(id: string, oldReason: string | null) {
  await supabaseAdmin.from("inventory_returns").update({ reason: oldReason }).eq("id", id);
}

/**
 * Reduce a bill by a returned item:
 * - lowers the product's line on the bill (paid qty first, then free qty)
 * - lowers the bill total and payment status (balance due is calculated by the DB)
 * - lowers the customer's outstanding balance and the rep's commission
 * - tags the return with the bill, [INVOICE_ADJUSTED] and [CREDIT:x]
 *
 * Free items carry no value, so returning them reduces qty only.
 */
export async function applyReturnToInvoice(
  returnId: string,
  invoiceRef: { invoiceId?: string | null; invoiceNo?: string | null }
): Promise<ApplyReturnResult> {
  const { data: ret } = await supabaseAdmin
    .from("inventory_returns")
    .select("id, return_number, product_id, quantity, return_type, reason, customer_id, business_id")
    .eq("id", returnId)
    .maybeSingle();
  if (!ret) return { ok: false, error: "Return not found" };

  const reason: string = ret.reason || "";
  if (ret.return_type === "Exchange") {
    return { ok: false, error: "Exchange returns don't reduce bills" };
  }
  if (reason.includes("[INVOICE_ADJUSTED]")) {
    return { ok: false, error: "This return has already reduced a bill" };
  }
  if (reason.includes("[SETTLED_IN_PAYMENT")) {
    return { ok: false, error: "This return was already used as a payment credit" };
  }
  if (reason.includes(APPLYING_TAG)) {
    return { ok: false, error: "This return is already being applied" };
  }

  let invQuery = supabaseAdmin
    .from("invoices")
    .select("id, invoice_no, order_id, total_amount, paid_amount, customer_id, status");
  if (invoiceRef.invoiceId) invQuery = invQuery.eq("id", invoiceRef.invoiceId);
  else if (invoiceRef.invoiceNo) invQuery = invQuery.eq("invoice_no", invoiceRef.invoiceNo);
  else return { ok: false, error: "No bill given" };

  const { data: invoiceCheck } = await invQuery.maybeSingle();
  if (!invoiceCheck || !invoiceCheck.order_id) return { ok: false, error: "Bill not found" };
  if (invoiceCheck.status === "Cancelled") return { ok: false, error: "Bill is cancelled" };
  if (ret.customer_id && invoiceCheck.customer_id && ret.customer_id !== invoiceCheck.customer_id) {
    return { ok: false, error: "Return and bill belong to different customers" };
  }

  if (!(await claimReturn(ret.id, ret.reason ?? null))) {
    return { ok: false, error: "This return was changed by someone else — refresh and try again" };
  }

  try {
    // Read the bill and line AFTER claiming, and only write the bill total if it
    // hasn't changed meanwhile (another return on the same bill). Retry a few times.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: invoice } = await supabaseAdmin
        .from("invoices")
        .select("id, invoice_no, order_id, total_amount, paid_amount, customer_id, status")
        .eq("id", invoiceCheck.id)
        .single();
      if (!invoice) {
        await releaseReturn(ret.id, ret.reason ?? null);
        return { ok: false, error: "Bill not found" };
      }

      const { data: line } = await supabaseAdmin
        .from("order_items")
        .select("id, quantity, free_quantity, unit_price, total_price, commission_earned")
        .eq("order_id", invoice.order_id)
        .eq("product_id", ret.product_id)
        .maybeSingle();
      if (!line) {
        await releaseReturn(ret.id, ret.reason ?? null);
        return { ok: false, error: "This product is not on the bill" };
      }

      const returnQty = Number(ret.quantity || 0);
      const oldQty = Number(line.quantity || 0);
      const oldFree = Number(line.free_quantity || 0);
      const oldLineTotal = Number(line.total_price || 0);

      const paidReduce = Math.min(returnQty, oldQty);
      const freeReduce = Math.min(returnQty - paidReduce, oldFree);
      const newQty = oldQty - paidReduce;
      const newFree = oldFree - freeReduce;

      // Effective unit price includes any line discount
      const effUnit = oldQty > 0 ? oldLineTotal / oldQty : Number(line.unit_price || 0);
      const newLineTotal = Math.round(newQty * effUnit * 100) / 100;
      const credit = Math.round((oldLineTotal - newLineTotal) * 100) / 100;

      const oldComm = Number(line.commission_earned || 0);
      const newComm = oldQty > 0 ? (oldComm / oldQty) * newQty : 0;

      const oldTotal = Number(invoice.total_amount || 0);
      const paid = Number(invoice.paid_amount || 0);
      const newTotal = Math.max(0, Math.round((oldTotal - credit) * 100) / 100);
      const newDue = Math.max(0, Math.round((newTotal - paid) * 100) / 100);
      const newStatus = newDue <= 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";

      // Bill first, so nothing else changes if it fails.
      // due_amount is a generated column (total - paid) — never write it.
      const { data: updated, error: invErr } = await supabaseAdmin
        .from("invoices")
        .update({ total_amount: newTotal, status: newStatus })
        .eq("id", invoice.id)
        .eq("total_amount", invoice.total_amount)
        .select("id");
      if (invErr) {
        await releaseReturn(ret.id, ret.reason ?? null);
        return { ok: false, error: `Could not update bill: ${invErr.message}` };
      }
      if (!updated || updated.length === 0) continue; // bill changed meanwhile — retry

      const { error: lineErr } = await supabaseAdmin
        .from("order_items")
        .update({
          quantity: newQty,
          free_quantity: newFree,
          total_price: newLineTotal,
          commission_earned: newComm,
        })
        .eq("id", line.id);
      if (lineErr) console.error("[applyReturnToInvoice] line update failed:", lineErr);

      const { error: ordErr } = await supabaseAdmin
        .from("orders")
        .update({ total_amount: newTotal })
        .eq("id", invoice.order_id);
      if (ordErr) console.error("[applyReturnToInvoice] order update failed:", ordErr);

      if (invoice.customer_id && credit !== 0) {
        const { data: customer } = await supabaseAdmin
          .from("customers")
          .select("outstanding_balance")
          .eq("id", invoice.customer_id)
          .maybeSingle();
        if (customer) {
          await supabaseAdmin
            .from("customers")
            .update({ outstanding_balance: Number(customer.outstanding_balance || 0) - credit })
            .eq("id", invoice.customer_id);
        }
      }

      // Rep commission follows the bill's items
      const { data: allItems } = await supabaseAdmin
        .from("order_items")
        .select("commission_earned")
        .eq("order_id", invoice.order_id);
      const newCommissionTotal = (allItems || []).reduce(
        (s: number, it: any) => s + Number(it.commission_earned || 0),
        0
      );
      const { data: repComm } = await supabaseAdmin
        .from("rep_commissions")
        .select("id")
        .eq("order_id", invoice.order_id)
        .maybeSingle();
      if (repComm) {
        await supabaseAdmin
          .from("rep_commissions")
          .update({ total_commission_amount: newCommissionTotal })
          .eq("id", repComm.id);
      }

      // Link the return to the bill. Drop [RETURN_CREDIT] so it can't be used
      // again as a payment credit.
      const billTag = `[${invoice.invoice_no}]`;
      let newReason = reason.replace("[RETURN_CREDIT]", "").trim();
      if (!newReason.includes(billTag)) newReason = `${billTag} ${newReason}`.trim();
      newReason = `${newReason} [INVOICE_ADJUSTED] [CREDIT:${credit}]`.trim();
      await supabaseAdmin.from("inventory_returns").update({ reason: newReason }).eq("id", ret.id);

      const { error: txErr } = await supabaseAdmin.from("account_transactions").insert({
        transaction_type: "INVENTORY_RETURN",
        description: `Return ${ret.return_number} (${returnQty} units) reduced bill ${invoice.invoice_no} by LKR ${credit.toLocaleString()}`,
        amount: credit,
        transaction_date: new Date().toISOString(),
        business_id: ret.business_id || null,
        metadata: {
          return_id: ret.id,
          return_number: ret.return_number,
          invoice_id: invoice.id,
          invoice_no: invoice.invoice_no,
          product_id: ret.product_id,
          paid_qty_reduced: paidReduce,
          free_qty_reduced: freeReduce,
          old_total: oldTotal,
          new_total: newTotal,
          kind: "RETURN_BILL_ADJUSTMENT",
        },
      });
      if (txErr) console.error("[applyReturnToInvoice] transaction log failed:", txErr);

      return { ok: true, credit, invoiceNo: invoice.invoice_no, newTotal, newDue };
    }

    await releaseReturn(ret.id, ret.reason ?? null);
    return { ok: false, error: "Bill kept changing — please try again" };
  } catch (err: any) {
    await releaseReturn(ret.id, ret.reason ?? null);
    return { ok: false, error: err?.message || "Failed to apply return" };
  }
}

/**
 * Undo applyReturnToInvoice when a return is deleted:
 * - puts the qty back on the bill line (paid + free)
 * - adds the credit back to the bill total, order total and customer balance
 * - restores the rep's commission for that line
 * Does nothing if the return never reduced a bill.
 */
export async function undoReturnOnInvoice(ret: any): Promise<ApplyReturnResult> {
  const reason: string = ret?.reason || "";
  if (!reason.includes("[INVOICE_ADJUSTED]")) return { ok: true, credit: 0 };

  // The bill adjustment log has the exact bill and quantities
  const { data: txs } = await supabaseAdmin
    .from("account_transactions")
    .select("metadata")
    .eq("transaction_type", "INVENTORY_RETURN")
    .eq("metadata->>return_id", ret.id)
    .eq("metadata->>kind", "RETURN_BILL_ADJUSTMENT")
    .order("transaction_date", { ascending: false })
    .limit(1);
  const meta: any = txs?.[0]?.metadata || {};

  const credit = parseFloat(reason.match(/\[CREDIT:([\d.]+)\]/)?.[1] || "0") || 0;
  const paidBack = meta.paid_qty_reduced != null ? Number(meta.paid_qty_reduced) : Number(ret.quantity || 0);
  const freeBack = meta.free_qty_reduced != null ? Number(meta.free_qty_reduced) : 0;

  let invQuery = supabaseAdmin
    .from("invoices")
    .select("id, invoice_no, order_id, total_amount, paid_amount, customer_id");
  if (meta.invoice_id) invQuery = invQuery.eq("id", meta.invoice_id);
  else {
    const billNo = meta.invoice_no || reason.match(/\[INV:([^\]]+)\]/)?.[1]?.trim();
    if (!billNo) return { ok: false, error: "Can't find the bill this return reduced" };
    invQuery = invQuery.eq("invoice_no", billNo);
  }
  const { data: invoice } = await invQuery.maybeSingle();
  if (!invoice) return { ok: false, error: "Can't find the bill this return reduced" };

  const newTotal = Math.round((Number(invoice.total_amount || 0) + credit) * 100) / 100;
  const paid = Number(invoice.paid_amount || 0);
  const newDue = Math.max(0, Math.round((newTotal - paid) * 100) / 100);
  const newStatus = newDue <= 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";

  const { error: invErr } = await supabaseAdmin
    .from("invoices")
    .update({ total_amount: newTotal, status: newStatus })
    .eq("id", invoice.id);
  if (invErr) return { ok: false, error: `Could not update bill: ${invErr.message}` };

  if (invoice.order_id) {
    await supabaseAdmin.from("orders").update({ total_amount: newTotal }).eq("id", invoice.order_id);

    const { data: line } = await supabaseAdmin
      .from("order_items")
      .select("id, quantity, free_quantity, total_price, commission_earned")
      .eq("order_id", invoice.order_id)
      .eq("product_id", ret.product_id)
      .maybeSingle();
    if (line) {
      const curQty = Number(line.quantity || 0);
      const restoredQty = curQty + paidBack;
      const curComm = Number(line.commission_earned || 0);
      const restoredComm = curQty > 0 ? (curComm / curQty) * restoredQty : curComm;
      await supabaseAdmin
        .from("order_items")
        .update({
          quantity: restoredQty,
          free_quantity: Number(line.free_quantity || 0) + freeBack,
          total_price: Math.round((Number(line.total_price || 0) + credit) * 100) / 100,
          commission_earned: restoredComm,
        })
        .eq("id", line.id);

      const { data: allItems } = await supabaseAdmin
        .from("order_items")
        .select("commission_earned")
        .eq("order_id", invoice.order_id);
      const commTotal = (allItems || []).reduce((s: number, it: any) => s + Number(it.commission_earned || 0), 0);
      await supabaseAdmin
        .from("rep_commissions")
        .update({ total_commission_amount: commTotal })
        .eq("order_id", invoice.order_id);
    }
  }

  if (invoice.customer_id && credit !== 0) {
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("outstanding_balance")
      .eq("id", invoice.customer_id)
      .maybeSingle();
    if (customer) {
      await supabaseAdmin
        .from("customers")
        .update({ outstanding_balance: Number(customer.outstanding_balance || 0) + credit })
        .eq("id", invoice.customer_id);
    }
  }

  await supabaseAdmin.from("account_transactions").insert({
    transaction_type: "INVENTORY_RETURN_REVERSAL",
    description: `Deleted return ${ret.return_number}: bill ${invoice.invoice_no} put back up by LKR ${credit.toLocaleString()}`,
    amount: credit,
    transaction_date: new Date().toISOString(),
    business_id: ret.business_id || null,
    metadata: {
      return_id: ret.id,
      return_number: ret.return_number,
      invoice_id: invoice.id,
      invoice_no: invoice.invoice_no,
      product_id: ret.product_id,
      paid_qty_restored: paidBack,
      free_qty_restored: freeBack,
      kind: "RETURN_BILL_ADJUSTMENT_UNDO",
    },
  });

  return { ok: true, credit, invoiceNo: invoice.invoice_no, newTotal, newDue };
}

/**
 * Apply every not-yet-deducted office Good return that belongs to this bill.
 * Returns how many were applied.
 */
export async function autoApplyPendingReturns(
  invoiceId: string,
  returns: any[]
): Promise<number> {
  let applied = 0;
  for (const r of returns) {
    if (r.linked || r.adjusted || r.settled_in_payment) continue;
    if (r.return_type !== "Good" || r.status !== "Completed") continue;
    const res = await applyReturnToInvoice(r.id, { invoiceId });
    if (res.ok) applied++;
    else console.warn(`[autoApplyPendingReturns] ${r.return_number}: ${res.error}`);
  }
  return applied;
}
