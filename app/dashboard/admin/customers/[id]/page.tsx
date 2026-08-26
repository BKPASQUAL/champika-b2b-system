"use client";

import React, { useState, useEffect, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Search,
  FileText,
  CreditCard,
  Building2,
  MapPin,
  Phone,
  User,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Clock,
  RotateCcw,
  Receipt,
  ExternalLink,
  ShoppingBag,
  Package,
  Layers,
  Tag,
  ChevronDown,
  ChevronUp,
  Calendar,
  Download,
  Printer,
  Share2,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import {
  downloadCustomerHistoryReport,
  printCustomerHistoryReport,
} from "@/app/lib/customer-history-report";
import {
  downloadCustomerStatement,
  shareCustomerStatement,
  StatementInvoice,
} from "@/lib/customer-statement-report";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const router = useRouter();
  const { id } = use(params);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [chequeFilter, setChequeFilter] = useState("all");

  // Purchased Products States
  const [purchasedProducts, setPurchasedProducts] = useState<any[]>([]);
  const [loadingPurchasedProducts, setLoadingPurchasedProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // Sheet for Invoice Details
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<any>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [showInvoiceSheet, setShowInvoiceSheet] = useState(false);

  const fetchCustomerDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${id}`);
      if (!res.ok) throw new Error("Failed to load customer details");
      const json = await res.json();
      setData(json);
    } catch (error: any) {
      toast.error(error.message || "Error fetching customer details");
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchasedProducts = async () => {
    setLoadingPurchasedProducts(true);
    try {
      const res = await fetch(`/api/customers/${id}/purchased-products`);
      if (!res.ok) throw new Error("Failed to load purchased products");
      const json = await res.json();
      setPurchasedProducts(json || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load purchased products");
    } finally {
      setLoadingPurchasedProducts(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchCustomerDetails();
      fetchPurchasedProducts();
    }
  }, [id]);

  const openInvoiceSheet = async (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setShowInvoiceSheet(true);
    setLoadingInvoice(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (!res.ok) throw new Error("Failed to fetch invoice details");
      const inv = await res.json();
      setInvoiceDetails(inv);
    } catch (error: any) {
      toast.error(error.message || "Failed to load invoice");
    } finally {
      setLoadingInvoice(false);
    }
  };

  // Delivered & Completed Invoices Filter (Excludes Cancelled, Pending, Processing, Loading, In Transit)
  const deliveredInvoices = useMemo(() => {
    if (!data?.invoices) return [];
    return data.invoices.filter((inv: any) => {
      const invSt = String(inv.status || "").toLowerCase().trim();
      const ordSt = String(inv.orderStatus || "").toLowerCase().trim();

      if (
        invSt.includes("cancel") ||
        ordSt.includes("cancel") ||
        invSt.includes("void") ||
        ordSt.includes("void") ||
        invSt.includes("draft") ||
        ordSt.includes("draft")
      ) {
        return false;
      }

      if (
        ordSt === "pending" ||
        ordSt === "processing" ||
        ordSt === "loading" ||
        ordSt === "in transit" ||
        ordSt === "transit"
      ) {
        return false;
      }

      return true;
    });
  }, [data?.invoices]);

  const deliveredSummary = useMemo(() => {
    const totalInvoicesCount = deliveredInvoices.length;
    const totalInvoiced = deliveredInvoices.reduce((sum: number, inv: any) => sum + (inv.totalAmount || 0), 0);
    const totalPaid = deliveredInvoices.reduce((sum: number, inv: any) => sum + (inv.paidAmount || 0), 0);
    const totalDue = deliveredInvoices.reduce((sum: number, inv: any) => sum + (inv.dueAmount || 0), 0);
    return {
      totalInvoicesCount,
      totalInvoiced,
      totalPaid,
      totalDue,
    };
  }, [deliveredInvoices]);

  // Filtered Invoices for UI display
  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.toLowerCase();
    return deliveredInvoices.filter((inv: any) => {
      return (
        !q ||
        inv.invoiceNo?.toLowerCase().includes(q) ||
        inv.status?.toLowerCase().includes(q) ||
        inv.paymentType?.toLowerCase().includes(q)
      );
    });
  }, [deliveredInvoices, invoiceSearch]);

  // Filtered Cheques
  const filteredCheques = useMemo(() => {
    if (!data?.cheques) return [];
    if (chequeFilter === "all") return data.cheques;
    return data.cheques.filter((c: any) => {
      const st = c.status.toLowerCase();
      if (chequeFilter === "pending") return st === "pending" || st === "deposited";
      if (chequeFilter === "cleared") return st === "passed" || st === "cleared";
      if (chequeFilter === "returned") return st === "returned" || st === "bounced";
      return true;
    });
  }, [data?.cheques, chequeFilter]);

  // Filtered Purchased Products
  const filteredProducts = useMemo(() => {
    if (!purchasedProducts) return [];
    const q = productSearch.toLowerCase();
    return purchasedProducts.filter(
      (p: any) =>
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
    );
  }, [purchasedProducts, productSearch]);

  const totalUnitsPurchased = useMemo(() => {
    return (purchasedProducts || []).reduce(
      (sum, p) => sum + (p.totalPurchasedQty || 0),
      0
    );
  }, [purchasedProducts]);

  const totalSpentOnProducts = useMemo(() => {
    return (purchasedProducts || []).reduce(
      (sum, p) => sum + (p.totalSpent || 0),
      0
    );
  }, [purchasedProducts]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Loading customer history & financial profile...</p>
      </div>
    );
  }

  if (!data || !data.customer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-base font-semibold text-slate-800">Customer Not Found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  const { customer, summary, invoices = [], payments = [], cheques = [], returns = [] } = data;

  const creditUsagePercent = customer.creditLimit > 0
    ? Math.min(100, Math.round((customer.outstandingBalance / customer.creditLimit) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-xl border shadow-xs">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10 shrink-0 mt-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {customer.shopName}
              </h1>
              <Badge variant="outline" className="font-mono text-xs text-slate-600 bg-slate-50">
                ID: {customer.customerId}
              </Badge>
              {customer.status === "Active" && (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                </Badge>
              )}
              {customer.status === "Inactive" && (
                <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                  <XCircle className="w-3 h-3 mr-1" /> Inactive
                </Badge>
              )}
              {customer.status === "Blocked" && (
                <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                  <AlertOctagon className="w-3 h-3 mr-1" /> Blocked
                </Badge>
              )}
              <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                <Building2 className="w-3 h-3 mr-1" /> {customer.businessName}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-4">
              {customer.ownerName && (
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" /> {customer.ownerName}
                </span>
              )}
              {customer.phone && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {customer.phone}
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> Route: {customer.route}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!data || !data.customer) return;
              const items: StatementInvoice[] = deliveredInvoices.map((inv: any) => ({
                id: inv.id,
                invoiceNo: inv.invoiceNo,
                date: inv.date,
                totalAmount: inv.totalAmount,
                paidAmount: inv.paidAmount,
                balance: inv.dueAmount,
                status: inv.status,
                payments: (data?.payments || [])
                  .filter((p: any) => p.invoiceNo === inv.invoiceNo || p.invoiceId === inv.id)
                  .map((p: any) => ({
                    id: p.id,
                    paymentDate: p.date,
                    amount: p.amount,
                    method: p.method,
                    chequeNo: p.chequeNo,
                    chequeStatus: p.chequeStatus,
                  })),
              }));
              downloadCustomerStatement(data.customer.shopName, items, data.customer.businessName);
            }}
            disabled={loading}
            className="text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
          >
            <ReceiptText className="w-3.5 h-3.5 mr-1.5 text-red-600" /> Outstanding PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!data || !data.customer) return;
              const items: StatementInvoice[] = deliveredInvoices.map((inv: any) => ({
                id: inv.id,
                invoiceNo: inv.invoiceNo,
                date: inv.date,
                totalAmount: inv.totalAmount,
                paidAmount: inv.paidAmount,
                balance: inv.dueAmount,
                status: inv.status,
                payments: (data?.payments || [])
                  .filter((p: any) => p.invoiceNo === inv.invoiceNo || p.invoiceId === inv.id)
                  .map((p: any) => ({
                    id: p.id,
                    paymentDate: p.date,
                    amount: p.amount,
                    method: p.method,
                    chequeNo: p.chequeNo,
                    chequeStatus: p.chequeStatus,
                  })),
              }));
              shareCustomerStatement(data.customer.shopName, items, data.customer.businessName);
            }}
            disabled={loading}
            className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
          >
            <Share2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Share Statement
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!data || !data.customer) return;
              downloadCustomerHistoryReport({
                ...data,
                invoices: deliveredInvoices,
              });
            }}
            disabled={loading}
            className="text-xs bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Full PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!data || !data.customer) return;
              printCustomerHistoryReport({
                ...data,
                invoices: deliveredInvoices,
              });
            }}
            disabled={loading}
            className="text-xs bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5 text-slate-700" /> Print PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchCustomerDetails();
              fetchPurchasedProducts();
            }}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Outstanding & Credit */}
        <Card className="border-l-4 border-l-red-500 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Outstanding Balance</span>
              <CreditCard className="w-4 h-4 text-red-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <p className={`text-2xl font-bold font-mono ${customer.outstandingBalance > 0 ? "text-red-600" : "text-slate-700"}`}>
              LKR {customer.outstandingBalance.toLocaleString()}
            </p>
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs text-muted-foreground font-medium">
                <span>Credit Limit: LKR {customer.creditLimit.toLocaleString()}</span>
                <span>{creditUsagePercent}% Used</span>
              </div>
              <Progress value={creditUsagePercent} className="h-1.5 bg-slate-100" />
              <p className="text-[11px] text-muted-foreground text-right pt-0.5">
                Available: <span className="font-semibold text-emerald-600 font-mono">LKR {summary.creditAvailable.toLocaleString()}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Invoices Summary */}
        <Card className="border-l-4 border-l-blue-500 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Delivered Invoices</span>
              <FileText className="w-4 h-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <p className="text-2xl font-bold font-mono text-slate-900">
              LKR {deliveredSummary.totalInvoiced.toLocaleString()}
            </p>
            <div className="flex justify-between items-center text-xs pt-1 border-t">
              <span className="text-muted-foreground">{deliveredSummary.totalInvoicesCount} Delivered Invoice(s)</span>
              <span className="font-semibold text-emerald-600 font-mono">Paid: LKR {deliveredSummary.totalPaid.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Cheques Overview */}
        <Card className="border-l-4 border-l-amber-500 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Cheques Overview</span>
              <Receipt className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1.5 text-xs">
            <div className="flex justify-between items-center bg-amber-50 p-1.5 rounded text-amber-900">
              <span className="flex items-center gap-1 font-medium"><Clock className="w-3 h-3 text-amber-600" /> Pending ({summary.cheques.pendingCount})</span>
              <span className="font-mono font-bold">LKR {summary.cheques.pendingAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center bg-emerald-50 p-1.5 rounded text-emerald-900">
              <span className="flex items-center gap-1 font-medium"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cleared ({summary.cheques.clearedCount})</span>
              <span className="font-mono font-bold">LKR {summary.cheques.clearedAmount.toLocaleString()}</span>
            </div>
            {summary.cheques.returnedCount > 0 && (
              <div className="flex justify-between items-center bg-red-50 p-1.5 rounded text-red-900">
                <span className="flex items-center gap-1 font-medium"><AlertOctagon className="w-3 h-3 text-red-600" /> Bounced ({summary.cheques.returnedCount})</span>
                <span className="font-mono font-bold">LKR {summary.cheques.returnedAmount.toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Returns Summary */}
        <Card className="border-l-4 border-l-purple-500 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Returns & Claims</span>
              <RotateCcw className="w-4 h-4 text-purple-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <p className="text-2xl font-bold font-mono text-purple-900">
              {summary.returns.totalCount} <span className="text-xs font-normal text-muted-foreground">return record(s)</span>
            </p>
            <div className="flex items-center gap-3 text-xs pt-1 border-t">
              <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                Good: {summary.returns.goodCount}
              </span>
              <span className="text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded">
                Damage: {summary.returns.damageCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comprehensive Tabs Section */}
      <Card className="shadow-xs">
        <CardContent className="p-4 sm:p-6">
          <Tabs defaultValue="invoices" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto p-1 bg-slate-100 gap-1">
              <TabsTrigger value="invoices" className="text-xs font-semibold">
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Invoices ({deliveredInvoices.length})
              </TabsTrigger>
              <TabsTrigger value="purchased-products" className="text-xs font-semibold">
                <ShoppingBag className="w-3.5 h-3.5 mr-1.5 text-orange-600" /> Purchased Products ({purchasedProducts.length})
              </TabsTrigger>
              <TabsTrigger value="payments" className="text-xs font-semibold">
                <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Payment History ({payments.length})
              </TabsTrigger>
              <TabsTrigger value="cheques" className="text-xs font-semibold">
                <Receipt className="w-3.5 h-3.5 mr-1.5" /> Cheques ({cheques.length})
              </TabsTrigger>
              <TabsTrigger value="returns" className="text-xs font-semibold">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Returns ({returns.length})
              </TabsTrigger>
              <TabsTrigger value="profile" className="text-xs font-semibold">
                <User className="w-3.5 h-3.5 mr-1.5" /> Profile Info
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: INVOICES */}
            <TabsContent value="invoices" className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-3">
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filter by invoice no, status..."
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    className="pl-9 bg-white text-xs border-slate-200"
                  />
                </div>
                <span className="text-xs text-muted-foreground">Showing {filteredInvoices.length} of {deliveredInvoices.length} Delivered Invoice(s)</span>
              </div>

              <div className="rounded-lg border bg-white overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[110px]">Date</TableHead>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Payment Type</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Paid Amount</TableHead>
                      <TableHead className="text-right">Due Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No invoices found for this customer.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInvoices.map((inv: any) => (
                        <TableRow key={inv.id} className="hover:bg-slate-50/80">
                          <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                            {inv.date ? new Date(inv.date).toLocaleDateString() : ""}
                          </TableCell>
                          <TableCell className="font-mono font-bold text-xs text-blue-700">
                            {inv.invoiceNo}
                          </TableCell>
                          <TableCell className="text-xs capitalize">{inv.paymentType || "Standard"}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-xs">
                            LKR {inv.totalAmount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-emerald-600">
                            LKR {inv.paidAmount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-red-600">
                            LKR {inv.dueAmount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                inv.status === "Paid"
                                  ? "bg-green-100 text-green-800"
                                  : inv.status === "Partial"
                                  ? "bg-amber-100 text-amber-800"
                                  : inv.status === "Cancelled"
                                  ? "bg-gray-100 text-gray-700"
                                  : "bg-red-100 text-red-800"
                              }
                            >
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => openInvoiceSheet(inv.id)}
                            >
                              View Invoice
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* TAB: PURCHASED PRODUCTS */}
            <TabsContent value="purchased-products" className="space-y-4 pt-2">
              {/* Summary Pill Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-orange-800 uppercase tracking-wider">Unique Products Bought</p>
                    <p className="text-xl font-bold font-mono text-orange-950 mt-0.5">{purchasedProducts.length}</p>
                  </div>
                  <Package className="w-6 h-6 text-orange-500 opacity-80" />
                </div>
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">Total Units Purchased</p>
                    <p className="text-xl font-bold font-mono text-blue-950 mt-0.5">{totalUnitsPurchased.toLocaleString()} units</p>
                  </div>
                  <Layers className="w-6 h-6 text-blue-500 opacity-80" />
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Total Product Value</p>
                    <p className="text-xl font-bold font-mono text-emerald-950 mt-0.5">LKR {totalSpentOnProducts.toLocaleString()}</p>
                  </div>
                  <Tag className="w-6 h-6 text-emerald-500 opacity-80" />
                </div>
              </div>

              {/* Search */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search product name or SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9 bg-white text-xs border-slate-200"
                  />
                </div>
                <span className="text-xs text-muted-foreground">Showing {filteredProducts.length} of {purchasedProducts.length}</span>
              </div>

              {/* Product Table */}
              <div className="rounded-lg border bg-white overflow-hidden shadow-xs">
                {loadingPurchasedProducts ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span className="text-xs text-muted-foreground">Loading purchased products...</span>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Product Name & SKU</TableHead>
                        <TableHead className="text-center">Last Purchase Date</TableHead>
                        <TableHead className="text-center">Times Bought</TableHead>
                        <TableHead className="text-right">Total Qty Bought</TableHead>
                        <TableHead className="text-right">Total Spent</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No delivered purchased products found for this customer.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProducts.map((product: any) => {
                          const isExpanded = expandedProductId === product.id;
                          return (
                            <React.Fragment key={product.id}>
                              <TableRow className={isExpanded ? "bg-orange-50/40 border-orange-200" : "hover:bg-slate-50/80"}>
                                <TableCell className="font-medium">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-xs text-slate-900">{product.name}</span>
                                    <span className="font-mono text-[10px] text-muted-foreground">SKU: {product.sku || "N/A"}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center text-xs font-medium text-slate-600 whitespace-nowrap">
                                  {product.lastPurchasedDate ? new Date(product.lastPurchasedDate).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell className="text-center text-xs font-bold font-mono">
                                  {product.purchaseCount}x
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-xs text-blue-700">
                                  {product.totalPurchasedQty.toLocaleString()} {product.unit}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-xs text-emerald-600">
                                  LKR {product.totalSpent.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant={isExpanded ? "default" : "outline"}
                                    className={isExpanded ? "bg-orange-600 hover:bg-orange-700 text-white h-7 text-xs" : "h-7 text-xs border-orange-200 text-orange-900 hover:bg-orange-50"}
                                    onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="w-3.5 h-3.5 mr-1" /> Hide Dates
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-3.5 h-3.5 mr-1 text-orange-600" /> View Dates & Invoices ({product.history?.length || 0})
                                      </>
                                    )}
                                  </Button>
                                </TableCell>
                              </TableRow>

                              {/* Expanded Row showing full purchase dates, invoice numbers, prices, and totals */}
                              {isExpanded && (
                                <TableRow className="bg-orange-50/20 border-b border-orange-200">
                                  <TableCell colSpan={6} className="p-3 sm:p-4">
                                    <div className="bg-white border border-orange-200 rounded-lg p-3 space-y-2.5 shadow-xs">
                                      <div className="flex items-center justify-between border-b pb-2">
                                        <h4 className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                                          <Calendar className="w-3.5 h-3.5 text-orange-600" />
                                          Purchase History for "{product.name}" ({product.history?.length} invoice transaction(s))
                                        </h4>
                                        <span className="text-[11px] text-muted-foreground">
                                          Latest Unit Price: <strong className="font-mono text-slate-800">LKR {product.latestUnitPrice?.toLocaleString()}</strong>
                                        </span>
                                      </div>

                                      <div className="rounded border overflow-hidden">
                                        <Table>
                                          <TableHeader className="bg-orange-50/60">
                                            <TableRow className="border-orange-100">
                                              <TableHead className="text-xs font-semibold text-orange-900">Invoice Date</TableHead>
                                              <TableHead className="text-xs font-semibold text-orange-900">Invoice No</TableHead>
                                              <TableHead className="text-center text-xs font-semibold text-orange-900">Purchased Qty</TableHead>
                                              <TableHead className="text-right text-xs font-semibold text-orange-900">Unit Price</TableHead>
                                              <TableHead className="text-right text-xs font-semibold text-orange-900">Total Price</TableHead>
                                              <TableHead className="text-center text-xs font-semibold text-orange-900">Status</TableHead>
                                              <TableHead className="text-right text-xs font-semibold text-orange-900">Action</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {product.history?.map((h: any, idx: number) => (
                                              <TableRow key={h.orderItemId || idx} className="hover:bg-orange-50/30 text-xs">
                                                <TableCell className="font-medium text-slate-700 whitespace-nowrap">
                                                  {h.date ? new Date(h.date).toLocaleDateString() : "-"}
                                                </TableCell>
                                                <TableCell className="font-mono font-bold text-blue-700">
                                                  {h.invoiceNo}
                                                </TableCell>
                                                <TableCell className="text-center font-mono font-bold">
                                                  {h.quantity} {product.unit}
                                                  {h.freeQuantity > 0 && (
                                                    <span className="text-[10px] text-emerald-600 block">+{h.freeQuantity} free</span>
                                                  )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                  LKR {h.unitPrice?.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-bold text-emerald-600">
                                                  LKR {h.totalPrice?.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                  <Badge variant="outline" className="text-[10px] font-medium bg-slate-50">
                                                    {h.orderStatus}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                  {h.invoiceId ? (
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      className="h-6 text-[11px] px-2 text-blue-700 border-blue-200 hover:bg-blue-50"
                                                      onClick={() => openInvoiceSheet(h.invoiceId)}
                                                    >
                                                      View Invoice
                                                    </Button>
                                                  ) : (
                                                    <span className="text-[10px] text-muted-foreground">-</span>
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            {/* TAB 2: PAYMENTS */}
            <TabsContent value="payments" className="space-y-3 pt-2">
              <div className="rounded-lg border bg-white overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[110px]">Date</TableHead>
                      <TableHead>Invoice Ref</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Cheque No & Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No payment records found for this customer.
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((p: any) => {
                        const isChq = p.method === "cheque" || Boolean(p.chequeNo);
                        const chqSt = (p.chequeStatus || (isChq ? "Pending" : "Cleared")).toLowerCase();
                        let badgeClass = "bg-green-100 text-green-800";
                        if (isChq) {
                          if (chqSt === "passed" || chqSt === "cleared") badgeClass = "bg-emerald-100 text-emerald-800";
                          else if (chqSt === "returned" || chqSt === "bounced") badgeClass = "bg-red-100 text-red-800";
                          else badgeClass = "bg-amber-100 text-amber-800";
                        }
                        return (
                          <TableRow key={p.id} className="hover:bg-slate-50/80">
                            <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                              {p.date ? new Date(p.date).toLocaleDateString() : ""}
                            </TableCell>
                            <TableCell className="font-mono font-bold text-xs text-blue-700">
                              {p.invoiceNo || "N/A"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-xs font-semibold bg-slate-50">
                                {p.method}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {p.chequeNo ? (
                                <div className="flex flex-col">
                                  <span className="font-bold text-amber-900">{p.chequeNo}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {p.chequeDate ? new Date(p.chequeDate).toLocaleDateString() : ""}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={badgeClass}>
                                {p.chequeStatus || (isChq ? "Pending" : "Cleared")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-xs text-emerald-600">
                              LKR {p.amount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 max-w-[200px] truncate" title={p.notes}>
                              {p.notes || "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* TAB 3: CHEQUES */}
            <TabsContent value="cheques" className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={chequeFilter === "all" ? "default" : "outline"}
                  className="text-xs h-7"
                  onClick={() => setChequeFilter("all")}
                >
                  All ({cheques.length})
                </Button>
                <Button
                  size="sm"
                  variant={chequeFilter === "pending" ? "default" : "outline"}
                  className="text-xs h-7 border-amber-300 text-amber-900"
                  onClick={() => setChequeFilter("pending")}
                >
                  Pending ({summary.cheques.pendingCount})
                </Button>
                <Button
                  size="sm"
                  variant={chequeFilter === "cleared" ? "default" : "outline"}
                  className="text-xs h-7 border-emerald-300 text-emerald-900"
                  onClick={() => setChequeFilter("cleared")}
                >
                  Cleared ({summary.cheques.clearedCount})
                </Button>
                <Button
                  size="sm"
                  variant={chequeFilter === "returned" ? "default" : "outline"}
                  className="text-xs h-7 border-red-300 text-red-900"
                  onClick={() => setChequeFilter("returned")}
                >
                  Returned ({summary.cheques.returnedCount})
                </Button>
              </div>

              <div className="rounded-lg border bg-white overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Cheque No</TableHead>
                      <TableHead>Cheque Date</TableHead>
                      <TableHead>Invoice Ref</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCheques.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No cheque records found in this category.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCheques.map((c: any) => {
                        const st = c.status.toLowerCase();
                        let badgeClass = "bg-amber-100 text-amber-800";
                        if (st === "passed" || st === "cleared") badgeClass = "bg-emerald-100 text-emerald-800";
                        if (st === "returned" || st === "bounced") badgeClass = "bg-red-100 text-red-800";

                        return (
                          <TableRow key={c.id} className="hover:bg-slate-50/80">
                            <TableCell className="font-mono font-bold text-xs text-amber-800">
                              {c.chequeNo}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                              {c.chequeDate ? new Date(c.chequeDate).toLocaleDateString() : ""}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-blue-700 font-semibold">
                              {c.invoiceNo}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-xs">
                              LKR {c.amount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge className={badgeClass}>{c.status}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 max-w-[200px] truncate" title={c.notes}>
                              {c.notes || "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* TAB 4: RETURNS */}
            <TabsContent value="returns" className="space-y-3 pt-2">
              <div className="rounded-lg border bg-white overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Return No</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Product / SKU</TableHead>
                      <TableHead className="text-center">Quantity</TableHead>
                      <TableHead>Return Type</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No return records found for this customer.
                        </TableCell>
                      </TableRow>
                    ) : (
                      returns.map((r: any) => (
                        <TableRow key={r.id} className="hover:bg-slate-50/80">
                          <TableCell className="font-mono font-bold text-xs text-purple-800">
                            {r.returnNumber}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                            {r.date ? new Date(r.date).toLocaleDateString() : ""}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-xs text-slate-900">{r.productName}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{r.sku}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-bold text-xs">{r.quantity}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                r.returnType === "Good"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-800"
                              }
                            >
                              {r.returnType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 italic max-w-[250px] truncate" title={r.reason}>
                            {r.reason}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* TAB 5: PROFILE INFO */}
            <TabsContent value="profile" className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border bg-slate-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" /> Basic Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Shop Name:</span>
                      <span className="font-semibold text-slate-900">{customer.shopName}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Owner Name:</span>
                      <span className="font-semibold text-slate-900">{customer.ownerName || "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Phone Number:</span>
                      <span className="font-mono font-semibold text-slate-900">{customer.phone || "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-semibold text-slate-900">{customer.email || "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Address:</span>
                      <span className="font-semibold text-slate-900">{customer.address || "N/A"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border bg-slate-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" /> Business & Account Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Assigned Business:</span>
                      <span className="font-semibold text-blue-700">{customer.businessName}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Route / Beat Area:</span>
                      <span className="font-semibold text-slate-900">{customer.route}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Credit Limit:</span>
                      <span className="font-mono font-semibold text-slate-900">LKR {customer.creditLimit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-muted-foreground">Outstanding Balance:</span>
                      <span className="font-mono font-bold text-red-600">LKR {customer.outstandingBalance.toLocaleString()}</span>
                    </div>
                    {customer.latitude && customer.longitude && (
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-muted-foreground">GPS Location:</span>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${customer.latitude},${customer.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                        >
                          View Google Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Invoice Details Sidebar (Sheet) */}
      <Sheet open={showInvoiceSheet} onOpenChange={setShowInvoiceSheet}>
        <SheetContent className="sm:max-w-xl overflow-y-auto h-full">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Invoice Details
            </SheetTitle>
          </SheetHeader>

          {loadingInvoice ? (
            <div className="flex justify-center items-center h-[300px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : invoiceDetails ? (
            <div className="py-4 space-y-6">
              {/* Invoice Meta */}
              <div className="bg-slate-50 p-4 rounded-lg border space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">Invoice No</span>
                  <span className="font-mono font-bold text-sm text-slate-900">{invoiceDetails.invoiceNo}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">Invoice Date</span>
                  <span className="text-sm font-medium">{new Date(invoiceDetails.date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground uppercase font-semibold">Payment Status</span>
                  <Badge className={invoiceDetails.status === "Paid" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {invoiceDetails.status}
                  </Badge>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</h4>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Item</TableHead>
                        <TableHead className="text-center text-xs font-semibold">Qty</TableHead>
                        <TableHead className="text-right text-xs font-semibold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceDetails.items?.map((item: any) => (
                        <TableRow key={item.productId || item.sku}>
                          <TableCell className="py-2.5">
                            <p className="text-sm font-medium leading-none">{item.productName || item.sku}</p>
                            <p className="text-[10px] text-muted-foreground font-mono mt-1">{item.sku}</p>
                          </TableCell>
                          <TableCell className="text-center py-2.5 text-sm">
                            {item.quantity} {item.unit}
                            {item.freeQuantity > 0 && (
                              <span className="text-[10px] text-green-600 block">+{item.freeQuantity} free</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-2.5 font-mono text-sm font-medium">
                            LKR {item.total?.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Financial Summary */}
              {(() => {
                const gTotal = invoiceDetails.grandTotal || invoiceDetails.totalAmount || 0;
                const pAmount = invoiceDetails.paidAmount || 0;
                const dAmount = invoiceDetails.dueAmount != null
                  ? invoiceDetails.dueAmount
                  : Math.max(0, gTotal - pAmount);
                const discAmount = invoiceDetails.extraDiscountAmount || 0;
                const discPercent = invoiceDetails.extraDiscountPercent || 0;
                const itemsSubtotal = (invoiceDetails.items || []).reduce(
                  (sum: number, item: any) => sum + (item.total || (item.quantity * (item.unitPrice || 0)) || 0),
                  0
                );
                const subTotal = itemsSubtotal > 0 ? itemsSubtotal : (gTotal + discAmount);

                return (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2">
                      Financial Breakdown
                    </h4>

                    {/* Subtotal */}
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-mono font-semibold text-slate-800">
                        LKR {subTotal.toLocaleString()}
                      </span>
                    </div>

                    {/* Extra Discount (if any) */}
                    {(discAmount > 0 || discPercent > 0) && (
                      <div className="flex justify-between items-center text-xs text-amber-800 font-semibold bg-amber-50 p-2 rounded-md border border-amber-200">
                        <span>🏷️ Extra Discount ({discPercent}%)</span>
                        <span className="font-mono text-amber-900">
                          - LKR {discAmount.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Grand Total */}
                    <div className="flex justify-between items-center text-sm font-bold pt-1.5 border-t border-slate-200">
                      <span className="text-slate-900">Grand Total</span>
                      <span className="font-mono text-base text-blue-700">
                        LKR {gTotal.toLocaleString()}
                      </span>
                    </div>

                    {/* Paid Amount */}
                    <div className="flex justify-between items-center text-xs font-semibold text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                      <span>Paid Amount</span>
                      <span className="font-mono font-bold text-emerald-900">
                        LKR {pAmount.toLocaleString()}
                      </span>
                    </div>

                    {/* Due Amount */}
                    <div className="flex justify-between items-center text-sm font-bold text-red-800 bg-red-50 p-3 rounded-lg border border-red-200">
                      <span>Balance Due</span>
                      <span className="font-mono text-base text-red-700">
                        LKR {dAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Failed to load invoice details.
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
