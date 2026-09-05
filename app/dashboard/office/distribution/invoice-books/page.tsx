"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MoreVertical,
  Edit2,
  CheckSquare,
  Trash2,
  User,
  Hash,
  Sparkles,
  TrendingUp,
  RotateCcw,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS } from "@/app/config/business-constants";

interface InvoiceBook {
  id: string;
  book_number: string;
  prefix: string;
  start_number: number;
  end_number: number;
  current_number: number;
  assigned_to_user_id: string | null;
  assigned_to_user_name: string | null;
  business_id: string | null;
  status: "Active" | "Completed" | "Cancelled";
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
}

interface SalesRep {
  id: string;
  full_name: string;
  email?: string;
  role?: string;
}

export default function DistributionInvoiceBooksPage() {
  const [books, setBooks] = useState<InvoiceBook[]>([]);
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookNumber, setBookNumber] = useState("");
  const [prefix, setPrefix] = useState("CHD");
  const [startNumber, setStartNumber] = useState<number | "">(2000);
  const [endNumber, setEndNumber] = useState<number | "">(3000);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [notes, setNotes] = useState("");

  // Edit / Adjust Modal state
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<InvoiceBook | null>(null);
  const [newCurrentNumber, setNewCurrentNumber] = useState<number | "">("");

  const businessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (businessId) params.append("businessId", businessId);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (search) params.append("search", search);

      const res = await fetch(`/api/invoice-books?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
      } else {
        toast.error("Failed to load invoice books");
      }
    } catch {
      toast.error("Error fetching invoice books");
    } finally {
      setLoading(false);
    }
  }, [businessId, statusFilter, search]);

  const fetchReps = useCallback(async () => {
    try {
      const res = await fetch("/api/users?roles=rep,admin,office");
      if (res.ok) {
        const data = await res.json();
        setReps(data);
      }
    } catch (e) {
      console.error("Failed to fetch reps:", e);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
    fetchReps();
  }, [fetchBooks, fetchReps]);

  const handleCreateBook = async () => {
    if (!bookNumber.trim()) {
      toast.error("Please enter a Book Number");
      return;
    }
    if (!assignedUserId) {
      toast.error("Please select a Sales Representative");
      return;
    }
    if (typeof startNumber !== "number" || typeof endNumber !== "number") {
      toast.error("Please enter valid start and end numbers");
      return;
    }
    if (startNumber > endNumber) {
      toast.error("Start number cannot be greater than End number");
      return;
    }

    setIsSubmitting(true);
    try {
      const currentUser = getUserBusinessContext();
      const res = await fetch("/api/invoice-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookNumber,
          prefix: prefix.trim().toUpperCase() || "CHD",
          startNumber,
          endNumber,
          assignedToUserId: assignedUserId,
          businessId,
          performedByName: currentUser?.name || "Admin",
          performedByEmail: currentUser?.email || null,
          notes,
        }),
      });

      if (res.ok) {
        toast.success("Invoice Book assigned successfully!");
        setCreateModalOpen(false);
        setBookNumber("");
        setNotes("");
        fetchBooks();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create invoice book");
      }
    } catch {
      toast.error("Unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustCurrentNumber = async () => {
    if (!selectedBook || typeof newCurrentNumber !== "number") return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/invoice-books/${selectedBook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentNumber: newCurrentNumber,
        }),
      });

      if (res.ok) {
        toast.success("Invoice book updated!");
        setAdjustModalOpen(false);
        fetchBooks();
      } else {
        toast.error("Failed to update invoice book");
      }
    } catch {
      toast.error("Error updating book");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseBook = async (book: InvoiceBook) => {
    if (!confirm(`Are you sure you want to mark Book #${book.book_number} as Completed?`)) return;
    try {
      const res = await fetch(`/api/invoice-books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      });
      if (res.ok) {
        toast.success(`Book #${book.book_number} completed!`);
        fetchBooks();
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDeleteBook = async (book: InvoiceBook) => {
    if (!confirm(`Are you sure you want to delete Book #${book.book_number}?`)) return;
    try {
      const res = await fetch(`/api/invoice-books/${book.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Book deleted");
        fetchBooks();
      }
    } catch {
      toast.error("Failed to delete book");
    }
  };

  // KPIs
  const totalBooks = books.length;
  const activeBooks = books.filter((b) => b.status === "Active").length;
  const completedBooks = books.filter((b) => b.status === "Completed").length;
  const totalBillsIssued = books.reduce((acc, b) => acc + Math.max(0, b.current_number - b.start_number), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-blue-600" />
            Invoice Books & Rep Ranges
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage custom invoice numbering ranges (e.g. 2000-3000) assigned to Sales Representatives
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Assign New Invoice Book
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-100 bg-blue-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Total Books
              <BookOpen className="h-4 w-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{totalBooks}</div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Active Books
              <Sparkles className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">{activeBooks}</div>
          </CardContent>
        </Card>

        <Card className="border-purple-100 bg-purple-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Completed Books
              <CheckCircle2 className="h-4 w-4 text-purple-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{completedBooks}</div>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Total Invoices Issued
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">{totalBillsIssued}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by book # or rep..."
                className="pl-8 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 text-sm">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active Only</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
              <AlertCircle className="h-8 w-8 opacity-40" />
              <p className="text-sm">No invoice books found</p>
              <Button size="sm" variant="outline" onClick={() => setCreateModalOpen(true)}>
                Assign First Invoice Book
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Book #</TableHead>
                    <TableHead>Assigned Sales Rep</TableHead>
                    <TableHead>Range (Start – End)</TableHead>
                    <TableHead>Next Active No</TableHead>
                    <TableHead className="w-48">Usage Progress</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {books.map((book) => {
                    const totalRange = Math.max(1, book.end_number - book.start_number + 1);
                    const usedCount = Math.max(0, Math.min(totalRange, book.current_number - book.start_number));
                    const percentage = Math.min(100, Math.round((usedCount / totalRange) * 100));

                    return (
                      <TableRow key={book.id}>
                        <TableCell className="font-semibold font-mono">
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />
                            <span>Book #{book.book_number}</span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-800 font-bold text-xs">
                              {(book.assigned_to_user_name || "U")[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-sm">
                              {book.assigned_to_user_name || "Unassigned"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="font-mono text-sm text-slate-700">
                          {book.prefix}-{book.start_number} → {book.prefix}-{book.end_number}
                        </TableCell>

                        <TableCell className="font-mono font-bold text-blue-700">
                          {book.prefix}-{String(book.current_number).padStart(4, "0")}
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{usedCount} / {totalRange} bills</span>
                              <span className="font-medium">{percentage}%</span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        </TableCell>

                        <TableCell className="text-center">
                          {book.status === "Active" ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                              Active
                            </Badge>
                          ) : book.status === "Completed" ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-100 text-gray-700">
                              Cancelled
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedBook(book);
                                  setNewCurrentNumber(book.current_number);
                                  setAdjustModalOpen(true);
                                }}
                              >
                                <Edit2 className="w-4 h-4 mr-2 text-blue-600" /> Adjust Current Number
                              </DropdownMenuItem>

                              {book.status === "Active" && (
                                <DropdownMenuItem onClick={() => handleCloseBook(book)}>
                                  <CheckSquare className="w-4 h-4 mr-2 text-purple-600" /> Mark as Completed
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDeleteBook(book)} className="text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" /> Delete Book
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Create / Assign New Invoice Book */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Assign New Invoice Book
            </DialogTitle>
            <DialogDescription>
              Assign a custom invoice numbering range (e.g. 2000 - 3000) to a Sales Representative.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Sales Representative *</Label>
              <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Sales Rep..." />
                </SelectTrigger>
                <SelectContent>
                  {reps.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.full_name} {rep.role ? `(${rep.role.toUpperCase()})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Book Number / Identifier *</Label>
                <Input
                  placeholder="e.g. 001 or DIR-01"
                  value={bookNumber}
                  onChange={(e) => setBookNumber(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Invoice Prefix *</Label>
                <Input
                  placeholder="CHD"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Number *</Label>
                <Input
                  type="number"
                  placeholder="2000"
                  value={startNumber}
                  onChange={(e) => setStartNumber(parseInt(e.target.value) || "")}
                />
              </div>

              <div className="space-y-2">
                <Label>End Number *</Label>
                <Input
                  type="number"
                  placeholder="3000"
                  value={endNumber}
                  onChange={(e) => setEndNumber(parseInt(e.target.value) || "")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input
                placeholder="Additional details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateBook} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 gap-2">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Assign Book
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Adjust Current Number */}
      <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Adjust Next Invoice Number</DialogTitle>
            <DialogDescription>
              Book #{selectedBook?.book_number} ({selectedBook?.assigned_to_user_name})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Next Active Number</Label>
              <Input
                type="number"
                value={newCurrentNumber}
                onChange={(e) => setNewCurrentNumber(parseInt(e.target.value) || "")}
              />
              <p className="text-xs text-muted-foreground">
                Range: {selectedBook?.start_number} to {selectedBook?.end_number}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleAdjustCurrentNumber} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              Save Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
