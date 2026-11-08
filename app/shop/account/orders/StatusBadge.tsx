import type { OrderStatus } from "@/lib/shop-orders";
import { STATUS_TEXT } from "@/lib/shop-orders";

const TONE: Record<OrderStatus, string> = {
  New: "bg-(--s-accent-soft) text-(--s-accent)",
  Confirmed: "bg-(--s-accent-soft) text-(--s-accent)",
  Packed: "bg-(--s-accent-soft) text-(--s-accent)",
  Dispatched: "bg-(--s-accent) text-(--s-accent-ink)",
  Delivered: "bg-(--s-good) text-white",
  Cancelled: "bg-(--s-soft) text-(--s-bad)",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[status]}`}>{STATUS_TEXT[status].label}</span>;
}
