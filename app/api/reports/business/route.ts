import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

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

    // 1. All invoices in the period — revenue source (matches Sierra Agency page)
    const { data: allInvoices, error: allInvError } = await supabaseAdmin
      .from("invoices")
      .select(`
        id, invoice_no, manual_invoice_no, total_amount, due_amount, status,
        order:orders!inner (
          order_id, status, created_at, order_date, business_id,
          customer:customers (id, shop_name)
        )
      `)
      .gte("order.created_at", fromDate)
      .lte("order.created_at", toDate);

    if (allInvError) throw allInvError;

    // 2. Order items — cost + product + customer detail (filtered to invoiced orders only)
    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(`
        id, quantity, unit_price, total_price,
        product:products (id, name, sku, cost_price),
        order:orders!inner (
          id, order_id, status, created_at, order_date, business_id,
          customer:customers (id, shop_name)
        )
      `)
      .gte("order.created_at", fromDate)
      .lte("order.created_at", toDate);

    if (itemsError) throw itemsError;

    type ProductEntry = {
      id: string; name: string; sku: string;
      unitsSold: number; revenue: number; cost: number; profit: number;
    };
    type CustomerEntry = {
      id: string; name: string;
      revenue: number; cost: number; profit: number;
      dueAmount: number; orderSet: Set<string>;
    };
    type InvoiceEntry = {
      invoiceId: string; orderId: string; invoiceNo: string;
      customer: string; date: string;
      amount: number; due: number; paymentStatus: string;
    };
    type BusinessEntry = {
      id: string; name: string;
      totalRevenue: number; totalCost: number; totalUnits: number;
      invoicedOrderIds: Set<string>;
      customerCountSet: Set<string>;
      dueAmount: number;
      productMap: Record<string, ProductEntry>;
      customerMap: Record<string, CustomerEntry>;
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
          productMap: {}, customerMap: {}, invoiceList: [],
        };
      }
    };

    Object.values(BUSINESS_IDS).forEach((id) => ensureBusiness(id));

    // Pass 1 — invoices: build revenue, invoicedOrderIds, invoiceList, dueAmount
    (allInvoices || []).forEach((inv: any) => {
      const order = inv.order;
      if (!order || !COUNTED_STATUSES.includes(order.status)) return;
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
      });
    });

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
      const itemRevenue = qty * (Number(item.unit_price) || 0);
      const cost = qty * (Number(item.product?.cost_price) || 0);

      biz.totalCost += cost;
      biz.totalUnits += qty;
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

    // Build final list
    const businesses = Object.values(businessMap).map((biz) => {
      const totalProfit = biz.totalRevenue - biz.totalCost;

      const products = Object.values(biz.productMap)
        .map((p) => ({ ...p, margin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0 }))
        .sort((a, b) => b.revenue - a.revenue);

      const customers = Object.values(biz.customerMap)
        .map((c) => ({
          id: c.id, name: c.name,
          revenue: c.revenue, cost: c.cost, profit: c.profit,
          dueAmount: c.dueAmount, invoiceCount: c.orderSet.size,
          margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      const invoices = [...biz.invoiceList].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      return {
        id: biz.id,
        name: biz.name,
        totalRevenue: biz.totalRevenue,
        totalCost: biz.totalCost,
        totalProfit,
        totalUnits: biz.totalUnits,
        invoiceCount: invoices.length,
        customerCount: biz.customerCountSet.size,
        dueAmount: biz.dueAmount,
        margin: biz.totalRevenue > 0 ? (totalProfit / biz.totalRevenue) * 100 : 0,
        products,
        customers,
        invoices,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Overall aggregate
    const allProductsMap: Record<string, any> = {};
    const allCustomersMap: Record<string, any> = {};
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
          allCustomersMap[c.id].invoiceCount += c.invoiceCount;
        }
      });
      allInvoicesList.push(...biz.invoices);
    });

    const overallProducts = Object.values(allProductsMap)
      .map((p: any) => ({ ...p, margin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0 }))
      .sort((a: any, b: any) => b.revenue - a.revenue);

    const overallCustomers = Object.values(allCustomersMap)
      .map((c: any) => ({ ...c, margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0 }))
      .sort((a: any, b: any) => b.revenue - a.revenue);

    const overallInvoices = allInvoicesList.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const overall = {
      id: "overall",
      name: "Overall",
      totalRevenue: businesses.reduce((s, b) => s + b.totalRevenue, 0),
      totalCost: businesses.reduce((s, b) => s + b.totalCost, 0),
      totalProfit: businesses.reduce((s, b) => s + b.totalProfit, 0),
      totalUnits: businesses.reduce((s, b) => s + b.totalUnits, 0),
      invoiceCount: businesses.reduce((s, b) => s + b.invoiceCount, 0),
      customerCount: businesses.reduce((s, b) => s + b.customerCount, 0),
      dueAmount: businesses.reduce((s, b) => s + b.dueAmount, 0),
      margin: 0,
      products: overallProducts,
      customers: overallCustomers,
      invoices: overallInvoices,
    };
    overall.margin = overall.totalRevenue > 0
      ? (overall.totalProfit / overall.totalRevenue) * 100 : 0;

    return NextResponse.json({ overall, businesses });
  } catch (error: any) {
    console.error("Business analytics error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
