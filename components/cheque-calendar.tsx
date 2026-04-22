"use client";

import { useEffect, useState, useMemo } from "react";
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
  date: string; // YYYY-MM-DD
  cheque_number: string;
  amount: number;
  status: string;
  name: string;
  reference: string;
}

type ViewMode = "month" | "week" | "day";

// ─── Helpers ───────────────────────────────────────────────────────────────────
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatLKR(amount: number): string {
  if (amount >= 1_000_000) return `LKR ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 100_000) return `LKR ${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000) return `LKR ${(amount / 1_000).toFixed(0)}K`;
  return `LKR ${amount.toFixed(0)}`;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function statusColor(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "passed") return { badge: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" };
  if (s === "returned") return { badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" };
  if (s === "deposited") return { badge: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" };
  return { badge: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-400" };
}

// ─── Event Pill (month/week) ───────────────────────────────────────────────────
function EventPill({
  event,
  onClick,
  compact = false,
}: {
  event: ChequeEvent;
  onClick: (e: ChequeEvent) => void;
  compact?: boolean;
}) {
  const isCustomer = event.type === "customer";
  const base = isCustomer
    ? "bg-blue-500 hover:bg-blue-600 text-white"
    : "bg-orange-500 hover:bg-orange-600 text-white";

  return (
    <button
      onClick={() => onClick(event)}
      className={`w-full text-left rounded px-1.5 py-0.5 text-xs font-medium truncate transition-colors ${base} ${compact ? "leading-4" : "leading-5"}`}
    >
      <span className="opacity-75 mr-1">{isCustomer ? "C" : "S"}</span>
      {event.name} · {formatLKR(event.amount)}
    </button>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ event, onClose }: { event: ChequeEvent; onClose: () => void }) {
  const isCustomer = event.type === "customer";
  const colors = statusColor(event.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isCustomer ? "bg-blue-500" : "bg-orange-500"}`} />
            <span className="font-semibold text-sm">
              {isCustomer ? "Customer Cheque" : "Supplier Cheque"}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">
              {isCustomer ? "Customer" : "Supplier"}
            </p>
            <p className="font-semibold text-base">{event.name}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Cheque No</p>
              <p className="text-sm font-medium">{event.cheque_number || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Amount</p>
              <p className="text-sm font-bold text-gray-800">
                LKR {Number(event.amount).toLocaleString("en-LK")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Cheque Date</p>
              <p className="text-sm">{event.date}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">
                {isCustomer ? "Invoice" : "Payment Date"}
              </p>
              <p className="text-sm">{event.reference}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Status</p>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
              {event.status || "Pending"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Month View ────────────────────────────────────────────────────────────────
function MonthView({
  year,
  month,
  eventsByDate,
  onEventClick,
  onDayClick,
}: {
  year: number;
  month: number;
  eventsByDate: Map<string, ChequeEvent[]>;
  onEventClick: (e: ChequeEvent) => void;
  onDayClick: (date: Date) => void;
}) {
  const today = toDateKey(new Date());
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrev - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month + 1, cells.length - daysInMonth - firstDay + 1), inMonth: false });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="grid grid-cols-7 border-b">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1 divide-x divide-y border-b">
        {cells.map(({ date, inMonth }, idx) => {
          const key = toDateKey(date);
          const events = eventsByDate.get(key) || [];
          const isToday = key === today;
          return (
            <div key={idx} className={`min-h-[90px] p-1 flex flex-col gap-0.5 ${!inMonth ? "bg-gray-50" : ""}`}>
              <div className="flex items-center justify-between mb-0.5">
                <button
                  onClick={() => onDayClick(date)}
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full hover:ring-2 hover:ring-blue-300 transition-all ${
                    isToday ? "bg-blue-600 text-white" : inMonth ? "text-gray-700 hover:bg-gray-100" : "text-gray-400"
                  }`}
                >
                  {date.getDate()}
                </button>
                {events.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{events.length}</span>
                )}
              </div>
              <div className="space-y-0.5 overflow-hidden">
                {events.slice(0, 3).map((ev) => (
                  <EventPill key={ev.id} event={ev} onClick={onEventClick} compact />
                ))}
                {events.length > 3 && (
                  <button
                    onClick={() => onDayClick(date)}
                    className="text-[10px] text-blue-500 hover:underline pl-1"
                  >
                    +{events.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ─────────────────────────────────────────────────────────────────
function WeekView({
  weekStart,
  eventsByDate,
  onEventClick,
  onDayClick,
}: {
  weekStart: Date;
  eventsByDate: Map<string, ChequeEvent[]>;
  onEventClick: (e: ChequeEvent) => void;
  onDayClick: (date: Date) => void;
}) {
  const today = toDateKey(new Date());
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="grid grid-cols-7 border-b">
        {days.map((d) => {
          const key = toDateKey(d);
          const isToday = key === today;
          const evCount = eventsByDate.get(key)?.length || 0;
          return (
            <div key={key} className="text-center py-2 border-r last:border-r-0">
              <p className="text-xs font-medium text-muted-foreground">{DAY_NAMES[d.getDay()]}</p>
              <button
                onClick={() => onDayClick(d)}
                className={`mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold hover:ring-2 hover:ring-blue-300 transition-all ${
                  isToday ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {d.getDate()}
              </button>
              {evCount > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{evCount} cheque{evCount !== 1 ? "s" : ""}</p>
              )}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7 flex-1 divide-x border-b overflow-auto">
        {days.map((d) => {
          const key = toDateKey(d);
          const events = eventsByDate.get(key) || [];
          return (
            <div key={key} className="p-1.5 space-y-1 min-h-[300px]">
              {events.length === 0 && (
                <p className="text-[10px] text-gray-300 text-center mt-4">—</p>
              )}
              {events.map((ev) => (
                <EventPill key={ev.id} event={ev} onClick={onEventClick} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day View ──────────────────────────────────────────────────────────────────
function DayView({
  date,
  eventsByDate,
  onEventClick,
}: {
  date: Date;
  eventsByDate: Map<string, ChequeEvent[]>;
  onEventClick: (e: ChequeEvent) => void;
}) {
  const key = toDateKey(date);
  const events = eventsByDate.get(key) || [];
  const today = toDateKey(new Date());
  const isToday = key === today;

  const customerEvents = events.filter((e) => e.type === "customer");
  const supplierEvents = events.filter((e) => e.type === "supplier");

  const totalCustomer = customerEvents.reduce((s, e) => s + e.amount, 0);
  const totalSupplier = supplierEvents.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {/* Day header */}
      <div className={`px-6 py-4 border-b ${isToday ? "bg-blue-50" : "bg-gray-50"}`}>
        <div className="flex items-baseline gap-3">
          <span className={`text-4xl font-bold ${isToday ? "text-blue-600" : "text-gray-800"}`}>
            {date.getDate()}
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-700">
              {DAY_NAMES_FULL[date.getDay()]}, {MONTH_NAMES[date.getMonth()]} {date.getFullYear()}
            </p>
            {isToday && <p className="text-xs text-blue-600 font-medium">Today</p>}
          </div>
          {events.length > 0 && (
            <div className="ml-auto flex gap-4 text-right">
              {customerEvents.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="text-sm font-bold text-blue-600">{formatLKR(totalCustomer)}</p>
                  <p className="text-xs text-muted-foreground">{customerEvents.length} cheque{customerEvents.length !== 1 ? "s" : ""}</p>
                </div>
              )}
              {supplierEvents.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Supplier</p>
                  <p className="text-sm font-bold text-orange-600">{formatLKR(totalSupplier)}</p>
                  <p className="text-xs text-muted-foreground">{supplierEvents.length} cheque{supplierEvents.length !== 1 ? "s" : ""}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 p-4">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <CalendarDays className="h-10 w-10 mb-2 opacity-20" />
            <p className="text-sm">No cheques on this day</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {/* Customer cheques */}
            {customerEvents.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Customer Cheques ({customerEvents.length})
                  </p>
                </div>
                <div className="space-y-2">
                  {customerEvents.map((ev) => {
                    const colors = statusColor(ev.status);
                    return (
                      <button
                        key={ev.id}
                        onClick={() => onEventClick(ev)}
                        className="w-full text-left flex items-center gap-4 rounded-lg border border-blue-100 bg-blue-50 hover:bg-blue-100 transition-colors px-4 py-3"
                      >
                        <div className="w-1 self-stretch rounded-full bg-blue-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{ev.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Cheque #{ev.cheque_number || "—"} · Invoice {ev.reference}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-blue-700">
                            LKR {Number(ev.amount).toLocaleString("en-LK")}
                          </p>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                            {ev.status || "Pending"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Supplier cheques */}
            {supplierEvents.length > 0 && (
              <div className={customerEvents.length > 0 ? "mt-4" : ""}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Supplier Cheques ({supplierEvents.length})
                  </p>
                </div>
                <div className="space-y-2">
                  {supplierEvents.map((ev) => {
                    const colors = statusColor(ev.status);
                    return (
                      <button
                        key={ev.id}
                        onClick={() => onEventClick(ev)}
                        className="w-full text-left flex items-center gap-4 rounded-lg border border-orange-100 bg-orange-50 hover:bg-orange-100 transition-colors px-4 py-3"
                      >
                        <div className="w-1 self-stretch rounded-full bg-orange-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{ev.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Cheque #{ev.cheque_number || "—"} · Payment date {ev.reference}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-orange-700">
                            LKR {Number(ev.amount).toLocaleString("en-LK")}
                          </p>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                            {ev.status || "Pending"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
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
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [events, setEvents] = useState<ChequeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChequeEvent | null>(null);
  const [filter, setFilter] = useState<"all" | "customer" | "supplier">("all");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Week start = Sunday of the week containing currentDate
  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [currentDate]);

  // Fetch by month (covers month + week + day views)
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      year: String(year),
      month: String(month + 1),
      businessId,
    });
    fetch(`/api/admin/calendar?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setEvents(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year, month, businessId]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ChequeEvent[]>();
    events
      .filter((e) => filter === "all" || e.type === filter)
      .forEach((e) => {
        const list = map.get(e.date) || [];
        list.push(e);
        map.set(e.date, list);
      });
    return map;
  }, [events, filter]);

  function prev() {
    const d = new Date(currentDate);
    if (view === "month") {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (view === "week") {
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
    }
  }
  function next() {
    const d = new Date(currentDate);
    if (view === "month") {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (view === "week") {
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
    }
  }
  function goToday() {
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  function goToDay(date: Date) {
    setCurrentDate(new Date(date));
    setView("day");
  }

  const title = useMemo(() => {
    if (view === "month") return `${MONTH_NAMES[month]} ${year}`;
    if (view === "week") {
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      return `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
    }
    return `${DAY_NAMES_FULL[currentDate.getDay()]}, ${MONTH_NAMES[month]} ${currentDate.getDate()}, ${year}`;
  }, [view, year, month, weekStart, currentDate]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold tracking-tight leading-none">Cheque Calendar</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{portalName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs mr-2">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              Customer
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
              Supplier
            </span>
          </div>

          {/* Filter */}
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {(["all", "customer", "supplier"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 capitalize font-medium transition-colors ${
                  filter === f ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {(["month", "week", "day"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 capitalize font-medium transition-colors ${
                  view === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Calendar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 border rounded-xl bg-white overflow-hidden min-h-[500px]">
        {/* Nav bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <button
            onClick={goToday}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
          >
            Today
          </button>
          <div className="flex items-center gap-3">
            <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-semibold min-w-[220px] text-center">{title}</h3>
            <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="w-16" />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading cheques...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        ) : view === "month" ? (
          <MonthView
            year={year}
            month={month}
            eventsByDate={eventsByDate}
            onEventClick={setSelected}
            onDayClick={goToDay}
          />
        ) : view === "week" ? (
          <WeekView
            weekStart={weekStart}
            eventsByDate={eventsByDate}
            onEventClick={setSelected}
            onDayClick={goToDay}
          />
        ) : (
          <DayView
            date={currentDate}
            eventsByDate={eventsByDate}
            onEventClick={setSelected}
          />
        )}
      </div>

      {selected && <DetailModal event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
