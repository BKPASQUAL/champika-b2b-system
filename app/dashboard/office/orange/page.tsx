"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Search,
  Filter,
  RefreshCw,
  Factory,
  Calendar,
  FileText,
  Eye,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

interface Purchase {
  id: string;
  purchaseId: string;
  supplierName: string;
  invoiceNo: string;
  purchaseDate: string;
  status: string;
  paymentStatus: "Paid" | "Unpaid" | "Partial";
  totalAmount: number;
  paidAmount: number;
}

export default function OrelBillsPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(
    null
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");

  useEffect(() => {
    const user = getUserBusinessContext();
    if (user && user.businessId) {
      setCurrentBusinessId(user.businessId);
    }
  }, []);

  const fetchBills = useCallback(async () => {
    if (!currentBusinessId) return;

    try {
      setLoading(true);
      // ✅ Now strictly filtered on the server side
      const res = await fetch(`/api/purchases?businessId=${currentBusinessId}`);
      if (!res.ok) throw new Error("Failed to fetch bills");
      const data = await res.json();

      const orelBills: Purchase[] = data.map((p: any) => ({
        id: p.id,
        purchaseId: p.purchaseId,
        supplierName: p.supplierName || "Orel Corporation Pvt Ltd",
        invoiceNo: p.invoiceNo || "-",
        purchaseDate: p.purchaseDate,
        status: p.status,
        paymentStatus: p.paymentStatus,
        totalAmount: p.totalAmount,
        paidAmount: p.paidAmount,
      }));

      setPurchases(orelBills);
    } catch (error) {
      console.error("Error fetching bills:", error);
      toast.error("Failed to load bills");
    } finally {
      setLoading(false);
    }
  }, [currentBusinessId]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      p.purchaseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPayment =
      paymentFilter === "all" || p.paymentStatus === paymentFilter;
    return matchesSearch && matchesPayment;
  });

  const totalDue = filteredPurchases.reduce(
    (sum, p) => sum + (p.totalAmount - p.paidAmount),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-orange-900 flex items-center gap-2">
            Supplier Bills <Factory className="w-6 h-6 text-orange-600" />
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Exclusive Supplier:{" "}
            <strong>Orel Corporation Private Limited</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchBills}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={() =>
              router.push("/dashboard/office/orange/purchases/create")
            }
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            Create New Bill
          </Button>
        </div>
      </div>

      <Card className="bg-orange-50 border-orange-200">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-orange-800">
                Total Payable to Orel Corp
              </p>
              <h2 className="text-2xl font-bold text-orange-950">
                LKR {totalDue.toLocaleString()}
              </h2>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search PO # or Invoice..."
                className="pl-9 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-[180px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Filter className="w-3 h-3" />
                    <SelectValue placeholder="Payment Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier Invoice</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Due Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No bills found for Orel Corporation.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPurchases.map((bill) => {
                    const due = bill.totalAmount - bill.paidAmount;
                    return (
                      <TableRow key={bill.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {bill.purchaseDate}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {bill.purchaseId}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="w-3 h-3 text-muted-foreground" />
                            {bill.invoiceNo}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-orange-800">
                          {bill.supplierName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{bill.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium 
                                ${
                                  bill.paymentStatus === "Paid"
                                    ? "bg-green-100 text-green-700"
                                    : bill.paymentStatus === "Unpaid"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}
                          >
                            {bill.paymentStatus}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          LKR {bill.totalAmount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-bold text-red-600">
                          {due > 0 ? `LKR ${due.toLocaleString()}` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              router.push(
                                `/dashboard/office/orange/purchases/${bill.id}`
                              )
                            }
                          >
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          </Button>
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
