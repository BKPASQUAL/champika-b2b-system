// app/dashboard/office/distribution/orders/loading/reconcile/page.tsx
"use client";

import React, { useState, useMemo } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
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
  const { data: allLoads = [], loading } = useCachedFetch<any[]>(
    `/api/orders/loading/history?businessId=${distributionBusinessId}`,
    []
  );
  const loads = useMemo(
    () => allLoads.filter((l: any) => l.status === "In Transit"),
    [allLoads]
  );

  if (loading)
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
