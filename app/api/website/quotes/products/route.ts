import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWebsiteStaff } from "@/lib/web-auth";
import { getProducts } from "@/lib/shop-data";
import { saleRowsFor } from "@/lib/web-order-create";
import { apiError } from "@/lib/web-utils";

/**
 * Staff: search website products to add to a quotation.
 * Prices are for the customer's tier (?tier=normal|trade); cost is for margin.
 */
export async function GET(request: NextRequest) {
  const auth = await requireWebsiteStaff();
  if (auth.error) return auth.error;
  try {
    const sp = request.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim().slice(0, 80);
    const tier = sp.get("tier") === "trade" ? "trade" : "normal";
    if (q.length < 2) return NextResponse.json([]);
    const products = (await getProducts({ search: q, tier })).slice(0, 25);
    const sales = await saleRowsFor(products.map((p) => p.id));
    const mainIds = [...new Set([...sales.values()].map((s) => s.product_id))];
    const { data: mains } = mainIds.length
      ? await supabaseAdmin.from("products").select("id, cost_price, actual_cost_price").in("id", mainIds)
      : { data: [] as any[] };
    const cost = new Map((mains || []).map((m: any) => [m.id, Number(m.actual_cost_price || m.cost_price || 0)]));
    return NextResponse.json(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        image: p.image,
        brand: p.brand,
        mrp: p.mrp,
        price: p.price,
        available: p.available,
        cost: cost.get(sales.get(p.id)?.product_id || "") ?? 0,
      })),
    );
  } catch (e) {
    return apiError(e);
  }
}
