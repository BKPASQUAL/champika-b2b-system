// Apply / revert a supplier monthly claim discount on actual cost.
//
// Rule: each item's discount is divided over the units of that item PURCHASED from the
// claim's supplier (for the claim's business) in the claim period.
//   cut per unit = item discount ÷ units purchased in the period (paid + free)
//
// Then for every purchase line in the period:
//   • purchase_items.actual_unit_cost        − cut   (record of what the stock really cost)
//   • product_cost_layers.cost_price          − cut   (unsold stock → future sales cost less)
//   • units of that batch already sold        → the earliest customer invoice lines of that
//     product on/after the purchase date get their actual_unit_cost lowered (FIFO order)
//   • products.actual_cost_price              − cut   (only if it is still that purchase's cost)
//
// Every change is stored in supplier_claim_cost_adjustments so it can be undone exactly.

import { supabaseAdmin } from "@/lib/supabase-admin";

const num = (v: any) => Number(v) || 0;

export type ApplyResult = {
  appliedAmount: number; // total discount placed on cost
  appliedToSold: number; // part placed on already-sold invoice lines
  appliedToStock: number; // part placed on unsold stock
  notAppliedAmount: number;
  linesUpdated: number; // invoice lines changed
  notApplied: { productId: string; name: string; amount: number; reason: string }[];
};

type Adj = {
  claim_bill_id: string;
  target_type: "purchase_item" | "cost_layer" | "order_item" | "product";
  target_id: string;
  order_id?: string | null;
  product_id: string;
  units: number;
  reduction_per_unit: number;
  cost_before: number;
};

const TABLE: Record<Adj["target_type"], { table: string; col: string }> = {
  purchase_item: { table: "purchase_items", col: "actual_unit_cost" },
  cost_layer: { table: "product_cost_layers", col: "cost_price" },
  order_item: { table: "order_items", col: "actual_unit_cost" },
  product: { table: "products", col: "actual_cost_price" },
};

async function inBatches<T>(list: T[], size: number, fn: (x: T) => PromiseLike<any>) {
  for (let i = 0; i < list.length; i += size) {
    await Promise.all(list.slice(i, i + size).map(fn));
  }
}

async function fetchAll(build: (s: number, e: number) => any) {
  const out: any[] = [];
  let start = 0;
  while (true) {
    const { data, error } = await build(start, start + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < 1000) break;
    start += 1000;
  }
  return out;
}

// Lower one value, then record it. Recorded only after the update succeeds,
// so an undo never adds back a cut that was not made.
async function lowerAndRecord(adj: Adj, newValue: number) {
  const t = TABLE[adj.target_type];
  const { error: upErr } = await supabaseAdmin.from(t.table).update({ [t.col]: newValue }).eq("id", adj.target_id);
  if (upErr) throw upErr;
  const { error: insErr } = await supabaseAdmin.from("supplier_claim_cost_adjustments").insert(adj);
  if (insErr) {
    await supabaseAdmin.from(t.table).update({ [t.col]: adj.cost_before }).eq("id", adj.target_id);
    throw insErr;
  }
}

export async function applyClaimCosts(claimBillId: string): Promise<ApplyResult> {
  const { data: bill, error } = await supabaseAdmin
    .from("supplier_claim_bills")
    .select(
      `id, business_id, supplier_id, period_from, period_to,
       items:supplier_claim_bill_items (product_id, discount_amount, product:products (name, actual_cost_price))`,
    )
    .eq("id", claimBillId)
    .single();
  if (error || !bill) throw new Error("Claim bill not found");

  const result: ApplyResult = {
    appliedAmount: 0, appliedToSold: 0, appliedToStock: 0, notAppliedAmount: 0, linesUpdated: 0, notApplied: [],
  };

  const disc: Record<string, { amount: number; name: string; productCost: number }> = {};
  (bill.items || []).forEach((i: any) => {
    const d = (disc[i.product_id] ||= { amount: 0, name: i.product?.name || "Unknown", productCost: num(i.product?.actual_cost_price) });
    d.amount += num(i.discount_amount);
  });
  const productIds = Object.keys(disc);

  // 1. Purchase lines of these products from this supplier in the period
  const purchaseLines: any[] = [];
  for (let i = 0; i < productIds.length; i += 100) {
    const chunk = productIds.slice(i, i + 100);
    purchaseLines.push(
      ...(await fetchAll((s, e) =>
        supabaseAdmin
          .from("purchase_items")
          .select(
            `id, product_id, quantity, free_quantity, unit_cost, total_cost, actual_unit_cost,
             purchase:purchases!inner (id, purchase_date, business_id, supplier_id)`,
          )
          .in("product_id", chunk)
          .eq("purchase.business_id", bill.business_id)
          .eq("purchase.supplier_id", bill.supplier_id)
          .gte("purchase.purchase_date", bill.period_from)
          .lte("purchase.purchase_date", bill.period_to)
          .order("id", { ascending: true })
          .range(s, e),
      )),
    );
  }
  // Free-claim stock (zero cost) is not a real purchase — skip it
  const realLines = purchaseLines.filter((pl) => !(num(pl.total_cost) === 0 && num(pl.unit_cost) === 0));

  // 2. Stock batches (FIFO layers) created by those purchases
  const purchaseIds = [...new Set(realLines.map((pl) => pl.purchase.id))] as string[];
  const layers: any[] = [];
  for (let i = 0; i < purchaseIds.length; i += 100) {
    const { data, error: le } = await supabaseAdmin
      .from("product_cost_layers")
      .select("id, product_id, purchase_id, cost_price, original_quantity, remaining_quantity")
      .in("purchase_id", purchaseIds.slice(i, i + 100))
      .in("product_id", productIds);
    if (le) throw le;
    layers.push(...(data || []));
  }
  const layersFor = (purchaseId: string, productId: string) =>
    layers.filter((l) => l.purchase_id === purchaseId && l.product_id === productId);

  for (const pid of productIds) {
    const d = disc[pid];
    if (d.amount <= 0) continue;
    const lines = realLines.filter((pl) => pl.product_id === pid);
    const units = lines.reduce((s, pl) => s + num(pl.quantity) + num(pl.free_quantity), 0);
    if (units <= 0) {
      result.notAppliedAmount += d.amount;
      result.notApplied.push({ productId: pid, name: d.name, amount: d.amount, reason: "Not purchased from this supplier in the period" });
      continue;
    }
    const cut = d.amount / units;

    let soldUnits = 0;
    let earliestDate = "9999-12-31";
    let productLowered = false;

    for (const pl of lines) {
      const lineUnits = num(pl.quantity) + num(pl.free_quantity);
      const date = String(pl.purchase.purchase_date).slice(0, 10);
      if (date < earliestDate) earliestDate = date;

      // Purchase line's recorded actual cost
      const before = num(pl.actual_unit_cost);
      const plCut = Math.min(cut, Math.max(0, before));
      if (plCut > 0) {
        await lowerAndRecord(
          { claim_bill_id: bill.id, target_type: "purchase_item", target_id: pl.id, product_id: pid, units: lineUnits, reduction_per_unit: plCut, cost_before: before },
          before - plCut,
        );
      }

      // Product's current actual cost — only if it still equals this purchase's cost
      if (!productLowered && Math.abs(d.productCost - before) < 0.01 && d.productCost > 0) {
        const pCut = Math.min(cut, d.productCost);
        await lowerAndRecord(
          { claim_bill_id: bill.id, target_type: "product", target_id: pid, product_id: pid, units: 0, reduction_per_unit: pCut, cost_before: d.productCost },
          d.productCost - pCut,
        );
        productLowered = true;
      }

      // Stock batches from this purchase: unsold part gets the lower cost
      const ls = layersFor(pl.purchase.id, pid);
      if (ls.length === 0) {
        soldUnits += lineUnits; // no batch record → treat all as sold
        continue;
      }
      // A product appearing twice on one bill shares the same layers; only process them once
      for (const layer of ls) {
        if ((layer as any)._done) continue;
        (layer as any)._done = true;
        const lb = num(layer.cost_price);
        const remaining = num(layer.remaining_quantity);
        soldUnits += Math.max(0, num(layer.original_quantity) - remaining);
        const lCut = Math.min(cut, Math.max(0, lb));
        if (remaining > 0 && lCut > 0) {
          await lowerAndRecord(
            { claim_bill_id: bill.id, target_type: "cost_layer", target_id: layer.id, product_id: pid, units: remaining, reduction_per_unit: lCut, cost_before: lb },
            lb - lCut,
          );
          result.appliedToStock += lCut * remaining;
        }
      }
    }

    // 3. Units already sold → earliest customer invoice lines on/after the purchase date
    if (soldUnits > 0) {
      const sales = await fetchAll((s, e) =>
        supabaseAdmin
          .from("order_items")
          .select(
            `id, quantity, free_quantity, actual_unit_cost,
             order:orders!inner (id, order_date, status, customer:customers (shop_name), invoices (id))`,
          )
          .eq("product_id", pid)
          .eq("order.status", "Delivered")
          .gte("order.order_date", `${earliestDate}T00:00:00`)
          .order("id", { ascending: true })
          .range(s, e),
      );
      const eligible = sales
        .filter((l: any) => {
          const shop = String(l.order?.customer?.shop_name || "").toLowerCase();
          if (shop.includes("champika hardware")) return false; // internal branch bills
          const inv = l.order?.invoices;
          if (!inv || (Array.isArray(inv) && inv.length === 0)) return false;
          return num(l.quantity) + num(l.free_quantity) > 0;
        })
        .sort((a: any, b: any) => String(a.order.order_date).localeCompare(String(b.order.order_date)));

      let left = soldUnits;
      for (const l of eligible) {
        if (left <= 0) break;
        const u = num(l.quantity) + num(l.free_quantity);
        const take = Math.min(u, left);
        left -= take;
        const before = num(l.actual_unit_cost);
        // Spread this line's share over all its units
        const perUnit = Math.min((cut * take) / u, Math.max(0, before));
        if (perUnit <= 0) continue;
        await lowerAndRecord(
          { claim_bill_id: bill.id, target_type: "order_item", target_id: l.id, order_id: l.order.id, product_id: pid, units: u, reduction_per_unit: perUnit, cost_before: before },
          before - perUnit,
        );
        result.appliedToSold += perUnit * u;
        result.linesUpdated += 1;
      }
      if (left > 0.001) {
        const amt = left * cut;
        result.notAppliedAmount += amt;
        result.notApplied.push({
          productId: pid,
          name: d.name,
          amount: amt,
          reason: `${left} sold units not found on customer invoices`,
        });
      }
    }
  }

  result.appliedAmount = result.appliedToSold + result.appliedToStock;
  return result;
}

export async function revertClaimCosts(claimBillId: string): Promise<number> {
  const { data: adj, error } = await supabaseAdmin
    .from("supplier_claim_cost_adjustments")
    .select("target_type, target_id, order_id, product_id, reduction_per_unit")
    .eq("claim_bill_id", claimBillId);
  if (error) throw error;
  if (!adj || adj.length === 0) return 0;

  // Add each cut back to the CURRENT value (other claims stay intact)
  const addBack: { type: Adj["target_type"]; id: string; add: number }[] = [];

  // Purchase lines, stock batches, products: by id
  const direct: Record<string, { type: Adj["target_type"]; add: number }> = {};
  adj
    .filter((a: any) => a.target_type !== "order_item")
    .forEach((a: any) => {
      const k = `${a.target_type}|${a.target_id}`;
      (direct[k] ||= { type: a.target_type, add: 0 }).add += num(a.reduction_per_unit);
    });
  Object.entries(direct).forEach(([k, v]) => addBack.push({ type: v.type, id: k.split("|")[1], add: v.add }));

  // Invoice lines: by invoice + product (an edit may have replaced the original line)
  const cutByKey: Record<string, number> = {};
  adj
    .filter((a: any) => a.target_type === "order_item")
    .forEach((a: any) => {
      const k = `${a.order_id}|${a.product_id}`;
      cutByKey[k] = Math.max(cutByKey[k] || 0, num(a.reduction_per_unit));
    });
  const orderIds = [...new Set(Object.keys(cutByKey).map((k) => k.split("|")[0]))];
  for (let i = 0; i < orderIds.length; i += 200) {
    const { data, error: e } = await supabaseAdmin
      .from("order_items")
      .select("id, order_id, product_id")
      .in("order_id", orderIds.slice(i, i + 200));
    if (e) throw e;
    (data || []).forEach((l: any) => {
      const add = cutByKey[`${l.order_id}|${l.product_id}`];
      if (add > 0) addBack.push({ type: "order_item", id: l.id, add });
    });
  }

  await inBatches(addBack, 20, async ({ type, id, add }) => {
    const t = TABLE[type];
    const { data: row } = await supabaseAdmin.from(t.table).select(t.col).eq("id", id).maybeSingle();
    if (!row) return; // row no longer exists
    const { error: upErr } = await supabaseAdmin
      .from(t.table)
      .update({ [t.col]: num((row as any)[t.col]) + add })
      .eq("id", id);
    if (upErr) throw upErr;
  });

  await supabaseAdmin.from("supplier_claim_cost_adjustments").delete().eq("claim_bill_id", claimBillId);
  return addBack.length;
}
