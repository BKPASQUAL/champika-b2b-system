import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), 0, 1).toISOString();
    const lastDay = new Date(now.getFullYear(), 11, 31).toISOString();
    const fromDate = searchParams.get("from") || firstDay;
    const toDate = searchParams.get("to") || lastDay;

    // 1. All products with current stock
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select(`
        id, name, sku, supplier_name, cost_price, selling_price, category,
        product_stocks (quantity)
      `);

    if (productsError) throw productsError;

    // 2. Delivered non-inter-branch order items — includes customer + invoice info
    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(`
        id, quantity, free_quantity, unit_price, actual_unit_cost, total_price,
        product:products!inner (id, name, sku, supplier_name, category),
        order:orders!inner (
          id, order_id, status, is_inter_branch, created_at, order_date,
          customer:customers (id, shop_name, owner_name),
          invoices (invoice_no, manual_invoice_no)
        )
      `)
      .eq("order.status", "Delivered")
      .eq("order.is_inter_branch", false)
      .gte("order.created_at", fromDate)
      .lte("order.created_at", toDate);

    if (itemsError) throw itemsError;

    // 3. Supplier → products stock map
    type ProductEntry = {
      id: string; name: string; sku: string; category: string;
      costPrice: number; sellingPrice: number;
      stockQty: number; stockCostValue: number; stockSellingValue: number;
      unitsSold: number; freeQty: number; revenue: number; cost: number; profit: number;
    };
    type CustomerEntry = {
      id: string; name: string; orders: number; revenue: number; cost: number; profit: number;
    };
    type InvoiceEntry = {
      orderId: string; invoiceNo: string; customer: string; date: string;
      revenue: number; cost: number; profit: number; margin: number;
    };
    type SupplierEntry = {
      products: Record<string, ProductEntry>;
      customers: Record<string, CustomerEntry>;
      invoices: Record<string, InvoiceEntry>;
    };

    const supplierMap: Record<string, SupplierEntry> = {};

    const ensureSupplier = (name: string) => {
      if (!supplierMap[name]) supplierMap[name] = { products: {}, customers: {}, invoices: {} };
    };

    // Seed product stock data
    (products || []).forEach((p: any) => {
      const supplier = p.supplier_name || "Unknown Supplier";
      const stockQty = (p.product_stocks || []).reduce(
        (s: number, st: any) => s + (Number(st.quantity) || 0), 0
      );
      const costPrice = Number(p.cost_price) || 0;
      const sellingPrice = Number(p.selling_price) || 0;

      ensureSupplier(supplier);
      supplierMap[supplier].products[p.id] = {
        id: p.id, name: p.name, sku: p.sku || "", category: p.category || "",
        costPrice, sellingPrice,
        stockQty, stockCostValue: stockQty * costPrice, stockSellingValue: stockQty * sellingPrice,
        unitsSold: 0, freeQty: 0, revenue: 0, cost: 0, profit: 0,
      };
    });

    // 4. Aggregate sales → products + customers + invoices
    // Double-guard: skip inter-branch items even if the query filter missed them
    (orderItems || []).forEach((item: any) => {
      const supplier = item.product?.supplier_name || "Unknown Supplier";
      const pid = item.product?.id;
      const order = item.order;
      if (!pid || !order) return;
      if (order.is_inter_branch === true) return;

      const qty = Number(item.quantity) || 0;
      const freeQty = Number(item.free_quantity) || 0;
      const revenue = Number(item.total_price) || 0;
      const cost = qty * (Number(item.actual_unit_cost) || 0);
      const profit = revenue - cost;

      ensureSupplier(supplier);

      // Product aggregation
      if (!supplierMap[supplier].products[pid]) {
        supplierMap[supplier].products[pid] = {
          id: pid, name: item.product.name, sku: item.product.sku || "",
          category: item.product.category || "", costPrice: 0, sellingPrice: 0,
          stockQty: 0, stockCostValue: 0, stockSellingValue: 0,
          unitsSold: 0, freeQty: 0, revenue: 0, cost: 0, profit: 0,
        };
      }
      const prod = supplierMap[supplier].products[pid];
      prod.unitsSold += qty; prod.freeQty += freeQty;
      prod.revenue += revenue; prod.cost += cost; prod.profit += profit;

      // Customer aggregation
      const cId = order.customer?.id || "unknown";
      const cName = order.customer?.shop_name || "Unknown";
      if (!supplierMap[supplier].customers[cId]) {
        supplierMap[supplier].customers[cId] = { id: cId, name: cName, orders: 0, revenue: 0, cost: 0, profit: 0 };
      }
      supplierMap[supplier].customers[cId].revenue += revenue;
      supplierMap[supplier].customers[cId].cost += cost;
      supplierMap[supplier].customers[cId].profit += profit;

      // Invoice aggregation (one row per order)
      const oid = order.order_id;
      const inv = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
      const invoiceNo = inv?.manual_invoice_no || inv?.invoice_no || oid;
      const date = (order.order_date || order.created_at || "").split("T")[0];

      if (!supplierMap[supplier].invoices[oid]) {
        supplierMap[supplier].invoices[oid] = {
          orderId: oid, invoiceNo, customer: cName, date,
          revenue: 0, cost: 0, profit: 0, margin: 0,
        };
      }
      supplierMap[supplier].invoices[oid].revenue += revenue;
      supplierMap[supplier].invoices[oid].cost += cost;
      supplierMap[supplier].invoices[oid].profit += profit;

      // Count unique orders per customer
      if (!supplierMap[supplier].customers[cId].orders) {
        supplierMap[supplier].customers[cId].orders = 0;
      }
    });

    // Count unique orders per customer per supplier
    const orderCustomerSet: Record<string, Set<string>> = {};
    (orderItems || []).forEach((item: any) => {
      const supplier = item.product?.supplier_name || "Unknown Supplier";
      const cId = item.order?.customer?.id || "unknown";
      const oid = item.order?.order_id;
      if (!oid) return;
      const key = `${supplier}__${cId}`;
      if (!orderCustomerSet[key]) orderCustomerSet[key] = new Set();
      orderCustomerSet[key].add(oid);
    });

    // 5. Build final supplier summaries
    const suppliers = Object.entries(supplierMap).map(([name, data]) => {
      const productList = Object.values(data.products).map((p) => ({
        ...p, margin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0,
      })).sort((a, b) => b.unitsSold - a.unitsSold);

      const customerList = Object.values(data.customers).map((c) => {
        const key = `${name}__${c.id}`;
        return {
          ...c,
          orders: orderCustomerSet[key]?.size || 0,
          margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0,
        };
      }).sort((a, b) => b.revenue - a.revenue);

      const invoiceList = Object.values(data.invoices).map((inv) => ({
        ...inv,
        margin: inv.revenue > 0 ? (inv.profit / inv.revenue) * 100 : 0,
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const totalStock = Object.values(data.products).reduce((s, p) => s + p.stockQty, 0);
      const totalStockCostValue = Object.values(data.products).reduce((s, p) => s + p.stockCostValue, 0);
      const totalStockSellingValue = Object.values(data.products).reduce((s, p) => s + p.stockSellingValue, 0);
      const totalUnitsSold = productList.reduce((s, p) => s + p.unitsSold, 0);
      const totalRevenue = invoiceList.reduce((s, i) => s + i.revenue, 0);
      const totalCost = invoiceList.reduce((s, i) => s + i.cost, 0);
      const totalProfit = totalRevenue - totalCost;

      return {
        name,
        productCount: productList.length,
        customerCount: customerList.length,
        invoiceCount: invoiceList.length,
        totalStock,
        totalStockCostValue,
        totalStockSellingValue,
        totalUnitsSold,
        totalRevenue,
        totalCost,
        totalProfit,
        margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
        products: productList,
        customers: customerList,
        invoices: invoiceList,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    return NextResponse.json({ suppliers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
