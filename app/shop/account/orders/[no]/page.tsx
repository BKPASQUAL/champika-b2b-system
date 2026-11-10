import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Check, ChevronLeft, CircleCheckBig, ImageOff, MapPin, MessageCircle, Phone } from "lucide-react";
import { getBankInfo, getShopBase, getStoreInfo } from "@/lib/shop-data";
import { getMyOrder, PAYMENT_TEXT, STATUS_TEXT, type OrderStatus } from "@/lib/shop-orders";
import { formatAddress } from "@/lib/shop-address";
import { ensureWebCustomer } from "@/lib/web-auth";
import { rs, whatsappLink } from "../../../_components/format";
import { cardCls } from "../../../_components/ui";
import { StatusBadge } from "../StatusBadge";
import { SlipUpload } from "./SlipUpload";
import { OrderAgain } from "./OrderAgain";

type Props = { params: Promise<{ no: string }>; searchParams: Promise<{ placed?: string }> };

const STEPS: OrderStatus[] = ["New", "Confirmed", "Packed", "Dispatched", "Delivered"];

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ no }, sp, base, c, bank, store] = await Promise.all([params, searchParams, getShopBase(), ensureWebCustomer(), getBankInfo(), getStoreInfo()]);
  if (!c) return null;
  const o = await getMyOrder(c.id, decodeURIComponent(no));
  if (!o) notFound();

  const stepIndex = STEPS.indexOf(o.status);
  const cancelled = o.status === "Cancelled";
  const showBank = o.paymentMethod === "BANK" && !cancelled && o.paymentStatus !== "verified";
  const wa = whatsappLink(store.whatsapp, `Hi, about my order ${o.no}`);

  return (
    <div className="space-y-5">
      <Link href={`${base}/account/orders`} className="inline-flex items-center gap-1 text-sm text-(--s-muted) hover:text-(--s-ink)">
        <ChevronLeft className="h-4 w-4" /> My orders
      </Link>

      {sp.placed && (
        <div className="flex items-start gap-3 rounded-2xl border border-(--s-good) p-4">
          <CircleCheckBig className="mt-0.5 h-6 w-6 shrink-0 text-(--s-good)" />
          <div>
            <p className="font-semibold">Thank you! Your order {o.no} is placed.</p>
            <p className="text-sm text-(--s-ink-2)">
              {o.paymentMethod === "BANK"
                ? "Please transfer the total to our bank account below and upload the slip. We'll confirm once it's checked."
                : "We will call you soon to confirm. Please keep the cash ready on delivery."}
            </p>
          </div>
        </div>
      )}

      {/* Header + timeline */}
      <section className={`p-5 sm:p-6 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
              Order {o.no} <StatusBadge status={o.status} />
            </h2>
            <p className="text-sm text-(--s-muted)">
              Placed on {new Date(o.createdAt).toLocaleString("en-LK", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{rs(o.total)}</div>
            <div className="text-xs text-(--s-muted)">
              {o.paymentMethod === "COD" ? "Cash on delivery" : "Bank transfer"} · {o.paymentMethod === "COD" && o.paymentStatus === "pending" ? "Pay on delivery" : PAYMENT_TEXT[o.paymentStatus]}
            </div>
          </div>
        </div>
        {!sp.placed && (
          <div className="mt-4">
            <OrderAgain items={o.items.filter((i) => i.id).map((i) => ({ id: i.id!, qty: i.qty }))} />
          </div>
        )}

        {cancelled ? (
          <p className="mt-5 rounded-xl bg-(--s-soft) px-4 py-3 text-sm text-(--s-ink-2)">{STATUS_TEXT.Cancelled.text}</p>
        ) : (
          <>
            <ol className="mt-6 grid grid-cols-5 gap-1">
              {STEPS.map((s, i) => {
                const done = i <= stepIndex;
                return (
                  <li key={s} className="flex flex-col items-center text-center">
                    <div className="flex w-full items-center">
                      <span className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : done ? "bg-(--s-accent)" : "bg-(--s-line)"}`} />
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                          done ? "border-(--s-accent) bg-(--s-accent) text-(--s-accent-ink)" : "border-(--s-line) bg-(--s-surface)"
                        }`}
                      >
                        {done && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? "opacity-0" : i < stepIndex ? "bg-(--s-accent)" : "bg-(--s-line)"}`} />
                    </div>
                    <span className={`mt-2 text-[12.5px] leading-tight sm:text-xs ${done ? "font-semibold" : "text-(--s-muted)"}`}>{STATUS_TEXT[s].label}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-sm text-(--s-ink-2)">{STATUS_TEXT[o.status].text}</p>
          </>
        )}
      </section>

      {/* Bank transfer */}
      {showBank && (
        <section className={`p-5 sm:p-6 ${cardCls}`}>
          <h3 className="flex items-center gap-2 font-bold">
            <Building2 className="h-5 w-5" /> Pay by bank transfer
          </h3>
          {bank.bank && bank.accountNo ? (
            <dl className="mt-4 grid gap-x-6 gap-y-2 rounded-2xl bg-(--s-soft) p-4 text-sm sm:grid-cols-2">
              <BankRow label="Bank" value={bank.bank} />
              {bank.branch && <BankRow label="Branch" value={bank.branch} />}
              {bank.accountName && <BankRow label="Account name" value={bank.accountName} />}
              <BankRow label="Account number" value={bank.accountNo} strong />
              <BankRow label="Amount" value={rs(o.total)} strong />
              <BankRow label="Reference" value={o.no} strong />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-(--s-ink-2)">We will send you our bank details by phone or WhatsApp.</p>
          )}
          <div className="mt-5">
            <SlipUpload orderNo={o.no} hasSlip={o.hasSlip} />
          </div>
        </section>
      )}

      {/* Advance for special-order items (asked by the office after talking to the customer) */}
      {!cancelled && o.advance.status !== "none" && o.advance.amount > 0 && (
        <section className={`p-5 sm:p-6 ${cardCls} ${o.advance.status === "paid" ? "" : "border-2 border-amber-500/50"}`}>
          <h3 className="flex items-center gap-2 font-bold">
            <Building2 className="h-5 w-5" /> Advance payment: {rs(o.advance.amount)}
          </h3>
          {o.advance.status === "paid" ? (
            <p className="mt-2 flex items-center gap-2 font-semibold text-(--s-good)">
              <Check className="h-4 w-4" /> Advance received. Thank you!
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-(--s-ink-2)">
                Please pay an advance of <b>{rs(o.advance.amount)}</b> so we can order your items.
                {o.advance.note ? ` ${o.advance.note}` : ""}
              </p>
              {bank.bank && bank.accountNo ? (
                <dl className="mt-4 grid gap-x-6 gap-y-2 rounded-2xl bg-(--s-soft) p-4 text-sm sm:grid-cols-2">
                  <BankRow label="Bank" value={bank.bank} />
                  {bank.branch && <BankRow label="Branch" value={bank.branch} />}
                  {bank.accountName && <BankRow label="Account name" value={bank.accountName} />}
                  <BankRow label="Account number" value={bank.accountNo} strong />
                  <BankRow label="Amount" value={rs(o.advance.amount)} strong />
                  <BankRow label="Reference" value={o.no} strong />
                </dl>
              ) : (
                <p className="mt-3 text-sm text-(--s-ink-2)">We will send you our bank details by phone or WhatsApp.</p>
              )}
              <p className="mt-2 text-sm text-(--s-muted)">Or pay at our shop.</p>
              <div className="mt-4">
                <SlipUpload orderNo={o.no} hasSlip={o.advance.status === "slip_uploaded"} advance />
              </div>
            </>
          )}
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        {/* Items */}
        <section className={`p-5 sm:p-6 ${cardCls}`}>
          <h3 className="font-bold">Items ({o.itemCount})</h3>
          <ul className="mt-4 divide-y divide-(--s-line)">
            {o.items.map((i, idx) => (
              <li key={idx} className="flex items-center gap-3 py-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-(--s-img)">
                  {i.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.image} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <ImageOff className="h-5 w-5 text-(--s-muted)" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  {i.slug ? (
                    <Link href={`${base}/p/${i.slug}`} className="line-clamp-2 text-sm font-medium hover:underline">
                      {i.name}
                    </Link>
                  ) : (
                    <span className="line-clamp-2 text-sm font-medium">{i.name}</span>
                  )}
                  <span className="text-xs text-(--s-muted)">
                    {i.qty} × {rs(i.unitPrice)}
                  </span>
                </span>
                <span className="font-semibold">{rs(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-2 border-t border-(--s-line) pt-4 text-sm">
            <Row label="Subtotal" value={rs(o.subtotal)} />
            {o.discount > 0 && <Row label="Discount" value={`− ${rs(o.discount)}`} />}
            <Row label="Delivery" value={o.deliveryFee ? rs(o.deliveryFee) : "Free"} />
            <div className="flex justify-between border-t border-(--s-line) pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{rs(o.total)}</dd>
            </div>
          </dl>
        </section>

        {/* Delivery + help */}
        <aside className="space-y-5">
          <section className={`p-5 ${cardCls}`}>
            <h3 className="font-bold">Delivery</h3>
            <p className="mt-3 text-sm font-medium">{o.deliveryName}</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-(--s-ink-2)">
              <Phone className="h-3.5 w-3.5" /> {o.deliveryPhone}
            </p>
            <p className="mt-1 flex items-start gap-2 text-sm text-(--s-ink-2)">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {formatAddress(o.deliveryAddress)}
            </p>
            {o.note && <p className="mt-3 rounded-xl bg-(--s-soft) px-3 py-2 text-sm text-(--s-ink-2)">“{o.note}”</p>}
          </section>
          {(wa || store.phone) && (
            <section className={`p-5 ${cardCls}`}>
              <h3 className="font-bold">Need help?</h3>
              <p className="mt-1 text-sm text-(--s-muted)">Tell us your order number {o.no}.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-(--s-soft) px-4 py-2 text-sm font-medium hover:bg-(--s-line)">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                )}
                {store.phone && (
                  <a href={`tel:${store.phone}`} className="inline-flex items-center gap-1.5 rounded-full bg-(--s-soft) px-4 py-2 text-sm font-medium hover:bg-(--s-line)">
                    <Phone className="h-4 w-4" /> Call
                  </a>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-(--s-ink-2)">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function BankRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 sm:block">
      <dt className="text-(--s-muted)">{label}</dt>
      <dd className={strong ? "font-bold" : "font-medium"}>{value}</dd>
    </div>
  );
}
