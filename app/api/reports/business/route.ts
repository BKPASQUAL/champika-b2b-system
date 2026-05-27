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

    // 1. Fetch delivered/completed order items with business context
    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(`
        id, quantity, free_quantity, unit_price, actual_unit_cost, total_price,
        order:orders!inner (
          id, order_id, status, created_at, order_date, business_id,
          customer:customers (id, shop_name)
        )
      `)
      .gte("order.created_at", fromDate)
      .lte("order.created_at", toDate);

    if (itemsError) throw itemsError;

    // 2. Fetch due amounts per business (all-time outstanding)
    const { data: dueInvoices, error: dueError } = await supabaseAdmin
      .from("invoices")
      .select(`
        id, due_amount, status,
        order:orders!inner (business_id, created_at)
      `)
      .in("status", ["Unpaid", "Partial", "Overdue"])
      .gte("order.created_at", fromDate)
      .lte("order.created_at", toDate);

    if (dueError) throw dueError;

    // 3. Aggregate per business
    const COUNTED_STATUSES = ["Delivered", "Completed"];

    type BusinessEntry = {
      id: string;
      name: string;
      totalRevenue: number;
      totalCost: number;
      totalProfit: number;
      totalUnits: number;
      invoiceCount: Set<string>;
      customerCount: Set<string>;
      dueAmount: number;
    };

    const businessMap: Record<string, BusinessEntry> = {};

    const ensureBusiness = (bizId: string) => {
      if (!businessMap[bizId]) {
        businessMap[bizId] = {
          id: bizId,
          name: BUSINESS_NAMES[bizId as keyof typeof BUSINESS_NAMES] || "Unknown",
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          totalUnits: 0,
          invoiceCount: new Set(),
          customerCount: new Set(),
          dueAmount: 0,
        };
      }
    };

    // Seed all known businesses so they always appear
    Object.values(BUSINESS_IDS).forEach((id) => ensureBusiness(id));

    // Aggregate sales
    (orderItems || []).forEach((item: any) => {
      const order = item.order;
      if (!order) return;
      if (!COUNTED_STATUSES.includes(order.status)) return;
      const bizId = order.business_id;
      if (!bizId) return;

      ensureBusiness(bizId);
      const biz = businessMap[bizId];

      const qty = Number(item.quantity) || 0;
      const revenue = Number(item.total_price) || 0;
      const cost = qty * (Number(item.actual_unit_cost) || 0);

      biz.totalRevenue += revenue;
      biz.totalCost += cost;
      biz.totalProfit += revenue - cost;
      biz.totalUnits += qty;
      biz.invoiceCount.add(order.order_id);
      if (order.customer?.id) biz.customerCount.add(order.customer.id);
    });

    // Aggregate due amounts
    (dueInvoices || []).forEach((inv: any) => {
      const bizId = inv.order?.business_id;
      if (!bizId) return;
      ensureBusiness(bizId);
      businessMap[bizId].dueAmount += Number(inv.due_amount) || 0;
    });

    // 4. Build final list ordered by totalRevenue desc
    const businesses = Object.values(businessMap).map((biz) => ({
      id: biz.id,
      name: biz.name,
      totalRevenue: biz.totalRevenue,
      totalCost: biz.totalCost,
      totalProfit: biz.totalProfit,
      totalUnits: biz.totalUnits,
      invoiceCount: biz.invoiceCount.size,
      customerCount: biz.customerCount.size,
      dueAmount: biz.dueAmount,
      margin: biz.totalRevenue > 0 ? (biz.totalProfit / biz.totalRevenue) * 100 : 0,
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // 5. Overall aggregate
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
    };
    overall.margin = overall.totalRevenue > 0
      ? (overall.totalProfit / overall.totalRevenue) * 100
      : 0;

    return NextResponse.json({ overall, businesses });
  } catch (error: any) {
    console.error("Business analytics error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
