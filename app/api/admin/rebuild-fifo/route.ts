import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { rebuildFifoCosts } from "@/lib/fifo-rebuild";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/rebuild-fifo
 * Body: { productIds?: string[], skus?: string[], dryRun?: boolean (default true) }
 * No productIds/skus → every product.
 *
 * Replays purchases and sales in date order (FIFO) and fixes invoice line costs
 * that were saved before their purchase bill was entered. Run with dryRun first.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false;

    let ids: string[] = Array.isArray(body.productIds) ? body.productIds : [];
    if (Array.isArray(body.skus) && body.skus.length) {
      const { data, error } = await supabaseAdmin.from("products").select("id").in("sku", body.skus);
      if (error) throw error;
      ids.push(...(data || []).map((p: any) => p.id));
    }
    if (ids.length === 0) {
      let start = 0;
      while (true) {
        const { data, error } = await supabaseAdmin.from("products").select("id").order("id").range(start, start + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        ids.push(...data.map((p: any) => p.id));
        if (data.length < 1000) break;
        start += 1000;
      }
    }

    const result = await rebuildFifoCosts(ids, { dryRun });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("rebuild-fifo error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
