"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  Banknote,
  Eye,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Target,
  Download,
  Share2,
  CheckCircle,
  XCircle,
  Search,
  Users,
  ShieldCheck,
  Building2,
  FileText,
  DollarSign,
  Coffee,
  Moon,
  ArrowRight,
} from "lucide-react";
import { downloadPayslip, sharePayslip } from "@/app/dashboard/office/distribution/salaries/generate-payslip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TableBody,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { BUSINESS_NAMES } from "@/app/config/business-constants";

const fmt = (amount: number) =>
  `LKR ${(amount ?? 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtShort = (amount: number) =>
  `LKR ${(amount ?? 0).toLocaleString("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

interface Profile {
  id: string;
  fullName?: string;
  full_name?: string;
  username?: string;
  email: string;
  role?: string;
}

interface SalaryRecord {
  id: string;
  user_id: string;
  profiles?: { full_name: string; email: string };
  salary_month: string;
  payment_date: string;
  basic_salary: number;
  auto_commissions: number;
  manual_commissions_added: number;
  manual_commissions_deducted: number;
  target_bonus_amount: number;
  other_deductions: number;
  lunch_allowance: number;
  working_days: number;
  night_out_days: number;
  night_out_allowance: number;
  net_salary: number;
  admin_approval_status: string;
  business_id?: string;
  created_at?: string;
}

const BLANK_FORM = {
  userId: "",
  salaryMonth: "",
  basicSalary: 0,
  autoCommissions: 0,
  manualCommissionsAdded: 0,
  manualCommissionsDeducted: 0,
  targetBonusAmount: 0,
  otherDeductions: 0,
  lunchAllowance: 0,
  workingDays: 26,
  nightOutDays: 0,
  nightOutAllowance: 0,
  paymentDate: new Date().toISOString().split("T")[0],
  adminApprovalStatus: "Approved",
  businessId: "global",
};

export default function AdminSalariesPage() {
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterBusiness, setFilterBusiness] = useState("ALL");

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingSalary, setViewingSalary] = useState<SalaryRecord | null>(null);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const loadData = async () => {
    setLoading(true);
    try {
      const [profRes, salRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/salaries"),
      ]);

      if (profRes.ok) {
        const u = await profRes.json();
        setProfiles(Array.isArray(u) ? u : u.users || []);
      }
      if (salRes.ok) {
        const s = await salRes.json();
        setSalaries(s.salaries || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load staff salaries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setFilterMonth(currentMonthStr);
  }, []);

  // Filtered Salaries
  const filteredSalaries = useMemo(() => {
    return salaries.filter((s) => {
      const name = (s.profiles?.full_name || (s.profiles as any)?.fullName || "").toLowerCase();
      const email = s.profiles?.email?.toLowerCase() || "";
      const q = search.toLowerCase();
      const matchesSearch = !q || name.includes(q) || email.includes(q);

      const matchesMonth = !filterMonth || s.salary_month === filterMonth;
      const matchesStatus =
        filterStatus === "ALL" || s.admin_approval_status === filterStatus;
      const matchesBiz =
        filterBusiness === "ALL" ||
        s.business_id === filterBusiness ||
        (!s.business_id && filterBusiness === "global");

      return matchesSearch && matchesMonth && matchesStatus && matchesBiz;
    });
  }, [salaries, search, filterMonth, filterStatus, filterBusiness]);

  // Calculations for summary stats
  const stats = useMemo(() => {
    const totalNet = filteredSalaries.reduce((sum, s) => sum + (s.net_salary || 0), 0);
    const approvedNet = filteredSalaries
      .filter((s) => s.admin_approval_status === "Approved")
      .reduce((sum, s) => sum + (s.net_salary || 0), 0);
    const pendingCount = filteredSalaries.filter(
      (s) => s.admin_approval_status === "Pending"
    ).length;

    return {
      totalNet,
      approvedNet,
      pendingCount,
      count: filteredSalaries.length,
    };
  }, [filteredSalaries]);

  // Form Net Salary live computation
  const liveNetSalary = useMemo(() => {
    const earnings =
      Number(form.basicSalary || 0) +
      Number(form.autoCommissions || 0) +
      Number(form.manualCommissionsAdded || 0) +
      Number(form.targetBonusAmount || 0) +
      Number(form.lunchAllowance || 0) +
      Number(form.nightOutAllowance || 0);

    const deductions =
      Number(form.manualCommissionsDeducted || 0) +
      Number(form.otherDeductions || 0);

    return earnings - deductions;
  }, [form]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({
      ...BLANK_FORM,
      salaryMonth: filterMonth || currentMonthStr,
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (s: SalaryRecord) => {
    setEditingId(s.id);
    setForm({
      userId: s.user_id,
      salaryMonth: s.salary_month || "",
      basicSalary: s.basic_salary || 0,
      autoCommissions: s.auto_commissions || 0,
      manualCommissionsAdded: s.manual_commissions_added || 0,
      manualCommissionsDeducted: s.manual_commissions_deducted || 0,
      targetBonusAmount: s.target_bonus_amount || 0,
      otherDeductions: s.other_deductions || 0,
      lunchAllowance: s.lunch_allowance || 0,
      workingDays: s.working_days || 26,
      nightOutDays: s.night_out_days || 0,
      nightOutAllowance: s.night_out_allowance || 0,
      paymentDate: s.payment_date || new Date().toISOString().split("T")[0],
      adminApprovalStatus: s.admin_approval_status || "Approved",
      businessId: s.business_id || "global",
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.userId) {
      toast.error("Please select an employee");
      return;
    }
    if (!form.salaryMonth) {
      toast.error("Please select the salary month");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        user_id: form.userId,
        salary_month: form.salaryMonth,
        basic_salary: Number(form.basicSalary) || 0,
        auto_commissions: Number(form.autoCommissions) || 0,
        manual_commissions_added: Number(form.manualCommissionsAdded) || 0,
        manual_commissions_deducted: Number(form.manualCommissionsDeducted) || 0,
        target_bonus_amount: Number(form.targetBonusAmount) || 0,
        other_deductions: Number(form.otherDeductions) || 0,
        lunch_allowance: Number(form.lunchAllowance) || 0,
        working_days: Number(form.workingDays) || 0,
        night_out_days: Number(form.nightOutDays) || 0,
        night_out_allowance: Number(form.nightOutAllowance) || 0,
        payment_date: form.paymentDate,
        admin_approval_status: form.adminApprovalStatus,
        business_id: form.businessId === "global" ? null : form.businessId,
      };

      if (editingId) {
        const res = await fetch(`/api/salaries/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update salary");
        toast.success("Salary record updated successfully");
      } else {
        const res = await fetch("/api/salaries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to create salary");
        }
        toast.success("Staff salary recorded successfully");
      }

      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Error saving salary");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/salaries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_approval_status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`Salary marked as ${newStatus}`);
      loadData();
    } catch (err) {
      toast.error("Error updating status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this salary record?")) return;
    try {
      const res = await fetch(`/api/salaries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete salary");
      toast.success("Salary record deleted");
      loadData();
    } catch (err) {
      toast.error("Error deleting salary");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Banknote className="w-8 h-8 text-primary" />
              Staff Salaries & Payroll
            </h1>
            <Badge variant="outline" className="text-xs font-semibold">
              HR & Personnel Costs
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage employee monthly salaries, allowances, incentives, and official payslips.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild size="sm">
            <Link href="/dashboard/admin/reports/monthly-pnl">
              <ArrowRight className="w-4 h-4 mr-1.5 text-blue-600" />
              View Monthly P&L
            </Link>
          </Button>

          <Button onClick={handleOpenCreate} size="sm" className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-1.5" />
            Record Staff Salary
          </Button>
        </div>
      </div>

      {/* ─── Top Stats Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-blue-200/50 bg-blue-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Monthly Payroll
            </CardTitle>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {fmt(stats.totalNet)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.count} staff records ({filterMonth || "All Months"})
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-emerald-200/50 bg-emerald-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
              Approved Payroll
            </CardTitle>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {fmt(stats.approvedNet)}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-300 mt-1">
              Active in Monthly P&L report
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-amber-200/50 bg-amber-50/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
              Pending Approvals
            </CardTitle>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {stats.pendingCount}
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
              Requires Admin review
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Employees Listed
            </CardTitle>
            <Users className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {profiles.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered staff & reps
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Filters & Search ──────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search staff name or email..."
                className="pl-8 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Month Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <Input
                type="month"
                className="w-40 text-xs h-9"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              />
              {filterMonth && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-muted-foreground"
                  onClick={() => setFilterMonth("")}
                >
                  Clear Month
                </Button>
              )}
            </div>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            {/* Business Filter */}
            <Select value={filterBusiness} onValueChange={setFilterBusiness}>
              <SelectTrigger className="w-44 text-xs h-9">
                <SelectValue placeholder="Business Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Businesses</SelectItem>
                <SelectItem value="global">Global / Office</SelectItem>
                {Object.entries(BUSINESS_NAMES).map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="ghost" size="sm" onClick={loadData} className="text-xs text-muted-foreground">
            Refresh
          </Button>
        </CardContent>
      </Card>

      {/* ─── Salary Table ──────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Staff Salary Register {filterMonth && `— ${filterMonth}`}
          </CardTitle>
          <CardDescription>
            Detailed payroll breakdown for each employee. Approved salaries automatically feed into Monthly Profit & Loss.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading salary records...</p>
            </div>
          ) : filteredSalaries.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground space-y-3">
              <p>No staff salary records found for the selected month or filters.</p>
              <Button onClick={handleOpenCreate} size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Record First Salary for {filterMonth || "This Month"}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Basic Pay</TableHead>
                  <TableHead className="text-right text-emerald-600">Allowances & Comm.</TableHead>
                  <TableHead className="text-right text-rose-600">Deductions</TableHead>
                  <TableHead className="text-right font-bold text-slate-900 dark:text-slate-100">
                    Net Salary
                  </TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSalaries.map((s) => {
                  const additions =
                    (Number(s.auto_commissions) || 0) +
                    (Number(s.manual_commissions_added) || 0) +
                    (Number(s.target_bonus_amount) || 0) +
                    (Number(s.lunch_allowance) || 0) +
                    (Number(s.night_out_allowance) || 0);

                  const deductions =
                    (Number(s.manual_commissions_deducted) || 0) +
                    (Number(s.other_deductions) || 0);

                  return (
                    <TableRow key={s.id} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                          {s.profiles?.full_name || (s.profiles as any)?.fullName || "Unknown Staff"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {s.profiles?.email || ""}
                        </div>
                      </TableCell>

                      <TableCell className="font-mono text-xs">
                        <Badge variant="outline" className="text-[11px]">
                          {s.salary_month}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs">
                        {fmtShort(s.basic_salary)}
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs text-emerald-600 font-medium">
                        +{fmtShort(additions)}
                      </TableCell>

                      <TableCell className="text-right font-mono text-xs text-rose-600 font-medium">
                        {deductions > 0 ? `-${fmtShort(deductions)}` : "—"}
                      </TableCell>

                      <TableCell className="text-right font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {fmt(s.net_salary)}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            s.admin_approval_status === "Approved"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold text-[10px]"
                              : s.admin_approval_status === "Rejected"
                              ? "bg-rose-50 text-rose-700 border-rose-300 font-semibold text-[10px]"
                              : "bg-amber-50 text-amber-700 border-amber-300 font-semibold text-[10px]"
                          }
                        >
                          {s.admin_approval_status}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick Approval / Rejection */}
                          {s.admin_approval_status !== "Approved" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              title="Approve Salary"
                              onClick={() => handleStatusChange(s.id, "Approved")}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          {s.admin_approval_status === "Approved" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              title="Set to Pending"
                              onClick={() => handleStatusChange(s.id, "Pending")}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}

                          {/* View Payslip */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="View Payslip"
                            onClick={() => setViewingSalary(s)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {/* Download PDF */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-600 hover:text-slate-800"
                            title="Download PDF"
                            onClick={() => downloadPayslip(s as any)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>

                          {/* Edit */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-600 hover:text-slate-800"
                            title="Edit"
                            onClick={() => handleOpenEdit(s)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>

                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            title="Delete"
                            onClick={() => handleDelete(s.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── ADD / EDIT SALARY DIALOG ───────────────────────────────────────── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" />
              {editingId ? "Edit Staff Salary" : "Record Staff Salary"}
            </DialogTitle>
            <DialogDescription>
              Enter employee basic pay, monthly allowances, commissions, and deductions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-4">
              {/* Employee - Full Width */}
              <div className="space-y-1.5 w-full">
                <Label className="text-xs font-semibold">Staff Member *</Label>
                <Select
                  value={form.userId}
                  onValueChange={(val) => setForm({ ...form, userId: val })}
                >
                  <SelectTrigger className="w-full text-xs h-10">
                    <SelectValue placeholder="Select Staff Member" />
                  </SelectTrigger>
                  <SelectContent position="popper" align="start" className="w-[var(--radix-select-trigger-width)] max-h-72">
                    {profiles.map((p) => {
                      const name = p.fullName || p.full_name || p.username || p.email;
                      return (
                        <SelectItem key={p.id} value={p.id} className="text-xs py-2 cursor-pointer">
                          <span className="font-medium">{name}</span>
                          {p.role && (
                            <span className="text-muted-foreground ml-1.5 font-normal">
                              ({p.role})
                            </span>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* 3-Column Base Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Salary Month */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Salary Month *</Label>
                  <Input
                    type="month"
                    className="w-full text-xs h-10"
                    value={form.salaryMonth}
                    onChange={(e) => setForm({ ...form, salaryMonth: e.target.value })}
                    required
                  />
                </div>

                {/* Basic Salary */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Basic Salary (LKR) *</Label>
                  <Input
                    type="number"
                    step="any"
                    className="w-full text-xs h-10"
                    value={form.basicSalary || ""}
                    onChange={(e) => setForm({ ...form, basicSalary: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g. 50000"
                    required
                  />
                </div>

                {/* Working Days */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Working Days</Label>
                  <Input
                    type="number"
                    className="w-full text-xs h-10"
                    value={form.workingDays || ""}
                    onChange={(e) => setForm({ ...form, workingDays: parseInt(e.target.value, 10) || 0 })}
                    placeholder="26"
                  />
                </div>
              </div>
            </div>

            <Separator />
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Allowances & Incentives (+ Earnings)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Coffee className="w-3.5 h-3.5 text-amber-600" />
                  Lunch Allowance
                </Label>
                <Input
                  type="number"
                  step="any"
                  className="text-xs"
                  value={form.lunchAllowance || ""}
                  onChange={(e) => setForm({ ...form, lunchAllowance: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  Night-Out Allowance
                </Label>
                <Input
                  type="number"
                  step="any"
                  className="text-xs"
                  value={form.nightOutAllowance || ""}
                  onChange={(e) => setForm({ ...form, nightOutAllowance: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-blue-600" />
                  Target Bonus
                </Label>
                <Input
                  type="number"
                  step="any"
                  className="text-xs"
                  value={form.targetBonusAmount || ""}
                  onChange={(e) => setForm({ ...form, targetBonusAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Commissions / Incentives</Label>
                <Input
                  type="number"
                  step="any"
                  className="text-xs"
                  value={form.manualCommissionsAdded || ""}
                  onChange={(e) => setForm({ ...form, manualCommissionsAdded: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Night Out Days</Label>
                <Input
                  type="number"
                  className="text-xs"
                  value={form.nightOutDays || ""}
                  onChange={(e) => setForm({ ...form, nightOutDays: parseInt(e.target.value, 10) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>

            <Separator />
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Deductions (- Reductions)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Advances / Commission Deductions</Label>
                <Input
                  type="number"
                  step="any"
                  className="text-xs"
                  value={form.manualCommissionsDeducted || ""}
                  onChange={(e) => setForm({ ...form, manualCommissionsDeducted: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Other Deductions (EPF / Loan / Fine)</Label>
                <Input
                  type="number"
                  step="any"
                  className="text-xs"
                  value={form.otherDeductions || ""}
                  onChange={(e) => setForm({ ...form, otherDeductions: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Live Calculation Preview Card */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">
                  Net Salary to Pay
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Basic ({fmtShort(form.basicSalary)}) + Allowances - Deductions
                </p>
              </div>
              <div className="text-2xl font-extrabold text-primary font-mono">
                {fmt(liveNetSalary)}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Payment Date</Label>
                <Input
                  type="date"
                  className="w-full text-xs h-10"
                  value={form.paymentDate}
                  onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Approval Status</Label>
                <Select
                  value={form.adminApprovalStatus}
                  onValueChange={(val) => setForm({ ...form, adminApprovalStatus: val })}
                >
                  <SelectTrigger className="w-full text-xs h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="start" className="w-[var(--radix-select-trigger-width)]">
                    <SelectItem value="Approved">Approved (Feed into P&L directly)</SelectItem>
                    <SelectItem value="Pending">Pending (Draft / Needs review)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingId ? (
                  "Update Salary"
                ) : (
                  "Save & Record Salary"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── VIEW PAYSLIP MODAL ────────────────────────────────────────────── */}
      {viewingSalary && (
        <Dialog open={!!viewingSalary} onOpenChange={() => setViewingSalary(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-primary" />
                Payslip — {viewingSalary.profiles?.full_name || (viewingSalary.profiles as any)?.fullName || "Staff"}
              </DialogTitle>
              <DialogDescription>
                Month: {viewingSalary.salary_month} • Status: {viewingSalary.admin_approval_status}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-xs">
              <div className="bg-muted/40 p-3 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm">
                    {viewingSalary.profiles?.full_name || (viewingSalary.profiles as any)?.fullName || "Staff"}
                  </p>
                  <p className="text-muted-foreground">{viewingSalary.profiles?.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-muted-foreground">Month: {viewingSalary.salary_month}</p>
                  <p className="font-mono text-muted-foreground">Paid: {viewingSalary.payment_date || "—"}</p>
                </div>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between font-semibold border-b pb-1">
                  <span>Earnings & Allowances</span>
                  <span>Amount (LKR)</span>
                </div>
                <div className="flex justify-between pl-2">
                  <span>Basic Salary</span>
                  <span className="font-mono">{fmt(viewingSalary.basic_salary)}</span>
                </div>
                {viewingSalary.lunch_allowance > 0 && (
                  <div className="flex justify-between pl-2">
                    <span>Lunch Allowance</span>
                    <span className="font-mono">{fmt(viewingSalary.lunch_allowance)}</span>
                  </div>
                )}
                {viewingSalary.night_out_allowance > 0 && (
                  <div className="flex justify-between pl-2">
                    <span>Night-out Allowance</span>
                    <span className="font-mono">{fmt(viewingSalary.night_out_allowance)}</span>
                  </div>
                )}
                {viewingSalary.target_bonus_amount > 0 && (
                  <div className="flex justify-between pl-2">
                    <span>Target Bonus</span>
                    <span className="font-mono">{fmt(viewingSalary.target_bonus_amount)}</span>
                  </div>
                )}
                {viewingSalary.auto_commissions > 0 && (
                  <div className="flex justify-between pl-2">
                    <span>Sales Commissions</span>
                    <span className="font-mono">{fmt(viewingSalary.auto_commissions)}</span>
                  </div>
                )}
                {viewingSalary.manual_commissions_added > 0 && (
                  <div className="flex justify-between pl-2">
                    <span>Additional Incentives</span>
                    <span className="font-mono">{fmt(viewingSalary.manual_commissions_added)}</span>
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between font-semibold border-b pb-1 text-rose-600">
                  <span>Deductions</span>
                  <span>Amount (LKR)</span>
                </div>
                {viewingSalary.manual_commissions_deducted > 0 && (
                  <div className="flex justify-between pl-2">
                    <span>Advance Repayments</span>
                    <span className="font-mono text-rose-600">
                      ({fmt(viewingSalary.manual_commissions_deducted)})
                    </span>
                  </div>
                )}
                {viewingSalary.other_deductions > 0 && (
                  <div className="flex justify-between pl-2">
                    <span>Other Deductions</span>
                    <span className="font-mono text-rose-600">
                      ({fmt(viewingSalary.other_deductions)})
                    </span>
                  </div>
                )}
                {viewingSalary.manual_commissions_deducted === 0 && viewingSalary.other_deductions === 0 && (
                  <p className="text-muted-foreground italic pl-2">No deductions</p>
                )}
              </div>

              <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex justify-between items-center">
                <span className="font-bold text-sm">NET PAYOUT:</span>
                <span className="text-xl font-extrabold font-mono text-primary">
                  {fmt(viewingSalary.net_salary)}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => downloadPayslip(viewingSalary as any)}>
                <Download className="w-4 h-4 mr-1.5" />
                Download PDF
              </Button>
              <Button onClick={() => setViewingSalary(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
