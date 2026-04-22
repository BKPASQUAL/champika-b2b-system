"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
export type ChequeEventType = "customer" | "supplier";

export interface ChequeEvent {
  id: string;
  type: ChequeEventType;
  date: string;
  cheque_number: string;
  amount: number;
  status: string;
  name: string;
  reference: string;
}

type ViewMode = "month" | "week" | "day";

interface TooltipState {
  event: ChequeEvent;
  x: number;
  y: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatLKR(amount: number): string {
  if (amount >= 1_000_000) return `LKR ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 100_000) return `LKR ${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000) return `LKR ${(amount / 1_000).toFixed(0)}K`;
  return `LKR ${amount.toFixed(0)}`;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function statusColors(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "passed") return { badge: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" };
  if (s === "returned") return { badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" };
  if (s === "deposited") return { badge: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" };
  return { badge: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-400" };
}

// ─── Hover Tooltip (desktop only) ─────────────────────────────────────────────
function HoverTooltip({ tooltip }: { tooltip: TooltipState }) {
  const { event, x, y } = tooltip;
  const isCustomer = event.type === "customer";
  const colors = statusColors(event.status);
  const W = 260;
  const GAP = 12;
  const left = x + GAP + W > window.innerWidth ? x - W - GAP : x + GAP;

  return (
    <div className="fixed z-9999 pointer-events-none" style={{ left, top: y + GAP, width: W }}>
      <div className="bg-white rounded-xl shadow-2xl border border-gray-100 p-4 text-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isCustomer ? "bg-blue-500" : "bg-orange-500"}`} />
          <span className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
            {isCustomer ? "Customer Cheque" : "Supplier Cheque"}
          </span>
        </div>
        <p className="font-bold text-gray-900 truncate mb-3">{event.name}</p>
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div>
            <p className="text-muted-foreground mb-0.5">Cheque No</p>
            <p className="font-medium">{event.cheque_number || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Amount</p>
            <p className={`font-bold ${isCustomer ? "text-blue-700" : "text-orange-700"}`}>
              LKR {Number(event.amount).toLocaleString("en-LK")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Date</p>
            <p className="font-medium">{event.date}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">{isCustomer ? "Invoice" : "Pmt Date"}</p>
            <p className="font-medium truncate">{event.reference}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${colors.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
          {event.status || "Pending"}
        </span>
      </div>
    </div>
  );
}

// ─── Mobile Bottom Sheet ───────────────────────────────────────────────────────
function BottomSheet({ event, onClose }: { event: ChequeEvent; onClose: () => void }) {
  const isCustomer = event.type === "customer";
  const colors = statusColors(event.status);
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-2xl shadow-2xl px-5 pt-4 pb-10 animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isCustomer ? "bg-blue-500" : "bg-orange-500"}`} />
            <span className="font-semibold text-sm">{isCustomer ? "Customer Cheque" : "Supplier Cheque"}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 p-1"><X className="h-4 w-4" /></button>
        </div>
        <p className="font-bold text-xl text-gray-900 mb-4">{event.name}</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Cheque No</p>
            <p className="font-semibold">{event.cheque_number || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Amount</p>
            <p className={`font-bold text-lg ${isCustomer ? "text-blue-700" : "text-orange-700"}`}>
              LKR {Number(event.amount).toLocaleString("en-LK")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Cheque Date</p>
            <p className="font-semibold">{event.date}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">
              {isCustomer ? "Invoice" : "Payment Date"}
            </p>
            <p className="font-semibold">{event.reference}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1.5">Status</p>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${colors.badge}`}>
            <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
            {event.status || "Pending"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Desktop: single-event modal ──────────────────────────────────────────────
function DesktopEventModal({ event, onClose }: { event: ChequeEvent; onClose: () => void }) {
  const isCustomer = event.type === "customer";
  const colors = statusColors(event.status);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: "blur(3px)", background: "rgba(0,0,0,0.3)" }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        style={{ animation: "dmIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both" }}
        onClick={e => e.stopPropagation()}
      >
        <div className={`h-1.5 w-full ${isCustomer ? "bg-blue-500" : "bg-orange-500"}`} />
        <div className="px-6 pt-5 pb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2.5 h-2.5 rounded-full ${isCustomer ? "bg-blue-500" : "bg-orange-500"}`} />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {isCustomer ? "Customer Cheque" : "Supplier Cheque"}
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 leading-tight">{event.name}</p>
            </div>
            <button onClick={onClose} className="ml-3 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-0.5">Cheque No</p>
              <p className="text-sm font-semibold text-gray-800 font-mono">{event.cheque_number || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-0.5">Amount</p>
              <p className={`text-base font-bold ${isCustomer ? "text-blue-700" : "text-orange-700"}`}>
                LKR {Number(event.amount).toLocaleString("en-LK")}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-0.5">Cheque Date</p>
              <p className="text-sm font-semibold text-gray-800">{event.date}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-0.5">
                {isCustomer ? "Invoice" : "Payment Date"}
              </p>
              <p className="text-sm font-semibold text-gray-800 truncate">{event.reference}</p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Status</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${colors.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
              {event.status || "Pending"}
            </span>
          </div>
        </div>
      </div>
      <style>{`@keyframes dmIn{from{opacity:0;transform:scale(0.92) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

// ─── Desktop: "more events" day popover ───────────────────────────────────────
function DesktopDayPopover({
  date, events, onEventClick, onClose,
}: {
  date: Date;
  events: ChequeEvent[];
  onEventClick: (e: ChequeEvent) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const isToday = toDateKey(date) === toDateKey(new Date());
  const totalAmount = events.reduce((s, e) => s + e.amount, 0);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: "blur(3px)", background: "rgba(0,0,0,0.3)" }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        style={{ animation: "dmIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 pt-4 pb-3 border-b ${isToday ? "bg-blue-50" : "bg-gray-50"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                isToday ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
              }`}>
                {date.getDate()}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">
                  {DAY_FULL[date.getDay()]}, {MONTH_NAMES[date.getMonth()]} {date.getDate()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {events.length} cheque{events.length !== 1 ? "s" : ""} · {formatLKR(totalAmount)}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Events list */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-2">
          {events.map((ev) => {
            const isCustomer = ev.type === "customer";
            const colors = statusColors(ev.status);
            return (
              <button
                key={ev.id}
                onClick={() => { onEventClick(ev); }}
                className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:shadow-sm ${
                  isCustomer ? "border-blue-100 bg-blue-50 hover:bg-blue-100" : "border-orange-100 bg-orange-50 hover:bg-orange-100"
                }`}
              >
                <div className={`w-1 self-stretch rounded-full shrink-0 ${isCustomer ? "bg-blue-500" : "bg-orange-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{ev.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    #{ev.cheque_number || "—"} · {isCustomer ? ev.reference : `Pmt ${ev.reference}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${isCustomer ? "text-blue-700" : "text-orange-700"}`}>
                    LKR {Number(ev.amount).toLocaleString("en-LK")}
                  </p>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium mt-0.5 ${colors.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                    {ev.status || "Pending"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Event Pill (month grid) ───────────────────────────────────────────────────
function EventPill({
  event, onHover, onHoverEnd, onTap, compact = false,
}: {
  event: ChequeEvent;
  onHover: (e: ChequeEvent, x: number, y: number) => void;
  onHoverEnd: () => void;
  onTap: (e: ChequeEvent) => void;
  compact?: boolean;
}) {
  const isCustomer = event.type === "customer";
  return (
    <button
      onClick={() => onTap(event)}
      onMouseEnter={(ev) => onHover(event, ev.clientX, ev.clientY)}
      onMouseMove={(ev) => onHover(event, ev.clientX, ev.clientY)}
      onMouseLeave={onHoverEnd}
      className={`w-full text-left rounded px-1.5 py-0.5 text-xs font-medium truncate cursor-pointer ${isCustomer ? "bg-blue-500 text-white" : "bg-orange-500 text-white"
        } ${compact ? "leading-4" : "leading-5"}`}
    >
      <span className="opacity-75 mr-1">{isCustomer ? "C" : "S"}</span>
      {event.name} · {formatLKR(event.amount)}
    </button>
  );
}

// ─── Event Row (week/day list) ─────────────────────────────────────────────────
function EventRow({
  event, onHover, onHoverEnd, onTap,
}: {
  event: ChequeEvent;
  onHover: (e: ChequeEvent, x: number, y: number) => void;
  onHoverEnd: () => void;
  onTap: (e: ChequeEvent) => void;
}) {
  const isCustomer = event.type === "customer";
  const colors = statusColors(event.status);
  return (
    <button
      onClick={() => onTap(event)}
      onMouseEnter={(ev) => onHover(event, ev.clientX, ev.clientY)}
      onMouseMove={(ev) => onHover(event, ev.clientX, ev.clientY)}
      onMouseLeave={onHoverEnd}
      className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer active:scale-[0.99] transition-transform ${isCustomer
          ? "border-blue-100 bg-blue-50 active:bg-blue-100"
          : "border-orange-100 bg-orange-50 active:bg-orange-100"
        }`}
    >
      <div className={`w-1 self-stretch rounded-full shrink-0 ${isCustomer ? "bg-blue-500" : "bg-orange-500"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{event.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          #{event.cheque_number || "—"} · {isCustomer ? event.reference : `Pmt ${event.reference}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${isCustomer ? "text-blue-700" : "text-orange-700"}`}>
          LKR {Number(event.amount).toLocaleString("en-LK")}
        </p>
        <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium mt-0.5 ${colors.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
          {event.status || "Pending"}
        </span>
      </div>
    </button>
  );
}

// ─── Events Panel (shared by week + day views) ─────────────────────────────────
function EventsPanel({
  date, events, onHover, onHoverEnd, onTap,
}: {
  date: Date;
  events: ChequeEvent[];
  onHover: (e: ChequeEvent, x: number, y: number) => void;
  onHoverEnd: () => void;
  onTap: (e: ChequeEvent) => void;
}) {
  const customerEvents = events.filter((e) => e.type === "customer");
  const supplierEvents = events.filter((e) => e.type === "supplier");

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <CalendarDays className="h-10 w-10 mb-3 opacity-20" />
        <p className="text-sm font-medium">No cheques</p>
        <p className="text-xs opacity-60 mt-1">
          {DAY_FULL[date.getDay()]}, {MONTH_NAMES[date.getMonth()]} {date.getDate()}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {customerEvents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Customer · {customerEvents.length}
            </p>
            <span className="text-xs text-muted-foreground ml-auto">
              {formatLKR(customerEvents.reduce((s, e) => s + e.amount, 0))}
            </span>
          </div>
          <div className="space-y-2">
            {customerEvents.map((ev) => (
              <EventRow key={ev.id} event={ev} onHover={onHover} onHoverEnd={onHoverEnd} onTap={onTap} />
            ))}
          </div>
        </div>
      )}
      {supplierEvents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Supplier · {supplierEvents.length}
            </p>
            <span className="text-xs text-muted-foreground ml-auto">
              {formatLKR(supplierEvents.reduce((s, e) => s + e.amount, 0))}
            </span>
          </div>
          <div className="space-y-2">
            {supplierEvents.map((ev) => (
              <EventRow key={ev.id} event={ev} onHover={onHover} onHoverEnd={onHoverEnd} onTap={onTap} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── iOS-style Day Strip (with touch swipe) ───────────────────────────────────
function DayStrip({
  days,
  selectedKey,
  todayKey,
  eventsByDate,
  onSelect,
  onSwipeLeft,
  onSwipeRight,
}: {
  days: Date[];
  selectedKey: string;
  todayKey: string;
  eventsByDate: Map<string, ChequeEvent[]>;
  onSelect: (d: Date) => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only treat as horizontal swipe if mostly horizontal
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }

  return (
    <div
      className="grid grid-cols-7 border-b bg-white select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {days.map((d) => {
        const key = toDateKey(d);
        const isToday = key === todayKey;
        const isSelected = key === selectedKey;
        const evs = eventsByDate.get(key) || [];
        const hasCustomer = evs.some((e) => e.type === "customer");
        const hasSupplier = evs.some((e) => e.type === "supplier");

        return (
          <button
            key={key}
            onClick={() => onSelect(d)}
            className="flex flex-col items-center pt-2 pb-2 gap-1 focus:outline-none"
          >
            {/* Day name */}
            <span className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wide ${isToday ? "text-blue-500" : "text-muted-foreground"
              }`}>
              {DAY_SHORT[d.getDay()]}
            </span>

            {/* Date number */}
            <span className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-sm sm:text-base font-bold transition-colors ${isSelected && isToday
                ? "bg-blue-600 text-white"
                : isSelected
                  ? "bg-gray-800 text-white"
                  : isToday
                    ? "text-blue-600"
                    : "text-gray-700"
              }`}>
              {d.getDate()}
            </span>

            {/* Event dots */}
            <div className="flex gap-0.5 h-1.5">
              {hasCustomer && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
              {hasSupplier && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Week View (iOS Calendar style) ───────────────────────────────────────────
function WeekView({
  weekStart, eventsByDate, onHover, onHoverEnd, onTap, onPrev, onNext,
}: {
  weekStart: Date;
  eventsByDate: Map<string, ChequeEvent[]>;
  onHover: (e: ChequeEvent, x: number, y: number) => void;
  onHoverEnd: () => void;
  onTap: (e: ChequeEvent) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const todayKey = toDateKey(new Date());

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  // Default selected = today if in week, else first day
  const defaultDay = days.find((d) => toDateKey(d) === todayKey) ?? days[0];
  const [selectedDate, setSelectedDate] = useState<Date>(defaultDay);

  // Reset selection when week changes
  useEffect(() => {
    const todayInWeek = days.find((d) => toDateKey(d) === todayKey);
    setSelectedDate(todayInWeek ?? days[0]);
  }, [weekStart]); // eslint-disable-line

  // Swipe on events panel also navigates weeks
  const panelTouchX = useRef<number | null>(null);
  const panelTouchY = useRef<number | null>(null);

  function handlePanelTouchStart(e: React.TouchEvent) {
    panelTouchX.current = e.touches[0].clientX;
    panelTouchY.current = e.touches[0].clientY;
  }
  function handlePanelTouchEnd(e: React.TouchEvent) {
    if (panelTouchX.current === null || panelTouchY.current === null) return;
    const dx = e.changedTouches[0].clientX - panelTouchX.current;
    const dy = e.changedTouches[0].clientY - panelTouchY.current;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) onNext();
      else onPrev();
    }
    panelTouchX.current = null;
    panelTouchY.current = null;
  }

  const selectedKey = toDateKey(selectedDate);
  const selectedEvents = eventsByDate.get(selectedKey) || [];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <DayStrip
        days={days}
        selectedKey={selectedKey}
        todayKey={todayKey}
        eventsByDate={eventsByDate}
        onSwipeLeft={onNext}
        onSwipeRight={onPrev}
        onSelect={setSelectedDate}
      />
      <div
        className="flex-1 overflow-auto"
        onTouchStart={handlePanelTouchStart}
        onTouchEnd={handlePanelTouchEnd}
      >
        <EventsPanel
          date={selectedDate}
          events={selectedEvents}
          onHover={onHover}
          onHoverEnd={onHoverEnd}
          onTap={onTap}
        />
      </div>
    </div>
  );
}

// ─── Month View ────────────────────────────────────────────────────────────────
function MonthView({
  year, month, eventsByDate, onHover, onHoverEnd, onTap, onDayClick, onMoreClick,
}: {
  year: number;
  month: number;
  eventsByDate: Map<string, ChequeEvent[]>;
  onHover: (e: ChequeEvent, x: number, y: number) => void;
  onHoverEnd: () => void;
  onTap: (e: ChequeEvent) => void;
  onDayClick: (date: Date) => void;
  onMoreClick: (date: Date, events: ChequeEvent[]) => void;
}) {
  const today = toDateKey(new Date());
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ date: new Date(year, month - 1, daysInPrev - i), inMonth: false });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ date: new Date(year, month, d), inMonth: true });
  while (cells.length < 42)
    cells.push({ date: new Date(year, month + 1, cells.length - daysInMonth - firstDay + 1), inMonth: false });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day header */}
      <div className="grid grid-cols-7 border-b">
        {DAY_SHORT.map((d) => (
          <div key={d} className="text-center text-[10px] sm:text-xs font-semibold text-muted-foreground py-1.5 sm:py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 flex-1 divide-x divide-y border-b">
        {cells.map(({ date, inMonth }, idx) => {
          const key = toDateKey(date);
          const events = eventsByDate.get(key) || [];
          const isToday = key === today;
          const hasCustomer = events.some((e) => e.type === "customer");
          const hasSupplier = events.some((e) => e.type === "supplier");

          return (
            <div
              key={idx}
              className={`min-h-14 sm:min-h-[90px] p-0.5 sm:p-1 flex flex-col gap-0.5 ${!inMonth ? "bg-gray-50" : ""}`}
            >
              {/* Date number */}
              <div className="flex items-center justify-between px-0.5 mb-0.5">
                <button
                  onClick={() => onDayClick(date)}
                  className={`text-xs font-semibold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full ${isToday ? "bg-blue-600 text-white" : inMonth ? "text-gray-700" : "text-gray-400"
                    }`}
                >
                  {date.getDate()}
                </button>

                {/* Mobile: dots instead of pills */}
                {events.length > 0 && (
                  <div className="flex gap-0.5 sm:hidden">
                    {hasCustomer && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    {hasSupplier && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                  </div>
                )}
              </div>

              {/* Desktop: event pills */}
              <div className="hidden sm:flex flex-col gap-0.5 overflow-hidden">
                {events.slice(0, 3).map((ev) => (
                  <EventPill key={ev.id} event={ev} onHover={onHover} onHoverEnd={onHoverEnd} onTap={onTap} compact />
                ))}
                {events.length > 3 && (
                  <button
                    onClick={() => onMoreClick(date, events)}
                    className="text-[10px] text-blue-600 font-semibold hover:text-blue-800 hover:underline pl-1 text-left"
                  >
                    +{events.length - 3} more
                  </button>
                )}
              </div>

              {/* Mobile: tap anywhere on cell to see events */}
              {events.length > 0 && (
                <button
                  onClick={() => onDayClick(date)}
                  className="sm:hidden absolute inset-0 w-full h-full opacity-0"
                  aria-label={`${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day View ──────────────────────────────────────────────────────────────────
function DayView({
  date, eventsByDate, onHover, onHoverEnd, onTap,
}: {
  date: Date;
  eventsByDate: Map<string, ChequeEvent[]>;
  onHover: (e: ChequeEvent, x: number, y: number) => void;
  onHoverEnd: () => void;
  onTap: (e: ChequeEvent) => void;
}) {
  const key = toDateKey(date);
  const events = eventsByDate.get(key) || [];
  const isToday = key === toDateKey(new Date());

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Day header */}
      <div className={`px-5 py-4 border-b ${isToday ? "bg-blue-50" : "bg-gray-50"}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${isToday ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
            }`}>
            {date.getDate()}
          </div>
          <div>
            <p className="text-base font-bold text-gray-800">
              {DAY_FULL[date.getDay()]}
            </p>
            <p className="text-sm text-muted-foreground">
              {MONTH_NAMES[date.getMonth()]} {date.getFullYear()}
            </p>
          </div>
          {events.length > 0 && (
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">{events.length} cheque{events.length !== 1 ? "s" : ""}</p>
              <p className="text-sm font-bold text-gray-800">
                {formatLKR(events.reduce((s, e) => s + e.amount, 0))}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <EventsPanel date={date} events={events} onHover={onHover} onHoverEnd={onHoverEnd} onTap={onTap} />
      </div>
    </div>
  );
}

// ─── Main Exported Component ───────────────────────────────────────────────────
export function ChequeCalendarView({
  businessId,
  portalName,
}: {
  businessId: string;
  portalName: string;
}) {
  const now = new Date();
  // Default: week view
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [events, setEvents] = useState<ChequeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "customer" | "supplier">("all");

  // Desktop tooltip
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mobile bottom sheet
  const [sheet, setSheet] = useState<ChequeEvent | null>(null);
  const isTouchRef = useRef(false);

  useEffect(() => { isTouchRef.current = window.matchMedia("(hover: none)").matches; }, []);

  const handleHover = useCallback((event: ChequeEvent, x: number, y: number) => {
    if (isTouchRef.current) return;
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltip({ event, x, y });
  }, []);

  const handleHoverEnd = useCallback(() => {
    if (isTouchRef.current) return;
    tooltipTimer.current = setTimeout(() => setTooltip(null), 80);
  }, []);

  // Desktop modals
  const [desktopEvent, setDesktopEvent] = useState<ChequeEvent | null>(null);
  const [desktopDay, setDesktopDay] = useState<{ date: Date; events: ChequeEvent[] } | null>(null);

  const handleTap = useCallback((event: ChequeEvent) => {
    if (isTouchRef.current) setSheet(event);
    else setDesktopEvent(event);
  }, []);

  const handleMoreClick = useCallback((date: Date, events: ChequeEvent[]) => {
    if (isTouchRef.current) { setCurrentDate(new Date(date)); setView("day"); }
    else setDesktopDay({ date, events });
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [currentDate]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ year: String(year), month: String(month + 1), businessId });
    fetch(`/api/admin/calendar?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setEvents(d); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year, month, businessId]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ChequeEvent[]>();
    events.filter((e) => filter === "all" || e.type === filter).forEach((e) => {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    });
    return map;
  }, [events, filter]);

  function prev() {
    const d = new Date(currentDate);
    if (view === "month") setCurrentDate(new Date(year, month - 1, 1));
    else if (view === "week") { d.setDate(d.getDate() - 7); setCurrentDate(d); }
    else { d.setDate(d.getDate() - 1); setCurrentDate(d); }
  }
  function next() {
    const d = new Date(currentDate);
    if (view === "month") setCurrentDate(new Date(year, month + 1, 1));
    else if (view === "week") { d.setDate(d.getDate() + 7); setCurrentDate(d); }
    else { d.setDate(d.getDate() + 1); setCurrentDate(d); }
  }
  function goToday() { setCurrentDate(new Date(now.getFullYear(), now.getMonth(), now.getDate())); }
  function goToDay(date: Date) { setCurrentDate(new Date(date)); setView("day"); }

  const title = useMemo(() => {
    if (view === "month") return `${MONTH_NAMES[month]} ${year}`;
    if (view === "week") {
      const end = new Date(weekStart); end.setDate(end.getDate() + 6);
      if (weekStart.getMonth() === end.getMonth())
        return `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()}–${end.getDate()}, ${year}`;
      return `${MONTH_SHORT[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTH_SHORT[end.getMonth()]} ${end.getDate()}, ${year}`;
    }
    return `${DAY_FULL[currentDate.getDay()]}, ${MONTH_NAMES[month]} ${currentDate.getDate()}`;
  }, [view, year, month, weekStart, currentDate]);

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-blue-600 shrink-0" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight leading-none">Cheque Calendar</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{portalName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs mr-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Customer</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />Supplier</span>
          </div>

          {/* Filter */}
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {(["all", "customer", "supplier"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 sm:px-3 py-1.5 capitalize font-medium transition-colors ${filter === f ? "bg-gray-800 text-white" : "bg-white text-gray-600"
                  }`}>
                {f === "all" ? "All" : f === "customer" ? "Cust." : "Supp."}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {(["week", "month", "day"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 sm:px-3 py-1.5 capitalize font-medium transition-colors ${view === v ? "bg-blue-600 text-white" : "bg-white text-gray-600"
                  }`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar container */}
      <div className="flex flex-col flex-1 border rounded-xl bg-white overflow-hidden min-h-[480px]">
        {/* Nav bar */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b bg-gray-50">
          <button onClick={goToday}
            className="text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-white transition-colors shrink-0">
            Today
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-xs sm:text-sm font-semibold text-center truncate px-1">{title}</h3>
            <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors shrink-0">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="w-14 shrink-0" />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" /><span className="text-sm">{error}</span>
          </div>
        ) : view === "week" ? (
          <WeekView weekStart={weekStart} eventsByDate={eventsByDate}
            onHover={handleHover} onHoverEnd={handleHoverEnd} onTap={handleTap}
            onPrev={prev} onNext={next} />
        ) : view === "month" ? (
          <MonthView year={year} month={month} eventsByDate={eventsByDate}
            onHover={handleHover} onHoverEnd={handleHoverEnd} onTap={handleTap} onDayClick={goToDay} onMoreClick={handleMoreClick} />
        ) : (
          <DayView date={currentDate} eventsByDate={eventsByDate}
            onHover={handleHover} onHoverEnd={handleHoverEnd} onTap={handleTap} />
        )}
      </div>

      {tooltip && <HoverTooltip tooltip={tooltip} />}
      {sheet && <BottomSheet event={sheet} onClose={() => setSheet(null)} />}
      {desktopEvent && <DesktopEventModal event={desktopEvent} onClose={() => setDesktopEvent(null)} />}
      {desktopDay && (
        <DesktopDayPopover
          date={desktopDay.date}
          events={desktopDay.events}
          onEventClick={(ev) => { setDesktopDay(null); setDesktopEvent(ev); }}
          onClose={() => setDesktopDay(null)}
        />
      )}
    </div>
  );
}
