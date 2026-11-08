import { getAllProductSlugs, getBrands, getCategoryTree } from "@/lib/shop-data";
import { SHOP_URL } from "@/lib/shop-host";

export const dynamic = "force-dynamic";

/** bkwiringbadukade.lk/sitemap.xml — home, categories, brands and every published product. */
export async function GET() {
  const [tree, brands, products] = await Promise.all([getCategoryTree(), getBrands(), getAllProductSlugs()]);
  const urls: { loc: string; lastmod?: string; priority: string }[] = [{ loc: `${SHOP_URL}/`, priority: "1.0" }];
  for (const c of tree) {
    urls.push({ loc: `${SHOP_URL}/c/${c.slug}`, priority: "0.8" });
    for (const s of c.children) urls.push({ loc: `${SHOP_URL}/c/${s.slug}`, priority: "0.8" });
  }
  for (const b of brands) urls.push({ loc: `${SHOP_URL}/b/${b.slug}`, priority: "0.6" });
  for (const p of products) urls.push({ loc: `${SHOP_URL}/p/${p.slug}`, lastmod: p.updated_at?.slice(0, 10), priority: "0.7" });

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`)
      .join("\n") +
    `\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
