import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError, getAllowedMainCategories } from "@/lib/web-utils";

const schema = z.object({
  delivery: z.object({ flat_fee: z.coerce.number().min(0), free_over: z.coerce.number().min(0), areas: z.string().default("") }),
  bank: z.object({ bank: z.string(), branch: z.string(), account_name: z.string(), account_no: z.string() }),
  store: z.object({
    name: z.string(),
    phone: z.string(),
    whatsapp: z.string(),
    address: z.string(),
    email: z.string(),
    hours: z.string().default(""),
    map_url: z.string().default(""),
  }),
  catalog: z.object({ allowed_categories: z.array(z.string()) }),
});

export async function GET() {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const [{ data, error }, { data: cats }, allowed] = await Promise.all([
      supabaseAdmin.from("web_settings").select("key, value"),
      supabaseAdmin.from("categories").select("name").eq("type", "category").order("name"),
      getAllowedMainCategories(),
    ]);
    if (error) throw error;
    const settings = Object.fromEntries((data || []).map((r: any) => [r.key, r.value]));
    return NextResponse.json({
      ...settings,
      catalog: { allowed_categories: allowed }, // includes the phase-1 default when not saved yet
      _mainCategories: [...new Set((cats || []).map((c: any) => c.name).filter(Boolean))],
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
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("web_settings").upsert(
      Object.entries(v).map(([key, value]) => ({ key, value, updated_at: now })),
    );
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
