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
  ArrowLeft,
  Plus,
  Search,
  AlertTriangle,
  Loader2,
  Calendar,
  MapPin,
  Package,
} from "lucide-react";
import { toast } from "sonner";

export default function DamageHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [damages, setDamages] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchDamages();
  }, []);

  const fetchDamages = async () => {
    try {
      const res = await fetch("/api/inventory/damage");
      if (!res.ok) throw new Error("Failed to load damage history");
      const data = await res.json();
      setDamages(data);
    } catch (error) {
      toast.error("Error loading history");
    } finally {
      setLoading(false);
    }
  };

  const filteredDamages = damages.filter(
    (item) =>
      item.products?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.return_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              className="-ml-2 text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">
              Damage Reports
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 ml-8">
            History of internal stock damages (Location & Transport).
          </p>
        </div>
        <Button
          onClick={() =>
            router.push("/dashboard/office/distribution/inventory/damage/create")
          }
        >
          <Plus className="w-4 h-4 mr-2" /> Report New Damage
        </Button>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center gap-4">
            <CardTitle>Damage History</CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search report #, product..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDamages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No damage reports found.</p>
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Report #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Reason / Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Reported By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDamages.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">
                        {item.return_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          {item.locations?.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {item.products?.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.products?.sku}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{item.reason}</span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {item.profiles?.full_name || "Admin"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
