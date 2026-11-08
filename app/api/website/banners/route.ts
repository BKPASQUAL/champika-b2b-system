import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError } from "@/lib/web-utils";

const schema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().nullable().optional(),
  imageUrl: z.string().min(1, "Image is required"),
  link: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const { data, error } = await supabaseAdmin.from("web_banners").select("*").order("sort_order");
    if (error) throw error;
    return NextResponse.json(
      (data || []).map((b: any) => ({
        id: b.id,
        title: b.title,
        imageUrl: b.image_url,
        link: b.link,
        sortOrder: b.sort_order,
        isActive: b.is_active,
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
    const row = {
      title: v.title ?? null,
      image_url: v.imageUrl,
      link: v.link ?? null,
      sort_order: v.sortOrder ?? 0,
      is_active: v.isActive ?? true,
    };
    const q = v.id
      ? supabaseAdmin.from("web_banners").update(row).eq("id", v.id)
      : supabaseAdmin.from("web_banners").insert(row);
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
    const { error } = await supabaseAdmin.from("web_banners").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
