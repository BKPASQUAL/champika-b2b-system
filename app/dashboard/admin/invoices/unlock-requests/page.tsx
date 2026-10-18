"use client";

import { useState, useEffect } from "react";
import {
  KeyRound,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ShieldAlert,
  Loader2,
  FileText,
  User,
  ArrowLeft,
  Lock,
  Save,
  AlertTriangle,
  Calendar,
  Check,
  ShieldCheck,
  ExternalLink,
  Eye,
  Sliders,
  Search,
  Users,
  UserCheck,
  UserX,
  Power,
  ShieldOff,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CustomerUnlockRequestRecord, CustomerUnlockType, OverdueBlockingConfig } from "@/lib/customer-overdue";

interface InvoiceUnlockRequest {
  id: string;
  invoice_id: string;
  requested_by_name: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "used" | "expired";
  approved_by_name?: string;
  created_at: string;
  invoices?: {
    invoice_no: string;
    total_amount: number;
    customers?: { shop_name: string };
    orders?: { status: string };
  };
}

interface OverdueDetailsSnapshot {
  totalOverdueAmount?: number;
  oldestDaysOverdue?: number;
  invoices?: Array<{
    id: string;
    invoiceNo: string;
    invoiceDate: string;
    daysOverdue: number;
    dueAmount: number;
    supplierNames?: string[];
    hasOrangeOrSierra?: boolean;
    thresholdDays?: number;
  }>;
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function AdminInvoiceUnlockRequestsPage() {
  const [activeTab, setActiveTab] = useState<"customer" | "invoice" | "management">("customer");

  // Overdue Blocking System & User Management State
  const [blockingConfig, setBlockingConfig] = useState<OverdueBlockingConfig | null>(null);
  const [blockingUsers, setBlockingUsers] = useState<Array<{
    id: string;
    fullName: string;
    username?: string;
    email?: string;
    role: string;
    businessName?: string | null;
    isEnforced: boolean;
    hasExplicitOverride: boolean;
    explicitValue?: boolean | null;
  }>>([]);
  const [blockingLoading, setBlockingLoading] = useState(true);
  const [savingMaster, setSavingMaster] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Customer Overdue Unlock State
  const [customerRequests, setCustomerRequests] = useState<CustomerUnlockRequestRecord[]>([]);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [custProcessingId, setCustProcessingId] = useState<string | null>(null);

  // Approval Dialog State
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedCustRequest, setSelectedCustRequest] = useState<CustomerUnlockRequestRecord | null>(null);
  const [approveDuration, setApproveDuration] = useState<CustomerUnlockType>("one_time");
  const [adminNote, setAdminNote] = useState("");

  // Invoice Edit Unlock State
  const [invoiceRequests, setInvoiceRequests] = useState<InvoiceUnlockRequest[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [invProcessingId, setInvProcessingId] = useState<string | null>(null);

  // Admin PIN Setting
  const [adminPin, setAdminPin] = useState("889900");
  const [savingPin, setSavingPin] = useState(false);

  // Fetch Blocking Configuration & User List
  const fetchBlockingData = async () => {
    setBlockingLoading(true);
    try {
      const res = await fetch("/api/settings/customer-overdue-blocking");
      if (res.ok) {
        const data = await res.json();
        setBlockingConfig(data.config);
        setBlockingUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to load overdue blocking settings:", err);
    } finally {
      setBlockingLoading(false);
    }
  };

  // Toggle Master Switch
  const handleToggleMaster = async (checked: boolean) => {
    setSavingMaster(true);
    try {
      let adminName = "Admin";
      if (typeof window !== "undefined") {
        const u = localStorage.getItem("currentUser");
        if (u) adminName = JSON.parse(u).fullName || JSON.parse(u).name || "Admin";
      }

      const res = await fetch("/api/settings/customer-overdue-blocking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          globalEnabled: checked,
          adminName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update master switch");

      setBlockingConfig(data.config);
      toast.success(
        checked
          ? "Customer Overdue Invoicing Block is now ACTIVE system-wide."
          : "Customer Overdue Invoicing Block has been PAUSED. All users can invoice overdue customers."
      );
      fetchBlockingData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update master switch");
    } finally {
      setSavingMaster(false);
    }
  };

  // Toggle Individual User Enforcement
  const handleToggleUser = async (userId: string, isEnforced: boolean, userName: string) => {
    setTogglingUserId(userId);
    try {
      let adminName = "Admin";
      if (typeof window !== "undefined") {
        const u = localStorage.getItem("currentUser");
        if (u) adminName = JSON.parse(u).fullName || JSON.parse(u).name || "Admin";
      }

      const res = await fetch("/api/settings/customer-overdue-blocking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          isEnforced,
          adminName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user setting");

      setBlockingConfig(data.config);
      setBlockingUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, isEnforced, hasExplicitOverride: true, explicitValue: isEnforced }
            : u
        )
      );

      toast.success(
        isEnforced
          ? `Overdue blocking ENFORCED for ${userName}.`
          : `Overdue blocking BYPASSED (Exempt) for ${userName}.`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update user setting");
    } finally {
      setTogglingUserId(null);
    }
  };

  // Bulk Toggle for filtered users
  const handleBulkToggle = async (enforceAll: boolean) => {
    const targetIds = filteredUsers.map((u) => u.id);
    if (targetIds.length === 0) return;

    setBulkProcessing(true);
    try {
      let adminName = "Admin";
      if (typeof window !== "undefined") {
        const u = localStorage.getItem("currentUser");
        if (u) adminName = JSON.parse(u).fullName || JSON.parse(u).name || "Admin";
      }

      const res = await fetch("/api/settings/customer-overdue-blocking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulkUserIds: targetIds,
          bulkEnforced: enforceAll,
          adminName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk update failed");

      setBlockingConfig(data.config);
      fetchBlockingData();
      toast.success(
        enforceAll
          ? `Updated ${targetIds.length} users to ENFORCED.`
          : `Updated ${targetIds.length} users to EXEMPT.`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update users");
    } finally {
      setBulkProcessing(false);
    }
  };

  // Fetch Customer Overdue Unlock Requests
  const fetchCustomerRequests = async () => {
    setCustomerLoading(true);
    try {
      const res = await fetch("/api/customer-unlock-requests?status=all");
      if (res.ok) {
        const data = await res.json();
        setCustomerRequests(data);
      }
    } catch (err) {
      toast.error("Failed to load customer unlock requests");
    } finally {
      setCustomerLoading(false);
    }
  };

  // Fetch Invoice Edit Unlock Requests & PIN
  const fetchInvoiceRequests = async () => {
    setInvoiceLoading(true);
    try {
      const [reqRes, pinRes] = await Promise.all([
        fetch("/api/admin/invoice-unlock-requests?status=all"),
        fetch("/api/settings/invoice-unlock-pin").catch(() => null),
      ]);

      if (reqRes.ok) {
        const data = await reqRes.json();
        setInvoiceRequests(data);
      }
      if (pinRes?.ok) {
        const pinData = await pinRes.json();
        if (pinData.pin) setAdminPin(pinData.pin);
      }
    } catch (err) {
      toast.error("Failed to load invoice edit unlock requests");
    } finally {
      setInvoiceLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerRequests();
    fetchInvoiceRequests();
    fetchBlockingData();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "management" || tab === "settings") {
        setActiveTab("management");
      }
    }
  }, []);

  const refreshAll = () => {
    fetchCustomerRequests();
    fetchInvoiceRequests();
    fetchBlockingData();
  };

  // Handle Customer Unlock Action (Approve / Reject)
  const openApproveDialog = (req: CustomerUnlockRequestRecord) => {
    setSelectedCustRequest(req);
    setApproveDuration(req.unlock_type || "one_time");
    setAdminNote("");
    setApproveDialogOpen(true);
  };

  const handleCustomerApprove = async () => {
    if (!selectedCustRequest) return;
    setCustProcessingId(selectedCustRequest.id);
    try {
      let adminName = "Admin";
      if (typeof window !== "undefined") {
        const u = localStorage.getItem("currentUser");
        if (u) adminName = JSON.parse(u).fullName || JSON.parse(u).name || "Admin";
      }

      const res = await fetch("/api/customer-unlock-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selectedCustRequest.id,
          action: "approve",
          unlockType: approveDuration,
          adminName,
          adminNotes: adminNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");

      toast.success(`Customer "${selectedCustRequest.customer_name}" unlocked successfully!`);
      setApproveDialogOpen(false);
      setSelectedCustRequest(null);
      fetchCustomerRequests();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve unlock");
    } finally {
      setCustProcessingId(null);
    }
  };

  const handleCustomerReject = async (req: CustomerUnlockRequestRecord) => {
    const reasonPrompt = window.prompt("Enter optional rejection note for the Sales Rep / Distribution staff:");
    if (reasonPrompt === null) return; // user cancelled

    setCustProcessingId(req.id);
    try {
      let adminName = "Admin";
      if (typeof window !== "undefined") {
        const u = localStorage.getItem("currentUser");
        if (u) adminName = JSON.parse(u).fullName || JSON.parse(u).name || "Admin";
      }

      const res = await fetch("/api/customer-unlock-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: req.id,
          action: "reject",
          adminName,
          adminNotes: reasonPrompt.trim() || "Rejected by Admin",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rejection failed");

      toast.info(`Request for "${req.customer_name}" rejected.`);
      fetchCustomerRequests();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject request");
    } finally {
      setCustProcessingId(null);
    }
  };

  // Handle Invoice Edit Unlock Action
  const handleInvoiceAction = async (requestId: string, action: "approve" | "reject") => {
    setInvProcessingId(requestId);
    try {
      let adminName = "Admin";
      if (typeof window !== "undefined") {
        const u = localStorage.getItem("currentUser");
        if (u) adminName = JSON.parse(u).fullName || "Admin";
      }

      const res = await fetch("/api/admin/invoice-unlock-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action, adminName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      toast.success(action === "approve" ? "Edit Request Approved!" : "Edit Request Rejected!");
      fetchInvoiceRequests();
    } catch (err: any) {
      toast.error(err.message || "Failed to process action");
    } finally {
      setInvProcessingId(null);
    }
  };

  const handleSavePin = async () => {
    if (!adminPin || adminPin.trim().length < 4) {
      toast.error("PIN must be at least 4 digits");
      return;
    }
    setSavingPin(true);
    try {
      const res = await fetch("/api/settings/invoice-unlock-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: adminPin.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update PIN");

      toast.success("Admin One-Time Unlock PIN updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update PIN");
    } finally {
      setSavingPin(false);
    }
  };

  const pendingCustRequests = customerRequests.filter((r) => r.status === "pending");
  const processedCustRequests = customerRequests.filter((r) => r.status !== "pending");

  const pendingInvRequests = invoiceRequests.filter((r) => r.status === "pending");
  const processedInvRequests = invoiceRequests.filter((r) => r.status !== "pending");

  const filteredUsers = blockingUsers.filter((u) => {
    const matchesSearch =
      !userSearch.trim() ||
      u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase())) ||
      (u.username && u.username.toLowerCase().includes(userSearch.toLowerCase()));

    const matchesRole =
      roleFilter === "all" ||
      u.role.toLowerCase() === roleFilter.toLowerCase();

    return matchesSearch && matchesRole;
  });

  const totalEnforced = blockingUsers.filter((u) => u.isEnforced).length;
  const totalExempt = blockingUsers.filter((u) => !u.isEnforced).length;

  return (
    <div className="space-y-6 mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <KeyRound className="w-6 h-6 text-blue-600" />
                Authorization & Unlock Requests
              </h1>
              {blockingConfig && (
                <div className="flex items-center gap-1.5 ml-2">
                  {blockingConfig.globalEnabled ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      Invoicing Block: ACTIVE
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                      Invoicing Block: PAUSED
                    </Badge>
                  )}
                  {totalExempt > 0 && blockingConfig.globalEnabled && (
                    <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-50/50">
                      {totalExempt} User{totalExempt > 1 ? "s" : ""} Exempt
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and approve temporary invoicing grace periods for customers with 60+ days overdue bills, and invoice edit permissions.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={refreshAll}
          disabled={customerLoading || invoiceLoading || blockingLoading}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${(customerLoading || invoiceLoading || blockingLoading) ? "animate-spin" : ""}`} />
          Refresh Requests
        </Button>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl flex flex-wrap h-auto gap-1">
          <TabsTrigger value="customer" className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg">
            <Lock className="w-4 h-4" />
            <span>Customer 60+ Days Overdue Unlocks</span>
            {pendingCustRequests.length > 0 && (
              <Badge className="bg-red-600 hover:bg-red-700 text-white text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center font-bold">
                {pendingCustRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoice" className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg">
            <FileText className="w-4 h-4" />
            <span>Invoice Edit Authorizations</span>
            {pendingInvRequests.length > 0 && (
              <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center font-bold">
                {pendingInvRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="management" className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg">
            <Sliders className="w-4 h-4 text-purple-600" />
            <span>Blocking Rules & User Permissions</span>
            {blockingConfig && !blockingConfig.globalEnabled && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-1.5 py-0 h-4 flex items-center justify-center font-bold">
                OFF
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: CUSTOMER OVERDUE UNLOCKS ── */}
        <TabsContent value="customer" className="space-y-6">
          {/* Pending Customer Unlock Requests Table */}
          <Card className="border-red-200 shadow-sm">
            <CardHeader className="bg-red-50/40 rounded-t-xl border-b border-red-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-red-950">
                    <Clock className="w-5 h-5 text-red-600" />
                    Pending Overdue Invoicing Requests ({pendingCustRequests.length})
                  </CardTitle>
                  <CardDescription className="text-xs text-red-900/80">
                    Submitted by Sales Reps and Distribution staff for customers with unsettled 60+ days overdue bills.
                  </CardDescription>
                </div>
                {pendingCustRequests.length > 0 && (
                  <Badge className="bg-red-600 hover:bg-red-700 text-white font-semibold">
                    {pendingCustRequests.length} Action Needed
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer / Shop</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Requested Duration</TableHead>
                      <TableHead>Overdue Amount</TableHead>
                      <TableHead>Reason for Request</TableHead>
                      <TableHead>Requested At</TableHead>
                      <TableHead className="text-right">Decision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-red-600" />
                          Loading customer unlock requests...
                        </TableCell>
                      </TableRow>
                    ) : pendingCustRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-70" />
                          <p className="font-medium text-slate-700">No pending customer overdue unlock requests!</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            All requests have been reviewed or customers have settled their accounts.
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingCustRequests.map((req) => {
                        const snap = req.overdue_details as OverdueDetailsSnapshot | undefined;
                        const totalOverdue = typeof snap?.totalOverdueAmount === "number" ? snap.totalOverdueAmount : null;
                        const oldestDays = typeof snap?.oldestDaysOverdue === "number" ? snap.oldestDaysOverdue : null;
                        const invList = Array.isArray(snap?.invoices) ? snap.invoices : [];

                        return (
                          <TableRow key={req.id} className="hover:bg-red-50/20">
                            <TableCell>
                              <div className="space-y-0.5">
                                <span className="font-bold text-slate-900 text-sm block">
                                  {req.customer_name}
                                </span>
                                {req.customers?.phone && (
                                  <span className="text-xs text-muted-foreground block">
                                    📞 {req.customers.phone}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <span className="font-medium text-xs text-slate-800 flex items-center gap-1">
                                  <User className="w-3 h-3 text-muted-foreground" />
                                  {req.requested_by_name || "Sales Rep"}
                                </span>
                                <Badge variant="outline" className="text-[10px] capitalize px-1 py-0">
                                  {req.requested_by_role || "Rep"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  req.unlock_type === "one_time"
                                    ? "bg-blue-100 text-blue-800 border-blue-300"
                                    : req.unlock_type === "7_days"
                                    ? "bg-purple-100 text-purple-800 border-purple-300"
                                    : "bg-indigo-100 text-indigo-800 border-indigo-300"
                                }
                                variant="outline"
                              >
                                {req.unlock_type === "one_time"
                                  ? "One-Time Creation"
                                  : req.unlock_type === "7_days"
                                  ? "7 Days Grace"
                                  : "14 Days Grace"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {totalOverdue !== null ? (
                                  <span className="font-mono font-bold text-red-700 text-xs block">
                                    LKR {fmt(totalOverdue)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-red-600 font-semibold">Overdue Bills</span>
                                )}
                                {oldestDays !== null && (
                                  <span className="text-[10px] text-muted-foreground block">
                                    Oldest: {oldestDays} days ({invList.length} bill{invList.length > 1 ? "s" : ""})
                                  </span>
                                )}
                                {invList.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {invList.slice(0, 3).map((inv) => (
                                      <a
                                        key={inv.id}
                                        href={`/invoice/${inv.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-[10px] font-mono text-red-900 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                                        title={`View invoice ${inv.invoiceNo} (LKR ${fmt(inv.dueAmount)}) - ${inv.hasOrangeOrSierra ? 'Orange/Sierra (60d rule)' : 'Other supplier (90d rule)'}`}
                                      >
                                        <span>{inv.invoiceNo}</span>
                                        {inv.hasOrangeOrSierra ? (
                                          <span className="text-[8px] bg-amber-100 text-amber-800 px-1 rounded font-sans font-bold">60d</span>
                                        ) : (
                                          <span className="text-[8px] bg-slate-100 text-slate-700 px-1 rounded font-sans font-bold">90d</span>
                                        )}
                                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                      </a>
                                    ))}
                                    {invList.length > 3 && (
                                      <span className="text-[10px] text-muted-foreground self-center">
                                        +{invList.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              <span className="italic">"{req.reason}"</span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(req.created_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleCustomerReject(req)}
                                  disabled={custProcessingId === req.id}
                                  className="h-8 text-xs"
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => openApproveDialog(req)}
                                  disabled={custProcessingId === req.id}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-semibold flex items-center gap-1"
                                >
                                  {custProcessingId === req.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  )}
                                  Approve
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Processed / History Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Customer Unlock History & Log</CardTitle>
              <CardDescription className="text-xs">
                Past approved, rejected, used, or resolved customer authorizations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Mode / Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Approved By</TableHead>
                      <TableHead>Validity / Expiry</TableHead>
                      <TableHead>Date & Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedCustRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-xs">
                          No past customer requests logged.
                        </TableCell>
                      </TableRow>
                    ) : (
                      processedCustRequests.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-semibold text-xs text-slate-900">
                            {req.customer_name}
                          </TableCell>
                          <TableCell className="text-xs">{req.requested_by_name || "Rep"}</TableCell>
                          <TableCell>
                            <span className="text-xs font-medium">
                              {req.unlock_type === "one_time"
                                ? "One-Time Creation"
                                : req.unlock_type === "7_days"
                                ? "7 Days Grace"
                                : "14 Days Grace"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                req.status === "approved"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold"
                                  : req.status === "used"
                                  ? "bg-blue-50 text-blue-700 border-blue-300 font-bold"
                                  : req.status === "resolved"
                                  ? "bg-teal-50 text-teal-700 border-teal-300 font-bold"
                                  : req.status === "expired"
                                  ? "bg-slate-100 text-slate-700 border-slate-300"
                                  : "bg-red-50 text-red-700 border-red-300"
                              }
                            >
                              {req.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {req.approved_by_name || "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {req.expires_at ? new Date(req.expires_at).toLocaleDateString("en-GB") : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {req.admin_notes || req.reason}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: INVOICE EDIT AUTHORIZATIONS ── */}
        <TabsContent value="invoice" className="space-y-6">
          {/* Admin Passcode Config Card */}
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-900">
                <Lock className="w-4 h-4 text-amber-600" />
                Admin Master Passcode (OTP / PIN)
              </CardTitle>
              <CardDescription className="text-xs text-amber-800">
                Staff and Reps can instantly unlock locked invoices by entering this Master Passcode when authorized over phone/WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 max-w-md">
                <Input
                  type="text"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="bg-white font-mono text-lg tracking-widest text-center"
                  maxLength={8}
                />
                <Button onClick={handleSavePin} disabled={savingPin} className="bg-amber-700 hover:bg-amber-800 text-white shrink-0">
                  {savingPin ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Save PIN
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pending Invoice Edit Requests Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Pending Edit Requests ({pendingInvRequests.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Requests waiting for your approval to grant one-time invoice edit access.
                  </CardDescription>
                </div>
                {pendingInvRequests.length > 0 && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-semibold">
                    {pendingInvRequests.length} Action Needed
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Reason for Edit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Loading edit requests...
                        </TableCell>
                      </TableRow>
                    ) : pendingInvRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                          No pending invoice edit requests!
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingInvRequests.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-mono font-semibold">
                            <Link
                              href={`/dashboard/office/distribution/invoices/${req.invoice_id}/edit`}
                              className="text-blue-600 hover:underline flex items-center gap-1"
                              target="_blank"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {req.invoices?.invoice_no || req.invoice_id.substring(0, 8)}
                            </Link>
                          </TableCell>
                          <TableCell>{req.invoices?.customers?.shop_name || "-"}</TableCell>
                          <TableCell className="flex items-center gap-1.5 text-xs font-medium">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            {req.requested_by_name}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-slate-700 font-medium bg-slate-50 p-2 rounded">
                            "{req.reason}"
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                              {req.invoices?.orders?.status || "Locked"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleInvoiceAction(req.id, "reject")}
                                disabled={invProcessingId === req.id}
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleInvoiceAction(req.id, "approve")}
                                disabled={invProcessingId === req.id}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                {invProcessingId === req.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                )}
                                Approve
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Invoice History Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Processed Requests Log</CardTitle>
              <CardDescription className="text-xs">
                Past approved, rejected, or used edit permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Approved / Decision By</TableHead>
                      <TableHead>Date & Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedInvRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                          No past edit requests logged.
                        </TableCell>
                      </TableRow>
                    ) : (
                      processedInvRequests.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-mono font-medium text-xs">
                            {req.invoices?.invoice_no || req.invoice_id.substring(0, 8)}
                          </TableCell>
                          <TableCell className="text-xs">{req.requested_by_name}</TableCell>
                          <TableCell className="text-xs max-w-xs truncate">"{req.reason}"</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                req.status === "approved"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                  : req.status === "used"
                                  ? "bg-blue-50 text-blue-700 border-blue-300"
                                  : "bg-red-50 text-red-700 border-red-300"
                              }
                            >
                              {req.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {req.approved_by_name || "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(req.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: BLOCKING MANAGEMENT & USER PERMISSIONS ── */}
        <TabsContent value="management" className="space-y-6">
          {/* Master System Switch Card */}
          <Card className={cn(
            "border-2 transition-all shadow-sm",
            blockingConfig?.globalEnabled
              ? "border-emerald-200 bg-gradient-to-r from-emerald-50/50 via-white to-emerald-50/30"
              : "border-amber-300 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40"
          )}>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2.5 rounded-xl shrink-0 mt-0.5",
                    blockingConfig?.globalEnabled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  )}>
                    {blockingConfig?.globalEnabled ? (
                      <ShieldCheck className="w-6 h-6" />
                    ) : (
                      <ShieldOff className="w-6 h-6" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg font-bold text-slate-900">
                        System-Wide Overdue Invoicing Block
                      </CardTitle>
                      {blockingConfig?.globalEnabled ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                          MASTER SWITCH: ACTIVE
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-semibold animate-pulse">
                          MASTER SWITCH: PAUSED
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                      When <strong>Active</strong>, credit control rules are enforced (Orange/Sierra ≥60 days, others ≥90 days). Customers with overdue bills cannot be invoiced without an approved Admin unlock. When <strong>Paused</strong>, overdue invoice blocking is disabled system-wide and all users can create bills freely.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:self-center bg-white/90 p-3 rounded-xl border shadow-2xs shrink-0">
                  <div className="text-right">
                    <span className="block text-xs font-bold text-slate-900">
                      {blockingConfig?.globalEnabled ? "Blocking Active" : "Blocking Paused"}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {blockingConfig?.globalEnabled ? "Credit rules enforced" : "Invoicing open to all"}
                    </span>
                  </div>
                  <Switch
                    checked={blockingConfig?.globalEnabled ?? true}
                    onCheckedChange={handleToggleMaster}
                    disabled={savingMaster || blockingLoading}
                    className="data-[state=checked]:bg-emerald-600 scale-125"
                  />
                  {savingMaster && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
                </div>
              </div>
            </CardHeader>
            {!blockingConfig?.globalEnabled && (
              <CardContent className="pt-0">
                <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Notice: Overdue blocking is currently PAUSED.</strong> Sales reps and distribution staff can create orders and bills for any customer even if they have overdue invoices exceeding 60 or 90 days. Flip the switch above to re-enable credit control enforcement.
                  </span>
                </div>
              </CardContent>
            )}
          </Card>

          {/* User-Specific Invoicing Permissions & Overrides */}
          <Card className="border shadow-sm">
            <CardHeader className="border-b bg-slate-50/50 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                    <Users className="w-5 h-5 text-blue-600" />
                    Staff Invoicing Permissions & User Overrides
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Turn overdue invoice blocking ON or OFF for specific Sales Reps, Distribution Officers, and Office Staff.
                  </CardDescription>
                </div>

                {/* Quick stats chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs flex items-center gap-1.5 border">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-muted-foreground">Total Staff:</span>
                    <span className="font-bold text-slate-900">{blockingUsers.length}</span>
                  </div>
                  <div className="px-3 py-1.5 bg-red-50 text-red-900 rounded-lg text-xs flex items-center gap-1.5 border border-red-200">
                    <span className="w-2 h-2 rounded-full bg-red-600" />
                    <span>Enforced:</span>
                    <span className="font-bold text-red-700">{totalEnforced}</span>
                  </div>
                  <div className="px-3 py-1.5 bg-emerald-50 text-emerald-900 rounded-lg text-xs flex items-center gap-1.5 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span>Exempt / Bypass:</span>
                    <span className="font-bold text-emerald-700">{totalExempt}</span>
                  </div>
                </div>
              </div>

              {/* Search & Role Filters Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search staff by name, email, or role..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 h-9 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Role pills */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border text-xs">
                    {(["all", "rep", "distribution", "office", "admin"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRoleFilter(r)}
                        className={cn(
                          "px-2.5 py-1 rounded-md capitalize font-medium transition-all text-xs",
                          roleFilter === r
                            ? "bg-slate-900 text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        )}
                      >
                        {r === "all" ? "All Roles" : r}
                      </button>
                    ))}
                  </div>

                  {/* Bulk action buttons */}
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkToggle(true)}
                      disabled={bulkProcessing || filteredUsers.length === 0}
                      className="h-8 text-xs text-red-700 border-red-200 hover:bg-red-50"
                      title="Enforce overdue invoice block on all shown users"
                    >
                      {bulkProcessing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserX className="w-3.5 h-3.5 mr-1" />}
                      Enforce All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkToggle(false)}
                      disabled={bulkProcessing || filteredUsers.length === 0}
                      className="h-8 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      title="Exempt all shown users from overdue invoice block"
                    >
                      {bulkProcessing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserCheck className="w-3.5 h-3.5 mr-1" />}
                      Exempt All
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Assigned Business</TableHead>
                      <TableHead>Effective Status</TableHead>
                      <TableHead className="text-right">Overdue Blocking Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blockingLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                          Loading user permission settings...
                        </TableCell>
                      </TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                          No users matched your search/filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => {
                        const isEnforced = user.isEnforced;
                        const isToggling = togglingUserId === user.id;
                        const masterOff = blockingConfig && !blockingConfig.globalEnabled;

                        return (
                          <TableRow key={user.id} className="hover:bg-slate-50/70">
                            <TableCell>
                              <div className="space-y-0.5">
                                <span className="font-semibold text-slate-900 text-xs block">
                                  {user.fullName}
                                </span>
                                {user.email && (
                                  <span className="text-[11px] text-muted-foreground block font-mono">
                                    {user.email}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">
                                {user.role || "Staff"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-slate-700">
                                {user.businessName || "All Agencies"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {masterOff ? (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-medium text-[11px]">
                                  Allowed (Master Switch OFF)
                                </Badge>
                              ) : isEnforced ? (
                                <Badge className="bg-red-100 text-red-800 border-red-300 font-semibold text-[11px] gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                                  ENFORCED (Blocked)
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-[11px] gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                  EXEMPT (Can Invoice)
                                </Badge>
                              )}
                              {user.hasExplicitOverride && (
                                <span className="text-[10px] text-muted-foreground block mt-0.5">
                                  (User-specific override)
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-3">
                                <span className={cn(
                                  "text-xs font-semibold select-none",
                                  isEnforced ? "text-red-700" : "text-emerald-700"
                                )}>
                                  {isEnforced ? "Blocking ON" : "Exempt (OFF)"}
                                </span>
                                <Switch
                                  checked={isEnforced}
                                  onCheckedChange={(val) => handleToggleUser(user.id, val, user.fullName)}
                                  disabled={isToggling || bulkProcessing}
                                  className={cn(
                                    "transition-all",
                                    isEnforced ? "data-[state=checked]:bg-red-600" : "data-[state=unchecked]:bg-emerald-500"
                                  )}
                                />
                                {isToggling && (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approval Confirmation Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-800">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Approve Customer Invoicing Unlock
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm authorization duration for <strong>{selectedCustRequest?.customer_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-slate-50 border rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-semibold text-slate-900">{selectedCustRequest?.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Requested by:</span>
                <span className="font-medium text-slate-800">{selectedCustRequest?.requested_by_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reason:</span>
                <span className="font-medium text-slate-800 italic">"{selectedCustRequest?.reason}"</span>
              </div>
              {(() => {
                const snap = selectedCustRequest?.overdue_details as OverdueDetailsSnapshot | undefined;
                const amt = typeof snap?.totalOverdueAmount === "number" ? snap.totalOverdueAmount : null;
                const invList = Array.isArray(snap?.invoices) ? snap.invoices : [];
                return (
                  <div className="pt-1.5 border-t space-y-1.5">
                    {amt !== null && (
                      <div className="flex justify-between text-red-700 font-semibold">
                        <span>Total Overdue:</span>
                        <span>LKR {fmt(amt)}</span>
                      </div>
                    )}
                    {invList.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground block font-semibold">
                          Overdue Invoices Requiring Settlement:
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                          {invList.map((inv) => (
                            <a
                              key={inv.id}
                              href={`/invoice/${inv.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-red-200 hover:border-blue-400 rounded text-[11px] font-mono text-slate-800 hover:text-blue-700 transition-colors shadow-2xs"
                              title="Click to view full printable invoice"
                            >
                              <span className="font-semibold text-red-950">{inv.invoiceNo}</span>
                              <span className="text-muted-foreground">({inv.daysOverdue}d)</span>
                              <span className="font-bold text-red-700">LKR {fmt(inv.dueAmount)}</span>
                              <ExternalLink className="w-3 h-3 text-blue-600 ml-0.5" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Duration Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Unlock Duration / Policy</Label>
              <Select
                value={approveDuration}
                onValueChange={(v) => setApproveDuration(v as CustomerUnlockType)}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">
                    <div className="flex flex-col py-0.5">
                      <span className="font-semibold text-xs">One-Time Invoice Creation</span>
                      <span className="text-[10px] text-muted-foreground">
                        Permits creating exactly 1 invoice; automatically expires when invoice is saved
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="7_days">
                    <div className="flex flex-col py-0.5">
                      <span className="font-semibold text-xs">7 Days Temporary Unlock</span>
                      <span className="text-[10px] text-muted-foreground">
                        Active grace period for all invoicing during the next 7 days
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="14_days">
                    <div className="flex flex-col py-0.5">
                      <span className="font-semibold text-xs">14 Days Temporary Unlock</span>
                      <span className="text-[10px] text-muted-foreground">
                        Extended grace period for all invoicing during the next 14 days
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Optional Admin Note */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Admin Notes (Optional)</Label>
              <Textarea
                placeholder="e.g. Approved per phone call with customer; customer agreed to settle LKR 50,000 on Monday."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="text-xs min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApproveDialogOpen(false)}
              disabled={custProcessingId !== null}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCustomerApprove}
              disabled={custProcessingId !== null}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {custProcessingId ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Approving...
                </>
              ) : (
                "Confirm & Unlock Customer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
