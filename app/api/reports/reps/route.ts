import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAllRepReturns, deductReturnFromBreakdown, isReturnPickupOrder } from "@/lib/rep-returns";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const _repReportCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const fromDate = searchParams.get("from") || firstDay;
    const toDate = searchParams.get("to") || lastDay;
    const fromDateOnly = fromDate.split("T")[0];
    const toDateOnly = toDate.split("T")[0];
    const isRefresh = searchParams.get("refresh") === "true";

    const cacheKey = `${fromDate}_${toDate}`;
    const cached = _repReportCache.get(cacheKey);
    if (!isRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    // 1. All reps
    const { data: reps, error: repsError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "rep")
      .order("full_name");
    if (repsError) throw repsError;

    // 2. Delivered orders in period assigned to a rep
    const { data: ordersRaw, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(`
        id, order_id, total_amount, status, created_at, order_date, sales_rep_id, notes,
        extra_discount_amount,
        customers (id, shop_name),
        invoices (id, invoice_no, manual_invoice_no, total_amount, paid_amount, status),
        rep_commissions (total_commission_amount, status)
      `)
      .eq("status", "Delivered")
      .gte("created_at", fromDate)
      .lte("created_at", toDate)
      .not("sales_rep_id", "is", null);
    if (ordersError) throw ordersError;
    // Return-note pickup / exchange orders are not sales
    const orders = (ordersRaw || []).filter((o: any) => !isReturnPickupOrder(o.notes));

    // Build lookup maps from orders
    const allInvoiceIds: string[] = [];
    const invoiceRepMap: Record<string, string> = {};
    const allOrderIds: string[] = [];
    const orderRepIdMap: Record<string, string> = {};

    (orders || []).forEach((o: any) => {
      const inv = Array.isArray(o.invoices) ? o.invoices[0] : o.invoices;
      if (inv?.id) {
        allInvoiceIds.push(inv.id);
        if (o.sales_rep_id) invoiceRepMap[inv.id] = o.sales_rep_id;
      }
      if (o.id) {
        allOrderIds.push(o.id);
        if (o.sales_rep_id) orderRepIdMap[o.id] = o.sales_rep_id;
      }
    });

    // 3. Payments in period for those invoices
    type PaymentEntry = { amount: number; date: string };
    const repPaymentsMap: Record<string, PaymentEntry[]> = {};

    if (allInvoiceIds.length > 0) {
      const { data: payments } = await supabaseAdmin
        .from("payments")
        .select("invoice_id, amount, payment_date")
        .in("invoice_id", allInvoiceIds)
        .gte("payment_date", fromDateOnly)
        .lte("payment_date", toDateOnly);

      (payments || []).forEach((p: any) => {
        const repId = invoiceRepMap[p.invoice_id];
        if (!repId) return;
        if (!repPaymentsMap[repId]) repPaymentsMap[repId] = [];
        repPaymentsMap[repId].push({ amount: Number(p.amount) || 0, date: p.payment_date });
      });
    }

    // 4. Order items for per-supplier & per-category commission breakdown (batched in parallel)
    let rawOrderItems: any[] = [];
    if (allOrderIds.length > 0) {
      const batchSize = 100;
      const batchPromises = [];
      for (let i = 0; i < allOrderIds.length; i += batchSize) {
        const batch = allOrderIds.slice(i, i + batchSize);
        batchPromises.push(
          supabaseAdmin
            .from("order_items")
            .select(`
              order_id, quantity, free_quantity, unit_price, total_price, commission_earned, actual_unit_cost,
              product:products (id, supplier_name, category, sub_category, product_family, cost_price, actual_cost_price)
            `)
            .in("order_id", batch)
        );
      }
      const results = await Promise.all(batchPromises);
      for (const res of results) {
        if (res.data && res.data.length > 0) {
          rawOrderItems.push(...res.data);
        }
      }
    }

    // 5. Pending orders (current state — no date filter)
    const { data: pendingOrders, error: pendingError } = await supabaseAdmin
      .from("orders")
      .select("id, total_amount, sales_rep_id, status")
      .not("status", "in", `("Delivered","Cancelled")`)
      .not("sales_rep_id", "is", null);
    if (pendingError) throw pendingError;

    // 6. Commission rules (global reference)
    const { data: commissionRules } = await supabaseAdmin
      .from("commission_rules")
      .select("id, supplier_name, category, sub_category, rate")
      .order("supplier_name");

    const findRate = (sup: string, cat: string, subCat: string | null) => {
      if (!commissionRules || commissionRules.length === 0) return 0;
      const exact = commissionRules.find(
        (r) =>
          r.supplier_name?.toLowerCase() === sup.toLowerCase() &&
          r.category?.toLowerCase() === cat.toLowerCase() &&
          (subCat ? r.sub_category?.toLowerCase() === subCat.toLowerCase() : true)
      );
      if (exact) return Number(exact.rate) || 0;
      const matchCat = commissionRules.find(
        (r) =>
          r.supplier_name?.toLowerCase() === sup.toLowerCase() &&
          r.category?.toLowerCase() === cat.toLowerCase()
      );
      if (matchCat) return Number(matchCat.rate) || 0;
      const matchSup = commissionRules.find(
        (r) => r.supplier_name?.toLowerCase() === sup.toLowerCase()
      );
      if (matchSup) return Number(matchSup.rate) || 0;
      return 0;
    };

    // 7. Build per-rep aggregation
    const today = new Date(); today.setHours(0, 0, 0, 0);

    type MonthEntry = { month: string; monthKey: string; sales: number; collections: number };
    type InvoiceEntry = {
      orderId: string; invoiceNo: string; customer: string; date: string;
      total: number; paid: number; due: number;
      commission: number; commissionEarned: number; commissionPending: number;
      isPaid: boolean; invStatus: string;
    };
    type RepEntry = {
      id: string; name: string; email: string;
      totalSales: number; totalCollections: number;
      pendingCount: number; pendingAmount: number;
      commissionEarned: number; commissionPending: number;
      monthlyMap: Record<string, MonthEntry>;
      invoices: InvoiceEntry[];
    };

    // Initialize repMap FIRST — all other aggregations reference it
    const repMap: Record<string, RepEntry> = {};
    (reps || []).forEach((rep: any) => {
      repMap[rep.id] = {
        id: rep.id,
        name: rep.full_name || rep.email || "Unknown Rep",
        email: rep.email || "",
        totalSales: 0,
        totalCollections: 0,
        pendingCount: 0,
        pendingAmount: 0,
        commissionEarned: 0,
        commissionPending: 0,
        monthlyMap: {},
        invoices: [],
      };
    });

    // Aggregate delivered orders
    (orders || []).forEach((order: any) => {
      const repId = order.sales_rep_id;
      if (!repMap[repId]) return;

      // Exclude inter-branch by customer name
      const shopName = (order.customers?.shop_name || "").toLowerCase();
      if (shopName.includes("champika hardware")) return;

      const inv = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
      const repCom = Array.isArray(order.rep_commissions)
        ? order.rep_commissions[0]
        : order.rep_commissions;

      const total = Number(inv?.total_amount || order.total_amount || 0);
      const paid = Number(inv?.paid_amount || 0);
      const due = Math.max(0, total - paid);
      const commissionAmount = Number(repCom?.total_commission_amount || 0);

      const invoiceDate = new Date(order.order_date || order.created_at);
      invoiceDate.setHours(0, 0, 0, 0);
      const daysSince = Math.floor((today.getTime() - invoiceDate.getTime()) / 86400000);
      const isPaid = due === 0 && paid > 0;

      const commissionEarned = isPaid ? commissionAmount : 0;
      const commissionPending = !isPaid && daysSince <= 60 ? commissionAmount : 0;

      repMap[repId].totalSales += total;
      repMap[repId].commissionEarned += commissionEarned;
      repMap[repId].commissionPending += commissionPending;

      // Monthly sales
      const d = new Date(order.order_date || order.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!repMap[repId].monthlyMap[key]) {
        repMap[repId].monthlyMap[key] = {
          month: d.toLocaleString("default", { month: "short", year: "2-digit" }),
          monthKey: key,
          sales: 0,
          collections: 0,
        };
      }
      repMap[repId].monthlyMap[key].sales += total;

      const invoiceNo = inv?.manual_invoice_no || inv?.invoice_no || order.order_id;
      repMap[repId].invoices.push({
        orderId: order.order_id,
        invoiceNo,
        customer: order.customers?.shop_name || "Unknown",
        date: (order.order_date || order.created_at || "").split("T")[0],
        total,
        paid,
        due,
        commission: commissionAmount,
        commissionEarned,
        commissionPending,
        isPaid,
        invStatus: inv?.status || "Unpaid",
      });
    });

    // Aggregate collections
    Object.entries(repPaymentsMap).forEach(([repId, payments]) => {
      if (!repMap[repId]) return;
      payments.forEach((p) => {
        repMap[repId].totalCollections += p.amount;
        const d = new Date(p.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!repMap[repId].monthlyMap[key]) {
          repMap[repId].monthlyMap[key] = {
            month: d.toLocaleString("default", { month: "short", year: "2-digit" }),
            monthKey: key,
            sales: 0,
            collections: 0,
          };
        }
        repMap[repId].monthlyMap[key].collections += p.amount;
      });
    });

    // Aggregate pending orders
    (pendingOrders || []).forEach((o: any) => {
      const repId = o.sales_rep_id;
      if (!repMap[repId]) return;
      repMap[repId].pendingCount += 1;
      repMap[repId].pendingAmount += Number(o.total_amount || 0);
    });

    // Aggregate per-supplier AND per-category commission
    type SupplierCommEntry = { name: string; sales: number; commission: number; itemsCount: number };
    type CategoryCommEntry = {
      supplier: string; category: string; subCategory: string | null;
      sales: number; commission: number; itemsCount: number;
    };
    const repSupplierMap: Record<string, Record<string, SupplierCommEntry>> = {};
    const repCategoryMap: Record<string, Record<string, CategoryCommEntry>> = {};

    rawOrderItems.forEach((item: any) => {
      const repId = orderRepIdMap[item.order_id];
      if (!repId || !repMap[repId]) return;
      const supplier = item.product?.supplier_name || "Unknown Supplier";
      const category = item.product?.category || "Uncategorised";
      const subCategory: string | null = item.product?.sub_category || null;
      const qty = Number(item.quantity) || 0;
      const sales = qty * (Number(item.unit_price) || 0);
      const earnedComm = Number(item.commission_earned) || 0;
      const fallbackRate = findRate(supplier, category, subCategory);
      const commission = earnedComm > 0 ? earnedComm : sales * (fallbackRate / 100);

      // By supplier
      if (!repSupplierMap[repId]) repSupplierMap[repId] = {};
      if (!repSupplierMap[repId][supplier]) {
        repSupplierMap[repId][supplier] = { name: supplier, sales: 0, commission: 0, itemsCount: 0 };
      }
      repSupplierMap[repId][supplier].sales += sales;
      repSupplierMap[repId][supplier].commission += commission;
      repSupplierMap[repId][supplier].itemsCount += qty;

      // By supplier + category + sub_category
      const catKey = `${supplier}||${category}||${subCategory ?? ""}`;
      if (!repCategoryMap[repId]) repCategoryMap[repId] = {};
      if (!repCategoryMap[repId][catKey]) {
        repCategoryMap[repId][catKey] = { supplier, category, subCategory, sales: 0, commission: 0, itemsCount: 0 };
      }
      repCategoryMap[repId][catKey].sales += sales;
      repCategoryMap[repId][catKey].commission += commission;
      repCategoryMap[repId][catKey].itemsCount += qty;
    });

    // ── Per Product Family: sales, cost & profit ─────────────────────────────
    // Same rules as the Actual Profit report:
    //   sales = line total − share of invoice extra discount − share of cash discount
    //   cost  = (paid + free qty) × FIFO unit cost (order_items.actual_unit_cost)
    type FamilyEntry = {
      family: string; category: string; subCategory: string | null;
      qty: number; sales: number; cost: number;
    };
    const repFamilyMap: Record<string, Record<string, FamilyEntry>> = {};
    const addFamily = (
      repId: string, family: string, category: string, subCategory: string | null,
      qty: number, sales: number, cost: number,
    ) => {
      const map = (repFamilyMap[repId] ||= {});
      const key = `${family}||${category}||${subCategory ?? ""}`;
      const e = (map[key] ||= { family, category, subCategory, qty: 0, sales: 0, cost: 0 });
      e.qty += qty;
      e.sales += sales;
      e.cost += cost;
    };

    // Orders that count toward the rep's totals (inter-branch sales are left out above)
    const countedOrders: Record<string, { extra: number; cash: number }> = {};
    (orders || []).forEach((o: any) => {
      if (!repMap[o.sales_rep_id]) return;
      const shop = (o.customers?.shop_name || "").toLowerCase();
      if (shop.includes("champika hardware")) return;
      const cashMatch = String(o.notes || "").match(/\[CASH_DISCOUNT_AMOUNT:([\d.]+)\]/);
      countedOrders[o.id] = {
        extra: Number(o.extra_discount_amount) || 0,
        cash: cashMatch ? Number(cashMatch[1]) || 0 : 0,
      };
    });
    const lineTotalOf = (it: any) =>
      it.total_price !== null && it.total_price !== undefined
        ? Number(it.total_price) || 0
        : (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    const orderSubtotal: Record<string, number> = {};
    rawOrderItems.forEach((it: any) => {
      if (!countedOrders[it.order_id]) return;
      orderSubtotal[it.order_id] = (orderSubtotal[it.order_id] || 0) + lineTotalOf(it);
    });

    rawOrderItems.forEach((it: any) => {
      const meta = countedOrders[it.order_id];
      if (!meta) return;
      const repId = orderRepIdMap[it.order_id];
      if (!repId) return;
      const prod = it.product || {};
      const family = (prod.product_family || "").trim() || "No Family";
      const lineTotal = lineTotalOf(it);
      const subtotal = orderSubtotal[it.order_id] || 0;
      const share = subtotal > 0 ? lineTotal / subtotal : 0;
      const sales = lineTotal - share * meta.extra - share * meta.cash;
      const unitCost =
        it.actual_unit_cost !== null && it.actual_unit_cost !== undefined
          ? Number(it.actual_unit_cost) || 0
          : Number(prod.actual_cost_price) || Number(prod.cost_price) || 0;
      const qty = Number(it.quantity) || 0;
      const free = Number(it.free_quantity) || 0;
      addFamily(
        repId, family, prod.category || "Uncategorised", prod.sub_category || null,
        qty, sales, (qty + free) * unitCost,
      );
    });

    // Returns come off the invoice rep's sales & commission in the month the return was made
    const repReturnTotals: Record<string, { value: number; commission: number; count: number }> = {};
    const allReturns = await getAllRepReturns(fromDate, toDate);

    // Product family of returned products (they may not be in this period's sales)
    const returnFamily: Record<string, string> = {};
    const returnProductIds = Array.from(new Set(allReturns.map((r) => r.productId).filter(Boolean)));
    if (returnProductIds.length > 0) {
      const { data: retProds } = await supabaseAdmin
        .from("products")
        .select("id, product_family")
        .in("id", returnProductIds);
      (retProds || []).forEach((p: any) => {
        returnFamily[p.id] = (p.product_family || "").trim() || "No Family";
      });
    }
    allReturns.forEach((r) => {
      const rep = repMap[r.ownerId];
      if (!rep) return;
      rep.totalSales -= r.value;
      // Pending commission first, then earned
      const fromPending = Math.min(rep.commissionPending, r.commission);
      rep.commissionPending -= fromPending;
      rep.commissionEarned -= r.commission - fromPending;

      if (!rep.monthlyMap[r.monthKey]) {
        rep.monthlyMap[r.monthKey] = {
          month: new Date(r.date).toLocaleString("default", { month: "short", year: "2-digit" }),
          monthKey: r.monthKey,
          sales: 0,
          collections: 0,
        };
      }
      rep.monthlyMap[r.monthKey].sales -= r.value;

      if (!repSupplierMap[r.ownerId]) repSupplierMap[r.ownerId] = {};
      if (!repCategoryMap[r.ownerId]) repCategoryMap[r.ownerId] = {};
      deductReturnFromBreakdown(repSupplierMap[r.ownerId], repCategoryMap[r.ownerId], r);
      addFamily(
        r.ownerId, returnFamily[r.productId] || "No Family", r.category || "Uncategorised",
        r.subCategory || null, -r.quantity, -r.value, -r.cost,
      );

      const t = (repReturnTotals[r.ownerId] ||= { value: 0, commission: 0, count: 0 });
      t.value += r.value;
      t.commission += r.commission;
      t.count += 1;
    });

    // Build final results
    const repsResult = Object.values(repMap).map((rep) => {
      const monthly = Object.values(rep.monthlyMap).sort((a, b) =>
        a.monthKey.localeCompare(b.monthKey)
      );
      rep.invoices.sort((a, b) => b.date.localeCompare(a.date));

      const commissionBySupplier = Object.values(repSupplierMap[rep.id] || {})
        .filter((s) => s.sales !== 0 || s.commission !== 0 || s.itemsCount !== 0)
        .map((s) => ({
          ...s,
          rate: s.sales > 0 ? (s.commission / s.sales) * 100 : 0,
          sharePct: rep.totalSales > 0 ? (s.sales / rep.totalSales) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales);

      const commissionByCategory = Object.values(repCategoryMap[rep.id] || {})
        .filter((c) => c.sales !== 0 || c.commission !== 0 || c.itemsCount !== 0)
        .map((c) => ({
          ...c,
          rate: c.sales > 0 ? (c.commission / c.sales) * 100 : 0,
          sharePct: rep.totalSales > 0 ? (c.sales / rep.totalSales) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales);

      const salesByFamily = Object.values(repFamilyMap[rep.id] || {})
        .filter((f) => Math.abs(f.sales) > 0.005 || Math.abs(f.cost) > 0.005 || f.qty !== 0)
        .map((f) => ({
          ...f,
          sales: Math.round(f.sales * 100) / 100,
          cost: Math.round(f.cost * 100) / 100,
          profit: Math.round((f.sales - f.cost) * 100) / 100,
          marginPct: f.sales > 0 ? ((f.sales - f.cost) / f.sales) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales);

      return {
        id: rep.id,
        name: rep.name,
        email: rep.email,
        totalSales: rep.totalSales,
        totalCollections: rep.totalCollections,
        pendingCount: rep.pendingCount,
        pendingAmount: rep.pendingAmount,
        commissionEarned: rep.commissionEarned,
        commissionPending: rep.commissionPending,
        totalReturns: Math.round((repReturnTotals[rep.id]?.value || 0) * 100) / 100,
        returnCommission: Math.round((repReturnTotals[rep.id]?.commission || 0) * 100) / 100,
        returnCount: repReturnTotals[rep.id]?.count || 0,
        invoiceCount: rep.invoices.length,
        monthly,
        invoices: rep.invoices,
        commissionBySupplier,
        commissionByCategory,
        salesByFamily,
      };
    }).sort((a, b) => b.totalSales - a.totalSales);

    const payload = { reps: repsResult, commissionRules: commissionRules || [] };
    _repReportCache.set(cacheKey, { data: payload, timestamp: Date.now() });
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("Rep analytics error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
