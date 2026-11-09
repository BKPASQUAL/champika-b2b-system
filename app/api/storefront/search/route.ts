import { NextRequest, NextResponse } from "next/server";
import { getProducts, sortProducts } from "@/lib/shop-data";

/**
 * Public: quick product search for the Quick Order page.
 * ?q=1/113 (search words) or ?c=<category id> (browse a category).
 * Only safe fields; prices for the visitor's tier.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim().slice(0, 80);
  const c = sp.get("c") || "";
  if (q.length < 2 && !/^[0-9a-f-]{36}$/i.test(c)) return NextResponse.json([]);
  try {
    const list = await getProducts(q.length >= 2 ? { search: q } : { categoryId: c });
    return NextResponse.json(
      sortProducts(list, "popular")
        .slice(0, 40)
        .map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          image: p.image,
          brand: p.brand,
          mrp: p.mrp,
          price: p.price,
          discountPct: p.discountPct,
          available: p.available,
        })),
    );
  } catch {
    return NextResponse.json({ error: "Search failed. Please try again." }, { status: 500 });
  }
}
