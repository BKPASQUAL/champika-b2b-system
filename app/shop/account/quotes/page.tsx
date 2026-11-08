import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { getShopBase } from "@/lib/shop-data";
import { getMyQuotes, QUOTE_STATUS_TEXT } from "@/lib/shop-quotes";
import { ensureWebCustomer } from "@/lib/web-auth";
import { rs } from "../../_components/format";
import { btnPrimary, cardCls } from "../../_components/ui";

const TONE: Record<string, string> = {
  Requested: "bg-(--s-soft) text-(--s-ink-2)",
  Priced: "bg-(--s-soft) text-(--s-ink-2)",
  Sent: "bg-(--s-accent) text-(--s-accent-ink)",
  Accepted: "bg-(--s-good) text-white",
  Rejected: "bg-(--s-soft) text-(--s-muted)",
  Expired: "bg-(--s-soft) text-(--s-bad)",
};

export default async function MyQuotesPage() {
  const [base, c] = await Promise.all([getShopBase(), ensureWebCustomer()]);
  if (!c) return null;
  const quotes = await getMyQuotes(c.id);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">My quotations</h2>
        <Link href={`${base}/quote`} className="text-sm font-semibold text-(--s-accent) hover:underline">
          + Ask for a house quotation
        </Link>
      </div>
      {!quotes.length ? (
        <div className={`flex flex-col items-center px-6 py-16 text-center ${cardCls}`}>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-(--s-soft)">
            <ClipboardList className="h-6 w-6 text-(--s-muted)" />
          </span>
          <p className="mt-4 font-semibold">No quotations yet</p>
          <p className="mt-1 max-w-sm text-sm text-(--s-muted)">Wiring a house? Tell us the rooms and points and we'll send one complete price list.</p>
          <Link href={`${base}/quote`} className={`mt-5 ${btnPrimary}`}>
            Get a quotation
          </Link>
        </div>
      ) : (
        quotes.map((q) => (
          <Link key={q.no} href={`${base}/account/quotes/${q.no}`} className={`flex items-center gap-4 rounded-2xl p-4 transition hover:border-(--s-ink) ${cardCls}`}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-(--s-soft)">
              <ClipboardList className="h-5 w-5 text-(--s-ink-2)" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{q.no}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[q.status]}`}>{QUOTE_STATUS_TEXT[q.status].label}</span>
              </span>
              <span className="mt-0.5 block truncate text-sm text-(--s-muted)">
                {q.title} · {new Date(q.createdAt).toLocaleDateString("en-LK", { dateStyle: "medium" })}
              </span>
            </span>
            {q.total != null && <span className="font-bold">{rs(q.total)}</span>}
            <ChevronRight className="hidden h-5 w-5 text-(--s-muted) sm:block" />
          </Link>
        ))
      )}
    </div>
  );
}
