import { supabaseAdmin } from "@/lib/supabase-admin";

/** "Orange 13A Switch (White)" → "orange-13a-switch-white" */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

/** Slug that is not used yet in `table` (adds -2, -3 … when needed). */
export async function uniqueSlug(
  table: "web_products" | "web_categories",
  base: string,
  ignoreId?: string,
): Promise<string> {
  const root = slugify(base);
  const { data } = await supabaseAdmin.from(table).select("id, slug").ilike("slug", `${root}%`);
  const taken = new Set((data || []).filter((r: any) => r.id !== ignoreId).map((r: any) => r.slug));
  if (!taken.has(root)) return root;
  let i = 2;
  while (taken.has(`${root}-${i}`)) i++;
  return `${root}-${i}`;
}

/** Main Warehouse = locations with no business. Returns qty per product id. */
export async function getMainWarehouseStock(productIds: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (productIds.length === 0) return result;

  const { data: locs } = await supabaseAdmin.from("locations").select("id").is("business_id", null);
  const locIds = (locs || []).map((l: any) => l.id);
  if (locIds.length === 0) return result;

  // Chunk to keep the URL short for large lists.
  for (let i = 0; i < productIds.length; i += 200) {
    const chunk = productIds.slice(i, i + 200);
    const { data } = await supabaseAdmin
      .from("product_stocks")
      .select("product_id, quantity")
      .in("location_id", locIds)
      .in("product_id", chunk);
    for (const row of data || []) {
      result[row.product_id] = (result[row.product_id] || 0) + (Number(row.quantity) || 0);
    }
  }
  return result;
}

/** Next running number like WEB-000123 for a text column with a fixed prefix. */
export async function nextRunningNo(
  table: "web_orders" | "web_quote_requests",
  column: "web_order_no" | "quote_no",
  prefix: string,
): Promise<string> {
  const { data } = await supabaseAdmin
    .from(table)
    .select(column)
    .ilike(column, `${prefix}-%`)
    .order(column, { ascending: false })
    .limit(1);
  const last = (data?.[0] as any)?.[column] as string | undefined;
  const n = last ? parseInt(last.split("-").pop() || "0", 10) || 0 : 0;
  return `${prefix}-${String(n + 1).padStart(6, "0")}`;
}

export const apiError = (e: any, status = 500) => {
  const message = e?.issues?.[0]?.message || e?.message || "Something went wrong";
  return Response.json({ error: message }, { status: e?.issues ? 400 : status });
};

/** Phase 1 sells only Wiring Accessories; used until Shop Settings saves a list. */
export const DEFAULT_ALLOWED_CATEGORIES = ["Wiring Accessories"];

/**
 * B2B (main) categories the website may sell, from Shop Settings → "catalog".
 * No saved setting → DEFAULT_ALLOWED_CATEGORIES. Saved empty list → all categories.
 */
export async function getAllowedMainCategories(): Promise<string[]> {
  const { data } = await supabaseAdmin.from("web_settings").select("value").eq("key", "catalog").maybeSingle();
  if (!data) return DEFAULT_ALLOWED_CATEGORIES;
  const list = (data.value as any)?.allowed_categories;
  return Array.isArray(list) ? list.filter(Boolean) : DEFAULT_ALLOWED_CATEGORIES;
}
