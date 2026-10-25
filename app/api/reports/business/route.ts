import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";
import { getApprovedReturns, isReturnPickupOrder } from "@/lib/rep-returns";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), 0, 1).toISOString();
    const lastDay = new Date(now.getFullYear(), 11, 31).toISOString();
    const fromDate = searchParams.get("from") || firstDay;
    const toDate = searchParams.get("to") || lastDay;

    const COUNTED_STATUSES = ["Delivered", "Completed"];

    // 1. All invoices in the period — revenue source (matches Sierra Agency page) with pagination
    const allInvoices: any[] = [];
    let invStart = 0;
    const invLimit = 1000;
    while (true) {
      const { data: batch, error: allInvError } = await supabaseAdmin
        .from("invoices")
        .select(`
          id, invoice_no, manual_invoice_no, total_amount, due_amount, status,
          order:orders!inner (
            order_id, status, created_at, order_date, business_id, sales_rep_id, notes,
            customer:customers (id, shop_name),
            rep:profiles!orders_sales_rep_id_fkey (id, full_name)
          )
        `)
        .gte("order.order_date", fromDate)
        .lte("order.order_date", toDate)
        .range(invStart, invStart + invLimit - 1);

      if (allInvError) throw allInvError;
      if (!batch || batch.length === 0) break;
      // Return-note pickup / exchange orders are not sales
      allInvoices.push(...batch.filter((inv: any) => !isReturnPickupOrder(inv.order?.notes)));
      if (batch.length < invLimit) break;
      invStart += invLimit;
    }

    // 2. Order items — cost + product + customer detail (filtered to invoiced orders only) with pagination
    const orderItems: any[] = [];
    let itemsStart = 0;
    const itemsLimit = 1000;
    while (true) {
      const { data: batch, error: itemsError } = await supabaseAdmin
        .from("order_items")
        .select(`
          id, quantity, free_quantity, unit_price, actual_unit_cost, total_price, claim_status,
          product:products (id, name, sku),
          order:orders!inner (
            id, order_id, status, created_at, order_date, business_id, sales_rep_id,
            customer:customers (id, shop_name),
            rep:profiles!orders_sales_rep_id_fkey (id, full_name)
          )
        `)
        .gte("order.order_date", fromDate)
        .lte("order.order_date", toDate)
        .range(itemsStart, itemsStart + itemsLimit - 1);

      if (itemsError) throw new Error(`Order items query failed: ${itemsError.message}`);
      if (!batch || batch.length === 0) break;
      orderItems.push(...batch);
      if (batch.length < itemsLimit) break;
      itemsStart += itemsLimit;
    }

    type ProductEntry = {
      id: string; name: string; sku: string;
      unitsSold: number; revenue: number; cost: number; profit: number;
    };
    type CustomerEntry = {
      id: string; name: string;
      revenue: number; cost: number; profit: number;
      dueAmount: number; orderSet: Set<string>;
    };
    type RepEntry = {
      id: string; name: string;
      revenue: number; cost: number; profit: number;
      dueAmount: number; invoiceCount: number;
    };
    type InvoiceEntry = {
      invoiceId: string; orderId: string; invoiceNo: string;
      customer: string; date: string;
      amount: number; due: number; paymentStatus: string;
      repName?: string;
      repId?: string;
      profit?: number | null;
      profitMargin?: number | null;
      freeQty?: number;
      freeCost?: number;
      pendingClaimCost?: number;
      netProfit?: number | null;
      netMargin?: number | null;
      isReturn?: boolean;
    };
    type BusinessEntry = {
      id: string; name: string;
      totalRevenue: number; totalCost: number; totalUnits: number;
      invoicedOrderIds: Set<string>;
      customerCountSet: Set<string>;
      dueAmount: number;
      pendingClaimCost: number;
      totalFreeQty: number;
      totalFreeCost: number;
      productMap: Record<string, ProductEntry>;
      customerMap: Record<string, CustomerEntry>;
      repMap: Record<string, RepEntry>;
      invoiceList: InvoiceEntry[];
    };

    const businessMap: Record<string, BusinessEntry> = {};

    const ensureBusiness = (bizId: string) => {
      if (!businessMap[bizId]) {
        businessMap[bizId] = {
          id: bizId,
          name: BUSINESS_NAMES[bizId as keyof typeof BUSINESS_NAMES] || "Unknown",
          totalRevenue: 0, totalCost: 0, totalUnits: 0,
          invoicedOrderIds: new Set(),
          customerCountSet: new Set(),
          dueAmount: 0,
          pendingClaimCost: 0,
          totalFreeQty: 0,
          totalFreeCost: 0,
          productMap: {}, customerMap: {}, repMap: {}, invoiceList: [],
        };
      }
    };

    Object.values(BUSINESS_IDS).forEach((id) => ensureBusiness(id));

    // Pass 1 — invoices: build revenue, invoicedOrderIds, invoiceList, dueAmount
    (allInvoices || []).forEach((inv: any) => {
      const order = inv.order;
      if (!order || !COUNTED_STATUSES.includes(order.status)) return;

      // Filter out inter-branch invoices
      const shopName = (order.customer?.shop_name || "").toLowerCase();
      if (shopName.includes("champika hardware")) return;

      const bizId = order.business_id;
      if (!bizId) return;

      ensureBusiness(bizId);
      const biz = businessMap[bizId];

      const amount = Number(inv.total_amount) || 0;
      const due = Number(inv.due_amount) || 0;

      biz.totalRevenue += amount;
      biz.invoicedOrderIds.add(order.order_id);

      if (["Unpaid", "Partial", "Overdue"].includes(inv.status)) {
        biz.dueAmount += due;
      }

      const repId = order.sales_rep_id || "direct";
      const repName = order.rep?.full_name || "Direct Sales";
      const date = (order.order_date || order.created_at || "").split("T")[0];
      biz.invoiceList.push({
        invoiceId: inv.id,
        orderId: order.order_id,
        invoiceNo: inv.manual_invoice_no || inv.invoice_no || order.order_id,
        customer: order.customer?.shop_name || "Unknown",
        date,
        amount,
        due,
        paymentStatus: inv.status || "Unpaid",
        repName,
        repId,
      });

      // Representatives aggregation in Pass 1
      if (!biz.repMap[repId]) {
        biz.repMap[repId] = {
          id: repId,
          name: repName,
          revenue: 0,
          cost: 0,
          profit: 0,
          dueAmount: 0,
          invoiceCount: 0,
        };
      }
      biz.repMap[repId].invoiceCount += 1;
      if (["Unpaid", "Partial", "Overdue"].includes(inv.status)) {
        biz.repMap[repId].dueAmount += due;
      }
    });

    const orderProfitMap: Record<string, { revenue: number; cost: number; freeQty: number; freeCost: number; pendingClaimCost: number }> = {};

    // Pass 2 — order items: cost + products + customers, ONLY for invoiced orders
    (orderItems || []).forEach((item: any) => {
      const order = item.order;
      if (!order || !COUNTED_STATUSES.includes(order.status)) return;
      const bizId = order.business_id;
      if (!bizId) return;

      ensureBusiness(bizId);
      const biz = businessMap[bizId];

      // Only count items whose order has an invoice
      if (!biz.invoicedOrderIds.has(order.order_id)) return;

      const qty = Number(item.quantity) || 0;
      const freeQty = Number(item.free_quantity) || 0;
      const itemRevenue = Number(item.total_price) || 0;
      const cost = qty * (Number(item.actual_unit_cost) || 0);
      const freeCost = freeQty * (Number(item.actual_unit_cost) || 0);
      const pendingClaim = item.claim_status !== "Approved" ? freeCost : 0;

      const oid = order.order_id;
      if (!orderProfitMap[oid]) {
        orderProfitMap[oid] = { revenue: 0, cost: 0, freeQty: 0, freeCost: 0, pendingClaimCost: 0 };
      }
      orderProfitMap[oid].revenue += itemRevenue;
      orderProfitMap[oid].cost += cost;
      orderProfitMap[oid].freeQty += freeQty;
      orderProfitMap[oid].freeCost += freeCost;
      orderProfitMap[oid].pendingClaimCost += pendingClaim;

      biz.totalCost += cost;
      biz.totalUnits += qty;
      biz.totalFreeQty += freeQty;
      biz.totalFreeCost += freeCost;
      biz.pendingClaimCost += pendingClaim;

      if (order.customer?.id) biz.customerCountSet.add(order.customer.id);

      // Products
      const pid = item.product?.id;
      if (pid) {
        if (!biz.productMap[pid]) {
          biz.productMap[pid] = {
            id: pid, name: item.product.name || "", sku: item.product.sku || "",
            unitsSold: 0, revenue: 0, cost: 0, profit: 0,
          };
        }
        biz.productMap[pid].unitsSold += qty;
        biz.productMap[pid].revenue += itemRevenue;
        biz.productMap[pid].cost += cost;
        biz.productMap[pid].profit += itemRevenue - cost;
      }

      // Customers
      const cId = order.customer?.id || "unknown";
      const cName = order.customer?.shop_name || "Unknown";
      if (!biz.customerMap[cId]) {
        biz.customerMap[cId] = {
          id: cId, name: cName, revenue: 0, cost: 0, profit: 0,
          dueAmount: 0, orderSet: new Set(),
        };
      }
      biz.customerMap[cId].revenue += itemRevenue;
      biz.customerMap[cId].cost += cost;
      biz.customerMap[cId].profit += itemRevenue - cost;
      biz.customerMap[cId].orderSet.add(order.order_id);

      // Representatives aggregation in Pass 2
      const repId = order.sales_rep_id || "direct";
      const repName = order.rep?.full_name || "Direct Sales";
      if (!biz.repMap[repId]) {
        biz.repMap[repId] = {
          id: repId,
          name: repName,
          revenue: 0,
          cost: 0,
          profit: 0,
          dueAmount: 0,
          invoiceCount: 0,
        };
      }
      biz.repMap[repId].revenue += itemRevenue;
      biz.repMap[repId].cost += cost;
      biz.repMap[repId].profit += itemRevenue - cost;
    });

    // Attach customer due amounts from invoice pass
    (allInvoices || []).forEach((inv: any) => {
      const order = inv.order;
      if (!order || !COUNTED_STATUSES.includes(order.status)) return;
      const bizId = order.business_id;
      if (!bizId || !businessMap[bizId]) return;
      if (!["Unpaid", "Partial", "Overdue"].includes(inv.status)) return;
      const cId = order.customer?.id || "unknown";
      const biz = businessMap[bizId];
      if (biz.customerMap[cId]) {
        biz.customerMap[cId].dueAmount += Number(inv.due_amount) || 0;
      }
    });

    // Pass 3 — approved customer returns: deduct in the month the return was made
    // (the original invoice month is left untouched)
    const returns = await getApprovedReturns(fromDate, toDate);
    returns.forEach((r) => {
      const bizId = r.businessId || BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;
      ensureBusiness(bizId);
      const biz = businessMap[bizId];
      const profit = r.value - r.cost;

      biz.totalRevenue -= r.value;
      biz.totalCost -= r.cost;
      biz.totalUnits -= r.quantity;

      if (!biz.productMap[r.productId]) {
        biz.productMap[r.productId] = {
          id: r.productId, name: r.productName, sku: r.sku,
          unitsSold: 0, revenue: 0, cost: 0, profit: 0,
        };
      }
      const p = biz.productMap[r.productId];
      p.unitsSold -= r.quantity;
      p.revenue -= r.value;
      p.cost -= r.cost;
      p.profit -= profit;

      const cId = r.customerId || "unknown";
      if (!biz.customerMap[cId]) {
        biz.customerMap[cId] = {
          id: cId, name: r.customer, revenue: 0, cost: 0, profit: 0,
          dueAmount: 0, orderSet: new Set(),
        };
      }
      biz.customerMap[cId].revenue -= r.value;
      biz.customerMap[cId].cost -= r.cost;
      biz.customerMap[cId].profit -= profit;

      const repId = r.ownerId || "direct";
      if (!biz.repMap[repId]) {
        biz.repMap[repId] = {
          id: repId, name: "Direct Sales", revenue: 0, cost: 0, profit: 0, dueAmount: 0, invoiceCount: 0,
        };
      }
      biz.repMap[repId].revenue -= r.value;
      biz.repMap[repId].cost -= r.cost;
      biz.repMap[repId].profit -= profit;

      // Show the return as a negative line in the invoice list / monthly breakdown
      orderProfitMap[r.returnNumber] = {
        revenue: -r.value, cost: -r.cost, freeQty: 0, freeCost: 0, pendingClaimCost: 0,
      };
      biz.invoiceList.push({
        invoiceId: r.returnNumber,
        orderId: r.returnNumber,
        invoiceNo: r.invoiceNo ? `${r.returnNumber} (Bill ${r.invoiceNo})` : r.returnNumber,
        customer: r.customer,
        date: new Date(r.date).toISOString().split("T")[0],
        amount: -r.value,
        due: 0,
        paymentStatus: "Return",
        repName: biz.repMap[repId].name,
        repId,
        isReturn: true,
      });
    });

    // Fill in rep names for reps that only appear through a return
    const unnamed = new Set<string>();
    Object.values(businessMap).forEach((b) =>
      Object.values(b.repMap).forEach((r) => {
        if (r.id !== "direct" && r.name === "Direct Sales") unnamed.add(r.id);
      })
    );
    if (unnamed.size > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", [...unnamed]);
      const names = new Map((profs || []).map((p: any) => [p.id, p.full_name || "Unknown Rep"]));
      Object.values(businessMap).forEach((b) => {
        Object.values(b.repMap).forEach((r) => {
          if (names.has(r.id)) r.name = names.get(r.id)!;
        });
        b.invoiceList.forEach((inv) => {
          if (inv.isReturn && inv.repId && names.has(inv.repId)) inv.repName = names.get(inv.repId)!;
        });
      });
    }

    // Build final list
    const businesses = Object.values(businessMap).map((biz) => {
      const invoices = [...biz.invoiceList].map((inv: any) => {
        const profitEntry = orderProfitMap[inv.orderId];
        const profit = profitEntry ? inv.amount - profitEntry.cost : null;
        const grossProfit = profit !== null ? (profit > 0 ? profit : 0) : null;
        const loss = profit !== null ? (profit < 0 ? Math.abs(profit) : 0) : null;
        const profitMargin = profit !== null && inv.amount > 0 ? (profit / inv.amount) * 100 : null;
        
        const freeQty = profitEntry ? profitEntry.freeQty : 0;
        const freeCost = profitEntry ? profitEntry.freeCost : 0;
        const pendingClaimCost = profitEntry ? profitEntry.pendingClaimCost : 0;
        const netProfit = profit !== null ? profit - pendingClaimCost : null;
        const netMargin = profitEntry && inv.amount > 0 && netProfit !== null ? (netProfit / inv.amount) * 100 : null;

        return {
          ...inv,
          profit,
          grossProfit,
          loss,
          profitMargin,
          freeQty,
          freeCost,
          pendingClaimCost,
          netProfit,
          netMargin,
        };
      }).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // Returns are not a "loss" — they lower gross profit directly
      const saleRows = invoices.filter((inv) => !inv.isReturn);
      const returnProfit = invoices.reduce((s, inv) => s + (inv.isReturn ? -(inv.profit || 0) : 0), 0);
      const returnValue = invoices.reduce((s, inv) => s + (inv.isReturn ? -inv.amount : 0), 0);
      const totalGrossProfit =
        saleRows.reduce((s, inv) => s + ((inv.profit && inv.profit > 0) ? inv.profit : 0), 0) - returnProfit;
      const totalLoss = saleRows.reduce((s, inv) => s + ((inv.profit && inv.profit < 0) ? Math.abs(inv.profit) : 0), 0);
      const totalProfit = biz.totalRevenue - biz.totalCost;
      const netProfit = totalProfit - biz.pendingClaimCost;

      const products = Object.values(biz.productMap)
        .map((p) => ({ ...p, margin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0 }))
        .sort((a, b) => b.revenue - a.revenue);

      const customers = Object.values(biz.customerMap)
        .map((c) => {
          const collected = Math.max(0, c.revenue - c.dueAmount);
          return {
            id: c.id, name: c.name,
            revenue: c.revenue, cost: c.cost, profit: c.profit,
            dueAmount: c.dueAmount,
            collected,
            collectionRate: c.revenue > 0 ? (collected / c.revenue) * 100 : 0,
            invoiceCount: c.orderSet.size,
            margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0,
          };
        })
        .sort((a, b) => b.revenue - a.revenue);

      const reps = Object.values(biz.repMap)
        .map((r) => {
          const collected = Math.max(0, r.revenue - r.dueAmount);
          return {
            id: r.id, name: r.name,
            revenue: r.revenue, cost: r.cost, profit: r.profit,
            dueAmount: r.dueAmount,
            collected,
            collectionRate: r.revenue > 0 ? (collected / r.revenue) * 100 : 0,
            invoiceCount: r.invoiceCount,
            margin: r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0,
          };
        })
        .sort((a, b) => b.revenue - a.revenue);

      // Monthly breakdown
      const monthMap: Record<string, any> = {};
      invoices.forEach((inv) => {
        if (!inv.date) return;
        const monthKey = inv.date.slice(0, 7);
        if (!monthKey || monthKey.length !== 7) return;

        if (!monthMap[monthKey]) {
          const [y, m] = monthKey.split("-");
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const label = `${monthNames[parseInt(m, 10) - 1]} ${y}`;
          monthMap[monthKey] = {
            month: monthKey,
            monthLabel: label,
            salesAmount: 0,
            collectedAmount: 0,
            dueAmount: 0,
            invoiceCount: 0,
            profit: 0,
            repMap: {},
          };
        }

        const mEntry = monthMap[monthKey];
        const isDue = ["Unpaid", "Partial", "Overdue"].includes(inv.paymentStatus);
        const invDue = isDue ? (Number(inv.due) || 0) : 0;
        const invCollected = Math.max(0, inv.amount - invDue);

        mEntry.salesAmount += inv.amount;
        mEntry.collectedAmount += invCollected;
        mEntry.dueAmount += invDue;
        if (!inv.isReturn) mEntry.invoiceCount += 1;
        mEntry.profit += (inv.profit || 0);

        const rName = inv.repName || "Direct Sales";
        if (!mEntry.repMap[rName]) {
          mEntry.repMap[rName] = { name: rName, sales: 0, collected: 0, due: 0, invoiceCount: 0 };
        }
        mEntry.repMap[rName].sales += inv.amount;
        mEntry.repMap[rName].collected += invCollected;
        mEntry.repMap[rName].due += invDue;
        if (!inv.isReturn) mEntry.repMap[rName].invoiceCount += 1;
      });

      const months = Object.values(monthMap).map((m: any) => ({
        ...m,
        collectionRate: m.salesAmount > 0 ? (m.collectedAmount / m.salesAmount) * 100 : 0,
        margin: m.salesAmount > 0 ? (m.profit / m.salesAmount) * 100 : 0,
        reps: Object.values(m.repMap).sort((a: any, b: any) => b.sales - a.sales),
      })).sort((a, b) => a.month.localeCompare(b.month));

      return {
        id: biz.id,
        name: biz.name,
        totalRevenue: biz.totalRevenue,
        totalCost: biz.totalCost,
        totalGrossProfit,
        totalLoss,
        totalProfit,
        totalUnits: biz.totalUnits,
        invoiceCount: saleRows.length,
        totalReturns: returnValue,
        returnCount: invoices.length - saleRows.length,
        customerCount: biz.customerCountSet.size,
        dueAmount: biz.dueAmount,
        totalCollections: Math.max(0, biz.totalRevenue - biz.dueAmount),
        collectionRate: biz.totalRevenue > 0 ? (Math.max(0, biz.totalRevenue - biz.dueAmount) / biz.totalRevenue) * 100 : 0,
        pendingClaimCost: biz.pendingClaimCost,
        netProfit,
        netMargin: biz.totalRevenue > 0 ? (netProfit / biz.totalRevenue) * 100 : 0,
        totalFreeQty: biz.totalFreeQty,
        totalFreeCost: biz.totalFreeCost,
        margin: biz.totalRevenue > 0 ? (totalGrossProfit / biz.totalRevenue) * 100 : 0,
        products,
        customers,
        reps,
        invoices,
        months,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Overall aggregate
    const allProductsMap: Record<string, any> = {};
    const allCustomersMap: Record<string, any> = {};
    const allRepsMap: Record<string, any> = {};
    const allInvoicesList: any[] = [];

    businesses.forEach((biz) => {
      biz.products.forEach((p: any) => {
        if (!allProductsMap[p.id]) {
          allProductsMap[p.id] = { ...p };
        } else {
          allProductsMap[p.id].unitsSold += p.unitsSold;
          allProductsMap[p.id].revenue += p.revenue;
          allProductsMap[p.id].cost += p.cost;
          allProductsMap[p.id].profit += p.profit;
        }
      });
      biz.customers.forEach((c: any) => {
        if (!allCustomersMap[c.id]) {
          allCustomersMap[c.id] = { ...c };
        } else {
          allCustomersMap[c.id].revenue += c.revenue;
          allCustomersMap[c.id].cost += c.cost;
          allCustomersMap[c.id].profit += c.profit;
          allCustomersMap[c.id].dueAmount += c.dueAmount;
          allCustomersMap[c.id].collected += c.collected;
          allCustomersMap[c.id].invoiceCount += c.invoiceCount;
        }
      });
      biz.reps.forEach((r: any) => {
        if (!allRepsMap[r.id]) {
          allRepsMap[r.id] = { ...r };
        } else {
          allRepsMap[r.id].revenue += r.revenue;
          allRepsMap[r.id].cost += r.cost;
          allRepsMap[r.id].profit += r.profit;
          allRepsMap[r.id].dueAmount += r.dueAmount;
          allRepsMap[r.id].collected += r.collected;
          allRepsMap[r.id].invoiceCount += r.invoiceCount;
        }
      });
      allInvoicesList.push(...biz.invoices);
    });

    const overallProducts = Object.values(allProductsMap)
      .map((p: any) => ({ ...p, margin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0 }))
      .sort((a: any, b: any) => b.revenue - a.revenue);

    const overallCustomers = Object.values(allCustomersMap)
      .map((c: any) => {
        const collected = Math.max(0, c.revenue - c.dueAmount);
        return {
          ...c,
          collected,
          collectionRate: c.revenue > 0 ? (collected / c.revenue) * 100 : 0,
          margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0,
        };
      })
      .sort((a: any, b: any) => b.revenue - a.revenue);

    const overallReps = Object.values(allRepsMap)
      .map((r: any) => {
        const collected = Math.max(0, r.revenue - r.dueAmount);
        return {
          ...r,
          collected,
          collectionRate: r.revenue > 0 ? (collected / r.revenue) * 100 : 0,
          margin: r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0,
        };
      })
      .sort((a: any, b: any) => b.revenue - a.revenue);

    const overallInvoices = allInvoicesList.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const overallTotalRevenue = businesses.reduce((s, b) => s + b.totalRevenue, 0);
    const overallTotalCost = businesses.reduce((s, b) => s + b.totalCost, 0);
    const overallTotalGrossProfit = businesses.reduce((s, b) => s + (b.totalGrossProfit || 0), 0);
    const overallTotalLoss = businesses.reduce((s, b) => s + (b.totalLoss || 0), 0);
    const overallTotalProfit = overallTotalRevenue - overallTotalCost;
    const overallPendingClaimCost = businesses.reduce((s, b) => s + b.pendingClaimCost, 0);
    const overallNetProfit = overallTotalProfit - overallPendingClaimCost;
    const overallDueAmount = businesses.reduce((s, b) => s + b.dueAmount, 0);
    const overallTotalCollections = Math.max(0, overallTotalRevenue - overallDueAmount);

    // Overall Monthly breakdown
    const overallMonthsMap: Record<string, any> = {};
    overallInvoices.forEach((inv) => {
      if (!inv.date) return;
      const monthKey = inv.date.slice(0, 7);
      if (!monthKey || monthKey.length !== 7) return;

      if (!overallMonthsMap[monthKey]) {
        const [y, m] = monthKey.split("-");
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const label = `${monthNames[parseInt(m, 10) - 1]} ${y}`;
        overallMonthsMap[monthKey] = {
          month: monthKey,
          monthLabel: label,
          salesAmount: 0,
          collectedAmount: 0,
          dueAmount: 0,
          invoiceCount: 0,
          profit: 0,
          repMap: {},
        };
      }

      const mEntry = overallMonthsMap[monthKey];
      const isDue = ["Unpaid", "Partial", "Overdue"].includes(inv.paymentStatus);
      const invDue = isDue ? (Number(inv.due) || 0) : 0;
      const invCollected = Math.max(0, inv.amount - invDue);

      mEntry.salesAmount += inv.amount;
      mEntry.collectedAmount += invCollected;
      mEntry.dueAmount += invDue;
      if (!inv.isReturn) mEntry.invoiceCount += 1;
      mEntry.profit += (inv.profit || 0);

      const rName = inv.repName || "Direct Sales";
      if (!mEntry.repMap[rName]) {
        mEntry.repMap[rName] = { name: rName, sales: 0, collected: 0, due: 0, invoiceCount: 0 };
      }
      mEntry.repMap[rName].sales += inv.amount;
      mEntry.repMap[rName].collected += invCollected;
      mEntry.repMap[rName].due += invDue;
      if (!inv.isReturn) mEntry.repMap[rName].invoiceCount += 1;
    });

    const overallMonths = Object.values(overallMonthsMap).map((m: any) => ({
      ...m,
      collectionRate: m.salesAmount > 0 ? (m.collectedAmount / m.salesAmount) * 100 : 0,
      margin: m.salesAmount > 0 ? (m.profit / m.salesAmount) * 100 : 0,
      reps: Object.values(m.repMap).sort((a: any, b: any) => b.sales - a.sales),
    })).sort((a, b) => a.month.localeCompare(b.month));

    const overall = {
      id: "overall",
      name: "Overall",
      totalRevenue: overallTotalRevenue,
      totalCost: overallTotalCost,
      totalGrossProfit: overallTotalGrossProfit,
      totalLoss: overallTotalLoss,
      totalProfit: overallTotalProfit,
      totalUnits: businesses.reduce((s, b) => s + b.totalUnits, 0),
      invoiceCount: businesses.reduce((s, b) => s + b.invoiceCount, 0),
      totalReturns: businesses.reduce((s, b) => s + (b.totalReturns || 0), 0),
      returnCount: businesses.reduce((s, b) => s + (b.returnCount || 0), 0),
      customerCount: businesses.reduce((s, b) => s + b.customerCount, 0),
      dueAmount: overallDueAmount,
      totalCollections: overallTotalCollections,
      collectionRate: overallTotalRevenue > 0 ? (overallTotalCollections / overallTotalRevenue) * 100 : 0,
      pendingClaimCost: overallPendingClaimCost,
      netProfit: overallNetProfit,
      netMargin: overallTotalRevenue > 0 ? (overallNetProfit / overallTotalRevenue) * 100 : 0,
      totalFreeQty: businesses.reduce((s, b) => s + b.totalFreeQty, 0),
      totalFreeCost: businesses.reduce((s, b) => s + b.totalFreeCost, 0),
      margin: overallTotalRevenue > 0 ? (overallTotalGrossProfit / overallTotalRevenue) * 100 : 0,
      products: overallProducts,
      customers: overallCustomers,
      reps: overallReps,
      invoices: overallInvoices,
      months: overallMonths,
    };

    return NextResponse.json({ overall, businesses });
  } catch (error: any) {
    console.error("Business analytics error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

