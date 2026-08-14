"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Search,
  BookOpen,
  Filter,
  Printer,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  Hash,
  Coins,
  FileText,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { ReceiptBook } from "@/hooks/useReceiptBooks";

interface SettledInvoice {
  paymentId: string;
  invoiceNo: string;
  amount: number;
}

interface ReceiptAuditItem {
  receiptNumber: string;
  status: "Issued" | "Unused" | "Cancelled";
  paymentDate: string | null;
  invoiceNo: string | null;
  invoicesList?: SettledInvoice[];
  invoiceCount?: number;
  customerName: string | null;
  amount: number | null;
  method: string | null;
}

interface AuditSummary {
  totalReceipts: number;
  issuedCount: number;
  unusedCount: number;
  cancelledCount: number;
  totalCollected: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2 }).format(amount);

export default function DedicatedReceiptAuditPage() {
  const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const [bookPopoverOpen, setBookPopoverOpen] = useState(false);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Custom Range Inputs
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [customOwner, setCustomOwner] = useState<string>("");

  // Audit Data State
  const [auditData, setAuditData] = useState<{
    book: any;
    summary: AuditSummary;
    items: ReceiptAuditItem[];
  } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Fetch available books for dropdown
  const fetchBooks = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const res = await fetch("/api/receipt-books");
      if (res.ok) {
        const data: ReceiptBook[] = await res.json();
        setReceiptBooks(data || []);
        if (data.length > 0) {
          setSelectedBookId(data[0].id);
        }
      }
    } catch {
      toast.error("Failed to load receipt books list");
    } finally {
      setLoadingBooks(false);
    }
  }, []);

  // Run audit breakdown calculation
  const runAudit = useCallback(async (bookId?: string, start?: string, end?: string, owner?: string) => {
    setLoadingAudit(true);
    try {
      const params = new URLSearchParams();
      if (bookId && bookId !== "custom") {
        params.append("bookId", bookId);
      } else if (start && end) {
        params.append("startNumber", start);
        params.append("endNumber", end);
        if (owner) params.append("ownerName", owner);
      } else {
        setLoadingAudit(false);
        return;
      }

      const res = await fetch(`/api/receipt-books/audit-details?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAuditData(data);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to load audit breakdown");
      }
    } catch {
      toast.error("An error occurred while loading audit details");
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    if (selectedBookId && selectedBookId !== "custom") {
      runAudit(selectedBookId);
    }
  }, [selectedBookId, runAudit]);

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart || !customEnd) {
      toast.error("Please enter both Start and End receipt numbers");
      return;
    }
    setSelectedBookId("custom");
    runAudit(undefined, customStart, customEnd, customOwner);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter items
  const filteredItems = (auditData?.items || []).filter((item) => {
    const matchesStatus =
      statusFilter === "all" ? true : item.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch = searchQuery
      ? item.receiptNumber.includes(searchQuery) ||
        (item.invoiceNo && item.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.customerName && item.customerName.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 p-2 sm:p-6 w-full">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600 text-white shadow-md">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Receipt Book Audit & Sequence Inspector</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Audit receipt books number-by-number to track payments, customers, and unused sequence numbers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} className="flex items-center gap-1.5 text-xs">
            <Printer className="h-4 w-4" /> Print Audit Report
          </Button>
        </div>
      </div>

      {/* Control Panel: Select Book OR Custom Range */}
      <Card className="border-purple-100 shadow-sm bg-purple-50/20">
        <CardHeader className="py-3 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-purple-600" /> Select Receipt Book or Custom Range to Audit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-12 items-end">
            {/* Searchable Receipt Book Selector Combobox */}
            <div className="sm:col-span-6 space-y-1.5">
              <Label className="text-xs font-semibold">Search & Select Assigned Receipt Book</Label>
              <Popover open={bookPopoverOpen} onOpenChange={setBookPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={bookPopoverOpen}
                    className="w-full justify-between bg-white text-sm font-normal"
                    disabled={loadingBooks}
                  >
                    {loadingBooks ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading books…
                      </span>
                    ) : selectedBookId && selectedBookId !== "custom" ? (
                      (() => {
                        const b = receiptBooks.find((item) => item.id === selectedBookId);
                        return b
                          ? `Book #${b.book_number} — ${b.assigned_to_user_name || "Unassigned"} (${b.start_number} - ${b.end_number})`
                          : "Select receipt book…";
                      })()
                    ) : selectedBookId === "custom" ? (
                      <span className="font-semibold text-purple-700">Custom Range Specified</span>
                    ) : (
                      <span className="text-muted-foreground">Search receipt book by # or name…</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[420px] max-w-full" style={{ width: "var(--radix-popover-trigger-width)" }}>
                  <Command>
                    <CommandInput placeholder="Type book #, owner name, or serial range..." className="h-9 text-xs" />
                    <CommandList>
                      <CommandEmpty className="py-4 text-center text-xs text-slate-500">
                        No receipt books found.
                      </CommandEmpty>
                      <CommandGroup>
                        {receiptBooks.map((b) => (
                          <CommandItem
                            key={b.id}
                            value={`${b.book_number} ${b.assigned_to_user_name || ""} ${b.start_number} ${b.end_number}`}
                            onSelect={() => {
                              setSelectedBookId(b.id);
                              setBookPopoverOpen(false);
                            }}
                            className="text-xs flex items-center justify-between py-2 cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <Check
                                className={`h-4 w-4 ${selectedBookId === b.id ? "opacity-100 text-purple-700" : "opacity-0"}`}
                              />
                              <div>
                                <span className="font-bold text-slate-900">Book #{b.book_number}</span>
                                <span className="text-slate-500 ml-1.5">— {b.assigned_to_user_name || "Unassigned"}</span>
                                <div className="text-[11px] text-purple-700 font-mono">
                                  Range: {b.start_number} to {b.end_number}
                                </div>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {b.status}
                            </Badge>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Custom Range Divider */}
            <div className="sm:col-span-6 text-xs text-muted-foreground font-medium pt-2 sm:pt-0">
              OR Audit Custom Range below:
            </div>
          </div>

          {/* Custom Range Inputs Form */}
          <form onSubmit={handleCustomSearch} className="grid gap-3 sm:grid-cols-12 items-end pt-2 border-t border-purple-100">
            <div className="sm:col-span-3 space-y-1">
              <Label className="text-xs">Start Receipt #</Label>
              <Input
                type="number"
                placeholder="e.g. 1001"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-white h-9 text-xs"
              />
            </div>

            <div className="sm:col-span-3 space-y-1">
              <Label className="text-xs">End Receipt #</Label>
              <Input
                type="number"
                placeholder="e.g. 1050"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-white h-9 text-xs"
              />
            </div>

            <div className="sm:col-span-4 space-y-1">
              <Label className="text-xs">Collector / Owner Name (Optional)</Label>
              <Input
                placeholder="e.g. John Doe"
                value={customOwner}
                onChange={(e) => setCustomOwner(e.target.value)}
                className="bg-white h-9 text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <Button type="submit" size="sm" className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs h-9">
                <Search className="h-3.5 w-3.5 mr-1" /> Audit Range
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Audit Summary Cards */}
      {auditData && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Book Owner / Assigned To</p>
                  <p className="text-base font-bold text-slate-900 mt-1">
                    {auditData.book?.assigned_to_user_name || "Unassigned"}
                  </p>
                  <p className="text-[11px] text-purple-700 font-mono mt-0.5">
                    Book #{auditData.book?.book_number || "Custom"}
                  </p>
                </div>
                <User className="h-8 w-8 text-purple-600 opacity-80" />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Serial Number Range</p>
                  <p className="text-base font-bold font-mono text-slate-900 mt-1">
                    #{auditData.book?.start_number} — #{auditData.book?.end_number}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Total: {auditData.summary.totalReceipts} Receipts
                  </p>
                </div>
                <Hash className="h-8 w-8 text-blue-600 opacity-80" />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Issuance Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-emerald-100 text-emerald-800 font-bold">
                      {auditData.summary.issuedCount} Issued
                    </Badge>
                    <Badge variant="outline" className="text-slate-600 font-bold">
                      {auditData.summary.unusedCount} Unused
                    </Badge>
                  </div>
                  {auditData.summary.cancelledCount > 0 && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">
                      {auditData.summary.cancelledCount} Cancelled
                    </p>
                  )}
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-600 opacity-80" />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Total Money Collected</p>
                  <p className="text-base font-bold text-emerald-700 mt-1">
                    {formatCurrency(auditData.summary.totalCollected)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Sum of all issued payments</p>
                </div>
                <Coins className="h-8 w-8 text-amber-500 opacity-80" />
              </CardContent>
            </Card>
          </div>

          {/* Number-by-Number Audit Table */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="py-3 px-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Receipt Number Sequence Audit</CardTitle>
                <CardDescription className="text-xs">
                  Line-by-line verification of every receipt number in range #{auditData.book?.start_number} to #{auditData.book?.end_number}
                </CardDescription>
              </div>

              {/* Table Filters */}
              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search receipt/inv/cust…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="Filter Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Receipts</SelectItem>
                    <SelectItem value="issued">Issued Only</SelectItem>
                    <SelectItem value="unused">Unused Only</SelectItem>
                    <SelectItem value="cancelled">Cancelled Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loadingAudit ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" /> Auditing receipt number sequence…
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No matching receipts found for current filter.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 text-xs">
                      <TableHead className="w-24 font-bold">Receipt #</TableHead>
                      <TableHead className="w-24 font-bold">Status</TableHead>
                      <TableHead className="w-28 font-bold">Date</TableHead>
                      <TableHead className="w-96 font-bold min-w-[320px]">Invoice # / Settled List</TableHead>
                      <TableHead className="w-64 font-bold">Customer Name</TableHead>
                      <TableHead className="w-36 font-bold">Payment Method</TableHead>
                      <TableHead className="w-36 text-right font-bold">Amount (LKR)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.receiptNumber} className={item.status === "Unused" ? "bg-slate-50/40 text-slate-400" : ""}>
                        <TableCell className="font-mono font-bold text-slate-900">
                          #{item.receiptNumber}
                        </TableCell>
                        <TableCell>
                          {item.status === "Issued" ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-semibold text-[11px]">
                              Issued
                            </Badge>
                          ) : item.status === "Cancelled" ? (
                            <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 font-semibold text-[11px]">
                              Cancelled
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-[11px]">
                              Unused
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {item.paymentDate
                            ? new Date(item.paymentDate).toLocaleDateString("en-LK", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-purple-900 py-2.5 min-w-[320px]">
                          {item.invoicesList && item.invoicesList.length > 1 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary" className="bg-purple-100 text-purple-900 font-bold text-[10px] whitespace-nowrap shrink-0">
                                {item.invoicesList.length} Invoices
                              </Badge>
                              {item.invoicesList.map((inv, idx) => (
                                <Badge key={idx} variant="outline" className="bg-purple-50/70 text-purple-950 border-purple-200 text-[11px] font-mono whitespace-nowrap px-2 py-0.5">
                                  {inv.invoiceNo} <span className="text-purple-700 font-bold ml-1">({formatCurrency(inv.amount)})</span>
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="font-mono text-xs font-bold text-purple-950">{item.invoiceNo || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">
                          {item.customerName || "—"}
                        </TableCell>
                        <TableCell className="capitalize text-xs">
                          {item.method || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-emerald-700">
                          {item.amount !== null ? formatCurrency(item.amount) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
