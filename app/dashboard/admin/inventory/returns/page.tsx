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
  Undo2,
  Search,
  RefreshCw,
  ArrowLeft,
  Filter,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function ReturnsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/inventory/returns");
      if (!res.ok) throw new Error("Failed to load returns");
      const data = await res.json();
      setReturns(data);
    } catch (error) {
      toast.error("Error fetching returns history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredReturns = returns.filter((r: any) => {
    const search = searchQuery.toLowerCase();
    return (
      r.return_number?.toLowerCase().includes(search) ||
      r.products?.name?.toLowerCase().includes(search) ||
      r.locations?.name?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/admin/inventory")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">
              Returns Management
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 ml-10">
            View history and process new customer returns.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            onClick={() =>
              router.push("/dashboard/admin/inventory/returns/create")
            }
          >
            <Undo2 className="w-4 h-4 mr-2" /> Process Return
          </Button>
        </div>
      </div>

      {/* Returns History Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Returns History</CardTitle>
              <CardDescription>List of all processed returns</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search returns..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
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
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredReturns.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No returns found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReturns.map((r: any) => (
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
        </CardContent>
      </Card>
    </div>
  );
}
