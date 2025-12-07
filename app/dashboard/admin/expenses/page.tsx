"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { ExpenseTable } from "./_components/ExpenseTable";
import { ExpenseFormDialog } from "./_components/ExpenseDialogs";
import { ExpenseFilters } from "./_components/ExpenseFilters";
import { Expense, ExpenseFormData } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ExpensesPage() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // --- Filtering State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterMonth, setFilterMonth] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/expenses");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setExpenses(data);
    } catch (error) {
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // --- Filter Logic ---
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      // ✅ FIX: Handle optional description safely
      const description = expense.description || "";
      const matchesSearch = description
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      // 2. Category
      const matchesCategory =
        filterCategory === "ALL" || expense.category === filterCategory;

      // 3. Date Filtering
      let matchesDate = true;

      if (filterMonth) {
        matchesDate = expense.expenseDate.startsWith(filterMonth);
      } else if (startDate || endDate) {
        const expDate = new Date(expense.expenseDate);
        if (startDate) {
          matchesDate = matchesDate && expDate >= new Date(startDate);
        }
        if (endDate) {
          matchesDate = matchesDate && expDate <= new Date(endDate);
        }
      }

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [expenses, searchQuery, filterCategory, filterMonth, startDate, endDate]);

  // --- Stats Calculation ---
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const todayStr = new Date().toISOString().split("T")[0];
  const todayExpenses = expenses
    .filter((e) => e.expenseDate === todayStr)
    .reduce((sum, e) => sum + e.amount, 0);

  const clearFilters = () => {
    setSearchQuery("");
    setFilterCategory("ALL");
    setFilterMonth("");
    setStartDate("");
    setEndDate("");
  };

  const handleCreate = () => {
    setEditingExpense(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Expense deleted");
      fetchExpenses();
    } catch (error) {
      toast.error("Error deleting expense");
    }
  };

  const handleSubmit = async (data: ExpenseFormData) => {
    try {
      const url = editingExpense
        ? `/api/expenses/${editingExpense.id}`
        : "/api/expenses";
      const method = editingExpense ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Operation failed");

      toast.success(editingExpense ? "Expense updated" : "Expense added");
      fetchExpenses();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save expense");
    }
  };

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">
            Manage your daily business expenses.
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Expense
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Filtered Total
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              LKR {totalExpenses.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on current filters
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Expenses (Today)
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              LKR {todayExpenses.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{todayStr}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Record Count</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredExpenses.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Expenses found</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <ExpenseFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        category={filterCategory}
        setCategory={setFilterCategory}
        month={filterMonth}
        setMonth={setFilterMonth}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        onClear={clearFilters}
      />

      {/* Table */}
      <ExpenseTable
        expenses={filteredExpenses}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Dialog */}
      <ExpenseFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleSubmit}
        initialData={editingExpense}
      />
    </div>
  );
}
