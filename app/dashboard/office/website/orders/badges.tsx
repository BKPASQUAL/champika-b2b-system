const STATUS: Record<string, string> = {
  New: "bg-blue-100 text-blue-800",
  Confirmed: "bg-indigo-100 text-indigo-800",
  Packed: "bg-violet-100 text-violet-800",
  Dispatched: "bg-amber-100 text-amber-800",
  Delivered: "bg-green-100 text-green-800",
  Cancelled: "bg-gray-200 text-gray-600",
};
const STATUS_LABEL: Record<string, string> = { Dispatched: "On the way" };

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[status] || "bg-muted"}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function PaymentBadge({ method, status }: { method: string; status: string }) {
  const m = method === "COD" ? "Cash on delivery" : method === "BANK" ? "Bank transfer" : "Card";
  const s =
    status === "verified"
      ? { t: "Paid", c: "text-green-700" }
      : status === "slip_uploaded"
        ? { t: "Slip to check", c: "text-amber-700 font-semibold" }
        : status === "failed"
          ? { t: "Slip rejected", c: "text-red-600" }
          : { t: method === "COD" ? "Pay on delivery" : "Waiting for slip", c: "text-muted-foreground" };
  return (
    <div className="leading-tight">
      <div className="text-sm">{m}</div>
      <div className={`text-xs ${s.c}`}>{s.t}</div>
    </div>
  );
}
