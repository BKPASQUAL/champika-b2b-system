// app/dashboard/office/distribution/orders/loading/reconcile/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Truck, Loader2, ClipboardCheck } from "lucide-react";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function DistributionReconcileListPage() {
  const router = useRouter();
  const distributionBusinessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoads = async () => {
      try {
        const res = await fetch(
          `/api/orders/loading/history?businessId=${distributionBusinessId}`
        );
        const data = await res.json();
        // Filter for loads that are In Transit (Ready to reconcile)
        setLoads(data.filter((l: any) => l.status === "In Transit"));
      } catch (error) {
        console.error("Failed to load", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLoads();
  }, [distributionBusinessId]);

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-blue-900">
            Reconcile Loads
          </h1>
          <p className="text-muted-foreground">
            Select a returning load to process.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Reconciliation</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Load ID</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead className="text-center">Orders</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loads.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No loads currently in transit.
                  </TableCell>
                </TableRow>
              ) : (
                loads.map((load) => (
                  <TableRow key={load.id}>
                    <TableCell className="font-mono font-medium">
                      {load.loadId}
                    </TableCell>
                    <TableCell>{load.driverName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{load.lorryNumber}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {load.totalOrders}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/dashboard/office/distribution/orders/loading/reconcile/${load.id}`
                          )
                        }
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <ClipboardCheck className="w-4 h-4 mr-2" /> Reconcile
                      </Button>
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
