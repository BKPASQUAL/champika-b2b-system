import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError } from "@/lib/web-utils";

/** Counts for the website dashboard cards. */
export async function GET() {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const count = (table: string, f?: (q: any) => any) => {
      let q = supabaseAdmin.from(table).select("id", { count: "exact", head: true });
      if (f) q = f(q);
      return q.then((r: any) => r.count || 0);
    };
    const [products, published, unavailable, categories, newOrders, openQuotes, customers, tradePending] =
      await Promise.all([
        count("web_products"),
        count("web_products", (q) => q.eq("is_published", true)),
        count("web_product_variants", (q) => q.eq("is_available", false)),
        count("web_categories"),
        count("web_orders", (q) => q.eq("status", "New")),
        count("web_quote_requests", (q) => q.eq("status", "Requested")),
        count("web_customers"),
        count("web_customers", (q) => q.eq("trade_status", "pending")),
      ]);
    return NextResponse.json({
      products,
      published,
      unavailable,
      categories,
      newOrders,
      openQuotes,
      customers,
      tradePending,
    });
  } catch (e) {
    return apiError(e);
  }
}
