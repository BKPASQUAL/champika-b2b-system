"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Plus,
  Search,
  UserCheck,
  Edit,
  Loader2,
  RefreshCw,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { ReceiptBook } from "@/hooks/useReceiptBooks";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role?: string;
}

export default function OfficeReceiptBooksPage() {
  const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<ReceiptBook | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Assign Form state
  const [bookNumber, setBookNumber] = useState("");
  const [startNumber, setStartNumber] = useState<number | "">("");
  const [endNumber, setEndNumber] = useState<number | "">("");
  const [assignedUserId, setAssignedUserId] = useState("");

  // Edit Form state
  const [editBookNumber, setEditBookNumber] = useState("");
  const [editStartNumber, setEditStartNumber] = useState<number | "">("");
  const [editEndNumber, setEditEndNumber] = useState<number | "">("");
  const [editCurrentNumber, setEditCurrentNumber] = useState<number | "">("");
  const [editAssignedUserId, setEditAssignedUserId] = useState("");
  const [editStatus, setEditStatus] = useState<"Active" | "Completed" | "Cancelled">("Active");

  // User context
  const currentUser = getUserBusinessContext();

  const fetchProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data || []);
      }
    } catch {
      toast.error("Failed to load user list");
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  const fetchReceiptBooks = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchQuery) params.append("search", searchQuery);

      const res = await fetch(`/api/receipt-books?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReceiptBooks(data || []);
      }
    } catch {
      toast.error("Failed to load receipt books");
    } finally {
      setLoadingBooks(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchProfiles();
    fetchReceiptBooks();
  }, [fetchProfiles, fetchReceiptBooks]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookNumber.trim() || !startNumber || !endNumber || !assignedUserId) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (Number(startNumber) > Number(endNumber)) {
      toast.error("Start number cannot be greater than end number");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/receipt-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookNumber: bookNumber.trim(),
          startNumber: Number(startNumber),
          endNumber: Number(endNumber),
          assignedToUserId: assignedUserId,
          performedByName: currentUser?.name || "Office User",
          performedByEmail: currentUser?.email || null,
        }),
      });

      if (res.ok) {
        toast.success(`Receipt book #${bookNumber} assigned successfully!`);
        setAssignModalOpen(false);
        setBookNumber("");
        setStartNumber("");
        setEndNumber("");
        setAssignedUserId("");
        fetchReceiptBooks();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to assign receipt book");
      }
    } catch {
      toast.error("An error occurred while creating assignment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (book: ReceiptBook) => {
    setSelectedBook(book);
    setEditBookNumber(book.book_number);
    setEditStartNumber(book.start_number);
    setEditEndNumber(book.end_number);
    setEditCurrentNumber(book.current_number);
    setEditAssignedUserId(book.assigned_to_user_id || "");
    setEditStatus(book.status);
    setEditModalOpen(true);
  };

  const handleUpdateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/receipt-books/${selectedBook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookNumber: editBookNumber.trim(),
          startNumber: Number(editStartNumber),
          endNumber: Number(editEndNumber),
          currentNumber: Number(editCurrentNumber),
          assignedToUserId: editAssignedUserId,
          status: editStatus,
          performedByName: currentUser?.name || "Office User",
          performedByEmail: currentUser?.email || null,
        }),
      });

      if (res.ok) {
        toast.success(`Receipt book #${editBookNumber} updated successfully!`);
        setEditModalOpen(false);
        fetchReceiptBooks();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update receipt book");
      }
    } catch {
      toast.error("An error occurred while updating assignment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>;
      case "Completed":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Completed</Badge>;
      case "Cancelled":
        return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-1 sm:p-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600 text-white shadow-md">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Receipt Book Assignments</h1>
            <p className="text-sm text-slate-500">
              View and assign physical receipt books for collectors and officers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setAssignModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 shadow"
          >
            <Plus className="h-4 w-4" /> Assign Receipt Book
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search book # or user…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={fetchReceiptBooks}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="py-4">
          <CardTitle className="text-lg">Assigned Receipt Books</CardTitle>
          <CardDescription>
            Active serial ranges assigned to users for receipt issuing
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingBooks ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading receipt books…
            </div>
          ) : receiptBooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <BookOpen className="h-10 w-10 text-slate-300 mb-2" />
              <p className="font-medium">No receipt books found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book Number</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Range (Start – End)</TableHead>
                  <TableHead>Current Receipt #</TableHead>
                  <TableHead className="w-48">Usage Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const filtered = receiptBooks.filter((b) => {
                    const matchesStatus = statusFilter === "all" ? true : b.status === statusFilter;
                    const q = searchQuery.toLowerCase().trim();
                    const matchesSearch = !q ? true : (
                      b.book_number?.toLowerCase().includes(q) ||
                      (b.assigned_to_user_name && b.assigned_to_user_name.toLowerCase().includes(q)) ||
                      String(b.start_number).includes(q) ||
                      String(b.end_number).includes(q) ||
                      String(b.current_number).includes(q)
                    );
                    return matchesStatus && matchesSearch;
                  });

                  if (filtered.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-slate-500 text-sm">
                          No receipt books matching search filter &quot;{searchQuery}&quot;
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return filtered.map((book) => {
                    const total = Math.max(1, book.end_number - book.start_number + 1);
                    const used = Math.min(total, Math.max(0, book.current_number - book.start_number));
                    const progress = Math.round((used / total) * 100);

                    return (
                      <TableRow key={book.id}>
                      <TableCell className="font-bold text-purple-950">
                        #{book.book_number}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">
                          {book.assigned_to_user_name || "Unassigned"}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {book.start_number} — {book.end_number}
                      </TableCell>
                      <TableCell className="font-bold font-mono text-purple-700">
                        #{book.current_number}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-medium text-slate-600">
                            <span>{used} / {total} used</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                        </div>
                      </TableCell>
                      <TableCell>{renderStatusBadge(book.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(book)}
                          className="h-8 text-xs text-slate-600 hover:text-purple-700"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" /> Edit / Reassign
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                });
              })()}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal: Assign New Receipt Book */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-600" /> Assign Receipt Book
            </DialogTitle>
            <DialogDescription>
              Assign a new receipt book serial range to a user
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAssignment} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Assign to User *</Label>
              <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email} ({p.role || "user"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Book Number / Serial Code *</Label>
              <Input
                placeholder="e.g. BK-101"
                value={bookNumber}
                onChange={(e) => setBookNumber(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Receipt # *</Label>
                <Input
                  type="number"
                  placeholder="1001"
                  value={startNumber}
                  onChange={(e) => setStartNumber(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label>End Receipt # *</Label>
                <Input
                  type="number"
                  placeholder="1050"
                  value={endNumber}
                  onChange={(e) => setEndNumber(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Assign Book
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Edit Receipt Book Assignment */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-purple-600" /> Edit Receipt Book Assignment
            </DialogTitle>
            <DialogDescription>
              Update range limits, reassign user, or change status
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateAssignment} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Assigned User *</Label>
              <Select value={editAssignedUserId} onValueChange={setEditAssignedUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email} ({p.role || "user"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Book Number *</Label>
              <Input
                value={editBookNumber}
                onChange={(e) => setEditBookNumber(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Receipt # *</Label>
                <Input
                  type="number"
                  value={editStartNumber}
                  onChange={(e) => setEditStartNumber(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label>End Receipt # *</Label>
                <Input
                  type="number"
                  value={editEndNumber}
                  onChange={(e) => setEditEndNumber(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Current Next Receipt # *</Label>
              <Input
                type="number"
                value={editCurrentNumber}
                onChange={(e) => setEditCurrentNumber(e.target.value === "" ? "" : Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">
                Adjust next receipt number counter if a mistyped receipt number accidentally jumped sequence.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Status *</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
