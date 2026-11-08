import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError } from "@/lib/web-utils";

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const [{ data, error }, { data: prods }] = await Promise.all([
      supabaseAdmin.from("web_suppliers").select("*").order("name"),
      supabaseAdmin.from("web_products").select("web_supplier_id"),
    ]);
    if (error) throw error;
    const countMap: Record<string, number> = {};
    for (const r of prods || []) if (r.web_supplier_id) countMap[r.web_supplier_id] = (countMap[r.web_supplier_id] || 0) + 1;
    return NextResponse.json(
      (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        notes: s.notes,
        isActive: s.is_active,
        productCount: countMap[s.id] || 0,
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
      name: v.name,
      phone: v.phone ?? null,
      notes: v.notes ?? null,
      is_active: v.isActive,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await (v.id
      ? supabaseAdmin.from("web_suppliers").update(row).eq("id", v.id)
      : supabaseAdmin.from("web_suppliers").insert(row)
    )
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("A supplier with this name already exists");
      throw error;
    }
    return NextResponse.json({ id: data.id, name: data.name }, { status: v.id ? 200 : 201 });
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
    const { error } = await supabaseAdmin.from("web_suppliers").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
