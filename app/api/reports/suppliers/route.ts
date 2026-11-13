import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_NAMES } from "@/app/config/business-constants";

export const dynamic = "force-dynamic";

// Module-level server-side in-memory cache for aggregate supplier analytics
const _serverReportCache = new Map<string, { data: any; timestamp: number }>();
const SERVER_CACHE_TTL_MS = 60_000; // 60 seconds

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), 0, 1).toISOString();
    const lastDay = new Date(now.getFullYear(), 11, 31).toISOString();
    const fromDate = searchParams.get("from") || firstDay;
    const toDate = searchParams.get("to") || lastDay;
    const isRefresh = searchParams.get("refresh") === "true";

    const cacheKey = `${fromDate}_${toDate}`;
    const cached = _serverReportCache.get(cacheKey);

    // Return instant server response if within cache TTL and not forced refresh
    if (!isRefresh && cached && Date.now() - cached.timestamp < SERVER_CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const toDateStr = toDate.split("T")[0];

    // Every month inside the selected period, in order (YYYY-MM)
    const periodMonths: string[] = [];
    {
      // from/to arrive as UTC timestamps of local (Sri Lanka) midnight, so read them in local time
      const localYM = (d: string) =>
        d.includes("T") ? new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" }).slice(0, 7) : d.slice(0, 7);
      let [y, m] = localYM(fromDate).split("-").map(Number);
      const [ey, em] = localYM(toDate).split("-").map(Number);
      while (y < ey || (y === ey && m <= em)) {
        periodMonths.push(`${y}-${String(m).padStart(2, "0")}`);
        m++;
        if (m > 12) { m = 1; y++; }
      }
    }

    // 1. All products with current stock — parallel batch pagination
    const fetchProducts = async () => {
      const products: any[] = [];
      const PAGE_SIZE = 1000;
      const BATCH_SIZE = 4;
      let pageOffset = 0;

      while (true) {
        const pageIndices = Array.from({ length: BATCH_SIZE }, (_, i) => pageOffset + i);
        const batchResults = await Promise.all(
          pageIndices.map(pageIdx =>
            supabaseAdmin
              .from("products")
              .select(`
                id, name, sku, supplier_name, cost_price, selling_price, category,
                sub_category, product_family,
                product_stocks (quantity)
              `)
              .range(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE - 1)
          )
        );

        let reachedEnd = false;
        for (const res of batchResults) {
          if (res.error) throw res.error;
          const data = res.data || [];
          products.push(...data);
          if (data.length < PAGE_SIZE) {
            reachedEnd = true;
            break;
          }
        }

        if (reachedEnd) break;
        pageOffset += BATCH_SIZE;
      }

      return products;
    };

    // 2. Order items strictly for the requested range (fromDate to toDate) with Delivered status — parallel batching
    const fetchOrderItems = async () => {
      const orderItems: any[] = [];
      const PAGE_SIZE = 1000;
      const BATCH_SIZE = 4;
      let pageOffset = 0;

      while (true) {
        const pageIndices = Array.from({ length: BATCH_SIZE }, (_, i) => pageOffset + i);
        const batchResults = await Promise.all(
          pageIndices.map(pageIdx =>
            supabaseAdmin
              .from("order_items")
              .select(`
                id, quantity, free_quantity, unit_price, actual_unit_cost, total_price, claim_status,
                product:products!inner (id, name, sku, supplier_name, category),
                order:orders!inner (
                  id, order_id, status, is_inter_branch, created_at, order_date, business_id,
                  customer:customers (id, shop_name, owner_name),
                  invoices (invoice_no, manual_invoice_no)
                )
              `)
              .gte("order.order_date", fromDate)
              .lte("order.order_date", toDate)
              .eq("order.status", "Delivered")
              .range(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE - 1)
          )
        );

        let reachedEnd = false;
        for (const res of batchResults) {
          if (res.error) throw new Error(`Order items query failed: ${res.error.message}`);
          const data = res.data || [];
          orderItems.push(...data);
          if (data.length < PAGE_SIZE) {
            reachedEnd = true;
            break;
          }
        }

        if (reachedEnd) break;
        pageOffset += BATCH_SIZE;
      }

      return orderItems;
    };

    // 2b. Purchase items in date range — parallel batching
    const fetchPurchaseItems = async () => {
      const purchaseItems: any[] = [];
      const PAGE_SIZE = 1000;
      const BATCH_SIZE = 4;
      let pageOffset = 0;

      while (true) {
        const pageIndices = Array.from({ length: BATCH_SIZE }, (_, i) => pageOffset + i);
        const batchResults = await Promise.all(
          pageIndices.map(pageIdx =>
            supabaseAdmin
              .from("purchase_items")
              .select(`
                id, quantity, free_quantity, total_cost,
                product:products (id, name, sku, supplier_name),
                purchase:purchases!inner (
                  id, purchase_id, purchase_date, status, supplier_id, business_id
                )
              `)
              .gte("purchase.purchase_date", fromDate.split("T")[0])
              .lte("purchase.purchase_date", toDateStr)
              .neq("purchase.status", "Draft")
              .range(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE - 1)
          )
        );

        let reachedEnd = false;
        for (const res of batchResults) {
          if (res.error) throw res.error;
          const data = res.data || [];
          purchaseItems.push(...data);
          if (data.length < PAGE_SIZE) {
            reachedEnd = true;
            break;
          }
        }

        if (reachedEnd) break;
        pageOffset += BATCH_SIZE;
      }

      return purchaseItems;
    };

    // Execute product catalog, sales order items and purchase records in parallel
    const [products, orderItems, purchaseItems] = await Promise.all([
      fetchProducts(),
      fetchOrderItems(),
      fetchPurchaseItems(),
    ]);

    // 3. Supplier → products stock map
    type ProductEntry = {
      id: string; name: string; sku: string; category: string;
      costPrice: number; sellingPrice: number;
      stockQty: number; stockCostValue: number; stockSellingValue: number;
      unitsSold: number; freeQty: number; revenue: number; cost: number; profit: number;
      pendingClaimQty: number; pendingClaimCost: number;
    };
    type CustomerEntry = {
      id: string; name: string; orders: number; revenue: number; cost: number; profit: number;
    };
    type InvoiceEntry = {
      orderId: string; invoiceNo: string; customer: string; date: string;
      businessId?: string | null; businessName?: string | null;
      revenue: number; cost: number; profit: number; margin: number;
    };
    type MonthEntry = {
      month: string; salesQty: number; salesAmount: number; cost: number; profit: number;
      purchaseQty: number; purchaseAmount: number; invoiceIds: Set<string>;
    };
    type SupplierEntry = {
      products: Record<string, ProductEntry>;
      customers: Record<string, CustomerEntry>;
      invoices: Record<string, InvoiceEntry>;
      months: Record<string, MonthEntry>;
    };

    const supplierMap: Record<string, SupplierEntry> = {};

    const ensureSupplier = (name: string) => {
      if (!supplierMap[name]) {
        const months: Record<string, MonthEntry> = {};
        periodMonths.forEach(m => {
          months[m] = {
            month: m, salesQty: 0, salesAmount: 0, cost: 0, profit: 0,
            purchaseQty: 0, purchaseAmount: 0, invoiceIds: new Set(),
          };
        });
        supplierMap[name] = { products: {}, customers: {}, invoices: {}, months };
      }
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
        pendingClaimQty: 0, pendingClaimCost: 0,
      };
    });

    // Purchases in the selected period, per supplier per month
    (purchaseItems || []).forEach((item: any) => {
      const supplier = item.product?.supplier_name || "Unknown Supplier";
      const monthKey = (item.purchase?.purchase_date || "").slice(0, 7);
      ensureSupplier(supplier);
      const mEntry = supplierMap[supplier].months[monthKey];
      if (!mEntry) return;
      mEntry.purchaseQty += (Number(item.quantity) || 0) + (Number(item.free_quantity) || 0);
      mEntry.purchaseAmount += Number(item.total_cost) || 0;
    });

    // 4. Aggregate sales → products + customers + invoices for selected period
    // Exclude inter-branch orders: flag check + customer name check (flag may be unset on older rows)
    const isInterBranch = (item: any) => {
      if (item.order?.is_inter_branch === true) return true;
      const name = (item.order?.customer?.shop_name || "").toLowerCase();
      return name.includes("champika hardware");
    };

    (orderItems || []).forEach((item: any) => {
      if (isInterBranch(item)) return;
      const supplier = item.product?.supplier_name || "Unknown Supplier";
      const pid = item.product?.id;
      const order = item.order;
      if (!pid || !order) return;

      const orderDate = order.order_date || order.created_at || "";
      const dateStr = orderDate.split("T")[0];

      ensureSupplier(supplier);

      // Skip ghost/duplicate orders without successfully created invoices
      const invoices = order.invoices;
      const hasInvoice = Array.isArray(invoices) ? invoices.length > 0 : !!invoices;
      if (!hasInvoice) return;

      const qty = Number(item.quantity) || 0;
      const freeQty = Number(item.free_quantity) || 0;
      const revenue = Number(item.total_price) || 0;
      const cost = qty * (Number(item.actual_unit_cost) || 0);
      const profit = revenue - cost;

      // Product aggregation
      if (!supplierMap[supplier].products[pid]) {
        supplierMap[supplier].products[pid] = {
          id: pid, name: item.product.name, sku: item.product.sku || "",
          category: item.product.category || "", costPrice: 0, sellingPrice: 0,
          stockQty: 0, stockCostValue: 0, stockSellingValue: 0,
          unitsSold: 0, freeQty: 0, revenue: 0, cost: 0, profit: 0,
          pendingClaimQty: 0, pendingClaimCost: 0,
        };
      }
      // Month aggregation (same rows as the invoice totals, so months add up to the period total)
      const mEntry = supplierMap[supplier].months[dateStr.slice(0, 7)];
      if (mEntry) {
        mEntry.salesQty += qty;
        mEntry.salesAmount += revenue;
        mEntry.cost += cost;
        mEntry.profit += profit;
        mEntry.invoiceIds.add(order.order_id);
      }

      const prod = supplierMap[supplier].products[pid];
      prod.unitsSold += qty; prod.freeQty += freeQty;
      prod.revenue += revenue; prod.cost += cost; prod.profit += profit;

      const isClaimed = item.claim_status === "Approved";
      if (!isClaimed) {
        prod.pendingClaimQty += freeQty;
        prod.pendingClaimCost += freeQty * (Number(item.actual_unit_cost) || 0);
      }

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
      const date = dateStr;
      const businessId = order.business_id;
      const businessName = businessId ? (BUSINESS_NAMES[businessId as keyof typeof BUSINESS_NAMES] || "Unknown Business") : "Unknown Business";

      if (!supplierMap[supplier].invoices[oid]) {
        supplierMap[supplier].invoices[oid] = {
          orderId: oid, invoiceNo, customer: cName, date,
          businessId, businessName,
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
      if (item.order?.status !== "Delivered" && item.order?.status !== "Completed") return;
      const supplier = item.product?.supplier_name || "Unknown Supplier";
      const cId = item.order?.customer?.id || "unknown";
      const oid = item.order?.order_id;
      if (!oid) return;
      const key = `${supplier}__${cId}`;
      if (!orderCustomerSet[key]) orderCustomerSet[key] = new Set();
      orderCustomerSet[key].add(oid);
    });

    // Product family lookup (for the Product Families tab)
    const familyInfo: Record<string, { family: string; category: string; subCategory: string | null }> = {};
    (products || []).forEach((p: any) => {
      familyInfo[p.id] = {
        family: (p.product_family || "").trim() || "No Family",
        category: p.category || "Uncategorised",
        subCategory: p.sub_category || null,
      };
    });

    // 5. Build final supplier summaries
    const suppliers = Object.entries(supplierMap).map(([name, data]) => {
      const productList = Object.values(data.products).map((p) => ({
        ...p, margin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0,
      })).sort((a, b) => b.unitsSold - a.unitsSold);

      // Group products by Product Family (only families with sales or stock)
      const famMap: Record<string, any> = {};
      productList.forEach((p) => {
        if (p.unitsSold === 0 && p.revenue === 0 && p.stockQty === 0) return;
        const info = familyInfo[p.id] || { family: "No Family", category: p.category || "Uncategorised", subCategory: null };
        const key = `${info.family}||${info.category}||${info.subCategory ?? ""}`;
        const f = (famMap[key] ||= {
          ...info, productCount: 0, stockQty: 0, stockCostValue: 0,
          unitsSold: 0, freeQty: 0, revenue: 0, cost: 0, profit: 0,
        });
        f.productCount += 1;
        f.stockQty += p.stockQty;
        f.stockCostValue += p.stockCostValue;
        f.unitsSold += p.unitsSold;
        f.freeQty += p.freeQty;
        f.revenue += p.revenue;
        f.cost += p.cost;
        f.profit += p.profit;
      });
      const familyList = Object.values(famMap)
        .map((f: any) => ({ ...f, margin: f.revenue > 0 ? (f.profit / f.revenue) * 100 : 0 }))
        .sort((a: any, b: any) => b.revenue - a.revenue);

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

      // Aggregate business breakdown for this supplier
      const businessMapForSupplier: Record<string, any> = {};
      invoiceList.forEach((inv) => {
        const bId = inv.businessId || "unknown";
        const bName = inv.businessName || "Unknown Business";
        
        if (!businessMapForSupplier[bId]) {
          businessMapForSupplier[bId] = {
            id: bId,
            name: bName,
            revenue: 0,
            cost: 0,
            profit: 0,
            invoiceCount: 0
          };
        }
        businessMapForSupplier[bId].revenue += inv.revenue;
        businessMapForSupplier[bId].cost += inv.cost;
        businessMapForSupplier[bId].profit += inv.profit;
        businessMapForSupplier[bId].invoiceCount += 1;
      });

      const businessList = Object.values(businessMapForSupplier).map((b: any) => ({
        ...b,
        margin: b.revenue > 0 ? (b.profit / b.revenue) * 100 : 0
      })).sort((a, b) => b.revenue - a.revenue);

      const totalStock = Object.values(data.products).reduce((s, p) => s + p.stockQty, 0);
      const totalStockCostValue = Object.values(data.products).reduce((s, p) => s + p.stockCostValue, 0);
      const totalStockSellingValue = Object.values(data.products).reduce((s, p) => s + p.stockSellingValue, 0);
      const totalUnitsSold = productList.reduce((s, p) => s + p.unitsSold, 0);
      const totalRevenue = invoiceList.reduce((s, i) => s + i.revenue, 0);
      const totalCost = invoiceList.reduce((s, i) => s + i.cost, 0);
      const totalProfit = totalRevenue - totalCost;

      const pendingClaimQty = productList.reduce((s, p) => s + (p.pendingClaimQty || 0), 0);
      const pendingClaimCost = productList.reduce((s, p) => s + (p.pendingClaimCost || 0), 0);
      const netProfit = totalProfit - pendingClaimCost;
      const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthList = Object.values(data.months).map(({ invoiceIds, ...m }) => {
        const [year, month] = m.month.split("-");
        return {
          ...m,
          invoiceCount: invoiceIds.size,
          margin: m.salesAmount > 0 ? (m.profit / m.salesAmount) * 100 : 0,
          monthLabel: `${monthNames[parseInt(month) - 1]} ${year}`,
        };
      });

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
        pendingClaimQty,
        pendingClaimCost,
        netProfit,
        netMargin,
        products: productList,
        families: familyList,
        customers: customerList,
        invoices: invoiceList,
        businesses: businessList,
        months: monthList,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    const payload = { suppliers };
    _serverReportCache.set(cacheKey, { data: payload, timestamp: Date.now() });
    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
