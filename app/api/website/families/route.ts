import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError, slugify } from "@/lib/web-utils";

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required"),
  webCategoryId: z.string().uuid().nullable().optional(), // the sub category it belongs to
  imageUrl: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const [{ data, error }, { data: prods }] = await Promise.all([
      supabaseAdmin.from("web_product_families").select("*, web_categories(name)").order("sort_order").order("name"),
      supabaseAdmin.from("web_products").select("web_family_id"),
    ]);
    if (error) throw error;
    const countMap: Record<string, number> = {};
    for (const r of prods || []) if (r.web_family_id) countMap[r.web_family_id] = (countMap[r.web_family_id] || 0) + 1;
    return NextResponse.json(
      (data || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        slug: f.slug,
        webCategoryId: f.web_category_id,
        webCategoryName: f.web_categories?.name ?? null,
        imageUrl: f.image_url ?? null,
        description: f.description,
        sortOrder: f.sort_order,
        isActive: f.is_active,
        productCount: countMap[f.id] || 0,
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
    // Slug must be unique; add a number when the same family name is used twice.
    let slug = slugify(v.name);
    const { data: same } = await supabaseAdmin.from("web_product_families").select("id, slug").ilike("slug", `${slug}%`);
    const taken = new Set((same || []).filter((r: any) => r.id !== v.id).map((r: any) => r.slug));
    for (let i = 2; taken.has(slug); i++) slug = `${slugify(v.name)}-${i}`;

    const row = {
      name: v.name,
      slug,
      web_category_id: v.webCategoryId ?? null,
      ...(v.imageUrl !== undefined ? { image_url: v.imageUrl } : {}),
      description: v.description ?? null,
      sort_order: v.sortOrder,
      is_active: v.isActive,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await (v.id
      ? supabaseAdmin.from("web_product_families").update(row).eq("id", v.id)
      : supabaseAdmin.from("web_product_families").insert(row)
    )
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ id: data.id, name: data.name, webCategoryId: data.web_category_id }, { status: v.id ? 200 : 201 });
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
    const { error } = await supabaseAdmin.from("web_product_families").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
