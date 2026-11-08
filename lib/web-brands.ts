import { supabaseAdmin } from "@/lib/supabase-admin";
import { slugify } from "@/lib/web-utils";

/** Slug for a brand: "acl", or "acl-fire-guard" for a sub brand. */
export function brandSlug(name: string, parentSlug?: string | null) {
  return parentSlug ? `${parentSlug}-${slugify(name)}` : slugify(name);
}

/**
 * Brand id for each name under one parent (null = top-level brand), creating
 * brands that don't exist yet. Matching is case-insensitive.
 */
export async function ensureBrands(names: string[], parentId: string | null = null): Promise<Map<string, string>> {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const result = new Map<string, string>();
  if (!wanted.length) return result;

  let q = supabaseAdmin.from("web_brands").select("id, name");
  q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
  const { data: existing } = await q;
  const byLower = new Map((existing || []).map((b: any) => [b.name.toLowerCase(), b.id as string]));

  const missing = wanted.filter((n) => !byLower.has(n.toLowerCase()));
  if (missing.length) {
    let parentSlug: string | null = null;
    if (parentId) {
      const { data: p } = await supabaseAdmin.from("web_brands").select("slug").eq("id", parentId).single();
      parentSlug = p?.slug ?? null;
    }
    const { data: created, error } = await supabaseAdmin
      .from("web_brands")
      .insert(missing.map((name) => ({ name, slug: brandSlug(name, parentSlug), parent_id: parentId })))
      .select("id, name");
    if (error) throw error;
    for (const b of created || []) byLower.set(b.name.toLowerCase(), b.id);
  }
  for (const n of wanted) result.set(n, byLower.get(n.toLowerCase())!);
  return result;
}

/** Supplier id for each name, creating suppliers that don't exist yet (case-insensitive). */
export async function ensureSuppliers(names: string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const result = new Map<string, string>();
  if (!wanted.length) return result;
  const { data: existing } = await supabaseAdmin.from("web_suppliers").select("id, name");
  const byLower = new Map((existing || []).map((s: any) => [s.name.toLowerCase(), s.id as string]));
  const missing = wanted.filter((n) => !byLower.has(n.toLowerCase()));
  if (missing.length) {
    const { data: created, error } = await supabaseAdmin
      .from("web_suppliers")
      .insert(missing.map((name) => ({ name })))
      .select("id, name");
    if (error) throw error;
    for (const s of created || []) byLower.set(s.name.toLowerCase(), s.id);
  }
  for (const n of wanted) result.set(n, byLower.get(n.toLowerCase())!);
  return result;
}
