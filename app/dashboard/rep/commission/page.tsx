"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  CreditCard,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle2,
  ShoppingBag,
  AlertCircle,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface CommissionRecord {
  id: string;
  orderRef: string;
  shopName: string;
  orderTotal: number;
  commission: number;
  status: "Pending" | "Paid" | "Unpaid Order";
  date: string; // This is now the "Effective Date" (Payment Date or Order Date)
  orderDue: number;
}

export default function RepCommissionPage() {
  const [loading, setLoading] = useState(true);
  const [allRecords, setAllRecords] = useState<CommissionRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<CommissionRecord[]>(
    []
  );
  const [selectedMonth, setSelectedMonth] = useState<string>("current");

  // --- Date Options Generator ---
  const dateOptions = useMemo(() => {
    const today = new Date();
    const options = [];

    // 1. Current Month
    options.push({
      label: `This Month (${today.toLocaleString("default", {
        month: "long",
      })})`,
      value: "current",
    });

    // 2. Last Month
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    options.push({
      label: `Last Month (${lastMonth.toLocaleString("default", {
        month: "long",
      })})`,
      value: "last",
    });

    // 3. Two Months Ago
    const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    options.push({
      label: `${twoMonthsAgo.toLocaleString("default", {
        month: "long",
      })} ${twoMonthsAgo.getFullYear()}`,
      value: "2-months-ago",
    });

    return options;
  }, []);

  // --- Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
      let userId = "";
      if (typeof window !== "undefined") {
        const storedUser = localStorage.getItem("currentUser");
        if (storedUser) {
          userId = JSON.parse(storedUser).id;
        }
      }

      if (!userId) {
        toast.error("User not found");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/rep/commission?repId=${userId}`);
        if (!res.ok) throw new Error("Failed to fetch commissions");
        const data = await res.json();

        setAllRecords(data);
      } catch (error) {
        console.error(error);
        toast.error("Error loading commission data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- Filtering Logic (By Effective/Collection Date) ---
  useEffect(() => {
    if (allRecords.length === 0) {
      setFilteredRecords([]);
      return;
    }

    const today = new Date();
    let targetMonth = today.getMonth();
    let targetYear = today.getFullYear();

    if (selectedMonth === "last") {
      const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      targetMonth = d.getMonth();
      targetYear = d.getFullYear();
    } else if (selectedMonth === "2-months-ago") {
      const d = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      targetMonth = d.getMonth();
      targetYear = d.getFullYear();
    }

    const filtered = allRecords.filter((rec) => {
      const recDate = new Date(rec.date);
      return (
        recDate.getMonth() === targetMonth &&
        recDate.getFullYear() === targetYear
      );
    });

    setFilteredRecords(filtered);
  }, [selectedMonth, allRecords]);

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    const totalSales = filteredRecords.reduce(
      (acc, r) => acc + (Number(r.orderTotal) || 0),
      0
    );

    const totalCommission = filteredRecords
      .filter((r) => r.status !== "Unpaid Order")
      .reduce((acc, r) => acc + (Number(r.commission) || 0), 0);

    const totalDue = filteredRecords.reduce(
      (acc, r) => acc + (Number(r.orderDue) || 0),
      0
    );

    return { totalSales, totalCommission, totalDue };
  }, [filteredRecords]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">My Commissions</h1>

        {/* Filter Dropdown */}
        <div className="w-[250px]">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter by Date" />
            </SelectTrigger>
            <SelectContent>
              {dateOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Sales (Collected)
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              LKR {stats.totalSales.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on collection date
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              LKR {stats.totalCommission.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Earned this period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Order Due</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              LKR {stats.totalDue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Outstanding for this period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Commission & Sales History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Effective Date</TableHead>
                <TableHead>Order Ref</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead className="text-right">Order Value</TableHead>
                <TableHead className="text-right">Est. Commission</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No records found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 font-medium">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          {new Date(record.date).toLocaleDateString()}
                        </div>
                        {record.status === "Paid" && (
                          <span className="text-[10px] text-green-600 ml-5">
                            (Paid Date)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {record.orderRef}
                    </TableCell>
                    <TableCell>{record.shopName}</TableCell>
                    <TableCell className="text-right">
                      <div>LKR {record.orderTotal.toLocaleString()}</div>
                      {record.orderDue > 0 && (
                        <div className="text-[10px] text-red-500 font-medium">
                          Due: {record.orderDue.toLocaleString()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold text-muted-foreground">
                      LKR {record.commission.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={
                          record.status === "Paid"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : record.status === "Pending"
                            ? "bg-orange-100 text-orange-800 hover:bg-orange-100"
                            : "bg-red-100 text-red-800 hover:bg-red-100"
                        }
                      >
                        {record.status === "Unpaid Order"
                          ? "Collect Payment"
                          : record.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
