import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { apiError } from "@/lib/web-utils";

/**
 * Reusable warranty presets (period + terms) for website products.
 * Stored as one list in web_settings (key "warranties"); picking a preset copies
 * its values onto the product, so editing a preset never changes saved products.
 */
const presetSchema = z.object({
  id: z.string().min(1),
  period: z.string().trim().min(1).max(60),
  terms: z.string().trim().max(2000).default(""),
});
const listSchema = z.object({ presets: z.array(presetSchema).max(100) });

export type WarrantyPreset = z.infer<typeof presetSchema>;

export async function GET() {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const { data, error } = await supabaseAdmin.from("web_settings").select("value").eq("key", "warranties").maybeSingle();
    if (error) throw error;
    const presets = Array.isArray(data?.value) ? data!.value : [];
    return NextResponse.json({ presets });
  } catch (e) {
    return apiError(e);
  }
}

/** Replace the whole preset list. */
export async function POST(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const { presets } = listSchema.parse(await request.json());
    const { error } = await supabaseAdmin
      .from("web_settings")
      .upsert({ key: "warranties", value: presets, updated_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ presets });
  } catch (e) {
    return apiError(e);
  }
}
