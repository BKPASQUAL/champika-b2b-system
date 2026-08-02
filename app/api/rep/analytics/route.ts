import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repId = searchParams.get("repId");
    if (!repId) {
      return NextResponse.json({ error: "Rep ID is required" }, { status: 400 });
    }

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const fromDate = searchParams.get("from") || firstDay;
    const toDate = searchParams.get("to") || lastDay;
    const fromDateOnly = fromDate.split("T")[0];
    const toDateOnly = toDate.split("T")[0];

    // 1. Rep Profile info
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", repId)
      .single();

    // 2. Delivered orders for this rep in range
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(`
        id, order_id, total_amount, status, created_at, order_date, sales_rep_id,
        customers (id, shop_name),
        invoices (id, invoice_no, manual_invoice_no, total_amount, paid_amount, status),
        rep_commissions (total_commission_amount, status)
      `)
      .eq("sales_rep_id", repId)
      .eq("status", "Delivered")
      .gte("created_at", fromDate)
      .lte("created_at", toDate);

    if (ordersError) throw ordersError;

    const allInvoiceIds: string[] = [];
    const allOrderIds: string[] = [];

    (orders || []).forEach((o: any) => {
      const inv = Array.isArray(o.invoices) ? o.invoices[0] : o.invoices;
      if (inv?.id) allInvoiceIds.push(inv.id);
      if (o.id) allOrderIds.push(o.id);
    });

    // 3. Payments for collections
    let totalCollections = 0;
    const monthlyMap: Record<string, { month: string; monthKey: string; sales: number; collections: number }> = {};

    if (allInvoiceIds.length > 0) {
      const { data: payments } = await supabaseAdmin
        .from("payments")
        .select("invoice_id, amount, payment_date")
        .in("invoice_id", allInvoiceIds)
        .gte("payment_date", fromDateOnly)
        .lte("payment_date", toDateOnly);

      (payments || []).forEach((p: any) => {
        const amt = Number(p.amount) || 0;
        totalCollections += amt;
        const d = new Date(p.payment_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyMap[key]) {
          monthlyMap[key] = {
            month: d.toLocaleString("default", { month: "short", year: "2-digit" }),
            monthKey: key,
            sales: 0,
            collections: 0,
          };
        }
        monthlyMap[key].collections += amt;
      });
    }

    // Fetch commission rules for fallback calculation
    const { data: commissionRules } = await supabaseAdmin
      .from("commission_rules")
      .select("id, supplier_name, category, sub_category, rate");

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

    // 4. Order items for supplier & category breakdown
    type SupplierCommEntry = { name: string; sales: number; commission: number; itemsCount: number };
    type CategoryCommEntry = {
      supplier: string; category: string; subCategory: string | null;
      sales: number; commission: number; itemsCount: number;
    };

    const supplierMap: Record<string, SupplierCommEntry> = {};
    const categoryMap: Record<string, CategoryCommEntry> = {};

    const rawOrderItems: any[] = [];
    if (allOrderIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < allOrderIds.length; i += batchSize) {
        const batch = allOrderIds.slice(i, i + batchSize);
        const { data: batchItems } = await supabaseAdmin
          .from("order_items")
          .select(`
            order_id, quantity, unit_price, commission_earned,
            product:products (supplier_name, category, sub_category)
          `)
          .in("order_id", batch);
        if (batchItems && batchItems.length > 0) {
          rawOrderItems.push(...batchItems);
        }
      }
    }

    (rawOrderItems || []).forEach((item: any) => {
        const supplier = item.product?.supplier_name || "Unknown Supplier";
        const category = item.product?.category || "Uncategorised";
        const subCategory: string | null = item.product?.sub_category || null;
        const qty = Number(item.quantity) || 0;
        const sales = qty * (Number(item.unit_price) || 0);
        const earnedComm = Number(item.commission_earned) || 0;
        const fallbackRate = findRate(supplier, category, subCategory);
        const commission = earnedComm > 0 ? earnedComm : sales * (fallbackRate / 100);

        // Supplier map
        if (!supplierMap[supplier]) {
          supplierMap[supplier] = { name: supplier, sales: 0, commission: 0, itemsCount: 0 };
        }
        supplierMap[supplier].sales += sales;
        supplierMap[supplier].commission += commission;
        supplierMap[supplier].itemsCount += qty;

        // Category map
        const catKey = `${supplier}||${category}||${subCategory ?? ""}`;
        if (!categoryMap[catKey]) {
          categoryMap[catKey] = { supplier, category, subCategory, sales: 0, commission: 0, itemsCount: 0 };
        }
        categoryMap[catKey].sales += sales;
        categoryMap[catKey].commission += commission;
        categoryMap[catKey].itemsCount += qty;
      });

    // 5. Pending orders
    const { data: pendingOrders } = await supabaseAdmin
      .from("orders")
      .select("id, total_amount")
      .eq("sales_rep_id", repId)
      .not("status", "in", `("Delivered","Cancelled")`);

    const pendingCount = (pendingOrders || []).length;
    const pendingAmount = (pendingOrders || []).reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    // 6. Aggregate invoices & totals
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let totalSales = 0;
    let commissionEarned = 0;
    let commissionPending = 0;
    const invoicesList: any[] = [];

    (orders || []).forEach((order: any) => {
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

      const cEarned = isPaid ? commissionAmount : 0;
      const cPending = !isPaid && daysSince <= 60 ? commissionAmount : 0;

      totalSales += total;
      commissionEarned += cEarned;
      commissionPending += cPending;

      const d = new Date(order.order_date || order.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) {
        monthlyMap[key] = {
          month: d.toLocaleString("default", { month: "short", year: "2-digit" }),
          monthKey: key,
          sales: 0,
          collections: 0,
        };
      }
      monthlyMap[key].sales += total;

      const invoiceNo = inv?.manual_invoice_no || inv?.invoice_no || order.order_id;
      invoicesList.push({
        orderId: order.order_id,
        invoiceNo,
        customer: order.customers?.shop_name || "Unknown",
        date: (order.order_date || order.created_at || "").split("T")[0],
        total,
        paid,
        due,
        commission: commissionAmount,
        commissionEarned: cEarned,
        commissionPending: cPending,
        isPaid,
        invStatus: inv?.status || "Unpaid",
      });
    });

    const monthly = Object.values(monthlyMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    invoicesList.sort((a, b) => b.date.localeCompare(a.date));

    const supplierSales = Object.values(supplierMap)
      .filter((s) => s.sales > 0 || s.commission > 0 || s.itemsCount > 0)
      .map((s) => ({
        ...s,
        rate: s.sales > 0 ? (s.commission / s.sales) * 100 : 0,
        sharePct: totalSales > 0 ? (s.sales / totalSales) * 100 : 0,
      }))
      .sort((a, b) => b.sales - a.sales);

    const categorySales = Object.values(categoryMap)
      .filter((c) => c.sales > 0 || c.commission > 0 || c.itemsCount > 0)
      .map((c) => ({
        ...c,
        rate: c.sales > 0 ? (c.commission / c.sales) * 100 : 0,
        sharePct: totalSales > 0 ? (c.sales / totalSales) * 100 : 0,
      }))
      .sort((a, b) => b.sales - a.sales);

    return NextResponse.json({
      rep: {
        id: profile?.id || repId,
        name: profile?.full_name || profile?.email || "Rep Portal",
        email: profile?.email || "",
      },
      stats: {
        totalSales,
        totalCollections,
        totalDue: Math.max(0, totalSales - totalCollections),
        pendingCount,
        pendingAmount,
        commissionEarned,
        commissionPending,
        invoiceCount: invoicesList.length,
      },
      monthly,
      invoices: invoicesList,
      supplierSales,
      categorySales,
    });
  } catch (error: any) {
    console.error("Rep Analytics Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
