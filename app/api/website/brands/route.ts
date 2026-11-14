import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError } from "@/lib/web-utils";
import { brandSlug } from "@/lib/web-brands";
import { refreshShop } from "@/lib/shop-cache";

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required"),
  parentId: z.string().uuid().nullable().optional(), // set = this is a sub brand
  logoUrl: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().default(0),
  isFeatured: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

/** All brands and sub brands (sub brands have parentId). */
export async function GET() {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const [{ data, error }, { data: prods }] = await Promise.all([
      supabaseAdmin.from("web_brands").select("*").order("sort_order").order("name"),
      supabaseAdmin.from("web_products").select("web_brand_id, web_sub_brand_id"),
    ]);
    if (error) throw error;
    const countMap: Record<string, number> = {};
    for (const r of prods || []) {
      if (r.web_brand_id) countMap[r.web_brand_id] = (countMap[r.web_brand_id] || 0) + 1;
      if (r.web_sub_brand_id) countMap[r.web_sub_brand_id] = (countMap[r.web_sub_brand_id] || 0) + 1;
    }
    return NextResponse.json(
      (data || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        parentId: b.parent_id,
        logoUrl: b.logo_url,
        description: b.description,
        sortOrder: b.sort_order,
        isFeatured: b.is_featured,
        isActive: b.is_active,
        productCount: countMap[b.id] || 0,
      })),
    );
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const v = schema.parse(await request.json());
    if (v.id && v.parentId === v.id) throw new Error("A brand cannot be its own sub brand");
    let parentSlug: string | null = null;
    if (v.parentId) {
      const { data: p } = await supabaseAdmin.from("web_brands").select("slug, parent_id").eq("id", v.parentId).single();
      if (!p) throw new Error("Parent brand not found");
      if (p.parent_id) throw new Error("Sub brands can only be one level deep");
      parentSlug = p.slug;
    }
    const row = {
      name: v.name,
      slug: brandSlug(v.name, parentSlug),
      parent_id: v.parentId ?? null,
      logo_url: v.logoUrl ?? null,
      description: v.description ?? null,
      sort_order: v.sortOrder,
      is_featured: v.isFeatured,
      is_active: v.isActive,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await (v.id
      ? supabaseAdmin.from("web_brands").update(row).eq("id", v.id)
      : supabaseAdmin.from("web_brands").insert(row)
    )
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw new Error(v.parentId ? "This brand already has a sub brand with that name" : "A brand with this name already exists");
      throw error;
    }
    // Keep the brand text shown on product pages in step with the brand name.
    if (v.id && !v.parentId) await supabaseAdmin.from("web_products").update({ brand_text: v.name }).eq("web_brand_id", v.id);
    refreshShop();
    return NextResponse.json(
      { id: data.id, name: data.name, slug: data.slug, parentId: data.parent_id },
      { status: v.id ? 200 : 201 },
    );
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
    // Sub brands are removed with their brand (ON DELETE CASCADE); products keep existing.
    const { error } = await supabaseAdmin.from("web_brands").delete().eq("id", id);
    if (error) throw error;
    refreshShop();
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
