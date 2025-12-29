"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Undo2,
  Search,
  RefreshCw,
  ArrowLeft,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function OrangeReturnsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState([]);

  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 10;

  // Filter State
  const [dateFilterType, setDateFilterType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        // Filter for Orange Agency
        businessId: BUSINESS_IDS.ORANGE_AGENCY,
      });

      if (searchQuery) params.append("search", searchQuery);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/inventory/returns?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load returns");

      const responseData = await res.json();
      setReturns(responseData.data || []);
      setTotalPages(responseData.totalPages || 1);
      setTotalRecords(responseData.total || 0);
    } catch (error) {
      toast.error("Error fetching returns history");
    } finally {
      setLoading(false);
    }
  };

  // Effect to handle Date Filter Presets
  useEffect(() => {
    const now = new Date();
    if (dateFilterType === "this_month") {
      setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
      setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
    } else if (dateFilterType === "last_month") {
      const lastMonth = subMonths(now, 1);
      setStartDate(format(startOfMonth(lastMonth), "yyyy-MM-dd"));
      setEndDate(format(endOfMonth(lastMonth), "yyyy-MM-dd"));
    } else if (dateFilterType === "all") {
      setStartDate("");
      setEndDate("");
    }
    setPage(1);
  }, [dateFilterType]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchData();
  }, [page, startDate, endDate]);

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setPage(1);
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/office/orange/inventory")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-orange-950">
              Returns Management (Orange)
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 ml-10">
            View history and process new customer returns for Orange Agency.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            className="bg-orange-600 hover:bg-orange-700 text-white"
            onClick={() =>
              router.push("/dashboard/office/orange/inventory/returns/create")
            }
          >
            <Undo2 className="w-4 h-4 mr-2" /> Process Return
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            {/* Search */}
            <div className="flex-1 w-full">
              <span className="text-sm font-medium mb-1 block">
                Search Returns
              </span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by Return #..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                />
              </div>
            </div>

            {/* Date Preset Filter */}
            <div className="w-full md:w-48">
              <span className="text-sm font-medium mb-1 block">Period</span>
              <Select value={dateFilterType} onValueChange={setDateFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            <div className="flex gap-2 w-full md:w-auto">
              <div>
                <span className="text-sm font-medium mb-1 block">From</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDateFilterType("custom");
                  }}
                  className="w-full md:w-40"
                />
              </div>
              <div>
                <span className="text-sm font-medium mb-1 block">To</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDateFilterType("custom");
                  }}
                  className="w-full md:w-40"
                />
              </div>
            </div>

            <Button
              onClick={() => {
                setPage(1);
                fetchData();
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Filter className="w-4 h-4 mr-2" /> Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Returns History Table */}
      <Card>
        <CardHeader className="py-4">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Returns History</CardTitle>
              <CardDescription>
                Showing {returns.length} records (Page {page} of {totalPages})
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="bg-orange-50/50">
                  <TableHead>Return #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Processed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-orange-600" />
                    </TableCell>
                  </TableRow>
                ) : returns.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No returns found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  returns.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono font-medium">
                        {r.return_number}
                      </TableCell>
                      <TableCell>
                        {new Date(r.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.products?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.products?.sku}
                        </div>
                      </TableCell>
                      <TableCell>{r.locations?.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.return_type === "Good"
                              ? "secondary"
                              : "destructive"
                          }
                          className={
                            r.return_type === "Good"
                              ? "bg-green-100 text-green-700 hover:bg-green-200 border-none"
                              : "bg-red-100 text-red-700 hover:bg-red-200 border-none"
                          }
                        >
                          {r.return_type === "Good" ? "Good Stock" : "Damaged"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {r.quantity}
                      </TableCell>
                      <TableCell
                        className="max-w-[200px] truncate text-muted-foreground"
                        title={r.reason}
                      >
                        {r.reason || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.profiles?.full_name || "System"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 py-4">
              <div className="text-sm text-muted-foreground mr-4">
                Total: {totalRecords} records
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <div className="text-sm font-medium">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={page === totalPages}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
