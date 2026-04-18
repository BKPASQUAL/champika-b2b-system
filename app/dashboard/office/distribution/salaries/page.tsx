"use client";

import React, { useState, useEffect } from "react";
import {
  Loader2, Plus, Banknote, Eye, Pencil, Trash2,
  TrendingUp, TrendingDown, CalendarDays, Target,
  Moon, Sun, Coffee, Download, Share2,
} from "lucide-react";
import { downloadPayslip, sharePayslip } from "./generate-payslip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardDescription,
  CardTitle, CardFooter,
} from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHead, TableRow, TableHeader,
  TableCell, TableBody,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency", currency: "LKR", minimumFractionDigits: 2,
  }).format(amount ?? 0);

interface Profile { id: string; fullName: string; role: string; }

interface SalaryRecord {
  id: string;
  user_id: string;
  profiles?: { full_name: string };
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
  workingDays: 0,
  nightOutDays: 0,
  nightOutAllowance: 0,
};

function StatusBadge({ status }: { status: string }) {
  if (status === "Approved")
    return <Badge className="bg-green-100 text-green-700 border-green-300 hover:bg-green-100">Approved</Badge>;
  if (status === "Rejected")
    return <Badge className="bg-red-100 text-red-700 border-red-300 hover:bg-red-100">Rejected</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100">Pending</Badge>;
}

/* ─── Salary Slip View Dialog ─────────────────────────────────────────── */
function SalaryViewDialog({
  salary, open, onClose,
}: { salary: SalaryRecord | null; open: boolean; onClose: () => void }) {
  if (!salary) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-indigo-600" />
            Salary Slip — {salary.profiles?.full_name}
          </DialogTitle>
        </DialogHeader>

        {/* Header strip */}
        <div className="bg-gray-50 border rounded-lg px-5 py-3 flex justify-between items-center text-sm">
          <div className="flex items-center gap-2 text-gray-700">
            <CalendarDays className="h-4 w-4 text-gray-400" />
            <span className="font-semibold">{salary.salary_month}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500">
              Released: {salary.payment_date ? new Date(salary.payment_date).toLocaleDateString() : "—"}
            </span>
            <StatusBadge status={salary.admin_approval_status} />
          </div>
        </div>

        {/* Attendance row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <Sun className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Working Days</p>
              <p className="text-lg font-bold text-blue-800">{salary.working_days ?? 0} days</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
            <Moon className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-xs text-purple-500 font-medium uppercase tracking-wide">Night Out Days</p>
              <p className="text-lg font-bold text-purple-800">{salary.night_out_days ?? 0} days</p>
            </div>
          </div>
        </div>

        {/* Earnings / Deductions grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border rounded-lg overflow-hidden">
          {/* Earnings */}
          <div className="p-5 space-y-3">
            <h3 className="uppercase text-xs font-bold tracking-wider text-gray-400 flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-green-500" /> Earnings
            </h3>
            {[
              { label: "Basic Salary", value: salary.basic_salary },
              { label: "Auto Commissions", value: salary.auto_commissions },
              salary.manual_commissions_added > 0 && { label: "Manual Comm. (Added)", value: salary.manual_commissions_added, accent: "green" },
              salary.target_bonus_amount > 0 && { label: "Target Bonus", value: salary.target_bonus_amount, accent: "blue", icon: <Target className="h-3 w-3" /> },
              salary.lunch_allowance > 0 && { label: "Lunch Allowance", value: salary.lunch_allowance, accent: "orange", icon: <Coffee className="h-3 w-3" /> },
              salary.night_out_allowance > 0 && { label: "Night Out Allowance", value: salary.night_out_allowance, accent: "purple", icon: <Moon className="h-3 w-3" /> },
            ].filter(Boolean).map((row: any, i) => (
              <div
                key={i}
                className={`flex justify-between items-center text-sm ${row.accent ? `text-${row.accent}-700 bg-${row.accent}-50 px-2 py-1 rounded` : ""}`}
              >
                <span className="flex items-center gap-1">{row.icon}{row.label}</span>
                <span className="font-semibold">{formatCurrency(row.value)}</span>
              </div>
            ))}
          </div>

          {/* Deductions */}
          <div className="p-5 space-y-3">
            <h3 className="uppercase text-xs font-bold tracking-wider text-gray-400 flex items-center gap-1">
              <TrendingDown className="h-4 w-4 text-red-500" /> Deductions
            </h3>
            {salary.manual_commissions_deducted > 0 && (
              <div className="flex justify-between items-center text-sm text-red-700 bg-red-50 px-2 py-1 rounded">
                <span>Manual Comm. (Deducted)</span>
                <span className="font-bold">-{formatCurrency(salary.manual_commissions_deducted)}</span>
              </div>
            )}
            {salary.other_deductions > 0 && (
              <div className="flex justify-between items-center text-sm text-red-700 bg-red-50 px-2 py-1 rounded">
                <span>Other Deductions</span>
                <span className="font-bold">-{formatCurrency(salary.other_deductions)}</span>
              </div>
            )}
            {(salary.manual_commissions_deducted <= 0 && salary.other_deductions <= 0) && (
              <p className="text-sm text-gray-400 italic py-2">No deductions applied.</p>
            )}
          </div>
        </div>

        {/* Net salary bar */}
        <div className="bg-gray-800 text-white px-6 py-4 rounded-lg flex items-center justify-between">
          <span className="font-semibold tracking-wide uppercase">Final Net Salary</span>
          <span className="text-2xl font-bold bg-gray-900 px-4 py-2 rounded shadow-inner">
            {formatCurrency(salary.net_salary)}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Salary Edit Dialog ──────────────────────────────────────────────── */
function SalaryEditDialog({
  salary, profiles, open, onClose, onSaved,
}: {
  salary: SalaryRecord | null;
  profiles: Profile[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (salary) {
      setForm({
        userId: salary.user_id,
        salaryMonth: salary.salary_month,
        basicSalary: salary.basic_salary,
        autoCommissions: salary.auto_commissions,
        manualCommissionsAdded: salary.manual_commissions_added,
        manualCommissionsDeducted: salary.manual_commissions_deducted,
        targetBonusAmount: salary.target_bonus_amount,
        otherDeductions: salary.other_deductions,
        lunchAllowance: salary.lunch_allowance ?? 0,
        workingDays: salary.working_days ?? 0,
        nightOutDays: salary.night_out_days ?? 0,
        nightOutAllowance: salary.night_out_allowance ?? 0,
      });
    }
  }, [salary]);

  const net =
    (form.basicSalary + form.autoCommissions + form.manualCommissionsAdded +
     form.targetBonusAmount + form.lunchAllowance + form.nightOutAllowance) -
    (form.manualCommissionsDeducted + form.otherDeductions);

  const f = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: Number(e.target.value) }));

  const handleSave = async () => {
    if (!salary) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/salaries/${salary.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basic_salary: form.basicSalary,
          auto_commissions: form.autoCommissions,
          manual_commissions_added: form.manualCommissionsAdded,
          manual_commissions_deducted: form.manualCommissionsDeducted,
          target_bonus_amount: form.targetBonusAmount,
          other_deductions: form.otherDeductions,
          lunch_allowance: form.lunchAllowance,
          working_days: form.workingDays,
          night_out_days: form.nightOutDays,
          night_out_allowance: form.nightOutAllowance,
          salary_month: form.salaryMonth,
        }),
      });
      if (res.ok) {
        toast.success("Salary updated. Sent back to Admin for re-approval.");
        onSaved();
        onClose();
      } else {
        toast.error("Failed to update salary.");
      }
    } catch {
      toast.error("An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-indigo-600" /> Edit Salary Record
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Salary Month</Label>
              <Input type="month" value={form.salaryMonth}
                onChange={(e) => setForm((p) => ({ ...p, salaryMonth: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Basic Salary</Label>
              <Input type="number" min="0" value={form.basicSalary || ""} onChange={f("basicSalary")} />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-bold uppercase text-gray-400 tracking-wider">Attendance</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="flex items-center gap-1"><Sun className="h-3 w-3 text-blue-500" /> Working Days</Label>
                <Input type="number" min="0" max="31" value={form.workingDays || ""} onChange={f("workingDays")} />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1"><Moon className="h-3 w-3 text-purple-500" /> Night Out Days</Label>
                <Input type="number" min="0" value={form.nightOutDays || ""} onChange={f("nightOutDays")} />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-bold uppercase text-gray-400 tracking-wider">Earnings</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Auto Commissions</Label>
                <Input type="number" value={form.autoCommissions || ""} disabled
                  className="bg-gray-100 text-gray-500 cursor-not-allowed" />
              </div>
              <div className="space-y-1">
                <Label>Manual Comm. (Added)</Label>
                <Input type="number" min="0" value={form.manualCommissionsAdded || ""}
                  onChange={f("manualCommissionsAdded")} className="border-green-300 bg-green-50" />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1"><Coffee className="h-3 w-3 text-orange-500" /> Lunch Allowance</Label>
                <Input type="number" min="0" value={form.lunchAllowance || ""}
                  onChange={f("lunchAllowance")} className="border-orange-200 bg-orange-50" />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1"><Moon className="h-3 w-3 text-purple-500" /> Night Out Allowance</Label>
                <Input type="number" min="0" value={form.nightOutAllowance || ""}
                  onChange={f("nightOutAllowance")} className="border-purple-200 bg-purple-50" />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1"><Target className="h-3 w-3 text-blue-500" /> Target Bonus</Label>
                <Input type="number" min="0" value={form.targetBonusAmount || ""}
                  onChange={f("targetBonusAmount")} />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-bold uppercase text-gray-400 tracking-wider">Deductions</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Manual Comm. (Reduced)</Label>
                <Input type="number" min="0" value={form.manualCommissionsDeducted || ""}
                  onChange={f("manualCommissionsDeducted")} className="border-red-300 bg-red-50" />
              </div>
              <div className="space-y-1">
                <Label>Other Deductions</Label>
                <Input type="number" min="0" value={form.otherDeductions || ""}
                  onChange={f("otherDeductions")} />
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-800 text-white rounded-lg flex items-center justify-between">
            <span className="font-semibold uppercase tracking-wider text-sm">Net Salary</span>
            <span className="text-xl font-bold">{formatCurrency(net)}</span>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────────── */
export default function SalariesEntryPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [salariesHistory, setSalariesHistory] = useState<SalaryRecord[]>([]);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculatingCommissions, setIsCalculatingCommissions] = useState(false);

  // Dialogs
  const [viewSalary, setViewSalary] = useState<SalaryRecord | null>(null);
  const [editSalary, setEditSalary] = useState<SalaryRecord | null>(null);

  useEffect(() => {
    const user = getUserBusinessContext();
    if (user?.businessId) setBusinessId(user.businessId);
    const d = new Date();
    setForm((p) => ({
      ...p,
      salaryMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    }));
  }, []);

  const loadData = async () => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      const [profilesRes, salariesRes] = await Promise.all([
        fetch(`/api/users`),
        fetch(`/api/salaries?business_id=${businessId}`),
      ]);
      if (profilesRes.ok) setProfiles(await profilesRes.json());
      if (salariesRes.ok) {
        const data = await salariesRes.json();
        setSalariesHistory(data.salaries || []);
      }
    } catch {
      toast.error("Failed to load records.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [businessId]);

  // Auto-calculate commissions
  useEffect(() => {
    const calc = async () => {
      if (!form.userId || !form.salaryMonth) { setForm((p) => ({ ...p, autoCommissions: 0 })); return; }
      setIsCalculatingCommissions(true);
      try {
        const res = await fetch(`/api/rep/commission?repId=${form.userId}`);
        if (res.ok) {
          const records = await res.json();
          const matched = records.filter((r: any) => {
            const d = new Date(r.invoiceDate);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === form.salaryMonth;
          });
          const total = matched.reduce((s: number, r: any) => s + (r.commissionEarned || 0), 0);
          setForm((p) => ({ ...p, autoCommissions: total }));
        }
      } catch {
        setForm((p) => ({ ...p, autoCommissions: 0 }));
      } finally {
        setIsCalculatingCommissions(false);
      }
    };
    calc();
  }, [form.userId, form.salaryMonth]);

  const netSalary =
    (form.basicSalary + form.autoCommissions + form.manualCommissionsAdded +
     form.targetBonusAmount + form.lunchAllowance + form.nightOutAllowance) -
    (form.manualCommissionsDeducted + form.otherDeductions);

  const setF = (field: keyof typeof form, asNumber = true) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: asNumber ? Number(e.target.value) : e.target.value }));

  const handleSubmit = async () => {
    if (!form.userId) return toast.error("Please select a rep.");
    if (netSalary < 0) return toast.error("Net salary cannot be negative.");
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/salaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: form.userId,
          basic_salary: form.basicSalary,
          auto_commissions: form.autoCommissions,
          manual_commissions_added: form.manualCommissionsAdded,
          manual_commissions_deducted: form.manualCommissionsDeducted,
          target_bonus_amount: form.targetBonusAmount,
          other_deductions: form.otherDeductions,
          lunch_allowance: form.lunchAllowance,
          working_days: form.workingDays,
          night_out_days: form.nightOutDays,
          night_out_allowance: form.nightOutAllowance,
          salary_month: form.salaryMonth,
          business_id: businessId,
        }),
      });
      if (res.ok) {
        toast.success("Salary submitted for Admin approval.");
        setForm((p) => ({
          ...BLANK_FORM,
          salaryMonth: p.salaryMonth,
          userId: "",
          autoCommissions: 0,
        }));
        loadData();
      } else {
        toast.error("Failed to submit salary.");
      }
    } catch {
      toast.error("An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this salary record? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/salaries/${id}`, { method: "DELETE" });
      if (res.ok) { toast.success("Salary record deleted."); loadData(); }
      else toast.error("Failed to delete.");
    } catch {
      toast.error("An error occurred.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
          <Banknote className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Salaries & Commissions</h1>
          <p className="text-muted-foreground text-sm">
            Prepare and submit employee monthly salaries for Admin approval.
          </p>
        </div>
      </div>

      {/* Two-column layout: form + history */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── Entry Form ── */}
        <Card className="border-t-4 border-t-indigo-600 shadow-md">
          <CardHeader>
            <CardTitle>Salary Generation Form</CardTitle>
            <CardDescription>Enter components to finalise the net salary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Employee + Month */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Employee</Label>
                <Select value={form.userId} onValueChange={(v) => setForm((p) => ({ ...p, userId: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select Team Member" /></SelectTrigger>
                  <SelectContent>
                    {profiles.filter((p) => p.role === "rep").map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.fullName || "Unknown"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Salary Month</Label>
                <Input type="month" value={form.salaryMonth}
                  onChange={(e) => setForm((p) => ({ ...p, salaryMonth: e.target.value }))} />
              </div>
            </div>

            {/* Attendance */}
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <h3 className="font-semibold text-xs uppercase text-gray-400 tracking-wider">Attendance</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="flex items-center gap-1"><Sun className="h-3 w-3 text-blue-500" /> Working Days</Label>
                  <Input type="number" min="0" max="31" value={form.workingDays || ""}
                    onChange={setF("workingDays")} placeholder="e.g. 26" />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-1"><Moon className="h-3 w-3 text-purple-500" /> Night Out Days</Label>
                  <Input type="number" min="0" value={form.nightOutDays || ""}
                    onChange={setF("nightOutDays")} placeholder="e.g. 4" />
                </div>
              </div>
            </div>

            {/* Earnings */}
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <h3 className="font-semibold text-xs uppercase text-gray-400 tracking-wider">Earnings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Basic Salary</Label>
                  <Input type="number" min="0" value={form.basicSalary || ""}
                    onChange={setF("basicSalary")} />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2">
                    Auto Commissions
                    {isCalculatingCommissions && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                  </Label>
                  <Input type="number" value={form.autoCommissions || ""} disabled
                    className="bg-gray-100 cursor-not-allowed text-gray-500" />
                  <p className="text-[10px] text-muted-foreground">Computed from sales</p>
                </div>
                <div className="space-y-1">
                  <Label>Manual Comm. (Added)</Label>
                  <Input type="number" min="0" value={form.manualCommissionsAdded || ""}
                    onChange={setF("manualCommissionsAdded")} className="border-green-300 bg-green-50" />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-1"><Coffee className="h-3 w-3 text-orange-500" /> Lunch Allowance</Label>
                  <Input type="number" min="0" value={form.lunchAllowance || ""}
                    onChange={setF("lunchAllowance")} className="border-orange-200 bg-orange-50"
                    placeholder="Total for month" />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-1"><Moon className="h-3 w-3 text-purple-500" /> Night Out Allowance</Label>
                  <Input type="number" min="0" value={form.nightOutAllowance || ""}
                    onChange={setF("nightOutAllowance")} className="border-purple-200 bg-purple-50" />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-1"><Target className="h-3 w-3 text-blue-500" /> Target Bonus</Label>
                  <Input type="number" min="0" value={form.targetBonusAmount || ""}
                    onChange={setF("targetBonusAmount")} />
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <h3 className="font-semibold text-xs uppercase text-gray-400 tracking-wider">Deductions</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Manual Comm. (Reduced)</Label>
                  <Input type="number" min="0" value={form.manualCommissionsDeducted || ""}
                    onChange={setF("manualCommissionsDeducted")} className="border-red-300 bg-red-50" />
                </div>
                <div className="space-y-1">
                  <Label>Other Deductions</Label>
                  <Input type="number" min="0" value={form.otherDeductions || ""}
                    onChange={setF("otherDeductions")} />
                </div>
              </div>
            </div>

            {/* Net salary preview */}
            <div className="p-4 bg-gray-50 border rounded-lg flex items-center justify-between shadow-inner">
              <span className="font-semibold uppercase text-gray-600 tracking-wider text-sm">Net Salary</span>
              <span className={`text-2xl font-bold ${netSalary < 0 ? "text-red-600" : "text-gray-900"}`}>
                {formatCurrency(netSalary)}
              </span>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !form.userId}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700"
            >
              {isSubmitting
                ? <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                : <Plus className="mr-2 h-5 w-5" />}
              Submit to Admin for Approval
            </Button>
          </CardFooter>
        </Card>

        {/* ── History Table ── */}
        <Card>
          <CardHeader>
            <CardTitle>Salary Records</CardTitle>
            <CardDescription>All submitted salary entries with current status.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center p-10">
                <Loader2 className="animate-spin w-6 h-6 text-indigo-600" />
              </div>
            ) : salariesHistory.length === 0 ? (
              <div className="text-center p-10 text-muted-foreground">
                No salary records found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salariesHistory.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.profiles?.full_name || "—"}</TableCell>
                        <TableCell className="text-sm text-gray-600">{s.salary_month}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatCurrency(s.net_salary)}
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusBadge status={s.admin_approval_status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button
                              size="icon" variant="ghost"
                              className="h-8 w-8 text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                              title="View salary slip"
                              onClick={() => setViewSalary(s)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              className="h-8 w-8 text-amber-600 hover:bg-amber-50 cursor-pointer"
                              title="Edit salary"
                              onClick={() => setEditSalary(s)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                              title="Download payslip PDF"
                              onClick={() => downloadPayslip(s)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              className="h-8 w-8 text-sky-600 hover:bg-sky-50 cursor-pointer"
                              title="Share payslip"
                              onClick={() => sharePayslip(s)}
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              className="h-8 w-8 text-red-600 hover:bg-red-50 cursor-pointer"
                              title="Delete salary"
                              onClick={() => handleDelete(s.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Dialog */}
      <SalaryViewDialog
        salary={viewSalary}
        open={!!viewSalary}
        onClose={() => setViewSalary(null)}
      />

      {/* Edit Dialog */}
      <SalaryEditDialog
        salary={editSalary}
        profiles={profiles}
        open={!!editSalary}
        onClose={() => setEditSalary(null)}
        onSaved={loadData}
      />
    </div>
  );
}
