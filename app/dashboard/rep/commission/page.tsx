"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface CommissionRecord {
  id: string;
  orderRef: string;
  shopName: string;
  orderTotal: number;
  commission: number;
  status: "Pending" | "Paid";
  date: string;
}

export default function RepCommissionPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [stats, setStats] = useState({
    totalEarned: 0,
    pending: 0,
    paid: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      // 1. Get Current User
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
        setRecords(data);

        // Calculate Stats
        const total = data.reduce(
          (acc: number, r: any) => acc + r.commission,
          0
        );
        const pending = data
          .filter((r: any) => r.status === "Pending")
          .reduce((acc: number, r: any) => acc + r.commission, 0);
        const paid = data
          .filter((r: any) => r.status === "Paid")
          .reduce((acc: number, r: any) => acc + r.commission, 0);

        setStats({ totalEarned: total, pending, paid });
      } catch (error) {
        console.error(error);
        toast.error("Error loading commission data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Commissions</h1>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Commission
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              LKR {stats.totalEarned.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Payout
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              LKR {stats.pending.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Approved but not yet paid
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Out</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              LKR {stats.paid.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Successfully transferred
            </p>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Commission History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order Ref</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead className="text-right">Order Value</TableHead>
                <TableHead className="text-right">Commission</TableHead>
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
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No commission records found.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {new Date(record.date).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {record.orderRef}
                    </TableCell>
                    <TableCell>{record.shopName}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {record.orderTotal.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      LKR {record.commission.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          record.status === "Paid" ? "default" : "secondary"
                        }
                        className={
                          record.status === "Paid"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-orange-100 text-orange-800 hover:bg-orange-100"
                        }
                      >
                        {record.status}
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
