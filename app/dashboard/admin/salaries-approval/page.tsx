"use client";

import React, { useState, useEffect } from "react";
import {
  Loader2, CheckCircle, XCircle, Eye, Moon, Sun,
  Coffee, Target, TrendingUp, TrendingDown, Banknote,
  ClipboardCheck, User, RefreshCw, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

const fmt = (n: number) =>
  `LKR ${(n ?? 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtShort = (n: number) =>
  `LKR ${(n ?? 0).toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/* ─── Status badge ─────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  if (status === "Approved")
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px]">Approved</Badge>;
  if (status === "Rejected")
    return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-[10px]">Rejected</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-[10px]">Pending</Badge>;
}

/* ─── Stat card ────────────────────────────────────────────────────────── */
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

/* ─── Payslip detail dialog ───────────────────────────────────────────── */
function PayslipDialog({
  salary, open, onClose, onApprove, onReject,
}: {
  salary: any; open: boolean; onClose: () => void;
  onApprove?: (id: string) => void; onReject?: (id: string) => void;
}) {
  if (!salary) return null;

  const totalEarnings =
    (salary.basic_salary ?? 0) + (salary.auto_commissions ?? 0) +
    (salary.manual_commissions_added ?? 0) + (salary.lunch_allowance ?? 0) +
    (salary.night_out_allowance ?? 0) + (salary.target_bonus_amount ?? 0);

  const totalDeductions =
    (salary.manual_commissions_deducted ?? 0) + (salary.other_deductions ?? 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">

        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-muted/20">
          <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-base font-semibold leading-tight">{salary.profiles?.full_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground font-normal">{salary.salary_month}</p>
              </div>
            </div>
            <StatusBadge status={salary.admin_approval_status} />
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-5">

          {/* Attendance */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-blue-50/50">
              <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <Sun className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Working Days</p>
                <p className="text-xl font-extrabold tabular-nums">{salary.working_days ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-purple-50/50">
              <div className="h-8 w-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                <Moon className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Night Out Days</p>
                <p className="text-xl font-extrabold tabular-nums">{salary.night_out_days ?? 0}</p>
              </div>
            </div>
          </div>

          {/* Earnings & Deductions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Earnings */}
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Earnings</span>
              </div>
              <div className="px-4 py-3 space-y-1.5">
                {[
                  { label: "Basic Salary", value: salary.basic_salary },
                  { label: "Auto Commissions", value: salary.auto_commissions },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-sm py-1 border-b border-dashed border-muted last:border-0">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-semibold tabular-nums">{fmt(r.value)}</span>
                  </div>
                ))}
                {salary.manual_commissions_added > 0 && (
                  <div className="flex justify-between text-sm py-1 border-b border-dashed border-muted">
                    <span className="text-emerald-700">Manual Comm. (Added)</span>
                    <span className="font-semibold tabular-nums text-emerald-700">+ {fmt(salary.manual_commissions_added)}</span>
                  </div>
                )}
                {salary.lunch_allowance > 0 && (
                  <div className="flex justify-between text-sm py-1 border-b border-dashed border-muted">
                    <span className="text-orange-600 flex items-center gap-1"><Coffee className="h-3 w-3" /> Lunch Allowance</span>
                    <span className="font-semibold tabular-nums text-orange-600">+ {fmt(salary.lunch_allowance)}</span>
                  </div>
                )}
                {salary.night_out_allowance > 0 && (
                  <div className="flex justify-between text-sm py-1 border-b border-dashed border-muted">
                    <span className="text-purple-600 flex items-center gap-1"><Moon className="h-3 w-3" /> Night Out Allowance</span>
                    <span className="font-semibold tabular-nums text-purple-600">+ {fmt(salary.night_out_allowance)}</span>
                  </div>
                )}
                {salary.target_bonus_amount > 0 && (
                  <div className="flex justify-between text-sm py-1 border-b border-dashed border-muted">
                    <span className="text-sky-600 flex items-center gap-1"><Target className="h-3 w-3" /> Target Bonus</span>
                    <span className="font-semibold tabular-nums text-sky-600">+ {fmt(salary.target_bonus_amount)}</span>
                  </div>
                )}
                <Separator className="my-1" />
                <div className="flex justify-between text-sm font-extrabold text-emerald-700">
                  <span>Total Earnings</span>
                  <span className="tabular-nums">{fmt(totalEarnings)}</span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deductions</span>
              </div>
              <div className="px-4 py-3 space-y-1.5">
                {salary.manual_commissions_deducted > 0 && (
                  <div className="flex justify-between text-sm py-1 border-b border-dashed border-muted">
                    <span className="text-red-600">Manual Comm. (Deducted)</span>
                    <span className="font-semibold tabular-nums text-red-600">− {fmt(salary.manual_commissions_deducted)}</span>
                  </div>
                )}
                {salary.other_deductions > 0 && (
                  <div className="flex justify-between text-sm py-1 border-b border-dashed border-muted">
                    <span className="text-red-600">Other Deductions</span>
                    <span className="font-semibold tabular-nums text-red-600">− {fmt(salary.other_deductions)}</span>
                  </div>
                )}
                {totalDeductions <= 0 && (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">No deductions applied.</p>
                )}
                <Separator className="my-1" />
                <div className="flex justify-between text-sm font-extrabold text-red-600">
                  <span>Total Deductions</span>
                  <span className="tabular-nums">− {fmt(totalDeductions)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net pay */}
          <div className="rounded-lg border bg-muted/30 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Net Pay</p>
              <p className="text-xs text-muted-foreground mt-0.5">{fmt(totalEarnings)} − {fmt(totalDeductions)}</p>
            </div>
            <span className="text-2xl font-extrabold tabular-nums">{fmt(salary.net_salary)}</span>
          </div>

          {/* Approval info for approved records */}
          {salary.admin_approval_status === "Approved" && salary.approved_at && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>
                Approved on{" "}
                {new Date(salary.approved_at).toLocaleDateString("en-LK", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </span>
            </div>
          )}

          {/* Actions — only for pending */}
          {salary.admin_approval_status === "Pending" && onApprove && onReject && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 h-10"
                onClick={() => { onApprove(salary.id); onClose(); }}
              >
                <CheckCircle className="w-4 h-4 mr-2" /> Approve
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 h-10"
                onClick={() => { onReject(salary.id); onClose(); }}
              >
                <XCircle className="w-4 h-4 mr-2" /> Reject
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Salary table (shared between tabs) ─────────────────────────────── */
function SalaryTable({
  rows, isPending, onView, onApprove, onReject,
}: {
  rows: any[];
  isPending: boolean;
  onView: (s: any) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
        {isPending
          ? <><CheckCircle className="w-9 h-9 mb-3 text-muted-foreground/30" /><p className="font-medium">All caught up — no pending records.</p></>
          : <><History className="w-9 h-9 mb-3 text-muted-foreground/30" /><p className="font-medium">No salary records found.</p></>}
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="pl-5">Employee</TableHead>
              <TableHead>Month</TableHead>
              <TableHead className="text-center">
                <span className="flex items-center justify-center gap-1"><Sun className="h-3 w-3" /> Days</span>
              </TableHead>
              <TableHead className="text-center">
                <span className="flex items-center justify-center gap-1"><Moon className="h-3 w-3" /> Nights</span>
              </TableHead>
              <TableHead className="text-right">Basic</TableHead>
              <TableHead className="text-right">Commissions</TableHead>
              <TableHead className="text-right">Allowances</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net Pay</TableHead>
              {!isPending && <TableHead className="text-center">Status</TableHead>}
              <TableHead className="text-center pr-5">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/20">
                <TableCell className="pl-5 font-medium">{s.profiles?.full_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{s.salary_month}</TableCell>
                <TableCell className="text-center">
                  <span className="font-semibold tabular-nums text-blue-700">{s.working_days ?? 0}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-semibold tabular-nums text-purple-700">{s.night_out_days ?? 0}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground text-sm">{fmt(s.basic_salary)}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {fmt((s.auto_commissions ?? 0) + (s.manual_commissions_added ?? 0))}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-orange-600">
                  {fmt((s.lunch_allowance ?? 0) + (s.night_out_allowance ?? 0))}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-red-600">
                  − {fmt((s.manual_commissions_deducted ?? 0) + (s.other_deductions ?? 0))}
                </TableCell>
                <TableCell className="text-right font-extrabold tabular-nums">{fmt(s.net_salary)}</TableCell>
                {!isPending && (
                  <TableCell className="text-center"><StatusBadge status={s.admin_approval_status} /></TableCell>
                )}
                <TableCell className="pr-5">
                  <div className="flex justify-center items-center gap-1">
                    <Button
                      size="icon" variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="View full slip"
                      onClick={() => onView(s)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {isPending && onApprove && onReject && (
                      <>
                        <Button size="sm" variant="outline"
                          className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                          onClick={() => onApprove(s.id)}>
                          <CheckCircle className="h-3 w-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline"
                          className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => onReject(s.id)}>
                          <XCircle className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y">
        {rows.map((s) => (
          <div key={s.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{s.profiles?.full_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{s.salary_month}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-extrabold tabular-nums">{fmt(s.net_salary)}</p>
                {!isPending && <StatusBadge status={s.admin_approval_status} />}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="flex items-center gap-1 text-blue-700"><Sun className="h-3 w-3" />{s.working_days ?? 0} days</span>
              <span className="flex items-center gap-1 text-purple-700"><Moon className="h-3 w-3" />{s.night_out_days ?? 0} nights</span>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="ghost" className="flex-none h-8 text-xs px-2" onClick={() => onView(s)}>
                <Eye className="h-3.5 w-3.5 mr-1" /> View
              </Button>
              {isPending && onApprove && onReject && (
                <>
                  <Button size="sm" className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => onApprove(s.id)}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => onReject(s.id)}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── Main page ────────────────────────────────────────────────────────── */
export default function AdminSalariesApprovalPage() {
  const [pending, setPending]       = useState<any[]>([]);
  const [allSalaries, setAllSalaries] = useState<any[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [adminId, setAdminId]       = useState<string | null>(null);
  const [detailSalary, setDetailSalary] = useState<any>(null);

  // Filters for "All Salaries" tab
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMonth, setFilterMonth]   = useState("all");

  useEffect(() => {
    const user = getUserBusinessContext();
    if (user?.id) setAdminId(user.id);
    loadAll();
  }, []);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [pendingRes, allRes] = await Promise.all([
        fetch("/api/salaries?admin_approval_status=Pending"),
        fetch("/api/salaries"),
      ]);
      if (pendingRes.ok) setPending((await pendingRes.json()).salaries || []);
      if (allRes.ok)     setAllSalaries((await allRes.json()).salaries || []);
    } catch {
      toast.error("Failed to load salaries");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: "Approved" | "Rejected") => {
    try {
      const res = await fetch(`/api/salaries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_approval_status: status, approved_by: adminId }),
      });
      if (res.ok) {
        toast.success(`Salary ${status === "Approved" ? "approved ✓" : "rejected"}`);
        loadAll();
      } else {
        toast.error("Failed to update status.");
      }
    } catch {
      toast.error("An error occurred.");
    }
  };

  // Unique months from all salaries for filter dropdown
  const months = Array.from(new Set(allSalaries.map((s) => s.salary_month).filter(Boolean))).sort().reverse();

  const filteredAll = allSalaries.filter((s) => {
    const statusOk = filterStatus === "all" || s.admin_approval_status === filterStatus;
    const monthOk  = filterMonth === "all"  || s.salary_month === filterMonth;
    return statusOk && monthOk;
  });

  // Stats
  const totalPayout    = pending.reduce((s, r) => s + (r.net_salary ?? 0), 0);
  const totalAllowance = pending.reduce((s, r) => s + (r.lunch_allowance ?? 0) + (r.night_out_allowance ?? 0), 0);
  const totalDeduct    = pending.reduce((s, r) => s + (r.manual_commissions_deducted ?? 0) + (r.other_deductions ?? 0), 0);
  const approvedCount  = allSalaries.filter((s) => s.admin_approval_status === "Approved").length;

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Salary Approvals</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review pending salaries and browse the full salary history.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 self-start" onClick={loadAll} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Pending Approval" value={String(pending.length)}
          sub="Awaiting your review"
          icon={<ClipboardCheck className="h-4 w-4" />}
          iconBg="bg-amber-50" iconColor="text-amber-600" valueColor="text-amber-700"
        />
        <StatCard
          label="Approved Total" value={String(approvedCount)}
          sub="Released to reps"
          icon={<CheckCircle className="h-4 w-4" />}
          iconBg="bg-emerald-50" iconColor="text-emerald-600" valueColor="text-emerald-700"
        />
        <StatCard
          label="Pending Payout" value={fmtShort(totalPayout)}
          sub="If all pending approved"
          icon={<Banknote className="h-4 w-4" />}
          iconBg="bg-blue-50" iconColor="text-blue-600" valueColor="text-blue-700"
        />
        <StatCard
          label="Pending Allowances" value={fmtShort(totalAllowance)}
          sub="Lunch + night out"
          icon={<Coffee className="h-4 w-4" />}
          iconBg="bg-orange-50" iconColor="text-orange-600" valueColor="text-orange-700"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList className="h-9">
          <TabsTrigger value="pending" className="text-xs gap-1.5">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Pending Approvals
            {pending.length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs gap-1.5">
            <History className="h-3.5 w-3.5" />
            All Salaries
            <span className="ml-1 bg-muted text-muted-foreground text-[9px] font-bold rounded-full px-1.5 py-0.5">
              {allSalaries.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* ── Pending tab ── */}
        <TabsContent value="pending" className="mt-4">
          <Card className="shadow-sm">
            <CardHeader className="px-5 pt-4 pb-3 border-b">
              <CardTitle className="text-base">Pending Salary Records</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SalaryTable
                rows={pending}
                isPending={true}
                onView={setDetailSalary}
                onApprove={(id) => handleStatusChange(id, "Approved")}
                onReject={(id) => handleStatusChange(id, "Rejected")}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── All salaries tab ── */}
        <TabsContent value="all" className="mt-4 space-y-4">

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="All months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filterStatus !== "all" || filterMonth !== "all") && (
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
                onClick={() => { setFilterStatus("all"); setFilterMonth("all"); }}>
                Clear filters
              </Button>
            )}

            <span className="ml-auto text-xs text-muted-foreground self-center">
              {filteredAll.length} record{filteredAll.length !== 1 ? "s" : ""}
            </span>
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-0">
              <SalaryTable
                rows={filteredAll}
                isPending={false}
                onView={setDetailSalary}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payslip dialog */}
      <PayslipDialog
        salary={detailSalary}
        open={!!detailSalary}
        onClose={() => setDetailSalary(null)}
        onApprove={(id) => handleStatusChange(id, "Approved")}
        onReject={(id) => handleStatusChange(id, "Rejected")}
      />
    </div>
  );
}
