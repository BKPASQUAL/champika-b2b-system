import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { withSite, type WebSite } from "@/lib/web-site";
import { apiError } from "@/lib/web-utils";

/**
 * Warranty types for website products (e.g. "Orange Akoya – 5 years").
 * Stored as one list in web_settings (key "warranties"). Picking one copies its
 * period + terms onto the product. When a warranty type is edited here, every
 * product still carrying its old period + terms is updated to the new values.
 */
const presetSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().max(80).default(""),
  period: z.string().trim().min(1).max(60),
  /** Brand or sub brand (model range) this warranty belongs to; null = any brand. */
  brandId: z.string().nullish().transform((v) => v || null),
  terms: z.string().trim().max(2000).default(""),
});
const listSchema = z.object({ presets: z.array(presetSchema).max(200) });

export type WarrantyPreset = z.infer<typeof presetSchema>;

async function readPresets(site: WebSite): Promise<WarrantyPreset[]> {
  const { data, error } = await supabaseAdmin.from("web_settings").select("value").eq("site", site).eq("key", "warranties").maybeSingle();
  if (error) throw error;
  const raw = Array.isArray(data?.value) ? (data!.value as unknown[]) : [];
  return raw.map((p) => presetSchema.safeParse(p)).filter((r) => r.success).map((r) => r.data!);
}

export async function GET() {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  const site = auth.site;
  try {
    const presets = await readPresets(site);
    // How many products use each warranty (same period + terms).
    const { data: rows } = await supabaseAdmin
      .from("web_products")
      .select("warranty_period, warranty_terms").eq("site", site)
      .not("warranty_period", "is", null);
    const key = (period: string, terms: string | null) => `${period.trim().toLowerCase()}\u0000${(terms || "").trim()}`;
    const counts = new Map<string, number>();
    for (const r of (rows || []) as { warranty_period: string; warranty_terms: string | null }[]) {
      const k = key(r.warranty_period, r.warranty_terms);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return NextResponse.json({
      presets: presets.map((p) => ({ ...p, productCount: counts.get(key(p.period, p.terms)) || 0 })),
    });
  } catch (e) {
    return apiError(e);
  }
}

/** Replace the whole list; products using an edited warranty get the new period + terms. */
export async function POST(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  const site = auth.site;
  try {
    const { presets } = listSchema.parse(await request.json());
    const before = await readPresets(site);

    const { error } = await supabaseAdmin
      .from("web_settings")
      .upsert(withSite({ key: "warranties", value: presets, updated_at: new Date().toISOString() }, site));
    if (error) throw error;

    let productsUpdated = 0;
    for (const next of presets) {
      const old = before.find((b) => b.id === next.id);
      if (!old || (old.period === next.period && old.terms === next.terms)) continue;
      let q = supabaseAdmin
        .from("web_products")
        .update({ warranty_period: next.period, warranty_terms: next.terms || null }).eq("site", site)
        .eq("warranty_period", old.period);
      q = old.terms ? q.eq("warranty_terms", old.terms) : q.is("warranty_terms", null);
      const { data, error: upErr } = await q.select("id");
      if (upErr) throw upErr;
      productsUpdated += data?.length || 0;
    }

    return NextResponse.json({ presets, productsUpdated });
  } catch (e) {
    return apiError(e);
  }
}
