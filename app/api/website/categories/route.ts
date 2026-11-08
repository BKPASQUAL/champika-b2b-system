import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError, uniqueSlug } from "@/lib/web-utils";

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required"),
  parentId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const [{ data, error }, { data: counts }] = await Promise.all([
      supabaseAdmin.from("web_categories").select("*").order("sort_order").order("name"),
      supabaseAdmin.from("web_products").select("web_category_id, web_sub_category_id"),
    ]);
    if (error) throw error;
    const countMap: Record<string, number> = {};
    for (const r of counts || []) {
      if (r.web_category_id) countMap[r.web_category_id] = (countMap[r.web_category_id] || 0) + 1;
      if (r.web_sub_category_id) countMap[r.web_sub_category_id] = (countMap[r.web_sub_category_id] || 0) + 1;
    }
    return NextResponse.json(
      (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        parentId: c.parent_id,
        imageUrl: c.image_url,
        description: c.description,
        sortOrder: c.sort_order,
        isActive: c.is_active,
        productCount: countMap[c.id] || 0,
      })),
    );
  } catch (e) {
    return apiError(e);
  }
}

/** Create (no id) or update (with id). */
export async function POST(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const v = schema.parse(await request.json());
    if (v.id && v.parentId === v.id) throw new Error("A category cannot be its own parent");
    const row = {
      name: v.name,
      slug: await uniqueSlug("web_categories", v.name, v.id),
      parent_id: v.parentId ?? null,
      image_url: v.imageUrl ?? null,
      description: v.description ?? null,
      sort_order: v.sortOrder ?? 0,
      is_active: v.isActive ?? true,
      updated_at: new Date().toISOString(),
    };
    const q = v.id
      ? supabaseAdmin.from("web_categories").update(row).eq("id", v.id)
      : supabaseAdmin.from("web_categories").insert(row);
    const { data, error } = await q.select().single();
    if (error) throw error;
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
    // Products and sub-categories keep existing; their category is cleared (ON DELETE SET NULL).
    const { error } = await supabaseAdmin.from("web_categories").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
