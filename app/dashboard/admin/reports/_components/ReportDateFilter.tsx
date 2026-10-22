"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
  Loader2,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function toYmd(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatHumanDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTH_SHORT[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function getMonthRange(year: number, monthIndex: number) {
  const from = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const to = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    label: `${MONTH_NAMES[monthIndex]} ${year}`,
  };
}

export function calculateRange(
  quickSelect: string,
  customFrom?: string,
  customTo?: string
): { from: string; to: string; label: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  if (quickSelect.startsWith("month:")) {
    const parts = quickSelect.replace("month:", "").split("-");
    const year = parseInt(parts[0], 10) || currentYear;
    const month = parseInt(parts[1], 10);
    return getMonthRange(year, isNaN(month) ? currentMonth : month);
  }

  switch (quickSelect) {
    case "this-month":
      return getMonthRange(currentYear, currentMonth);

    case "last-month": {
      const prev = new Date(currentYear, currentMonth - 1, 1);
      return getMonthRange(prev.getFullYear(), prev.getMonth());
    }

    case "this-year": {
      const from = new Date(currentYear, 0, 1, 0, 0, 0, 0);
      const to = new Date(currentYear, 11, 31, 23, 59, 59, 999);
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        label: `This Year (${currentYear})`,
      };
    }

    case "last-year": {
      const prevYear = currentYear - 1;
      const from = new Date(prevYear, 0, 1, 0, 0, 0, 0);
      const to = new Date(prevYear, 11, 31, 23, 59, 59, 999);
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        label: `Last Year (${prevYear})`,
      };
    }

    case "last-30": {
      const to = new Date(currentYear, currentMonth, now.getDate(), 23, 59, 59, 999);
      const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      from.setHours(0, 0, 0, 0);
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        label: "Last 30 Days",
      };
    }

    case "last-90": {
      const to = new Date(currentYear, currentMonth, now.getDate(), 23, 59, 59, 999);
      const from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
      from.setHours(0, 0, 0, 0);
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        label: "Last 90 Days",
      };
    }

    case "custom": {
      const f = customFrom ? new Date(customFrom) : new Date(currentYear, currentMonth, 1);
      f.setHours(0, 0, 0, 0);
      const t = customTo ? new Date(customTo) : new Date();
      t.setHours(23, 59, 59, 999);
      return {
        from: f.toISOString(),
        to: t.toISOString(),
        label: `${formatHumanDate(f)} – ${formatHumanDate(t)}`,
      };
    }

    default:
      return getMonthRange(currentYear, currentMonth);
  }
}

export interface ReportDateFilterValue {
  from: string;
  to: string;
  quickSelect: string;
  label?: string;
}

interface ReportDateFilterProps {
  value?: ReportDateFilterValue;
  from?: string;
  to?: string;
  quickSelect?: string;
  onChange: (val: ReportDateFilterValue) => void;
  loading?: boolean;
  className?: string;
  compact?: boolean;
}

export function ReportDateFilter({
  value,
  from: propFrom,
  to: propTo,
  quickSelect: propQuickSelect,
  onChange,
  loading = false,
  className = "",
  compact = false,
}: ReportDateFilterProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Effective values
  const currentQuickSelect = value?.quickSelect || propQuickSelect || "this-month";
  const currentFrom = value?.from || propFrom || new Date(currentYear, currentMonth, 1).toISOString();
  const currentTo = value?.to || propTo || new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).toISOString();

  // Calendar popover open state
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Popover calendar navigation state
  const initialCalendarDate = useMemo(() => {
    const d = new Date(currentFrom);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [currentFrom]);

  const [calYear, setCalYear] = useState(initialCalendarDate.getFullYear());
  const [calMonth, setCalMonth] = useState(initialCalendarDate.getMonth());

  // Staged dates inside popover
  const [tempStart, setTempStart] = useState<string>(toYmd(currentFrom));
  const [tempEnd, setTempEnd] = useState<string>(toYmd(currentTo));
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Sync staged dates when opening popover or current dates change
  useEffect(() => {
    if (popoverOpen) {
      const start = toYmd(currentFrom);
      const end = toYmd(currentTo);
      setTempStart(start);
      setTempEnd(end);
      const d = new Date(currentFrom);
      if (!isNaN(d.getTime())) {
        setCalYear(d.getFullYear());
        setCalMonth(d.getMonth());
      }
    }
  }, [popoverOpen, currentFrom, currentTo]);

  // Handle main dropdown select
  const handleSelectChange = (newVal: string) => {
    if (newVal === "custom") {
      setPopoverOpen(true);
      return;
    }
    const range = calculateRange(newVal);
    onChange({
      from: range.from,
      to: range.to,
      quickSelect: newVal,
      label: range.label,
    });
  };

  // Step month forward / backward for month modes
  const handleMonthStep = (delta: number) => {
    let year = currentYear;
    let month = currentMonth;

    if (currentQuickSelect.startsWith("month:")) {
      const parts = currentQuickSelect.replace("month:", "").split("-");
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    } else if (currentQuickSelect === "last-month") {
      month = currentMonth - 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
    }

    const targetDate = new Date(year, month + delta, 1);
    const newYear = targetDate.getFullYear();
    const newMonth = targetDate.getMonth();
    const range = getMonthRange(newYear, newMonth);
    const key = `month:${newYear}-${newMonth}`;

    onChange({
      from: range.from,
      to: range.to,
      quickSelect: key,
      label: range.label,
    });
  };

  // Apply custom calendar selection
  const handleApplyCustom = () => {
    if (!tempStart) return;
    const s = new Date(tempStart);
    s.setHours(0, 0, 0, 0);

    const e = tempEnd ? new Date(tempEnd) : new Date(tempStart);
    e.setHours(23, 59, 59, 999);

    if (e < s) {
      // Auto flip if backwards
      const swappedS = new Date(tempEnd);
      swappedS.setHours(0, 0, 0, 0);
      const swappedE = new Date(tempStart);
      swappedE.setHours(23, 59, 59, 999);
      onChange({
        from: swappedS.toISOString(),
        to: swappedE.toISOString(),
        quickSelect: "custom",
        label: `${formatHumanDate(swappedS)} – ${formatHumanDate(swappedE)}`,
      });
    } else {
      onChange({
        from: s.toISOString(),
        to: e.toISOString(),
        quickSelect: "custom",
        label: `${formatHumanDate(s)} – ${formatHumanDate(e)}`,
      });
    }
    setPopoverOpen(false);
  };

  // Quick preset within calendar popover
  const handleApplyPresetInPopover = (presetKey: string) => {
    const range = calculateRange(presetKey);
    const startYmd = toYmd(range.from);
    const endYmd = toYmd(range.to);
    setTempStart(startYmd);
    setTempEnd(endYmd);
    const d = new Date(range.from);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  // Click on a calendar day
  const handleDayClick = (dayStr: string) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dayStr);
      setTempEnd("");
    } else if (tempStart && !tempEnd) {
      if (dayStr < tempStart) {
        setTempEnd(tempStart);
        setTempStart(dayStr);
      } else {
        setTempEnd(dayStr);
      }
    }
  };

  // Calendar grid calculations
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay(); // 0 is Sunday
  const todayStr = toYmd(new Date());

  // Duration calculations
  const daysCount = useMemo(() => {
    const f = new Date(currentFrom);
    const t = new Date(currentTo);
    if (isNaN(f.getTime()) || isNaN(t.getTime())) return 0;
    return Math.max(1, Math.round((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)));
  }, [currentFrom, currentTo]);

  const activeRangeDisplay = useMemo(() => {
    if (value?.label) return value.label;
    const f = new Date(currentFrom);
    const t = new Date(currentTo);
    if (isNaN(f.getTime()) || isNaN(t.getTime())) return "Select dates";

    // Check if full month
    if (f.getDate() === 1) {
      const lastDay = new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate();
      if (t.getDate() === lastDay && f.getMonth() === t.getMonth()) {
        return `${MONTH_NAMES[f.getMonth()]} ${f.getFullYear()}`;
      }
    }
    return `${formatHumanDate(f)} – ${formatHumanDate(t)}`;
  }, [currentFrom, currentTo, value?.label]);

  const isMonthMode = currentQuickSelect === "this-month" ||
    currentQuickSelect === "last-month" ||
    currentQuickSelect.startsWith("month:");

  // Months lists for dropdown
  const monthsCurrentYear = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: `month:${currentYear}-${i}`,
      label: `${MONTH_NAMES[i]} ${currentYear}`,
      monthIndex: i,
    })).reverse(); // Current year in reverse (Dec down to Jan)
  }, [currentYear]);

  const monthsLastYear = useMemo(() => {
    const prevYear = currentYear - 1;
    return Array.from({ length: 12 }, (_, i) => ({
      value: `month:${prevYear}-${i}`,
      label: `${MONTH_NAMES[i]} ${prevYear}`,
      monthIndex: i,
    })).reverse();
  }, [currentYear]);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* ── Main Dropdown ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <Select value={currentQuickSelect} onValueChange={handleSelectChange}>
          <SelectTrigger className="w-full h-8 text-xs font-medium bg-white shadow-xs border-slate-200">
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary shrink-0" />
            <SelectValue placeholder="Select Range" />
          </SelectTrigger>
          <SelectContent className="max-h-80 w-64">
            <SelectGroup>
              <SelectLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                Quick Ranges
              </SelectLabel>
              <SelectItem value="this-month" className="text-xs">
                This Month ({MONTH_SHORT[currentMonth]} {currentYear})
              </SelectItem>
              <SelectItem value="last-month" className="text-xs">
                Last Month
              </SelectItem>
              <SelectItem value="last-30" className="text-xs">
                Last 30 Days
              </SelectItem>
              <SelectItem value="last-90" className="text-xs">
                Last 90 Days
              </SelectItem>
              <SelectItem value="this-year" className="text-xs">
                This Year ({currentYear})
              </SelectItem>
              <SelectItem value="last-year" className="text-xs">
                Last Year ({currentYear - 1})
              </SelectItem>
            </SelectGroup>

            <SelectSeparator />

            <SelectGroup>
              <SelectLabel className="text-[10px] font-bold text-primary uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                <span>All Months ({currentYear})</span>
                <span className="text-[9px] font-normal text-slate-400">1-click</span>
              </SelectLabel>
              {monthsCurrentYear.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs font-medium">
                  {m.label}
                </SelectItem>
              ))}
            </SelectGroup>

            <SelectSeparator />

            <SelectGroup>
              <SelectLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                Months ({currentYear - 1})
              </SelectLabel>
              {monthsLastYear.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectGroup>

            <SelectSeparator />

            <SelectGroup>
              <SelectLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                Custom Dates
              </SelectLabel>
              <SelectItem value="custom" className="text-xs font-semibold text-primary">
                📅 Custom Calendar Range...
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Calendar popover trigger icon button */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              title="Open Calendar Range Picker"
              className={`h-8 px-2 shrink-0 border-slate-200 hover:bg-primary/5 hover:text-primary ${
                currentQuickSelect === "custom" ? "bg-primary/10 text-primary border-primary/30" : "bg-white"
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            side="right"
            sideOffset={8}
            className="w-[330px] p-3.5 bg-white shadow-xl rounded-xl border border-slate-200 z-50 text-slate-800"
          >
            <div className="space-y-3">
              {/* Popover Header */}
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-xs text-slate-900">Custom Date Range</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-medium text-slate-500 bg-slate-50">
                  {tempStart && tempEnd ? `${Math.max(1, Math.round((new Date(tempEnd).getTime() - new Date(tempStart).getTime()) / (1000 * 60 * 60 * 24)) + 1)} days` : "Pick 2 dates"}
                </Badge>
              </div>

              {/* Quick Presets Chips */}
              <div className="flex flex-wrap gap-1">
                {[
                  { label: "Today", key: "custom", customDays: 0 },
                  { label: "Last 7D", key: "custom", customDays: 7 },
                  { label: "This Month", key: "this-month" },
                  { label: "Last Month", key: "last-month" },
                  { label: "Last 30D", key: "last-30" },
                  { label: "This Year", key: "this-year" },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => {
                      if (chip.customDays !== undefined) {
                        const t = new Date();
                        const s = new Date();
                        if (chip.customDays > 0) s.setDate(s.getDate() - chip.customDays);
                        setTempStart(toYmd(s));
                        setTempEnd(toYmd(t));
                        setCalYear(s.getFullYear());
                        setCalMonth(s.getMonth());
                      } else {
                        handleApplyPresetInPopover(chip.key);
                      }
                    }}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-600 transition-colors"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Month Navigation & Fast Jump Header */}
              <div className="flex items-center justify-between gap-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-slate-200"
                  onClick={() => {
                    if (calMonth === 0) {
                      setCalMonth(11);
                      setCalYear((y) => y - 1);
                    } else {
                      setCalMonth((m) => m - 1);
                    }
                  }}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                <div className="flex items-center gap-1">
                  {/* Month jump select */}
                  <select
                    value={calMonth}
                    onChange={(e) => setCalMonth(parseInt(e.target.value, 10))}
                    className="h-6 text-[11px] font-semibold bg-transparent border-0 rounded px-1 focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx}>
                        {name}
                      </option>
                    ))}
                  </select>

                  {/* Year jump select */}
                  <select
                    value={calYear}
                    onChange={(e) => setCalYear(parseInt(e.target.value, 10))}
                    className="h-6 text-[11px] font-semibold bg-transparent border-0 rounded px-1 focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {Array.from({ length: 8 }, (_, i) => currentYear - 4 + i).map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-slate-200"
                  onClick={() => {
                    if (calMonth === 11) {
                      setCalMonth(0);
                      setCalYear((y) => y + 1);
                    } else {
                      setCalMonth((m) => m + 1);
                    }
                  }}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Calendar Grid */}
              <div className="space-y-1">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 text-center text-[10px] font-medium text-slate-400 mb-1">
                  <span>Su</span>
                  <span>Mo</span>
                  <span>Tu</span>
                  <span>We</span>
                  <span>Th</span>
                  <span>Fr</span>
                  <span>Sa</span>
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 gap-y-1">
                  {/* Empty cells before month start */}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-7 w-7" />
                  ))}

                  {/* Actual days */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dayStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

                    const isStart = tempStart === dayStr;
                    const isEnd = tempEnd === dayStr;
                    const isBetween =
                      tempStart &&
                      tempEnd &&
                      dayStr > tempStart &&
                      dayStr < tempEnd;
                    const isHoverBetween =
                      tempStart &&
                      !tempEnd &&
                      hoverDate &&
                      ((dayStr > tempStart && dayStr <= hoverDate) ||
                        (dayStr < tempStart && dayStr >= hoverDate));

                    const isToday = dayStr === todayStr;

                    return (
                      <button
                        key={dayStr}
                        type="button"
                        onClick={() => handleDayClick(dayStr)}
                        onMouseEnter={() => setHoverDate(dayStr)}
                        onMouseLeave={() => setHoverDate(null)}
                        className={`h-7 w-full text-[11px] font-medium transition-colors relative flex items-center justify-center ${
                          isStart && isEnd
                            ? "bg-primary text-white rounded-md font-bold shadow-xs"
                            : isStart
                            ? "bg-primary text-white rounded-l-md font-bold shadow-xs"
                            : isEnd
                            ? "bg-primary text-white rounded-r-md font-bold shadow-xs"
                            : isBetween
                            ? "bg-primary/15 text-primary font-semibold"
                            : isHoverBetween
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-slate-100 text-slate-700 rounded-md"
                        } ${isToday && !isStart && !isEnd ? "ring-1 ring-primary/40 font-bold" : ""}`}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Exact Date Inputs Preview */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">From Date</label>
                  <Input
                    type="date"
                    value={tempStart}
                    onChange={(e) => setTempStart(e.target.value)}
                    className="h-7 text-xs px-2"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">To Date</label>
                  <Input
                    type="date"
                    value={tempEnd}
                    onChange={(e) => setTempEnd(e.target.value)}
                    className="h-7 text-xs px-2"
                  />
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-slate-500 hover:text-slate-800"
                  onClick={() => setPopoverOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs font-semibold px-4 shadow-sm"
                  onClick={handleApplyCustom}
                  disabled={!tempStart}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Apply Range
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Month Quick-Step Bar (when a month is selected) ─────────── */}
      {isMonthMode && (
        <div className="flex items-center justify-between bg-slate-50 rounded-lg p-1 border border-slate-200/70 text-xs">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-slate-500 hover:text-primary hover:bg-white"
            title="Previous Month"
            onClick={() => handleMonthStep(-1)}
            disabled={loading}
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
            <span className="text-[10px] font-medium">Prev</span>
          </Button>

          <span className="text-[11px] font-semibold text-slate-700 px-1 truncate">
            {activeRangeDisplay}
          </span>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-slate-500 hover:text-primary hover:bg-white"
            title="Next Month"
            onClick={() => handleMonthStep(1)}
            disabled={loading}
          >
            <span className="text-[10px] font-medium">Next</span>
            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>
      )}

      {/* ── Active Range Badge & Live Feedback ────────────────────────── */}
      <div className="flex items-center justify-between text-[11px] bg-slate-50/80 border border-slate-200/70 rounded-md px-2 py-1 text-slate-600">
        <span className="truncate flex items-center gap-1 font-medium text-slate-700">
          <Clock className="h-3 w-3 text-primary shrink-0" />
          <span className="truncate">{activeRangeDisplay}</span>
        </span>
        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {loading ? (
            <span className="flex items-center gap-1 text-[10px] text-primary font-medium animate-pulse">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Loading...
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 font-mono">
              {daysCount}d
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
