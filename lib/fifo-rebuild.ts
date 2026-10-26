// Rebuild FIFO costs for products by replaying their history in date order.
//
// Why: an invoice saves its cost when it is made. If the purchase bill for that
// stock was not entered yet, there was no stock batch, so the invoice got a guessed
// cost (product cost price). Entering the bill later never fixed those invoices.
//
// Rule (FIFO):
//   • Stock batches (product_cost_layers) and sales (order_items) are sorted by date.
//   • A sale takes units from the oldest batch that still has stock.
//   • Units sold when no stock was recorded WAIT for the next purchase bill and take
//     that bill's cost (the bill's stock includes those already-sold units).
//   • A stock count batch (no purchase) does not pay for earlier waiting sales.
//   • Units that never get a batch use the latest known batch cost (or product cost).
//
// Monthly claim discounts (supplier_claim_cost_adjustments) are kept: every unit of a
// claimed purchase costs less, and the invoice-line share is re-recorded per claim so
// the Actual Profit report and "delete claim" still work.
//
// Skipped: cancelled orders, inter-branch monthly bills (they never take stock), and
// sales before FIFO was switched on (first stock-count batch).

import { supabaseAdmin } from "@/lib/supabase-admin";

const num = (v: any) => Number(v) || 0;
const EPS = 0.0001;

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

async function inBatches<T>(list: T[], size: number, fn: (x: T) => PromiseLike<any>) {
  for (let i = 0; i < list.length; i += size) {
    await Promise.all(list.slice(i, i + size).map(fn));
  }
}

const iso = (v: any) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toISOString();
};

export type LineChange = {
  orderItemId: string;
  orderId: string;
  orderNo: string;
  date: string;
  units: number;
  oldCost: number;
  newCost: number;
  unresolvedUnits: number; // units with no purchase batch yet (estimated cost)
};

export type ProductRebuild = {
  productId: string;
  name: string;
  sku: string;
  lines: LineChange[];
  layersChanged: number;
  unresolvedUnits: number;
};

export type RebuildResult = {
  dryRun: boolean;
  productsChecked: number;
  productsChanged: number;
  linesChanged: number;
  layersChanged: number;
  products: ProductRebuild[];
};

let fifoStartCache: string | null = null;
// FIFO start = first stock-count batch (the seed run when FIFO was switched on)
async function fifoStart(): Promise<string> {
  if (fifoStartCache) return fifoStartCache;
  const { data } = await supabaseAdmin
    .from("product_cost_layers")
    .select("created_at")
    .is("purchase_id", null)
    .order("created_at", { ascending: true })
    .limit(1);
  fifoStartCache = data?.[0]?.created_at ? iso(data[0].created_at) : "1970-01-01T00:00:00.000Z";
  return fifoStartCache;
}

type Layer = {
  id: string;
  purchaseId: string | null;
  key: string;
  original: number;
  costNow: number;
  post: number; // cost per unit after monthly claims
  cuts: Record<string, number>; // claim id → cut per unit
  left: number;
  remainingNow: number;
};

type Line = {
  id: string;
  orderId: string;
  orderNo: string;
  key: string;
  units: number;
  oldCost: number;
  costSum: number;
  cutSum: Record<string, number>;
  unresolved: number;
};

export async function rebuildFifoCosts(
  productIds: string[],
  opts: { dryRun?: boolean } = {},
): Promise<RebuildResult> {
  const dryRun = !!opts.dryRun;
  const ids = [...new Set(productIds.filter(Boolean))];
  const result: RebuildResult = {
    dryRun, productsChecked: 0, productsChanged: 0, linesChanged: 0, layersChanged: 0, products: [],
  };
  if (ids.length === 0) return result;
  const start = await fifoStart();

  for (let c = 0; c < ids.length; c += 50) {
    const chunk = ids.slice(c, c + 50);

    const [products, layers, purchaseLines, adjustments, sales] = await Promise.all([
      fetchAll((s, e) =>
        supabaseAdmin.from("products").select("id, name, sku, cost_price, actual_cost_price")
          .in("id", chunk).order("id").range(s, e)),
      fetchAll((s, e) =>
        supabaseAdmin
          .from("product_cost_layers")
          .select("id, product_id, purchase_id, cost_price, original_quantity, remaining_quantity, created_at, purchase:purchases (purchase_date)")
          .in("product_id", chunk).order("id").range(s, e)),
      fetchAll((s, e) =>
        supabaseAdmin.from("purchase_items").select("id, purchase_id, product_id")
          .in("product_id", chunk).order("id").range(s, e)),
      fetchAll((s, e) =>
        supabaseAdmin
          .from("supplier_claim_cost_adjustments")
          .select("id, claim_bill_id, target_type, target_id, order_id, product_id, reduction_per_unit")
          .in("product_id", chunk).order("id").range(s, e)).catch(() => [] as any[]), // table may not exist
      fetchAll((s, e) =>
        supabaseAdmin
          .from("order_items")
          .select("id, product_id, quantity, free_quantity, actual_unit_cost, order:orders!inner (id, order_id, order_date, created_at, status, is_inter_branch, invoices (id))")
          .in("product_id", chunk)
          .neq("order.status", "Cancelled")
          .order("id").range(s, e)),
    ]);

    // purchase_item id → "purchaseId|productId"
    const piKey: Record<string, string> = {};
    purchaseLines.forEach((pi: any) => (piKey[pi.id] = `${pi.purchase_id}|${pi.product_id}`));

    // Claim cuts per purchase+product (max per claim if a product is on a bill twice)
    const purchaseCuts: Record<string, Record<string, number>> = {};
    const layerCutSum: Record<string, number> = {};
    const layerAdjClaims = new Set<string>(); // "claim|layer" with a cost_layer row
    adjustments.forEach((a: any) => {
      if (a.target_type === "purchase_item" && piKey[a.target_id]) {
        const m = (purchaseCuts[piKey[a.target_id]] ||= {});
        m[a.claim_bill_id] = Math.max(m[a.claim_bill_id] || 0, num(a.reduction_per_unit));
      } else if (a.target_type === "cost_layer") {
        layerCutSum[a.target_id] = (layerCutSum[a.target_id] || 0) + num(a.reduction_per_unit);
        layerAdjClaims.add(`${a.claim_bill_id}|${a.target_id}`);
      }
    });

    for (const product of products) {
      result.productsChecked++;
      const pid = product.id;

      // Stock batches as events
      const pl: Layer[] = layers
        .filter((l: any) => l.product_id === pid)
        .map((l: any) => {
          const costNow = num(l.cost_price);
          const base = costNow + (layerCutSum[l.id] || 0); // cost before any claim
          const cuts = l.purchase_id ? purchaseCuts[`${l.purchase_id}|${pid}`] || {} : {};
          const totalCut = Object.values(cuts).reduce((s, v) => s + v, 0);
          const pd = l.purchase?.purchase_date ? String(l.purchase.purchase_date).slice(0, 10) : "";
          return {
            id: l.id,
            purchaseId: l.purchase_id,
            key: l.purchase_id && pd ? `${pd}T00:00:00.000Z` : iso(l.created_at),
            original: num(l.original_quantity),
            costNow,
            post: Math.max(0, base - totalCut),
            cuts,
            left: num(l.original_quantity),
            remainingNow: num(l.remaining_quantity),
          };
        });

      // Sales as events (from FIFO start, real stock-taking orders only)
      const lines: Line[] = sales
        .filter((s: any) => {
          if (s.product_id !== pid || s.order?.is_inter_branch) return false;
          // No invoice = internal stock conversion ("SC-…"); it never took FIFO stock
          const inv = s.order?.invoices;
          return !!inv && (!Array.isArray(inv) || inv.length > 0);
        })
        .map((s: any) => {
          const date = String(s.order.order_date || s.order.created_at || "").slice(0, 10);
          const created = iso(s.order.created_at) || `${date}T00:00:00.000Z`;
          return {
            id: s.id,
            orderId: s.order.id,
            orderNo: s.order.order_id,
            key: `${date}T${created.slice(11)}`,
            units: num(s.quantity) + num(s.free_quantity),
            oldCost: num(s.actual_unit_cost),
            costSum: 0,
            cutSum: {},
            unresolved: 0,
          };
        })
        .filter((l) => l.units > 0 && l.key >= start);

      if (pl.length === 0 && lines.length === 0) continue;

      type Ev = { key: string; kind: 0 | 1; layer?: Layer; line?: Line };
      const events: Ev[] = [
        ...pl.map((layer) => ({ key: layer.key, kind: 0 as const, layer })),
        ...lines.map((line) => ({ key: line.key, kind: 1 as const, line })),
      ].sort((a, b) => (a.key === b.key ? a.kind - b.kind : a.key.localeCompare(b.key)));

      const take = (line: Line, layer: Layer, units: number) => {
        line.costSum += units * layer.post;
        for (const [claim, cut] of Object.entries(layer.cuts)) {
          line.cutSum[claim] = (line.cutSum[claim] || 0) + units * cut;
        }
        layer.left -= units;
      };

      const open: Layer[] = []; // batches with stock, oldest first
      let waiting: { line: Line; units: number }[] = []; // sold before stock was entered
      let lastPost = 0;

      for (const ev of events) {
        if (ev.kind === 0) {
          const layer = ev.layer!;
          if (layer.purchaseId) {
            // A purchase bill pays for units already sold while waiting for it
            while (waiting.length && layer.left > EPS) {
              const w = waiting[0];
              const u = Math.min(w.units, layer.left);
              take(w.line, layer, u);
              w.units -= u;
              if (w.units <= EPS) waiting.shift();
            }
          } else {
            // Stock count: earlier waiting sales stay estimated
            waiting.forEach((w) => (w.line.unresolved += w.units));
            waiting = [];
          }
          lastPost = layer.post || lastPost;
          if (layer.left > EPS) open.push(layer);
        } else {
          const line = ev.line!;
          let need = line.units;
          while (need > EPS && open.length) {
            const layer = open[0];
            const u = Math.min(need, layer.left);
            take(line, layer, u);
            need -= u;
            if (layer.left <= EPS) open.shift();
          }
          if (need > EPS) waiting.push({ line, units: need });
        }
      }
      waiting.forEach((w) => (w.line.unresolved += w.units));

      const changedLines: LineChange[] = [];
      const lineUpdates: { id: string; cost: number }[] = [];
      const newAdj: any[] = [];
      let unresolvedTotal = 0;

      for (const line of lines) {
        // Units no batch paid for: latest bill cost; with no bill at all, keep the saved cost
        const estimate = lastPost || line.oldCost;
        const newCost = (line.costSum + line.unresolved * estimate) / line.units;
        unresolvedTotal += line.unresolved;
        for (const [claim, sum] of Object.entries(line.cutSum)) {
          const perUnit = sum / line.units;
          if (perUnit > EPS) {
            newAdj.push({
              claim_bill_id: claim, target_type: "order_item", target_id: line.id, order_id: line.orderId,
              product_id: pid, units: line.units, reduction_per_unit: perUnit, cost_before: newCost + perUnit,
            });
          }
        }
        if (Math.abs(newCost - line.oldCost) > 0.005) {
          lineUpdates.push({ id: line.id, cost: newCost });
          changedLines.push({
            orderItemId: line.id, orderId: line.orderId, orderNo: line.orderNo, date: line.key.slice(0, 10),
            units: line.units, oldCost: line.oldCost, newCost, unresolvedUnits: line.unresolved,
          });
        }
      }

      const layerUpdates = pl.filter(
        (l) => Math.abs(l.left - l.remainingNow) > EPS || Math.abs(l.post - l.costNow) > 0.005,
      );
      // Claim rows for batches the claim lowered but never recorded (stock was 0 then)
      const newLayerAdj: any[] = [];
      pl.forEach((l) =>
        Object.entries(l.cuts).forEach(([claim, cut]) => {
          if (cut > EPS && !layerAdjClaims.has(`${claim}|${l.id}`)) {
            newLayerAdj.push({
              claim_bill_id: claim, target_type: "cost_layer", target_id: l.id, product_id: pid,
              units: l.original, reduction_per_unit: cut, cost_before: l.post + cut,
            });
          }
        }),
      );

      // Has the per-claim split on invoice lines changed?
      const replayedOrders = new Set(lines.map((l) => l.orderId));
      const oldAdj = adjustments.filter(
        (a: any) => a.target_type === "order_item" && a.product_id === pid && replayedOrders.has(a.order_id),
      );
      const sig = (rows: any[]) =>
        rows.map((a) => `${a.order_id}|${a.claim_bill_id}|${num(a.reduction_per_unit).toFixed(4)}`).sort().join(",");
      const adjChanged = sig(oldAdj) !== sig(newAdj);

      if (!changedLines.length && !layerUpdates.length && !newLayerAdj.length && !adjChanged) continue;

      result.productsChanged++;
      result.linesChanged += changedLines.length;
      result.layersChanged += layerUpdates.length;
      result.products.push({
        productId: pid, name: product.name, sku: product.sku, lines: changedLines,
        layersChanged: layerUpdates.length, unresolvedUnits: unresolvedTotal,
      });

      if (dryRun) continue;

      await inBatches(lineUpdates, 20, async (u) => {
        const { error } = await supabaseAdmin.from("order_items").update({ actual_unit_cost: u.cost }).eq("id", u.id);
        if (error) throw error;
      });
      await inBatches(layerUpdates, 20, async (l) => {
        const { error } = await supabaseAdmin
          .from("product_cost_layers")
          .update({ remaining_quantity: Math.max(0, Math.min(l.original, l.left)), cost_price: l.post })
          .eq("id", l.id);
        if (error) throw error;
      });
      if (newLayerAdj.length) {
        const { error } = await supabaseAdmin.from("supplier_claim_cost_adjustments").insert(newLayerAdj);
        if (error) throw error;
      }
      if (adjChanged) {
        if (oldAdj.length) {
          const oldIds = oldAdj.map((a: any) => a.id);
          for (let i = 0; i < oldIds.length; i += 200) {
            const { error } = await supabaseAdmin.from("supplier_claim_cost_adjustments").delete().in("id", oldIds.slice(i, i + 200));
            if (error) throw error;
          }
        }
        if (newAdj.length) {
          const { error } = await supabaseAdmin.from("supplier_claim_cost_adjustments").insert(newAdj);
          if (error) throw error;
        }
      }
    }
  }

  return result;
}

// For save hooks: never fail the main action because of a cost refresh.
export async function rebuildFifoCostsSafe(productIds: string[]) {
  try {
    return await rebuildFifoCosts(productIds);
  } catch (e) {
    console.error("FIFO rebuild failed:", e);
    return null;
  }
}
