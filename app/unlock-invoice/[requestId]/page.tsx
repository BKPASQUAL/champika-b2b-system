"use client";

import { useState, useEffect, use } from "react";
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  User,
  Building2,
  Lock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface RequestDetails {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  shopName: string;
  totalAmount: number;
  orderStatus: string;
  requestedByName: string;
  reason: string;
  status: string;
  createdAt: string;
}

export default function MobileUnlockPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = use(params);

  const [loading, setLoading] = useState(true);
  const [requestDetails, setRequestDetails] = useState<RequestDetails | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [approved, setApproved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/mobile-unlock?requestId=${requestId}`);
        const data = await res.json();

        if (!res.ok) {
          setErrorMsg(data.error || "Invalid or expired unlock request");
          return;
        }

        setRequestDetails(data);
        if (data.status === "approved" || data.status === "used") {
          setApproved(true);
        }
      } catch (err: any) {
        setErrorMsg("Failed to connect to server");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [requestId]);

  const handleApprove = async () => {
    if (!pinInput.trim()) {
      toast.error("Please enter your Admin PIN");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/mobile-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          pin: pinInput.trim(),
          adminName: "Mobile Phone Admin",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify PIN");

      setApproved(true);
      toast.success("Invoice Unlocked Successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to unlock invoice");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-3" />
        <p className="text-sm font-medium text-slate-300">Loading Invoice Details...</p>
      </div>
    );
  }

  if (errorMsg || !requestDetails) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 text-white">
        <Card className="max-w-md w-full bg-slate-800 border-slate-700 text-white shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto bg-red-500/20 p-3 rounded-full w-12 h-12 flex items-center justify-center text-red-400 mb-2">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl text-red-400">Request Not Found</CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1">
              {errorMsg || "This unlock QR code link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      {/* Container */}
      <div className="max-w-md w-full space-y-4">
        {/* Header Branding */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-full text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> Champika Remote Authorization
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            One-Time Invoice Edit
          </h1>
        </div>

        {/* Success View */}
        {approved ? (
          <Card className="bg-slate-900 border-emerald-500/50 text-white shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-white mx-auto mb-2" />
              <h2 className="text-xl font-bold text-white">Invoice Unlocked!</h2>
              <p className="text-xs text-emerald-100 mt-1">
                The desktop screen has automatically unlocked for editing.
              </p>
            </div>
            <CardContent className="p-5 space-y-3 text-slate-300 text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Invoice No:</span>
                <span className="font-mono font-bold text-white">{requestDetails.invoiceNo}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Customer:</span>
                <span className="font-semibold text-white">{requestDetails.shopName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Authorized Access:</span>
                <span className="text-emerald-400 font-semibold">Single Edit Granted</span>
              </div>
              <p className="text-center text-[11px] text-slate-400 pt-2">
                You may now close this browser tab on your phone.
              </p>
            </CardContent>
          </Card>
        ) : (
          /* Form View */
          <Card className="bg-slate-900 border-slate-800 text-white shadow-2xl">
            <CardHeader className="pb-3 border-b border-slate-800">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span className="font-mono font-bold text-base text-amber-400">
                    {requestDetails.invoiceNo}
                  </span>
                </div>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                  {requestDetails.orderStatus}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Details List */}
              <div className="bg-slate-950/70 p-3.5 rounded-lg border border-slate-800 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" /> Customer:
                  </span>
                  <span className="font-medium text-slate-200">{requestDetails.shopName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" /> Requested By:
                  </span>
                  <span className="font-medium text-slate-200">{requestDetails.requestedByName}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                  <span className="text-slate-400">Grand Total:</span>
                  <span className="font-bold text-blue-400 text-sm">
                    LKR {requestDetails.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Edit Reason Box */}
              <div className="bg-amber-950/30 border border-amber-500/20 p-3 rounded-lg text-xs space-y-1">
                <span className="text-amber-400 font-semibold block">Reason for Edit Request:</span>
                <p className="text-slate-300 italic">"{requestDetails.reason}"</p>
              </div>

              {/* Admin Passcode Input */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" /> Enter Admin Passcode (PIN):
                </label>
                <Input
                  type="password"
                  placeholder="Enter 6-digit PIN (e.g. 889900)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-white font-mono text-center tracking-widest text-lg h-12"
                  autoFocus
                />
              </div>

              {/* Approve Button */}
              <Button
                onClick={handleApprove}
                disabled={submitting || !pinInput}
                className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-5 h-5" /> Approve & Unlock Invoice
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
