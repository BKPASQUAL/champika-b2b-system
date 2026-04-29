// components/ui/layout/NotificationBell.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Banknote, ArrowUpCircle, Clock, CheckCircle2, X, BellRing, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface NotificationItem {
  id: string;
  type: "customer_deposit" | "supplier_due";
  title: string;
  subtitle: string;
  amount: number;
  daysInfo: string;
  isOverdue: boolean;
  route: string;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
  }).format(n);

export function NotificationBell({
  businessId,
  chequeRoute,
  supplierPaymentsRoute,
}: {
  businessId: string;
  chequeRoute: string;
  supplierPaymentsRoute: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { status: pushStatus, subscribe, unsubscribe } = usePushNotifications(businessId);

  const today = new Date().toISOString().split("T")[0];

  const fetchNotifications = useCallback(async () => {
    if (!businessId) return;
    try {
      const [custRes, suppRes] = await Promise.all([
        fetch(`/api/payments?businessId=${businessId}`),
        fetch(`/api/suppliers/payments?businessId=${businessId}`),
      ]);

      const items: NotificationItem[] = [];

      // ── Customer cheques pending deposit whose date has arrived ──
      if (custRes.ok) {
        const payments: any[] = await custRes.json();

        // Group by cheque_number to avoid duplicate notifications
        const chequeMap = new Map<string, any[]>();
        for (const p of payments) {
          if (
            p.payment_method === "cheque" &&
            p.cheque_status === "Pending" &&
            p.cheque_date &&
            p.cheque_date <= today
          ) {
            const key = p.cheque_number || p.id;
            if (!chequeMap.has(key)) chequeMap.set(key, []);
            chequeMap.get(key)!.push(p);
          }
        }

        for (const [chequeNo, group] of chequeMap) {
          const first = group[0];
          const totalAmount = group.reduce((s, p) => s + Number(p.amount), 0);
          const invoiceNos = group.map((p) => p.invoices?.invoice_no || "").filter(Boolean);
          const diff = Math.floor(
            (new Date(today).getTime() - new Date(first.cheque_date).getTime()) / 86400000
          );

          items.push({
            id: `cust_${chequeNo}`,
            type: "customer_deposit",
            title: first.customers?.name || "Customer",
            subtitle: `#${chequeNo !== first.id ? chequeNo : "—"}${invoiceNos.length ? ` · ${invoiceNos.join(", ")}` : ""}`,
            amount: totalAmount,
            daysInfo: diff === 0 ? "Due today" : `${diff}d overdue`,
            isOverdue: diff > 0,
            route: chequeRoute,
          });
        }
      }

      // ── Supplier cheques due today (need to be passed) ──
      if (suppRes.ok) {
        const supplierPayments: any[] = await suppRes.json();

        const suppMap = new Map<string, any[]>();
        for (const p of supplierPayments) {
          if (
            p.payment_method === "cheque" &&
            p.cheque_status === "pending" &&
            p.cheque_date === today
          ) {
            const key = p.cheque_number || p.id;
            if (!suppMap.has(key)) suppMap.set(key, []);
            suppMap.get(key)!.push(p);
          }
        }

        for (const [chequeNo, group] of suppMap) {
          const first = group[0];
          const totalAmount = group.reduce((s, p) => s + Number(p.amount), 0);
          const supplierName = first.purchases?.suppliers?.name || "Supplier";
          const purchaseIds = group.map((p) => p.purchases?.purchase_id || "").filter(Boolean);

          items.push({
            id: `supp_${chequeNo}`,
            type: "supplier_due",
            title: supplierName,
            subtitle: `#${chequeNo !== first.id ? chequeNo : "—"}${purchaseIds.length ? ` · ${purchaseIds.join(", ")}` : ""}`,
            amount: totalAmount,
            daysInfo: "Due today — pass cheque",
            isOverdue: false,
            route: supplierPaymentsRoute,
          });
        }
      }

      setNotifications(items);
    } catch {
      // Notifications are non-critical — silent fail
    }
  }, [businessId, today, chequeRoute, supplierPaymentsRoute]);

  // Initial load + event listener + 5-min poll
  useEffect(() => {
    fetchNotifications();
    const handler = () => fetchNotifications();
    window.addEventListener("b2b:payment-mutated", handler);
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => {
      window.removeEventListener("b2b:payment-mutated", handler);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const customerItems = notifications.filter((n) => n.type === "customer_deposit");
  const supplierItems = notifications.filter((n) => n.type === "supplier_due");
  const total = notifications.length;

  const handleNavigate = (route: string) => {
    setOpen(false);
    router.push(route);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`${total} notifications`}
        className={cn(
          "relative h-8 w-8 rounded-full flex items-center justify-center transition-colors",
          open ? "bg-gray-200" : "bg-gray-100 hover:bg-gray-200"
        )}
      >
        <Bell className={cn("h-4 w-4", total > 0 ? "text-gray-700" : "text-gray-500")} />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 w-[calc(100vw-2rem)] max-w-[340px] bg-white border border-gray-200 rounded-xl shadow-2xl z-200 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            </div>
            <div className="flex items-center gap-2">
              {total > 0 && (
                <span className="text-xs text-red-600 font-medium bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                  {total} action{total !== 1 ? "s" : ""} needed
                </span>
              )}
              <button
                onClick={() => setOpen(false)}
                className="h-5 w-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Empty state */}
          {total === 0 && (
            <div className="px-4 py-10 text-center">
              <CheckCircle2 className="h-9 w-9 text-green-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">All clear!</p>
              <p className="text-xs text-muted-foreground mt-1">
                No cheques require action today.
              </p>
            </div>
          )}

          {/* Notification list */}
          {total > 0 && (
            <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">

              {/* ── Customer cheques section ── */}
              {customerItems.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-amber-50 sticky top-0">
                    <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Banknote className="h-3 w-3" />
                      Customer Cheques · Deposit Required ({customerItems.length})
                    </p>
                  </div>
                  {customerItems.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNavigate(n.route)}
                      className="w-full text-left px-4 py-3 hover:bg-amber-50/70 transition-colors flex items-start gap-3 group"
                    >
                      <div className="mt-0.5 h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
                        <Banknote className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{n.subtitle}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-gray-800">
                            {formatCurrency(n.amount)}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                              n.isOverdue
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                            )}
                          >
                            {n.daysInfo}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 group-hover:text-amber-600 mt-1 shrink-0 transition-colors">
                        View →
                      </span>
                    </button>
                  ))}
                </>
              )}

              {/* ── Supplier cheques section ── */}
              {supplierItems.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-blue-50 sticky top-0">
                    <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowUpCircle className="h-3 w-3" />
                      Supplier Cheques · Pass Today ({supplierItems.length})
                    </p>
                  </div>
                  {supplierItems.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNavigate(n.route)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50/70 transition-colors flex items-start gap-3 group"
                    >
                      <div className="mt-0.5 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{n.subtitle}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-gray-800">
                            {formatCurrency(n.amount)}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {n.daysInfo}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 group-hover:text-blue-600 mt-1 shrink-0 transition-colors">
                        View →
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Footer — push notification toggle + hint */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex flex-col gap-1.5">
            {pushStatus !== "unsupported" && (
              <button
                onClick={() => pushStatus === "subscribed" ? unsubscribe() : subscribe()}
                disabled={pushStatus === "loading" || pushStatus === "denied"}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
                  pushStatus === "subscribed"
                    ? "bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-700 border border-green-200 hover:border-red-200"
                    : pushStatus === "denied"
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                )}
              >
                {pushStatus === "subscribed" ? (
                  <><BellRing className="h-3 w-3" /> Push alerts on — click to disable</>
                ) : pushStatus === "denied" ? (
                  <><BellOff className="h-3 w-3" /> Push blocked in browser settings</>
                ) : pushStatus === "loading" ? (
                  <><Bell className="h-3 w-3" /> Checking…</>
                ) : (
                  <><Bell className="h-3 w-3" /> Enable push alerts on this device</>
                )}
              </button>
            )}
            {total > 0 && (
              <p className="text-[10px] text-muted-foreground text-center">
                Click a notification to navigate to the cheque management page
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
