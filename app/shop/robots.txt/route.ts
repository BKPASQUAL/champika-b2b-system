import { getShopUrl } from "@/lib/shop-data";

/** <shop domain>/robots.txt (each shop points to its own sitemap). */
export async function GET() {
  const SHOP_URL = await getShopUrl();
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /account",
    "Disallow: /login",
    "Disallow: /auth/",
    "Disallow: /search",
    "Disallow: /api/",
    "",
    `Sitemap: ${SHOP_URL}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
