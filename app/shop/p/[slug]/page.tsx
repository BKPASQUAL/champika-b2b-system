import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MessageCircle, ShieldCheck, Truck, Wallet } from "lucide-react";
import { getProductBySlug, getRelatedProducts, getShopBase, getStoreInfo } from "@/lib/shop-data";
import { SHOP_URL } from "@/lib/shop-host";
import { Gallery } from "../../_components/Gallery";
import { Price } from "../../_components/Price";
import { ProductBuyBox } from "../../_components/AddToCart";
import { ProductGrid } from "../../_components/ProductCard";
import { whatsappLink } from "../../_components/format";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return { title: "Product not found" };
  const desc = p.shortDescription || `${p.name} — buy online at a discount price with fast delivery in the Galle area.`;
  return {
    title: p.name,
    description: desc.slice(0, 160),
    alternates: { canonical: `/p/${p.slug}` },
    openGraph: { title: p.name, description: desc.slice(0, 160), images: p.images.slice(0, 1) },
  };
}

export default async function ProductPage({ params }: Props) {
  const [{ slug }, base, store] = await Promise.all([params, getShopBase(), getStoreInfo()]);
  const p = await getProductBySlug(slug);
  if (!p) notFound();
  const related = await getRelatedProducts(p);
  const wa = whatsappLink(store.whatsapp, `Hi, I'm interested in: ${p.name}\n${SHOP_URL}/p/${p.slug}`);

  // Google product details (price, stock, brand) for search results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: p.images,
    description: p.shortDescription || p.description || undefined,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    offers: p.price
      ? {
          "@type": "Offer",
          url: `${SHOP_URL}/p/${p.slug}`,
          priceCurrency: "LKR",
          price: p.price,
          availability: p.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        }
      : undefined,
  };

  const crumbs = [
    p.category && { label: p.category.name, href: `${base}/c/${p.category.slug}` },
    p.subCategory && { label: p.subCategory.name, href: `${base}/c/${p.subCategory.slug}` },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="mx-auto max-w-[1800px] px-4 md:px-6 xl:px-10 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-(--s-muted)">
        <Link href={base || "/"} className="hover:text-(--s-ink)">Home</Link>
        {crumbs.map((c) => (
          <span key={c.href} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            <Link href={c.href} className="hover:text-(--s-ink)">{c.label}</Link>
          </span>
        ))}
      </nav>

      <div className="grid gap-8 md:grid-cols-[minmax(0,380px)_1fr] lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-12">
        <div className="mx-auto w-full max-w-[440px] md:mx-0 md:sticky md:top-24 md:self-start">
          <Gallery images={p.images} name={p.name} />
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {p.brandInfo && (
                <Link href={`${base}/b/${p.brandInfo.slug}`} className="text-sm font-semibold text-(--s-muted) hover:text-(--s-ink)">
                  {p.brandInfo.name}
                </Link>
              )}
              {p.subBrandInfo && (
                <Link href={`${base}/b/${p.subBrandInfo.slug}`} className="rounded-full bg-(--s-soft) px-2 py-0.5 text-xs font-medium text-(--s-ink-2) hover:underline">
                  {p.subBrandInfo.name}
                </Link>
              )}
            </div>
            <h1 className="mt-1 text-xl font-bold leading-snug text-(--s-ink) md:text-[26px]">{p.name}</h1>
            {p.shortDescription && <p className="mt-2 text-(--s-ink-2)">{p.shortDescription}</p>}
          </div>

          <div className="rounded-3xl border border-(--s-line) bg-(--s-surface) p-5">
            <Price price={p.price} mrp={p.mrp} discountPct={p.discountPct} size="lg" />
            {p.discountPct > 0 && p.mrp > p.price && (
              <p className="mt-1 text-sm font-medium text-(--s-good)">You save Rs {(p.mrp - p.price).toLocaleString("en-LK")}</p>
            )}
          </div>

          <ProductBuyBox id={p.id} name={p.name} available={p.available} />

          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-(--s-good) hover:underline">
              <MessageCircle className="h-4 w-4" /> Ask about this item on WhatsApp
            </a>
          )}

          <ul className="grid gap-2 border-t border-(--s-line) pt-4 text-sm text-(--s-ink-2) sm:grid-cols-3">
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-(--s-ink)" /> Genuine product</li>
            <li className="flex items-center gap-2"><Truck className="h-4 w-4 text-emerald-600" /> Galle area delivery</li>
            <li className="flex items-center gap-2"><Wallet className="h-4 w-4 text-(--s-ink)" /> Cash on delivery</li>
          </ul>
        </div>
      </div>

      {(p.specs.length > 0 || p.description) && (
        <div className="mt-14 grid gap-8 lg:grid-cols-5">
          {p.specs.length > 0 && (
            <section className="lg:col-span-2">
              <h2 className="mb-3 text-lg font-bold text-(--s-ink)">Specifications</h2>
              <table className="w-full overflow-hidden rounded-2xl border border-(--s-line) bg-(--s-surface) text-sm">
                <tbody>
                  {p.specs.map((s, i) => (
                    <tr key={i} className="border-b border-(--s-line) last:border-0">
                      <th className="w-2/5 bg-(--s-soft) px-4 py-2.5 text-left font-medium text-(--s-ink-2)">{s.label}</th>
                      <td className="px-4 py-2.5 text-(--s-ink)">{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {p.description && (
            <section className={p.specs.length ? "lg:col-span-3" : "lg:col-span-5"}>
              <h2 className="mb-3 text-lg font-bold text-(--s-ink)">Description</h2>
              <div className="rounded-2xl border border-(--s-line) bg-(--s-surface) p-6">
                <Description text={p.description} />
              </div>
            </section>
          )}
        </div>
      )}

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 text-xl font-bold text-(--s-ink) md:text-2xl">You may also need</h2>
          <ProductGrid products={related} base={base} wide />
        </section>
      )}
    </div>
  );
}

/** Plain text with paragraphs; lines starting with "*", "-" or "•" become a bullet list. */
function Description({ text }: { text: string }) {
  const blocks: { type: "p" | "ul"; lines: string[] }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ type: "p", lines: [] });
      continue;
    }
    const bullet = line.match(/^[*\-•]\s+(.*)$/);
    const type = bullet ? "ul" : "p";
    const last = blocks[blocks.length - 1];
    if (last && last.type === type && (type === "ul" || last.lines.length)) last.lines.push(bullet ? bullet[1] : line);
    else blocks.push({ type, lines: [bullet ? bullet[1] : line] });
  }
  return (
    <div className="space-y-3 text-sm leading-6 text-(--s-ink-2)">
      {blocks
        .filter((b) => b.lines.length)
        .map((b, i) =>
          b.type === "ul" ? (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.lines.map((l, j) => <li key={j}>{l}</li>)}
            </ul>
          ) : (
            <p key={i}>{b.lines.join(" ")}</p>
          ),
        )}
    </div>
  );
}
