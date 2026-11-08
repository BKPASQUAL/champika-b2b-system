import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CircleCheckBig, ImageOff } from "lucide-react";
import { getShopBase } from "@/lib/shop-data";
import { getMyQuote, QUOTE_STATUS_TEXT } from "@/lib/shop-quotes";
import { ensureWebCustomer } from "@/lib/web-auth";
import { rs } from "../../../_components/format";
import { cardCls } from "../../../_components/ui";
import { QuoteActions } from "./QuoteActions";

type Props = { params: Promise<{ no: string }>; searchParams: Promise<{ sent?: string }> };

const POINT_LABEL: Record<string, string> = {
  lights: "Light points",
  switches: "Switches",
  sockets: "Plug sockets",
  fans: "Fans",
  ac: "A/C units",
  waterHeater: "Water heaters",
  outdoorLights: "Outdoor lights",
  gate: "Gate motor / bell",
  floors: "Floors",
};

export default async function QuotePage({ params, searchParams }: Props) {
  const [{ no }, sp, base, c] = await Promise.all([params, searchParams, getShopBase(), ensureWebCustomer()]);
  if (!c) return null;
  const q = await getMyQuote(c.id, decodeURIComponent(no));
  if (!q) notFound();
  const a = (c.default_address || {}) as Record<string, string>;

  return (
    <div className="space-y-5">
      <Link href={`${base}/account/quotes`} className="inline-flex items-center gap-1 text-sm text-(--s-muted) hover:text-(--s-ink)">
        <ChevronLeft className="h-4 w-4" /> My quotations
      </Link>

      {sp.sent && (
        <div className="flex items-start gap-3 rounded-2xl border border-(--s-good) p-4">
          <CircleCheckBig className="mt-0.5 h-6 w-6 shrink-0 text-(--s-good)" />
          <div>
            <p className="font-semibold">Request {q.no} sent!</p>
            <p className="text-sm text-(--s-ink-2)">We'll prepare your price list and you'll see it here. We may call you to check details.</p>
          </div>
        </div>
      )}

      <section className={`p-5 sm:p-6 ${cardCls}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Quotation {q.no}</h2>
            <p className="text-sm text-(--s-muted)">
              Requested {new Date(q.createdAt).toLocaleDateString("en-LK", { dateStyle: "medium" })}
              {q.status === "Sent" && q.validUntil && ` · valid until ${new Date(q.validUntil).toLocaleDateString("en-LK", { dateStyle: "medium" })}`}
            </p>
          </div>
          {q.total != null && <div className="text-2xl font-bold">{rs(q.total)}</div>}
        </div>
        <p className="mt-3 rounded-xl bg-(--s-soft) px-4 py-3 text-sm text-(--s-ink-2)">{QUOTE_STATUS_TEXT[q.status].text}</p>
        {q.orderNo && (
          <Link href={`${base}/account/orders/${q.orderNo}`} className="mt-3 inline-block text-sm font-semibold text-(--s-accent) hover:underline">
            View order {q.orderNo} →
          </Link>
        )}
      </section>

      {q.type === "job" && (
        <section className={`p-5 sm:p-6 ${cardCls}`}>
          <h3 className="font-bold">Your job details</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {q.houseType && <Info label="Job" value={q.houseType} />}
            {q.rooms != null && <Info label="Rooms" value={String(q.rooms)} />}
            {Object.entries(q.points)
              .filter(([, v]) => Number(v) > 0)
              .map(([k, v]) => (
                <Info key={k} label={POINT_LABEL[k] || k} value={String(v)} />
              ))}
          </dl>
          {q.customerNote && <p className="mt-3 text-sm text-(--s-ink-2)">“{q.customerNote}”</p>}
          {q.hasPlans && <p className="mt-2 text-xs text-(--s-muted)">Plan / photos attached.</p>}
        </section>
      )}

      {q.items.length > 0 && (
        <section className={`p-5 sm:p-6 ${cardCls}`}>
          <h3 className="font-bold">Items ({q.items.length})</h3>
          {q.total == null && <p className="text-sm text-(--s-muted)">Prices will show once your quotation is ready.</p>}
          <ul className="mt-3 divide-y divide-(--s-line)">
            {q.items.map((i, idx) => (
              <li key={idx} className="flex items-center gap-3 py-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-(--s-img)">
                  {i.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.image} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <ImageOff className="h-4 w-4 text-(--s-muted)" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-medium">{i.name}</span>
                  <span className="text-xs text-(--s-muted)">
                    Qty {i.qty}
                    {i.price != null && ` × ${rs(i.price)}`}
                    {i.mrp != null && i.price != null && i.mrp > i.price && <span className="ml-1 line-through">{rs(i.mrp)}</span>}
                  </span>
                </span>
                {i.lineTotal != null && <span className="font-semibold">{rs(i.lineTotal)}</span>}
              </li>
            ))}
          </ul>
          {q.total != null && (
            <dl className="mt-2 space-y-1.5 border-t border-(--s-line) pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-(--s-ink-2)">Subtotal</dt>
                <dd>{rs(q.subtotal)}</dd>
              </div>
              {!!q.discount && (
                <div className="flex justify-between text-(--s-good)">
                  <dt>Special discount</dt>
                  <dd>− {rs(q.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-(--s-line) pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd>{rs(q.total)}</dd>
              </div>
            </dl>
          )}
        </section>
      )}

      {(q.status === "Sent" || q.status === "Requested" || q.status === "Priced") && (
        <QuoteActions
          no={q.no}
          canAccept={q.status === "Sent"}
          defaults={{ name: c.full_name || "", phone: c.phone || "", line1: a.line1 || "", line2: a.line2 || "", city: a.city || "", district: a.district || "" }}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-(--s-muted)">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
