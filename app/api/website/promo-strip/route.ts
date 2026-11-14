import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError } from "@/lib/web-utils";
import { refreshShop } from "@/lib/shop-cache";

// Items for the black promotion strip on the shop home page.
const schema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Title is required").max(40),
  imageUrl: z.string().nullable().optional(),
  linkType: z.enum(["category", "brand", "product", "url"]),
  linkValue: z.string().trim().min(1, "Choose where it should open"),
  badgeMode: z.enum(["none", "auto", "text"]),
  badgeText: z.string().trim().max(14).nullable().optional(),
  badgeColor: z.enum(["red", "orange", "green", "blue"]),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
  endsAt: z.string().nullable().optional(),
});

const toApi = (r: any) => ({
  id: r.id,
  title: r.title,
  imageUrl: r.image_url,
  linkType: r.link_type,
  linkValue: r.link_value,
  badgeMode: r.badge_mode,
  badgeText: r.badge_text,
  badgeColor: r.badge_color,
  sortOrder: r.sort_order,
  isActive: r.is_active,
  endsAt: r.ends_at,
});

export async function GET() {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const { data, error } = await supabaseAdmin.from("web_promo_strip").select("*").order("sort_order");
    if (error) {
      if (/web_promo_strip/.test(error.message)) {
        return NextResponse.json({ error: "Run supabase/migrations/website_shop.sql once to add the promo strip table." }, { status: 400 });
      }
      throw error;
    }
    return NextResponse.json((data || []).map(toApi));
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const v = schema.parse(await request.json());
    if (v.badgeMode === "text" && !v.badgeText) {
      return NextResponse.json({ error: "Type the badge text, e.g. 27% OFF" }, { status: 400 });
    }
    const row = {
      title: v.title,
      image_url: v.imageUrl || null,
      link_type: v.linkType,
      link_value: v.linkValue,
      badge_mode: v.badgeMode,
      badge_text: v.badgeMode === "text" ? v.badgeText : null,
      badge_color: v.badgeColor,
      sort_order: v.sortOrder ?? 0,
      is_active: v.isActive ?? true,
      // End of the chosen day (Sri Lanka time).
      ends_at: v.endsAt ? new Date(`${v.endsAt.slice(0, 10)}T23:59:59+05:30`).toISOString() : null,
    };
    const q = v.id
      ? supabaseAdmin.from("web_promo_strip").update(row).eq("id", v.id)
      : supabaseAdmin.from("web_promo_strip").insert(row);
    const { data, error } = await q.select().single();
    if (error) throw error;
    refreshShop();
    return NextResponse.json(toApi(data), { status: v.id ? 200 : 201 });
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
    const { error } = await supabaseAdmin.from("web_promo_strip").delete().eq("id", id);
    if (error) throw error;
    refreshShop();
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
