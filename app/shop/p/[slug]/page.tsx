import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, ChevronRight, MessageCircle, ShieldCheck, Truck, Wallet } from "lucide-react";
import { getProductBySlug, getRelatedProducts, getShopBase, getStoreInfo } from "@/lib/shop-data";
import { brandLabelFor, getAlternatives } from "@/lib/web-compare";
import { SHOP_URL } from "@/lib/shop-host";
import { Gallery } from "../../_components/Gallery";
import { AddToCartButton, ProductBuyBox } from "../../_components/AddToCart";
import { ProductGrid } from "../../_components/ProductCard";
import { rs, whatsappLink } from "../../_components/format";

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
  const [related, others, myBrand] = await Promise.all([
    getRelatedProducts(p),
    getAlternatives([p.id]).then((r) => r[p.id] || []).catch(() => []),
    brandLabelFor(p).catch(() => p.brand || ""),
  ]);
  // This item + the same item from other brands, cheapest first.
  const compare = others.length
    ? [{ ...p, brand: myBrand, isThis: true }, ...others.map((o) => ({ ...o, isThis: false }))].sort((a, b) => a.price - b.price)
    : [];
  const cheapestId = compare.filter((c) => c.available)[0]?.id;
  const wa = whatsappLink(store.whatsapp, `Hi, I'm interested in: ${p.name}\n${SHOP_URL}/p/${p.slug}`);
  const off = p.discountPct > 0 && p.mrp > p.price;

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

  // Specifications entered by the office; otherwise the basics we already know.
  const specs = p.specs.length
    ? p.specs
    : ([
        p.brandInfo && { label: "Brand", value: p.subBrandInfo ? `${p.brandInfo.name} · ${p.subBrandInfo.name}` : p.brandInfo.name },
        p.subCategory && { label: "Category", value: p.subCategory.name },
        p.family && { label: "Type", value: p.family.name },
      ].filter(Boolean) as { label: string; value: string }[]);

  const trust = [
    { icon: ShieldCheck, title: "Genuine product", text: "Original stock from authorised dealers" },
    { icon: Truck, title: "Galle area delivery", text: "Fast doorstep delivery across Galle & suburbs" },
    { icon: Wallet, title: "Cash on delivery", text: "Or pay by bank transfer" },
  ];

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6 md:px-6 md:py-8 xl:px-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav className="mb-5 flex flex-wrap items-center gap-1 text-xs text-(--s-muted)">
        <Link href={base || "/"} className="hover:text-(--s-ink)">
          Home
        </Link>
        {crumbs.map((c) => (
          <span key={c.href} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            <Link href={c.href} className="hover:text-(--s-ink)">
              {c.label}
            </Link>
          </span>
        ))}
        <ChevronRight className="h-3 w-3" />
        <span className="max-w-60 truncate text-(--s-ink-2)">{p.name}</span>
      </nav>

      {/* Photo + buying panel */}
      <section className="grid gap-6 rounded-3xl border border-(--s-line) bg-(--s-surface) p-4 shadow-[0_8px_30px_-14px_rgba(15,23,42,0.10)] sm:p-6 md:grid-cols-2 lg:gap-12 lg:p-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="md:sticky md:top-24 md:self-start">
          <Gallery images={p.images} name={p.name} />
        </div>

        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            {p.brandInfo && (
              <Link
                href={`${base}/b/${p.brandInfo.slug}`}
                className="rounded-md bg-(--s-accent-soft) px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-(--s-accent) transition hover:bg-(--s-accent) hover:text-(--s-accent-ink)"
              >
                {p.brandInfo.name}
              </Link>
            )}
            {p.subBrandInfo && (
              <Link href={`${base}/b/${p.subBrandInfo.slug}`} className="rounded-md bg-(--s-soft) px-2.5 py-1 text-[11px] font-semibold text-(--s-ink-2) hover:underline">
                {p.subBrandInfo.name}
              </Link>
            )}
            {p.subCategory && (
              <Link href={`${base}/c/${p.subCategory.slug}`} className="text-xs text-(--s-muted) hover:text-(--s-ink)">
                in {p.subCategory.name}
              </Link>
            )}
          </div>

          <h1 className="mt-3 text-xl font-bold leading-snug text-(--s-ink) md:text-2xl xl:text-[28px]">{p.name}</h1>
          {p.shortDescription && <p className="mt-3 max-w-3xl text-sm leading-6 text-(--s-ink-2) xl:text-[15px]">{p.shortDescription}</p>}

          {/* Price */}
          <div className="mt-5 border-t border-(--s-line) pt-5">
            {p.price ? (
              <>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-3xl font-bold tracking-tight text-(--s-ink)">{rs(p.price)}</span>
                  {off && <span className="text-base text-(--s-muted) line-through">{rs(p.mrp)}</span>}
                  {off && <span className="rounded-md bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">{p.discountPct}% OFF</span>}
                </div>
                {off && <p className="mt-1 text-sm font-medium text-emerald-600">You save {rs(p.mrp - p.price)}</p>}
                <p className="mt-1 text-xs text-(--s-muted)">Price includes all taxes.</p>
              </>
            ) : (
              <p className="text-lg font-semibold text-(--s-muted)">Ask us for the price</p>
            )}
          </div>

          <div className="mt-5">
            <ProductBuyBox id={p.id} name={p.name} available={p.available} />
          </div>

          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex w-fit items-center gap-2 rounded-full px-1 py-1 text-sm font-semibold text-emerald-600 hover:underline"
            >
              <MessageCircle className="h-4 w-4" /> Ask about this item on WhatsApp
            </a>
          )}

          {/* Why buy here */}
          <ul className="mt-6 grid divide-y divide-(--s-line) rounded-2xl border border-(--s-line) bg-(--s-bg) 2xl:grid-cols-3 2xl:divide-x 2xl:divide-y-0">
            {trust.map((t) => (
              <li key={t.title} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--s-surface) text-(--s-accent) ring-1 ring-(--s-line)">
                  <t.icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-(--s-ink)">{t.title}</span>
                  <span className="block text-xs text-(--s-muted)">{t.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Same item, other brands */}
      {compare.length > 0 && (
        <section className="mt-8 overflow-hidden rounded-2xl border border-(--s-line) bg-(--s-surface)">
          <div className="flex flex-wrap items-center gap-2 px-5 pt-5 sm:px-6">
            <ArrowLeftRight className="h-5 w-5 text-(--s-accent)" />
            <h2 className="text-lg font-bold text-(--s-ink)">Compare with other brands</h2>
            <span className="text-sm text-(--s-muted)">Same item · {compare.length} brands</span>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-y border-(--s-line) bg-(--s-soft) text-left text-xs text-(--s-muted)">
                  <th className="px-5 py-2.5 font-semibold sm:px-6">Brand</th>
                  <th className="px-3 py-2.5 font-semibold">Item</th>
                  <th className="px-3 py-2.5 text-right font-semibold">MRP</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Our price</th>
                  <th className="w-40 px-5 py-2.5 sm:px-6" />
                </tr>
              </thead>
              <tbody>
                {compare.map((c) => (
                  <tr key={c.id} className={`border-b border-(--s-line) last:border-0 ${c.isThis ? "bg-(--s-accent-soft)" : ""}`}>
                    <td className="px-5 py-3 font-bold sm:px-6">
                      {c.brand}
                      {c.id === cheapestId && (
                        <span className="ml-2 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white">Lowest price</span>
                      )}
                    </td>
                    <td className="max-w-[340px] px-3 py-3">
                      {c.isThis ? (
                        <span className="line-clamp-1 text-(--s-ink-2)">
                          {c.name} <span className="font-semibold text-(--s-accent)">· This item</span>
                        </span>
                      ) : (
                        <Link href={`${base}/p/${c.slug}`} className="line-clamp-1 text-(--s-ink-2) hover:underline">
                          {c.name}
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-(--s-muted)">{c.mrp > c.price ? <span className="line-through">{rs(c.mrp)}</span> : "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-bold text-(--s-ink)">{rs(c.price)}</span>
                      {!c.isThis && c.price !== p.price && (
                        <span className={`block text-[11px] font-semibold ${c.price < p.price ? "text-emerald-600 dark:text-emerald-400" : "text-(--s-muted)"}`}>
                          {c.price < p.price ? `${rs(p.price - c.price)} less` : `${rs(c.price - p.price)} more`}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 sm:px-6">
                      <AddToCartButton id={c.id} name={c.name} available={c.available} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Details */}
      {(p.description || specs.length > 0) && (
        <section className={`mt-8 grid gap-6 ${p.description && specs.length ? "lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_440px]" : ""}`}>
          {p.description && (
            <div className="rounded-3xl border border-(--s-line) bg-(--s-surface) p-5 sm:p-7">
              <h2 className="text-lg font-bold text-(--s-ink)">Description</h2>
              <div className="mt-4 max-w-5xl">
                <Description text={p.description} />
              </div>
            </div>
          )}
          {specs.length > 0 && (
            <div className="h-fit overflow-hidden rounded-3xl border border-(--s-line) bg-(--s-surface)">
              <h2 className="px-5 pt-5 text-lg font-bold text-(--s-ink) sm:px-6">Specifications</h2>
              <dl className="mt-3 divide-y divide-(--s-line) border-t border-(--s-line) text-sm">
                {specs.map((s, i) => (
                  <div key={i} className="grid grid-cols-[40%_1fr] gap-3 px-5 py-3 sm:px-6">
                    <dt className="text-(--s-muted)">{s.label}</dt>
                    <dd className="font-medium text-(--s-ink)">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-xl font-bold text-(--s-ink)">You may also need</h2>
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
    <div className="space-y-3 text-[15px] leading-7 text-(--s-ink-2)">
      {blocks
        .filter((b) => b.lines.length)
        .map((b, i) =>
          b.type === "ul" ? (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-(--s-accent)">
              {b.lines.map((l, j) => (
                <li key={j}>{l}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{b.lines.join(" ")}</p>
          ),
        )}
    </div>
  );
}
