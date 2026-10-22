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
  AlertTriangle,
  Search,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ArrowUpRight,
  ShoppingCart,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";

export default function StorefrontBacklogPage() {
  const [backlog, setBacklog] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchBacklog = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/storefront/manage/backlog");
      if (!res.ok) throw new Error("Failed to load shortage backlog");
      const data = await res.json();
      setBacklog(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBacklog();
  }, []);

  const filteredBacklog = backlog.filter((b) => {
    return (
      !search ||
      b.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.sku?.toLowerCase().includes(search.toLowerCase()) ||
      b.brand?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalDemand = backlog.reduce((sum, b) => sum + (b.inquiryCount || 0), 0);

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
            <div className="p-2 bg-rose-500/10 text-rose-600 rounded-lg">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Stock Shortage & Reorder Backlog
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Catalog items with zero physical stock or customer backorder demand
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.open("/dashboard/office/orange/purchase-estimates", "_blank")}
          >
            <ShoppingCart className="w-4 h-4 text-orange-600" />
            Agency POs
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              fetchBacklog();
              toast.info("Refreshed shortage backlog");
            }}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Critical Shortages</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-rose-600">{backlog.length}</div>
            <p className="text-xs text-rose-500 font-medium mt-1">Zero stock in warehouse</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Customer Demand</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{totalDemand}</div>
            <p className="text-xs text-amber-600 font-medium mt-1">Customer inquiries & notify requests</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Reorder Status</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">Immediate Action</div>
            <p className="text-xs text-blue-600 font-medium mt-1">Create supplier estimate</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <CardTitle>Shortage Items ({filteredBacklog.length})</CardTitle>
            <CardDescription>
              Items running out of stock across Orange, Sierra, and Wireman lines
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search shortage item, brand, SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Brand & Category</TableHead>
                  <TableHead className="text-center">Physical Stock</TableHead>
                  <TableHead className="text-center">Customer Demand</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-600" />
                      Loading shortage backlog...
                    </TableCell>
                  </TableRow>
                ) : filteredBacklog.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                      Great news! No critical stock shortages detected.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBacklog.map((b) => (
                    <TableRow key={b.id} className="hover:bg-slate-50/80">
                      <TableCell>
                        <div className="font-semibold text-slate-900">{b.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{b.sku}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {b.brand || "General"}
                        </Badge>
                        <div className="text-xs text-slate-500 capitalize mt-0.5">{b.category || "General"}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full text-xs">
                          <TrendingDown className="w-3 h-3" />
                          0 units
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-slate-700 bg-amber-50 px-2 py-0.5 rounded text-xs">
                          {b.inquiryCount || 0} waiting
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 text-xs">
                          Out of Stock
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50"
                          onClick={() => {
                            window.open(
                              b.brand?.toLowerCase().includes("wireman")
                                ? "/dashboard/office/wireman/purchase-estimates"
                                : b.brand?.toLowerCase().includes("sierra")
                                ? "/dashboard/office/sierra/purchase-estimates"
                                : "/dashboard/office/orange/purchase-estimates",
                              "_blank"
                            );
                          }}
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          Create Supplier PO
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
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
