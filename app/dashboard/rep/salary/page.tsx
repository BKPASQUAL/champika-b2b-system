"use client";

import React, { useState, useEffect } from "react";
import {
  Loader2, Banknote, Sun, Moon, Coffee, Target,
  TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  CheckCircle2, Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const fmt = (n: number) =>
  `LKR ${(n ?? 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtShort = (n: number) =>
  `LKR ${(n ?? 0).toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/* ─── Stat card (matches commission tracker) ──────────────────────────── */
function StatCard({
  label, value, sub, icon, iconBg, iconColor, valueColor,
}: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; iconBg: string; iconColor: string; valueColor: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">
            {label}
          </p>
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
            {icon}
          </div>
        </div>
        <p className={`text-lg sm:text-xl font-bold tabular-nums ${valueColor} truncate`}>{value}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
      </CardContent>
    </Card>
  );
}

/* ─── Single salary slip row ──────────────────────────────────────────── */
function SalaryRow({ label, value, badge }: { label: string; value: number; badge?: string }) {
  if (value <= 0) return null;
  return (
    <div className="flex justify-between items-center py-2 text-sm border-b border-dashed border-muted last:border-0">
      <span className="text-muted-foreground flex items-center gap-1.5">
        {badge && (
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${badge}`} />
        )}
        {label}
      </span>
      <span className="font-semibold tabular-nums text-foreground">{fmt(value)}</span>
    </div>
  );
}

/* ─── Salary slip card ────────────────────────────────────────────────── */
function SalarySlip({ s }: { s: any }) {
  const [expanded, setExpanded] = useState(false);

  const totalEarnings =
    (s.basic_salary ?? 0) + (s.auto_commissions ?? 0) +
    (s.manual_commissions_added ?? 0) + (s.lunch_allowance ?? 0) +
    (s.night_out_allowance ?? 0) + (s.target_bonus_amount ?? 0);

  const totalDeductions =
    (s.manual_commissions_deducted ?? 0) + (s.other_deductions ?? 0);

  return (
    <Card className="shadow-sm overflow-hidden">

      {/* ── Header row ── */}
      <CardHeader className="px-5 pt-4 pb-3 border-b bg-muted/20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">{s.salary_month}</CardTitle>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px] font-semibold">
                <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Approved
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 pl-6">
              Released: {s.payment_date
                ? new Date(s.payment_date).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" })
                : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Net Pay</p>
            <p className="text-2xl font-extrabold tabular-nums text-foreground">{fmt(s.net_salary)}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">

        {/* ── Attendance strip ── */}
        <div className="grid grid-cols-2 divide-x border-b bg-muted/10">
          <div className="flex items-center gap-2.5 px-5 py-3">
            <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Sun className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Working Days</p>
              <p className="text-base font-bold tabular-nums">{s.working_days ?? 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-5 py-3">
            <div className="h-7 w-7 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <Moon className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Night Out Days</p>
              <p className="text-base font-bold tabular-nums">{s.night_out_days ?? 0}</p>
            </div>
          </div>
        </div>

        {/* ── Summary quick row ── */}
        <div className="grid grid-cols-3 divide-x border-b text-center">
          {[
            { label: "Earnings", value: fmtShort(totalEarnings), color: "text-emerald-600" },
            { label: "Deductions", value: fmtShort(totalDeductions), color: "text-red-500" },
            { label: "Net Salary", value: fmtShort(s.net_salary), color: "text-foreground font-extrabold" },
          ].map((item) => (
            <div key={item.label} className="px-3 py-3">
              <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">{item.label}</p>
              <p className={`text-sm font-bold tabular-nums mt-0.5 ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* ── Expandable breakdown ── */}
        <button
          className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/20 transition-colors border-b"
          onClick={() => setExpanded(!expanded)}
        >
          <span>Salary Breakdown</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {expanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x">

            {/* Earnings */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-3">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Earnings</span>
              </div>
              <SalaryRow label="Basic Salary" value={s.basic_salary} badge="bg-gray-400" />
              <SalaryRow label="Auto Commissions" value={s.auto_commissions} badge="bg-blue-400" />
              <SalaryRow label="Manual Commission (Added)" value={s.manual_commissions_added} badge="bg-emerald-500" />
              <SalaryRow label="Lunch Allowance" value={s.lunch_allowance} badge="bg-orange-400" />
              <SalaryRow label="Night Out Allowance" value={s.night_out_allowance} badge="bg-purple-400" />
              <SalaryRow label="Target Bonus" value={s.target_bonus_amount} badge="bg-sky-400" />
              <div className="flex justify-between items-center pt-3 mt-1">
                <span className="text-xs font-bold uppercase text-muted-foreground tracking-wide">Total Earnings</span>
                <span className="text-sm font-extrabold tabular-nums text-emerald-600">{fmt(totalEarnings)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-3">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deductions</span>
              </div>
              <SalaryRow label="Manual Commission (Deducted)" value={s.manual_commissions_deducted} badge="bg-red-400" />
              <SalaryRow label="Other Deductions" value={s.other_deductions} badge="bg-red-300" />
              {totalDeductions <= 0 && (
                <p className="text-xs text-muted-foreground italic py-3">No deductions this period.</p>
              )}
              <div className="flex justify-between items-center pt-3 mt-1">
                <span className="text-xs font-bold uppercase text-muted-foreground tracking-wide">Total Deductions</span>
                <span className="text-sm font-extrabold tabular-nums text-red-500">− {fmt(totalDeductions)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */
export default function RepSalaryPage() {
  const [salaries, setSalaries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("currentUser");
    if (stored) {
      const id = JSON.parse(stored).id;
      if (id) loadMySalaries(id);
      else setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadMySalaries = async (userId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/salaries?user_id=${userId}&admin_approval_status=Approved`);
      if (res.ok) {
        const data = await res.json();
        setSalaries(data.salaries || []);
      }
    } catch {
      toast.error("Failed to load salary data");
    } finally {
      setIsLoading(false);
    }
  };

  /* Summary stats across all approved salaries */
  const totalNetPay    = salaries.reduce((s, r) => s + (r.net_salary ?? 0), 0);
  const totalBasic     = salaries.reduce((s, r) => s + (r.basic_salary ?? 0), 0);
  const totalComm      = salaries.reduce((s, r) => s + (r.auto_commissions ?? 0) + (r.manual_commissions_added ?? 0), 0);
  const totalAllowance = salaries.reduce((s, r) => s + (r.lunch_allowance ?? 0) + (r.night_out_allowance ?? 0), 0);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">My Salary</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Approved salary statements — expand each month for the full breakdown.
          </p>
        </div>
      </div>

      {/* Stat summary cards */}
      {salaries.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Net Pay" value={fmtShort(totalNetPay)}
            sub={`${salaries.length} approved month${salaries.length !== 1 ? "s" : ""}`}
            icon={<Banknote className="h-4 w-4" />}
            iconBg="bg-emerald-50" iconColor="text-emerald-600" valueColor="text-emerald-700"
          />
          <StatCard
            label="Total Basic" value={fmtShort(totalBasic)}
            sub="Base salary paid"
            icon={<TrendingUp className="h-4 w-4" />}
            iconBg="bg-blue-50" iconColor="text-blue-600" valueColor="text-blue-700"
          />
          <StatCard
            label="Total Commissions" value={fmtShort(totalComm)}
            sub="Auto + manual additions"
            icon={<Target className="h-4 w-4" />}
            iconBg="bg-sky-50" iconColor="text-sky-600" valueColor="text-sky-700"
          />
          <StatCard
            label="Total Allowances" value={fmtShort(totalAllowance)}
            sub="Lunch + night out"
            icon={<Coffee className="h-4 w-4" />}
            iconBg="bg-orange-50" iconColor="text-orange-600" valueColor="text-orange-700"
          />
        </div>
      )}

      {/* Salary slips */}
      {salaries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Banknote className="w-10 h-10 mb-3 text-muted-foreground/40" />
            <p className="font-medium">No approved salary records yet.</p>
            <p className="text-xs mt-1">Your salary will appear here once approved by admin.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {salaries.map((s) => <SalarySlip key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );
}
