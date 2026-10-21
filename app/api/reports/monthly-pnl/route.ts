import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Helper to normalize categories for consistent grouping
function normalizeCategory(rawCat: string | null | undefined): string {
  if (!rawCat) return "Other";
  const cat = rawCat.trim();
  const lower = cat.toLowerCase();

  if (lower.includes("labor") || lower.includes("wage") || lower.includes("labour")) {
    return "Labor / Wages";
  }
  if (lower.includes("salar")) {
    return "Staff Salaries";
  }
  if (lower.includes("interest") || lower.includes("loan") || lower.includes("bank charge") || lower.includes("finance")) {
    return "Bank Interest & Charges";
  }
  if (lower.includes("rent") || lower.includes("storage") || lower.includes("warehouse")) {
    return "Rent & Rates";
  }
  if (lower.includes("electric") || lower.includes("util") || lower.includes("water") || lower.includes("power") || lower.includes("internet") || lower.includes("wifi")) {
    return "Electricity & Utilities";
  }
  if (lower.includes("fuel") || lower.includes("diesel") || lower.includes("petrol") || lower.includes("transport")) {
    return "Fuel & Transport";
  }
  if (lower.includes("maint") || lower.includes("repair") || lower.includes("service") || lower.includes("tyre")) {
    return "Vehicle Maintenance & Services";
  }
  if (lower.includes("food") || lower.includes("lunch") || lower.includes("dinner") || lower.includes("breakfast") || lower.includes("tea") || lower.includes("meal") || lower.includes("guest")) {
    return "Food & Staff Welfare";
  }
  if (lower.includes("delivery") || lower.includes("logistics") || lower.includes("courier")) {
    return "Delivery & Logistics";
  }
  if (lower.includes("office") || lower.includes("admin") || lower.includes("print") || lower.includes("stationery")) {
    return "Office & Admin";
  }
  return cat;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();

    const year = parseInt(searchParams.get("year") || String(now.getFullYear()), 10);
    const selectedMonth = parseInt(searchParams.get("month") || String(now.getMonth() + 1), 10); // 1-12
    const businessId = searchParams.get("businessId") || null;

    // Full year boundary
    const yearStart = new Date(year, 0, 1, 0, 0, 0, 0).toISOString();
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999).toISOString();

    const COUNTED_STATUSES = ["Delivered"];

    // 1. Fetch Invoices for the entire year with chunked pagination
    const allInvoices: any[] = [];
    let invStart = 0;
    const invLimit = 1000;

    while (true) {
      let q = supabaseAdmin
        .from("invoices")
        .select(`
          id, invoice_no, manual_invoice_no, total_amount, due_amount, status, created_at,
          order:orders!inner (
            id, order_id, status, created_at, order_date, business_id, sales_rep_id,
            customer:customers (id, shop_name)
          )
        `)
        .gte("order.order_date", yearStart)
        .lte("order.order_date", yearEnd)
        .in("order.status", COUNTED_STATUSES)
        .range(invStart, invStart + invLimit - 1);

      if (businessId && businessId !== "all") {
        q = q.eq("order.business_id", businessId);
      }

      const { data: batch, error: invError } = await q;
      if (invError) throw invError;
      if (!batch || batch.length === 0) break;
      allInvoices.push(...batch);
      if (batch.length < invLimit) break;
      invStart += invLimit;
    }

    // 2. Fetch Order Items for the entire year with chunked pagination
    const allOrderItems: any[] = [];
    let itemsStart = 0;
    const itemsLimit = 1000;

    while (true) {
      let q = supabaseAdmin
        .from("order_items")
        .select(`
          id, quantity, free_quantity, unit_price, actual_unit_cost, total_price, claim_status,
          product:products (id, name, sku, cost_price),
          order:orders!inner (
            id, order_id, status, created_at, order_date, business_id, sales_rep_id,
            customer:customers (id, shop_name)
          )
        `)
        .gte("order.order_date", yearStart)
        .lte("order.order_date", yearEnd)
        .in("order.status", COUNTED_STATUSES)
        .range(itemsStart, itemsStart + itemsLimit - 1);

      if (businessId && businessId !== "all") {
        q = q.eq("order.business_id", businessId);
      }

      const { data: batch, error: itemsError } = await q;
      if (itemsError) throw itemsError;
      if (!batch || batch.length === 0) break;
      allOrderItems.push(...batch);
      if (batch.length < itemsLimit) break;
      itemsStart += itemsLimit;
    }

    // 3. Fetch Expenses for the year (with chunked pagination)
    const allExpenses: any[] = [];
    let expStart = 0;
    const expLimit = 1000;

    while (true) {
      let q = supabaseAdmin
        .from("expenses")
        .select(`
          id, amount, category, description, expense_date, payment_method, reference_no, business_id, load_id,
          loading_sheets(load_id),
          businesses(name)
        `)
        .gte("expense_date", `${year}-01-01`)
        .lte("expense_date", `${year}-12-31`)
        .order("expense_date", { ascending: false })
        .range(expStart, expStart + expLimit - 1);

      if (businessId && businessId !== "all") {
        q = q.or(`business_id.eq.${businessId},business_id.is.null`);
      }

      const { data: batch, error: expError } = await q;
      if (expError) throw expError;
      if (!batch || batch.length === 0) break;
      allExpenses.push(...batch);
      if (batch.length < expLimit) break;
      expStart += expLimit;
    }

    // 4. Fetch Business Losses (Damaged goods marked as business loss)
    let lossesQuery = supabaseAdmin
      .from("inventory_returns")
      .select(`
        id, return_number, quantity, created_at, status, reason,
        product:products (id, name, cost_price, category)
      `)
      .eq("status", "Business Loss")
      .gte("created_at", yearStart)
      .lte("created_at", yearEnd);

    const { data: losses, error: lossesError } = await lossesQuery;
    if (lossesError) throw lossesError;

    // 5. Fetch Staff Salaries from Payroll Table for the entire year
    let salariesQuery = supabaseAdmin
      .from("salaries")
      .select(`
        id, basic_salary, auto_commissions, manual_commissions_added, manual_commissions_deducted,
        target_bonus_amount, other_deductions, lunch_allowance, night_out_allowance,
        salary_month, admin_approval_status, payment_date, created_at,
        profiles:user_id (id, full_name, email)
      `)
      .like("salary_month", `${year}-%`)
      .order("created_at", { ascending: false });

    if (businessId && businessId !== "all") {
      salariesQuery = salariesQuery.eq("business_id", businessId);
    }

    const { data: salaryRows } = await salariesQuery;

    // --- Build 12 Months Data Structure ---
    interface MonthData {
      monthIndex: number; // 1-12
      name: string;
      shortName: string;
      revenue: number;
      cogs: number;
      grossProfit: number;
      grossMargin: number;
      salaries: number; // Dedicated Staff Salaries
      operatingProfit: number; // Gross Profit - Salaries
      overheads: number; // General overheads (Fuel, Rent, Utilities, Food, etc.)
      totalExpenses: number; // Salaries + Overheads
      losses: number;
      netProfit: number;
      netMargin: number;
      orderCount: number;
      staffCount: number;
      status: "PROFIT" | "LOSS" | "EVEN";
      overheadMap: Record<string, { total: number; count: number }>;
    }

    const monthlySummary: MonthData[] = Array.from({ length: 12 }, (_, i) => {
      const idx = i + 1;
      return {
        monthIndex: idx,
        name: MONTH_NAMES[i],
        shortName: MONTH_SHORT[i],
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        grossMargin: 0,
        salaries: 0,
        operatingProfit: 0,
        overheads: 0,
        totalExpenses: 0,
        losses: 0,
        netProfit: 0,
        netMargin: 0,
        orderCount: 0,
        staffCount: 0,
        status: "EVEN",
        overheadMap: {},
      };
    });

    // Map each invoiced order to its monthIndex and keep track of invoiced orders
    const orderMonthMap: Record<string, number> = {};
    const invoicedOrderIds = new Set<string>();

    // A. Aggregate Invoices (Actual Sales Revenue)
    allInvoices.forEach((inv: any) => {
      const order = inv.order;
      if (!order) return;

      const shopName = (order.customer?.shop_name || "").toLowerCase();
      if (shopName.includes("champika hardware")) return;

      const dateStr = order.order_date || order.created_at || inv.created_at;
      if (!dateStr) return;

      const d = new Date(dateStr);
      const mIdx = d.getMonth(); // 0-11
      if (mIdx < 0 || mIdx > 11) return;

      const amount = Number(inv.total_amount) || 0;
      monthlySummary[mIdx].revenue += amount;
      monthlySummary[mIdx].orderCount += 1;

      orderMonthMap[order.order_id] = mIdx;
      invoicedOrderIds.add(order.order_id);
    });

    // B. Aggregate Order Items (Cost of Goods Sold - COGS)
    allOrderItems.forEach((item: any) => {
      const order = item.order;
      if (!order) return;

      if (!invoicedOrderIds.has(order.order_id)) return;

      const mIdx = orderMonthMap[order.order_id];
      if (mIdx === undefined || mIdx < 0 || mIdx > 11) return;

      const qty = Number(item.quantity) || 0;
      const actualCost = item.actual_unit_cost !== null && item.actual_unit_cost !== undefined
        ? Number(item.actual_unit_cost)
        : Number(item.product?.cost_price) || 0;

      monthlySummary[mIdx].cogs += qty * actualCost;
    });

    // C. Aggregate Salaries (Dedicated Payroll Section)
    const selectedMonthSalariesList: any[] = [];
    const monthsWithPayroll = new Set<number>();

    (salaryRows || []).forEach((s: any) => {
      if (!s.salary_month) return;
      const parts = s.salary_month.split("-");
      if (parts.length < 2) return;
      const mIdx = parseInt(parts[1], 10) - 1; // 0-11
      if (mIdx < 0 || mIdx > 11) return;

      // Count approved or all recorded
      const net =
        (Number(s.basic_salary) || 0) +
        (Number(s.auto_commissions) || 0) +
        (Number(s.manual_commissions_added) || 0) +
        (Number(s.target_bonus_amount) || 0) +
        (Number(s.lunch_allowance) || 0) +
        (Number(s.night_out_allowance) || 0) -
        (Number(s.manual_commissions_deducted) || 0) -
        (Number(s.other_deductions) || 0);

      monthlySummary[mIdx].salaries += net;
      monthlySummary[mIdx].staffCount += 1;
      monthsWithPayroll.add(mIdx);

      if (mIdx + 1 === selectedMonth) {
        selectedMonthSalariesList.push({
          id: s.id,
          name: s.profiles?.full_name || "Unknown Staff",
          email: s.profiles?.email || "",
          month: s.salary_month,
          basic: Number(s.basic_salary) || 0,
          allowances: (Number(s.lunch_allowance) || 0) + (Number(s.night_out_allowance) || 0),
          commissions: (Number(s.auto_commissions) || 0) + (Number(s.manual_commissions_added) || 0) + (Number(s.target_bonus_amount) || 0),
          deductions: (Number(s.manual_commissions_deducted) || 0) + (Number(s.other_deductions) || 0),
          netSalary: net,
          paymentDate: s.payment_date || "-",
          status: s.admin_approval_status || "Pending",
        });
      }
    });

    // D. Aggregate Operating Overheads from Expenses (Excluding Salaries if payroll table already has it)
    const selectedMonthOverheadEntries: any[] = [];

    allExpenses.forEach((exp: any) => {
      if (!exp.expense_date) return;
      const d = new Date(exp.expense_date);
      const mIdx = d.getMonth(); // 0-11
      if (mIdx < 0 || mIdx > 11) return;

      const amt = Number(exp.amount) || 0;
      const normalizedCat = normalizeCategory(exp.category);

      // If category is "Staff Salaries" and payroll table already recorded salaries for that month, avoid double count
      if (normalizedCat === "Staff Salaries" && monthsWithPayroll.has(mIdx)) {
        return;
      }

      // If category is "Staff Salaries" but NO payroll table records exist for that month, count it as salaries!
      if (normalizedCat === "Staff Salaries") {
        monthlySummary[mIdx].salaries += amt;
        return;
      }

      monthlySummary[mIdx].overheads += amt;

      const oMap = monthlySummary[mIdx].overheadMap;
      if (!oMap[normalizedCat]) {
        oMap[normalizedCat] = { total: 0, count: 0 };
      }
      oMap[normalizedCat].total += amt;
      oMap[normalizedCat].count += 1;

      if (mIdx + 1 === selectedMonth) {
        selectedMonthOverheadEntries.push({
          id: exp.id,
          date: exp.expense_date,
          description: exp.description || "Expense",
          category: normalizedCat,
          rawCategory: exp.category || "Other",
          amount: amt,
          paymentMethod: exp.payment_method || "Cash",
          referenceNo: exp.reference_no || "-",
          businessName: exp.businesses?.name || "All / Global",
          loadRef: exp.loading_sheets?.load_id || null,
        });
      }
    });

    // E. Aggregate Losses into Months
    losses?.forEach((loss: any) => {
      if (!loss.created_at) return;
      const d = new Date(loss.created_at);
      const mIdx = d.getMonth();
      if (mIdx < 0 || mIdx > 11) return;

      const qty = Number(loss.quantity) || 0;
      const cost = Number(loss.product?.cost_price) || 0;
      const val = qty * cost;

      monthlySummary[mIdx].losses += val;
    });

    // F. Compute Multi-Tier Profit & Margins for each month
    monthlySummary.forEach((m) => {
      m.grossProfit = m.revenue - m.cogs;
      m.grossMargin = m.revenue > 0 ? (m.grossProfit / m.revenue) * 100 : 0;
      m.operatingProfit = m.grossProfit - m.salaries;
      m.totalExpenses = m.salaries + m.overheads;
      m.netProfit = m.operatingProfit - m.overheads - m.losses;
      m.netMargin = m.revenue > 0 ? (m.netProfit / m.revenue) * 100 : 0;
      m.status = m.netProfit > 0 ? "PROFIT" : m.netProfit < 0 ? "LOSS" : "EVEN";
    });

    // --- Details for the Selected Month ---
    const targetMonthData = monthlySummary[selectedMonth - 1] || monthlySummary[0];

    // Build overhead breakdown with percentages
    const overheadBreakdown = Object.entries(targetMonthData.overheadMap)
      .map(([category, info]) => ({
        category,
        total: info.total,
        count: info.count,
        percentOfOverheads: targetMonthData.overheads > 0
          ? (info.total / targetMonthData.overheads) * 100
          : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Spotlight expenses
    const laborExpense = targetMonthData.overheadMap["Labor / Wages"]?.total || 0;
    const bankInterestExpense = targetMonthData.overheadMap["Bank Interest & Charges"]?.total || 0;
    const rentExpense = targetMonthData.overheadMap["Rent & Rates"]?.total || 0;
    const utilityExpense = targetMonthData.overheadMap["Electricity & Utilities"]?.total || 0;
    const fuelExpense = targetMonthData.overheadMap["Fuel & Transport"]?.total || 0;

    // Previous month for MoM
    const prevMonthIdx = selectedMonth - 2;
    const prevMonthData = prevMonthIdx >= 0 ? monthlySummary[prevMonthIdx] : null;

    const momComparison = {
      prevMonthName: prevMonthData ? prevMonthData.name : null,
      revenueChange: prevMonthData ? targetMonthData.revenue - prevMonthData.revenue : 0,
      revenueChangePct: prevMonthData && prevMonthData.revenue > 0
        ? ((targetMonthData.revenue - prevMonthData.revenue) / prevMonthData.revenue) * 100
        : null,
      salariesChange: prevMonthData ? targetMonthData.salaries - prevMonthData.salaries : 0,
      salariesChangePct: prevMonthData && prevMonthData.salaries > 0
        ? ((targetMonthData.salaries - prevMonthData.salaries) / prevMonthData.salaries) * 100
        : null,
      overheadChange: prevMonthData ? targetMonthData.overheads - prevMonthData.overheads : 0,
      overheadChangePct: prevMonthData && prevMonthData.overheads > 0
        ? ((targetMonthData.overheads - prevMonthData.overheads) / prevMonthData.overheads) * 100
        : null,
      netProfitChange: prevMonthData ? targetMonthData.netProfit - prevMonthData.netProfit : 0,
      netProfitChangePct: prevMonthData && Math.abs(prevMonthData.netProfit) > 0
        ? ((targetMonthData.netProfit - prevMonthData.netProfit) / Math.abs(prevMonthData.netProfit)) * 100
        : null,
    };

    // YTD Totals
    const ytd = monthlySummary.reduce(
      (acc, m) => {
        acc.revenue += m.revenue;
        acc.cogs += m.cogs;
        acc.grossProfit += m.grossProfit;
        acc.salaries += m.salaries;
        acc.operatingProfit += m.operatingProfit;
        acc.overheads += m.overheads;
        acc.totalExpenses += m.totalExpenses;
        acc.losses += m.losses;
        acc.netProfit += m.netProfit;
        acc.orderCount += m.orderCount;
        return acc;
      },
      {
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        salaries: 0,
        operatingProfit: 0,
        overheads: 0,
        totalExpenses: 0,
        losses: 0,
        netProfit: 0,
        orderCount: 0,
      }
    );
    const ytdNetMargin = ytd.revenue > 0 ? (ytd.netProfit / ytd.revenue) * 100 : 0;
    const ytdGrossMargin = ytd.revenue > 0 ? (ytd.grossProfit / ytd.revenue) * 100 : 0;

    return NextResponse.json({
      year,
      month: selectedMonth,
      monthName: MONTH_NAMES[selectedMonth - 1],
      targetMonth: {
        ...targetMonthData,
        laborExpense,
        bankInterestExpense,
        rentExpense,
        utilityExpense,
        fuelExpense,
      },
      staffSalariesList: selectedMonthSalariesList,
      overheadBreakdown,
      overheadEntries: selectedMonthOverheadEntries,
      momComparison,
      monthlyTrend: monthlySummary.map(({ overheadMap, ...rest }) => rest),
      ytd: {
        ...ytd,
        grossMargin: ytdGrossMargin,
        netMargin: ytdNetMargin,
        status: ytd.netProfit >= 0 ? "PROFIT" : "LOSS",
      },
    });
  } catch (error: any) {
    console.error("Monthly PnL API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to load monthly P&L" }, { status: 500 });
  }
}
