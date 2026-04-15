// app/api/backup/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ExportTable =
  | "customers"
  | "products"
  | "invoices"
  | "orders"
  | "payments"
  | "expenses"
  | "purchases"
  | "suppliers"
  | "profiles"
  | "all";

// Tables with a direct business_id column — simple .eq() filter
const DIRECT_BUSINESS_TABLES = new Set([
  "customers",
  "orders",
  "expenses",
  "purchases",
  "suppliers",
  "profiles",
]);

const TABLE_QUERIES: Record<
  Exclude<ExportTable, "all">,
  { table: string; select: string; label: string }
> = {
  customers: {
    table: "customers",
    select:
      "id,shop_name,owner_name,phone,email,address,route,status,credit_limit,outstanding_balance,business_id,created_at",
    label: "Customers",
  },
  products: {
    table: "products",
    select:
      "id,sku,name,category,sub_category,brand,supplier_name,mrp,selling_price,cost_price,stock_quantity,min_stock_level,is_active,created_at",
    label: "Products",
  },
  invoices: {
    table: "invoices",
    select:
      "id,invoice_no,manual_invoice_no,customer_id,order_id,total_amount,paid_amount,due_amount,status,due_date,created_at",
    label: "Invoices",
  },
  orders: {
    table: "orders",
    select:
      "id,order_id,order_date,status,total_amount,notes,business_id,created_at",
    label: "Orders",
  },
  payments: {
    table: "payments",
    select:
      "id,customer_id,invoice_id,amount,payment_date,method,cheque_no,cheque_date,cheque_status,created_at",
    label: "Payments",
  },
  expenses: {
    table: "expenses",
    select:
      "id,description,amount,category,expense_date,payment_method,reference_no,business_id,created_at",
    label: "Expenses",
  },
  purchases: {
    table: "purchases",
    select:
      "id,invoice_no,purchase_date,arrival_date,payment_status,total_amount,paid_amount,business_id,created_at",
    label: "Purchases",
  },
  suppliers: {
    table: "suppliers",
    select:
      "id,name,contact_person,email,phone,address,category,status,due_payment,business_id,created_at",
    label: "Suppliers",
  },
  profiles: {
    table: "profiles",
    select: "id,full_name,role,business_id,created_at",
    label: "Users",
  },
};

// ── Helper: resolve customer IDs for a given business ─────────────────────────
async function getCustomerIdsForBusiness(businessId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("business_id", businessId);
  if (error) throw error;
  return (data ?? []).map((c: any) => c.id as string);
}

// ── Helper: fetch a single table with optional business-aware filtering ────────
async function fetchTable(
  key: Exclude<ExportTable, "all">,
  businessId: string | null,
  customerIds: string[] | null  // pre-resolved customer IDs for the business
): Promise<any[]> {
  const cfg = TABLE_QUERIES[key];

  let query = supabaseAdmin
    .from(cfg.table)
    .select(cfg.select)
    .order("created_at", { ascending: false });

  if (businessId) {
    if (DIRECT_BUSINESS_TABLES.has(key)) {
      // Simple direct filter
      query = query.eq("business_id", businessId) as typeof query;

    } else if (key === "invoices") {
      // Invoices link to business via customer_id
      if (!customerIds || customerIds.length === 0) return [];
      query = query.in("customer_id", customerIds) as typeof query;

    } else if (key === "payments") {
      // Payments also link via customer_id
      if (!customerIds || customerIds.length === 0) return [];
      query = query.in("customer_id", customerIds) as typeof query;

    }
    // products: no business filter — shared catalog, always full
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ─── GET handler ───────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entity = (searchParams.get("entity") ?? "all") as ExportTable;
    const businessId = searchParams.get("businessId") ?? null;

    const targets =
      entity === "all"
        ? (Object.keys(TABLE_QUERIES) as Exclude<ExportTable, "all">[])
        : [entity as Exclude<ExportTable, "all">];

    // Pre-fetch customer IDs once if we need them for invoices / payments
    let customerIds: string[] | null = null;
    if (businessId) {
      const needsCustomerIds =
        entity === "all" ||
        entity === "invoices" ||
        entity === "payments";

      if (needsCustomerIds) {
        customerIds = await getCustomerIdsForBusiness(businessId);
      }
    }

    const results: Record<string, any[]> = {};
    const errors: Record<string, string> = {};

    await Promise.all(
      targets.map(async (key) => {
        try {
          results[key] = await fetchTable(key, businessId, customerIds);
        } catch (err: any) {
          errors[key] = err.message;
        }
      })
    );

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      entity,
      businessId,
      results,
      errors,
      totalRecords: Object.values(results).reduce((s, a) => s + a.length, 0),
    });
  } catch (error: any) {
    console.error("GET /api/backup/export error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
