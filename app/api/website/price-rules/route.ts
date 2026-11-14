import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError } from "@/lib/web-utils";
import { refreshShop } from "@/lib/shop-cache";

const schema = z.object({
  id: z.string().uuid().optional(),
  scope: z.enum(["brand", "category", "web_category", "web_brand"]),
  scopeValue: z.string().trim().min(1, "Choose a brand / category"),
  tier: z.enum(["normal", "trade"]),
  method: z.enum(["mrp_discount_pct", "cost_markup_pct"]),
  value: z.coerce.number().min(0).max(500),
  priority: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

/** Rules + the option lists for the form (brands, categories, web categories). */
export async function GET() {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const [rules, brands, cats, webCats, webBrands] = await Promise.all([
      supabaseAdmin.from("web_price_rules").select("*").order("scope").order("scope_value"),
      supabaseAdmin.from("categories").select("name").eq("type", "brand").order("name"),
      supabaseAdmin.from("categories").select("name").eq("type", "category").order("name"),
      supabaseAdmin.from("web_categories").select("id, name").order("name"),
      supabaseAdmin.from("web_brands").select("id, name").order("name"),
    ]);
    if (rules.error) throw rules.error;
    const uniq = (rows: any[] | null) => [...new Set((rows || []).map((r) => r.name).filter(Boolean))];
    return NextResponse.json({
      rules: (rules.data || []).map((r: any) => ({
        id: r.id,
        scope: r.scope,
        scopeValue: r.scope_value,
        tier: r.tier,
        method: r.method,
        value: Number(r.value),
        priority: r.priority,
        isActive: r.is_active,
      })),
      options: {
        brands: uniq(brands.data),
        categories: uniq(cats.data),
        webCategories: webCats.data || [],
        webBrands: webBrands.data || [],
      },
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const v = schema.parse(await request.json());
    const row = {
      scope: v.scope,
      scope_value: v.scopeValue,
      tier: v.tier,
      method: v.method,
      value: v.value,
      priority: v.priority,
      is_active: v.isActive,
      updated_at: new Date().toISOString(),
    };
    const q = v.id
      ? supabaseAdmin.from("web_price_rules").update(row).eq("id", v.id)
      : supabaseAdmin.from("web_price_rules").insert(row);
    const { data, error } = await q.select().single();
    if (error) throw error;
    refreshShop();
    return NextResponse.json(data, { status: v.id ? 200 : 201 });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    const { error } = await supabaseAdmin.from("web_price_rules").delete().eq("id", id);
    if (error) throw error;
    refreshShop();
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
