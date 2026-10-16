import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_NAMES } from "@/app/config/business-constants";

export const dynamic = "force-dynamic";

// Module-level server-side in-memory cache for aggregate supplier analytics
const _serverReportCache = new Map<string, { data: any; timestamp: number }>();
const SERVER_CACHE_TTL_MS = 60_000; // 60 seconds

interface MonthStat {
  salesQty: number;
  salesAmount: number;
  purchaseQty: number;
  purchaseAmount: number;
}

// Module-level cache for historical rolling 12 months totals
let _rolling12MonthCache: {
  timestamp: number;
  data: Record<string, Record<string, MonthStat>>;
} | null = null;
const ROLLING_CACHE_TTL_MS = 15 * 60_000; // 15 minutes

async function getRolling12MonthSummary(rollingStartStr: string, toDateStr: string) {
  if (_rolling12MonthCache && Date.now() - _rolling12MonthCache.timestamp < ROLLING_CACHE_TTL_MS) {
    return _rolling12MonthCache.data;
  }

  const result: Record<string, Record<string, MonthStat>> = {};

  const ensureEntry = (supplier: string, month: string) => {
    if (!result[supplier]) result[supplier] = {};
    if (!result[supplier][month]) {
      result[supplier][month] = { salesQty: 0, salesAmount: 0, purchaseQty: 0, purchaseAmount: 0 };
    }
  };

  // Pre-fetch inter-branch customer IDs once to avoid joining customer table on 14,000+ rows
  const getInterBranchCustomerIds = async (): Promise<Set<string>> => {
    try {
      const { data } = await supabaseAdmin
        .from("customers")
        .select("id")
        .ilike("shop_name", "%champika hardware%");
      return new Set((data || []).map((c: any) => c.id));
    } catch {
      return new Set();
    }
  };

  const fetchSales = async (interBranchIds: Set<string>) => {
    const PAGE_SIZE = 1000;
    const BATCH_SIZE = 8;
    let pageOffset = 0;

    while (true) {
      const pageIndices = Array.from({ length: BATCH_SIZE }, (_, i) => pageOffset + i);
      const batchResults = await Promise.all(
        pageIndices.map(pageIdx =>
          supabaseAdmin
            .from("order_items")
            .select("quantity, total_price, product:products!inner(supplier_name), order:orders!inner(order_date, is_inter_branch, customer_id)")
            .gte("order.order_date", rollingStartStr)
            .lte("order.order_date", toDateStr)
            .eq("order.status", "Delivered")
            .range(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE - 1)
        )
      );

      let reachedEnd = false;
      for (const res of batchResults) {
        if (res.error) {
          console.error("fetchSales rolling error:", res.error);
          break;
        }
        const data = res.data || [];
        data.forEach((item: any) => {
          if (item.order?.is_inter_branch === true) return;
          if (item.order?.customer_id && interBranchIds.has(item.order.customer_id)) return;
          const supplier = item.product?.supplier_name || "Unknown Supplier";
          const dateStr = (item.order?.order_date || "").split("T")[0];
          const monthKey = dateStr.slice(0, 7);
          if (!monthKey) return;
          ensureEntry(supplier, monthKey);
          result[supplier][monthKey].salesQty += Number(item.quantity) || 0;
          result[supplier][monthKey].salesAmount += Number(item.total_price) || 0;
        });

        if (data.length < PAGE_SIZE) {
          reachedEnd = true;
          break;
        }
      }

      if (reachedEnd) break;
      pageOffset += BATCH_SIZE;
    }
  };

  const fetchPurchases = async () => {
    const PAGE_SIZE = 1000;
    const BATCH_SIZE = 4;
    let pageOffset = 0;

    while (true) {
      const pageIndices = Array.from({ length: BATCH_SIZE }, (_, i) => pageOffset + i);
      const batchResults = await Promise.all(
        pageIndices.map(pageIdx =>
          supabaseAdmin
            .from("purchase_items")
            .select("quantity, free_quantity, total_cost, product:products(supplier_name), purchase:purchases!inner(purchase_date, status)")
            .gte("purchase.purchase_date", rollingStartStr)
            .lte("purchase.purchase_date", toDateStr)
            .neq("purchase.status", "Draft")
            .range(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE - 1)
        )
      );

      let reachedEnd = false;
      for (const res of batchResults) {
        if (res.error) {
          console.error("fetchPurchases rolling error:", res.error);
          break;
        }
        const data = res.data || [];
        data.forEach((item: any) => {
          const supplier = item.product?.supplier_name || "Unknown Supplier";
          const dateStr = (item.purchase?.purchase_date || "").split("T")[0];
          const monthKey = dateStr.slice(0, 7);
          if (!monthKey) return;
          ensureEntry(supplier, monthKey);
          result[supplier][monthKey].purchaseQty += (Number(item.quantity) || 0) + (Number(item.free_quantity) || 0);
          result[supplier][monthKey].purchaseAmount += Number(item.total_cost) || 0;
        });

        if (data.length < PAGE_SIZE) {
          reachedEnd = true;
          break;
        }
      }

      if (reachedEnd) break;
      pageOffset += BATCH_SIZE;
    }
  };

  const interBranchIds = await getInterBranchCustomerIds();
  await Promise.all([fetchSales(interBranchIds), fetchPurchases()]);

  _rolling12MonthCache = { timestamp: Date.now(), data: result };
  return result;
}

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

    // Calculate rolling 12 months start date
    const rollingStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const rollingStartStr = rollingStart.toISOString().split("T")[0]; // YYYY-MM-DD
    const toDateStr = toDate.split("T")[0];

    // Generate rolling 12 month keys in chronological order
    const rollingMonths: string[] = [];
    const tempDate = new Date(rollingStart);
    while (tempDate <= now) {
      const y = tempDate.getFullYear();
      const m = String(tempDate.getMonth() + 1).padStart(2, '0');
      rollingMonths.push(`${y}-${m}`);
      tempDate.setMonth(tempDate.getMonth() + 1);
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

    // Execute product catalog, sales order items, purchase records, and rolling summary in parallel
    const [products, orderItems, purchaseItems, rollingSummary] = await Promise.all([
      fetchProducts(),
      fetchOrderItems(),
      fetchPurchaseItems(),
      getRolling12MonthSummary(rollingStartStr, toDateStr),
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
    type SupplierEntry = {
      products: Record<string, ProductEntry>;
      customers: Record<string, CustomerEntry>;
      invoices: Record<string, InvoiceEntry>;
      months: Record<string, { month: string; salesQty: number; salesAmount: number; purchaseQty: number; purchaseAmount: number }>;
    };

    const supplierMap: Record<string, SupplierEntry> = {};

    const ensureSupplier = (name: string) => {
      if (!supplierMap[name]) {
        const months: Record<string, any> = {};
        rollingMonths.forEach(m => {
          months[m] = {
            month: m,
            salesQty: 0,
            salesAmount: 0,
            purchaseQty: 0,
            purchaseAmount: 0
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

    // Populate 12-month rolling summary (sales & purchases) from rollingSummary
    Object.entries(rollingSummary).forEach(([supplier, monthsData]) => {
      ensureSupplier(supplier);
      Object.entries(monthsData).forEach(([mKey, agg]) => {
        if (supplierMap[supplier].months[mKey]) {
          supplierMap[supplier].months[mKey].salesQty = agg.salesQty;
          supplierMap[supplier].months[mKey].salesAmount = agg.salesAmount;
          supplierMap[supplier].months[mKey].purchaseQty = agg.purchaseQty;
          supplierMap[supplier].months[mKey].purchaseAmount = agg.purchaseAmount;
        }
      });
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

      const monthList = Object.values(data.months).map((m: any) => {
        const [year, month] = m.month.split("-");
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const label = `${monthNames[parseInt(month) - 1]} ${year}`;
        return {
          ...m,
          monthLabel: label
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
