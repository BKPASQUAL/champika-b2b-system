import { SHOP_URL } from "@/lib/shop-host";

/** bkwiringbadukade.lk/robots.txt */
export function GET() {
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
