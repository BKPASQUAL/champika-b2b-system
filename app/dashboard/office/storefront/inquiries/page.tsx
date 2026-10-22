"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Search,
  RefreshCw,
  ExternalLink,
  Loader2,
  ChevronLeft,
  Send,
  CheckCircle2,
  Mail,
  Phone,
} from "lucide-react";
import { toast } from "sonner";

export default function StorefrontInquiriesPage() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/storefront/manage/inquiries");
      if (!res.ok) throw new Error("Failed to load inquiries");
      const data = await res.json();
      setInquiries(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/storefront/manage/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryId: id, status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(`Inquiry marked as ${newStatus}`);
      fetchInquiries();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredInquiries = inquiries.filter((inq) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "pending" && inq.status !== "resolved") ||
      (filter === "resolved" && inq.status === "resolved");

    const matchesSearch =
      !search ||
      inq.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      inq.customerPhone?.toLowerCase().includes(search.toLowerCase()) ||
      inq.customerEmail?.toLowerCase().includes(search.toLowerCase()) ||
      inq.message?.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const pendingCount = inquiries.filter((i) => i.status !== "resolved").length;

  return (
    <div className="space-y-6 w-full">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/office/storefront">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Customer Inquiries & Messages
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Questions from product pages, project quote requests, and stock availability alerts
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.open("/", "_blank")}
          >
            <ExternalLink className="w-4 h-4 text-emerald-600" />
            Visit Storefront
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              fetchInquiries();
              toast.info("Refreshed inquiries");
            }}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <CardTitle>Inquiries & Queries ({filteredInquiries.length})</CardTitle>
            <CardDescription>
              Respond directly via WhatsApp or email to visitors requesting product assistance
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search customer, phone, message..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap gap-2 border-b pb-3">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() => setFilter("all")}
            >
              All Inquiries ({inquiries.length})
            </Button>
            <Button
              variant={filter === "pending" ? "default" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() => setFilter("pending")}
            >
              Pending / Unread ({pendingCount})
            </Button>
            <Button
              variant={filter === "resolved" ? "default" : "outline"}
              size="sm"
              className="text-xs h-8"
              onClick={() => setFilter("resolved")}
            >
              Resolved ({inquiries.length - pendingCount})
            </Button>
          </div>

          {/* Inquiries Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[180px]">Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Subject / Product</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                      Loading inquiries...
                    </TableCell>
                  </TableRow>
                ) : filteredInquiries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                      No customer inquiries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInquiries.map((inq) => {
                    const isResolved = inq.status === "resolved";
                    return (
                      <TableRow key={inq.id} className="hover:bg-slate-50/80">
                        <TableCell className="font-semibold text-slate-900">
                          {inq.customerName || "Website Visitor"}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-slate-700 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {inq.customerPhone || "N/A"}
                          </div>
                          {inq.customerEmail && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {inq.customerEmail}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {inq.subject || "General Query"}
                          </Badge>
                          {inq.productName && (
                            <div className="text-[11px] text-slate-500 mt-1 font-medium">
                              Ref: {inq.productName}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 max-w-[280px]">
                          <p className="line-clamp-2">{inq.message}</p>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                          {new Date(inq.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "text-xs font-semibold",
                              isResolved
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                                : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                            )}
                          >
                            {isResolved ? "Resolved" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* WhatsApp Reply */}
                            {inq.customerPhone && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => {
                                  const cleanPhone = inq.customerPhone.replace(/[^0-9]/g, "");
                                  const intlPhone = cleanPhone.startsWith("0")
                                    ? "94" + cleanPhone.slice(1)
                                    : cleanPhone;
                                  const text = encodeURIComponent(
                                    `Hello ${inq.customerName || ""}, thank you for contacting BK Wiring Kade regarding "${inq.subject || "your inquiry"}". How can we assist you today?`
                                  );
                                  window.open(`https://wa.me/${intlPhone}?text=${text}`, "_blank");
                                }}
                              >
                                <Send className="w-3.5 h-3.5 text-emerald-600" />
                                Reply
                              </Button>
                            )}

                            {/* Mark as Resolved */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className={cn(
                                "h-8 text-xs",
                                isResolved ? "text-slate-500" : "text-emerald-700 hover:bg-emerald-50"
                              )}
                              onClick={() => updateStatus(inq.id, isResolved ? "pending" : "resolved")}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              {isResolved ? "Reopen" : "Done"}
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
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
