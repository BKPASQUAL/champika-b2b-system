import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export const dynamic = "force-dynamic";

const SIERRA_ID = BUSINESS_IDS.SIERRA_AGENCY;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || new Date(new Date().getFullYear(), 0, 1).toISOString();
  const to = url.searchParams.get("to") || new Date(new Date().getFullYear(), 11, 31).toISOString();

  const fromDate = from.split("T")[0];
  const toDate = to.split("T")[0];

  try {
    // ── 1. Invoices (Sales) ───────────────────────────────────────────────────
    // Note: invoices table has no 'date' or 'final_amount' columns.
    // Date comes from created_at; amount from total_amount; status from 'status'.
    const { data: invoices, error: invErr } = await supabaseAdmin
      .from("invoices")
      .select(
        `id, total_amount, due_amount, status, invoice_no, manual_invoice_no, created_at,
         customers (id, shop_name),
         orders!inner (order_id, order_date, status, business_id)`
      )
      .eq("orders.business_id", SIERRA_ID)
      .gte("orders.order_date", fromDate)
      .lte("orders.order_date", toDate)
      .order("created_at", { ascending: false });

    if (invErr) throw new Error(`Invoices query failed: ${invErr.message}`);

    const deliveredInvoices = (invoices || []).filter(
      (inv: any) => {
        const isDelivered = inv.orders?.status === "Delivered" || inv.orders?.status === "Completed";
        const isInterBranch = (inv.customers?.shop_name || "").toLowerCase().includes("champika hardware");
        return isDelivered && !isInterBranch;
      }
    );

    // ── 2. Purchases ─────────────────────────────────────────────────────────
    const { data: purchases, error: purErr } = await supabaseAdmin
      .from("purchases")
      .select("id, total_amount, paid_amount, purchase_date, purchase_id")
      .eq("business_id", SIERRA_ID)
      .gte("purchase_date", fromDate)
      .lte("purchase_date", toDate);

    if (purErr) throw new Error(`Purchases query failed: ${purErr.message}`);

    // ── 3. Expenses ───────────────────────────────────────────────────────────
    const { data: expenses, error: expErr } = await supabaseAdmin
      .from("expenses")
      .select("id, amount, category, expense_date, description, payment_method")
      .eq("business_id", SIERRA_ID)
      .gte("expense_date", fromDate)
      .lte("expense_date", toDate)
      .order("expense_date", { ascending: false });

    if (expErr) throw new Error(`Expenses query failed: ${expErr.message}`);

    // ── 4. Order Items for Profit (Sierra products by supplier_name) with pagination ──────────
    let orderItems: any[] = [];
    let itemsStart = 0;
    const itemsLimit = 1000;
    while (true) {
      const { data: batch, error: itemErr } = await supabaseAdmin
        .from("order_items")
        .select(
          `id, quantity, free_quantity, unit_price, actual_unit_cost, created_at,
           order:orders!inner (
             order_id, status, created_at, order_date, invoice_no,
             customer:customers (shop_name),
             invoices (invoice_no)
           ),
           product:products!inner (id, name, sku, supplier_name, cost_price)`
        )
        .in("order.status", ["Delivered", "Completed"])
        .ilike("product.supplier_name", "%Sierra%")
        .gte("order.order_date", fromDate)
        .lte("order.order_date", toDate)
        .range(itemsStart, itemsStart + itemsLimit - 1);

      if (itemErr) throw new Error(`Order items query failed: ${itemErr.message}`);
      if (!batch || batch.length === 0) break;
      orderItems.push(...batch);
      if (batch.length < itemsLimit) break;
      itemsStart += itemsLimit;
    }

    orderItems = orderItems.filter(
      (item: any) => {
        const isInterBranch = (item.order?.customer?.shop_name || "").toLowerCase().includes("champika hardware");
        const invoices = item.order?.invoices;
        const hasInvoice = Array.isArray(invoices) ? invoices.length > 0 : !!invoices;
        return hasInvoice && !isInterBranch;
      }
    );

    // ── 5. Cost Layers for Sierra products (FIFO stock breakdown) ────────────
    // Query cost layers directly joined to products — no is_active / stock_quantity
    // restriction so all batches with remaining stock appear.
    let costLayers: any[] = [];
    const { data: rawLayers } = await supabaseAdmin
      .from("product_cost_layers")
      .select(`
        id, product_id, cost_price, original_quantity, remaining_quantity, created_at,
        product:products!inner (id, name, sku, stock_quantity, selling_price, supplier_name)
      `)
      .ilike("product.supplier_name", "%Sierra%")
      .gt("remaining_quantity", 0)
      .order("created_at", { ascending: true });

    if (rawLayers && rawLayers.length > 0) {
      // Group layers by product
      const layersByProduct: Record<string, any[]> = {};
      const productMeta: Record<string, any> = {};

      rawLayers.forEach((layer: any) => {
        const pid = layer.product_id;
        if (!layersByProduct[pid]) layersByProduct[pid] = [];
        layersByProduct[pid].push(layer);
        if (!productMeta[pid]) productMeta[pid] = layer.product;
      });

      costLayers = Object.entries(layersByProduct).map(([pid, layers]) => {
        const product = productMeta[pid];
        const sellingPrice = Number(product?.selling_price) || 0;
        const layerDetails = layers.map((layer: any, idx: number) => ({
          layerIndex: idx + 1,
          costPrice: Number(layer.cost_price),
          remainingQuantity: Number(layer.remaining_quantity),
          originalQuantity: Number(layer.original_quantity),
          costValue: Number(layer.remaining_quantity) * Number(layer.cost_price),
          sellingValue: Number(layer.remaining_quantity) * sellingPrice,
          potentialProfit: Number(layer.remaining_quantity) * (sellingPrice - Number(layer.cost_price)),
          purchaseDate: layer.created_at,
        }));
        const totalCostValue = layerDetails.reduce((s: number, l: any) => s + l.costValue, 0);
        const totalSellValue = layerDetails.reduce((s: number, l: any) => s + l.sellingValue, 0);
        return {
          productId: pid,
          productName: product?.name || "Unknown",
          sku: product?.sku || "",
          totalStock: Number(product?.stock_quantity || 0),
          sellingPrice,
          hasMultipleCostLevels: layerDetails.length > 1 &&
            layerDetails.some((l: any) => l.costPrice !== layerDetails[0].costPrice),
          layers: layerDetails,
          totals: { costValue: totalCostValue, sellingValue: totalSellValue, potentialProfit: totalSellValue - totalCostValue },
        };
      });
    }

    // ── Inter-branch order IDs (billed at cost → profit is always 0) ────────────
    // Inter-branch invoices bill Champika Hardware at cost price, not for profit.
    const interBranchOrderIds = new Set<string>(
      deliveredInvoices
        .filter((inv: any) =>
          (inv.customers?.shop_name || "").toLowerCase().includes("champika hardware")
        )
        .map((inv: any) => inv.orders?.order_id)
        .filter(Boolean)
    );

    // ── Process: Overview KPIs ────────────────────────────────────────────────
    const totalSales = deliveredInvoices.reduce(
      (s: number, inv: any) => s + (Number(inv.total_amount) || 0),
      0
    );
    const orderCount = deliveredInvoices.length;
    const totalExpenses = (expenses || []).reduce((s, e: any) => s + Number(e.amount || 0), 0);
    const expenseCount = (expenses || []).length;

    let totalRevenue = 0;
    let totalCost = 0;
    (orderItems || []).forEach((item: any) => {
      if (interBranchOrderIds.has(item.order?.order_id)) return;
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const unitCost = Number(item.actual_unit_cost) || 0;
      totalRevenue += qty * unitPrice;
      totalCost += qty * unitCost;
    });
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // ── Process: Monthly Distribution ─────────────────────────────────────────
    const monthMap: Record<string, { month: string; monthKey: string; billCount: number; totalSales: number; totalPurchases: number }> = {};

    deliveredInvoices.forEach((inv: any) => {
      const rawDate = inv.orders?.order_date || inv.created_at;
      if (!rawDate) return;
      const d = new Date(rawDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[key]) {
        monthMap[key] = {
          month: d.toLocaleString("default", { month: "long", year: "numeric" }),
          monthKey: key,
          billCount: 0,
          totalSales: 0,
          totalPurchases: 0,
        };
      }
      monthMap[key].billCount += 1;
      monthMap[key].totalSales += Number(inv.total_amount) || 0;
    });

    (purchases || []).forEach((p: any) => {
      const rawDate = p.purchase_date;
      if (!rawDate) return;
      const d = new Date(rawDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[key]) {
        monthMap[key] = {
          month: d.toLocaleString("default", { month: "long", year: "numeric" }),
          monthKey: key,
          billCount: 0,
          totalSales: 0,
          totalPurchases: 0,
        };
      }
      monthMap[key].totalPurchases += Number(p.total_amount) || 0;
    });

    const monthly = Object.values(monthMap)
      .map((m) => ({ ...m, netValue: m.totalSales - m.totalPurchases }))
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    // ── Process: Profit Monthly Chart ─────────────────────────────────────────
    const profitMonthMap: Record<string, any> = {};
    (orderItems || []).forEach((item: any) => {
      if (interBranchOrderIds.has(item.order?.order_id)) return;
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const unitCost = Number(item.actual_unit_cost) || 0;
      const revenue = qty * unitPrice;
      const profit = revenue - qty * unitCost;
      const rawDate = item.order.order_date || item.order.created_at.split("T")[0];
      const d = new Date(rawDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!profitMonthMap[key]) {
        profitMonthMap[key] = {
          name: d.toLocaleString("default", { month: "short", year: "2-digit" }),
          dateStr: key,
          revenue: 0,
          profit: 0,
        };
      }
      profitMonthMap[key].revenue += revenue;
      profitMonthMap[key].profit += profit;
    });
    const profitMonthly = Object.values(profitMonthMap).sort((a, b) =>
      a.dateStr.localeCompare(b.dateStr)
    );

    // ── Process: Products ─────────────────────────────────────────────────────
    const productMap: Record<string, any> = {};
    (orderItems || []).forEach((item: any) => {
      if (interBranchOrderIds.has(item.order?.order_id)) return;
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const unitCost = Number(item.actual_unit_cost) || 0;
      const revenue = qty * unitPrice;
      const cost = qty * unitCost;
      const pid = item.product.id;
      if (!productMap[pid]) {
        productMap[pid] = { id: pid, sku: item.product.sku, name: item.product.name, qtySold: 0, revenue: 0, cost: 0, profit: 0 };
      }
      productMap[pid].qtySold += qty;
      productMap[pid].revenue += revenue;
      productMap[pid].cost += cost;
      productMap[pid].profit += revenue - cost;
    });
    const products = Object.values(productMap)
      .map((p) => ({ ...p, margin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);

    // ── Process: Customers ────────────────────────────────────────────────────
    const customerMap: Record<string, any> = {};
    deliveredInvoices.forEach((inv: any) => {
      const name = inv.customers?.shop_name || "Unknown";
      const amount = Number(inv.total_amount) || 0;
      if (!customerMap[name]) {
        customerMap[name] = { id: inv.customers?.id || null, name, billCount: 0, totalSales: 0, dueAmount: 0 };
      }
      customerMap[name].billCount += 1;
      customerMap[name].totalSales += amount;
      customerMap[name].dueAmount += Number(inv.due_amount) || 0;
    });
    const customers = Object.values(customerMap).sort((a, b) => b.totalSales - a.totalSales);

    // ── Process: Customer Profits (from order_items) ──────────────────────────
    const customerProfitMap: Record<string, any> = {};
    (orderItems || []).forEach((item: any) => {
      if (interBranchOrderIds.has(item.order?.order_id)) return;
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const unitCost = Number(item.actual_unit_cost) || 0;
      const revenue = qty * unitPrice;
      const profit = revenue - qty * unitCost;
      const name = item.order.customer?.shop_name || "Unknown";
      if (!customerProfitMap[name]) {
        customerProfitMap[name] = { name, revenue: 0, profit: 0 };
      }
      customerProfitMap[name].revenue += revenue;
      customerProfitMap[name].profit += profit;
    });
    const customerProfits = Object.values(customerProfitMap)
      .filter((c: any) => c.profit > 0)
      .sort((a: any, b: any) => b.profit - a.profit)
      .slice(0, 12)
      .map((c: any) => ({
        name: c.name.length > 12 ? c.name.slice(0, 12) + "…" : c.name,
        fullName: c.name,
        value: Math.round(c.profit),
      }));

    // ── Process: Margin Distribution (per order) ──────────────────────────────
    const orderMarginMap: Record<string, { revenue: number; cost: number }> = {};
    (orderItems || []).forEach((item: any) => {
      if (interBranchOrderIds.has(item.order?.order_id)) return;
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const unitCost = Number(item.actual_unit_cost) || 0;
      const oid = item.order.order_id;
      if (!orderMarginMap[oid]) orderMarginMap[oid] = { revenue: 0, cost: 0 };
      orderMarginMap[oid].revenue += qty * unitPrice;
      orderMarginMap[oid].cost += qty * unitCost;
    });
    const marginDistribution = { excellent: 0, good: 0, fair: 0, low: 0 };
    Object.values(orderMarginMap).forEach((o) => {
      const m = o.revenue > 0 ? ((o.revenue - o.cost) / o.revenue) * 100 : 0;
      if (m >= 30) marginDistribution.excellent++;
      else if (m >= 20) marginDistribution.good++;
      else if (m >= 10) marginDistribution.fair++;
      else marginDistribution.low++;
    });

    // ── Process: Per-order profit map (from order_items) ─────────────────────
    const orderProfitMap: Record<string, { revenue: number; cost: number }> = {};
    (orderItems || []).forEach((item: any) => {
      const oid = item.order?.order_id;
      if (!oid) return;
      if (interBranchOrderIds.has(oid)) return;
      const qty = Number(item.quantity) || 0;
      const rev = qty * (Number(item.unit_price) || 0);
      const cost = qty * (Number(item.actual_unit_cost) || 0);
      if (!orderProfitMap[oid]) orderProfitMap[oid] = { revenue: 0, cost: 0 };
      orderProfitMap[oid].revenue += rev;
      orderProfitMap[oid].cost += cost;
    });

    // ── Process: Orders list ──────────────────────────────────────────────────
    const orders = deliveredInvoices.map((inv: any) => {
      const oid = inv.orders?.order_id;
      const isInterBranch = oid ? interBranchOrderIds.has(oid) : false;
      const profitEntry = (!isInterBranch && oid) ? orderProfitMap[oid] : null;
      const profit = isInterBranch ? 0 : (profitEntry ? profitEntry.revenue - profitEntry.cost : null);
      const revenue = profitEntry ? profitEntry.revenue : null;
      return {
        id: inv.id,
        invoiceNo: inv.invoice_no,
        manualInvoiceNo: inv.manual_invoice_no || null,
        date: inv.orders?.order_date
          ? new Date(inv.orders.order_date).toISOString().split("T")[0]
          : inv.created_at?.split("T")[0] || null,
        customer: inv.customers?.shop_name || "Unknown",
        amount: Number(inv.total_amount) || 0,
        dueAmount: Number(inv.due_amount) || 0,
        paymentStatus: inv.status || "Unpaid",
        isInterBranch,
        profit,
        profitMargin: isInterBranch ? 0 : (revenue && revenue > 0 ? ((profit ?? 0) / revenue) * 100 : null),
      };
    });

    // ── Process: Due Invoices ─────────────────────────────────────────────────
    const dueInvoices = orders
      .filter((o) => o.paymentStatus !== "Paid" && o.dueAmount > 0)
      .sort((a, b) => b.dueAmount - a.dueAmount);

    // ── Process: Expenses list ────────────────────────────────────────────────
    const expenseList = (expenses || []).map((e: any) => ({
      id: e.id,
      description: e.description || "-",
      amount: Number(e.amount) || 0,
      category: e.category || "General",
      date: e.expense_date,
      paymentMethod: e.payment_method || "-",
    }));

    return NextResponse.json({
      overview: {
        totalSales,
        orderCount,
        totalProfit,
        totalCost,
        profitMargin,
        totalExpenses,
        expenseCount,
      },
      monthly,
      profitMonthly,
      products,
      customers,
      customerProfits,
      marginDistribution,
      orders,
      dueInvoices,
      expenses: expenseList,
      costLayers,
    });
  } catch (error: any) {
    console.error("Sierra report error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
