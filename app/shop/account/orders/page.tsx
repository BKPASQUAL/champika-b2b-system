import Link from "next/link";
import { ChevronRight, ImageOff, Package } from "lucide-react";
import { getShopBase } from "@/lib/shop-data";
import { getMyOrders, STATUS_TEXT } from "@/lib/shop-orders";
import { ensureWebCustomer } from "@/lib/web-auth";
import { rs } from "../../_components/format";
import { StatusBadge } from "./StatusBadge";
import { btnPrimary, cardCls } from "../../_components/ui";

export default async function MyOrdersPage() {
  const [base, c] = await Promise.all([getShopBase(), ensureWebCustomer()]);
  if (!c) return null;
  const orders = await getMyOrders(c.id);

  if (!orders.length)
    return (
      <div className={`flex flex-col items-center px-6 py-16 text-center ${cardCls}`}>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-(--s-soft)">
          <Package className="h-6 w-6 text-(--s-muted)" />
        </span>
        <p className="mt-4 font-semibold">No orders yet</p>
        <p className="mt-1 text-sm text-(--s-muted)">When you place an order, you can follow it here.</p>
        <Link href={`${base}/products`} className={`mt-5 ${btnPrimary}`}>
          Start shopping
        </Link>
      </div>
    );

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">My orders</h2>
      {orders.map((o) => (
        <Link
          key={o.no}
          href={`${base}/account/orders/${o.no}`}
          className={`flex items-center gap-4 p-4 transition hover:border-(--s-ink) ${cardCls} rounded-2xl`}
        >
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-(--s-img)">
            {o.firstImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={o.firstImage} alt="" className="h-full w-full object-contain p-1" />
            ) : (
              <ImageOff className="h-5 w-5 text-(--s-muted)" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{o.no}</span>
              <StatusBadge status={o.status} />
            </span>
            <span className="mt-0.5 block text-sm text-(--s-muted)">
              {new Date(o.createdAt).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" })} · {o.itemCount}{" "}
              {o.itemCount === 1 ? "item" : "items"} · {STATUS_TEXT[o.status].label}
            </span>
          </span>
          <span className="text-right">
            <span className="block font-bold">{rs(o.total)}</span>
            <span className="text-xs text-(--s-muted)">{o.paymentMethod === "COD" ? "Cash on delivery" : "Bank transfer"}</span>
          </span>
          <ChevronRight className="hidden h-5 w-5 text-(--s-muted) sm:block" />
        </Link>
      ))}
    </div>
  );
}
