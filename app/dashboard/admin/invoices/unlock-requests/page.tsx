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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";

interface UnlockRequest {
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

export default function AdminInvoiceUnlockRequestsPage() {
  const [requests, setRequests] = useState<UnlockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Admin PIN Setting
  const [adminPin, setAdminPin] = useState("889900");
  const [savingPin, setSavingPin] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [reqRes, pinRes] = await Promise.all([
        fetch("/api/admin/invoice-unlock-requests?status=all"),
        fetch("/api/settings/invoice-unlock-pin").catch(() => null),
      ]);

      if (reqRes.ok) {
        const data = await reqRes.json();
        setRequests(data);
      }
      if (pinRes?.ok) {
        const pinData = await pinRes.json();
        if (pinData.pin) setAdminPin(pinData.pin);
      }
    } catch (err) {
      toast.error("Failed to load unlock requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (requestId: string, action: "approve" | "reject") => {
    setProcessingId(requestId);
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

      toast.success(action === "approve" ? "Request Approved!" : "Request Rejected!");
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || "Failed to process action");
    } finally {
      setProcessingId(null);
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

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const processedRequests = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6 mx-auto pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <KeyRound className="w-6 h-6 text-amber-600" />
              Invoice Edit Unlock Requests
            </h1>
            <p className="text-xs text-muted-foreground">
              Manage one-time invoice edit authorization requests submitted for invoices in Loading, In Transit, or Delivered status.
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

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

      {/* Pending Requests Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Pending Requests ({pendingRequests.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Requests waiting for your approval to grant one-time invoice edit access.
              </CardDescription>
            </div>
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-semibold">
                {pendingRequests.length} Action Needed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading unlock requests...
                    </TableCell>
                  </TableRow>
                ) : pendingRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                      No pending unlock requests!
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingRequests.map((req) => (
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
                            onClick={() => handleAction(req.id, "reject")}
                            disabled={processingId === req.id}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAction(req.id, "approve")}
                            disabled={processingId === req.id}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {processingId === req.id ? (
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

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Processed Requests Log</CardTitle>
          <CardDescription className="text-xs">
            Past approved, rejected, or used edit permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
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
                {processedRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                      No past requests logged.
                    </TableCell>
                  </TableRow>
                ) : (
                  processedRequests.map((req) => (
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
    </div>
  );
}
