// app/dashboard/office/distribution/orders/loading/active/page.tsx
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
import {
  Truck,
  ClipboardCheck,
  Calendar,
  User,
  ArrowRight,
  Loader2,
  Send,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface ActiveLoad {
  id: string;
  loadId: string;
  loadingDate: string;
  lorryNumber: string;
  driverName: string;
  helperName: string;
  status: string;
  totalOrders: number;
  totalAmount: number;
}

export default function DistributionActiveLoadsPage() {
  const router = useRouter();
  const [loads, setLoads] = useState<ActiveLoad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveLoads = async () => {
      try {
        // Fetch loading history and filter for 'In Transit'
        const res = await fetch("/api/orders/loading/history");
        if (!res.ok) throw new Error("Failed to fetch loads");
        const data = await res.json();

        // Filter for active loads
        const active = data.filter((load: any) => load.status === "In Transit");
        setLoads(active);
      } catch (error) {
        console.error(error);
        toast.error("Error loading active deliveries");
      } finally {
        setLoading(false);
      }
    };

    fetchActiveLoads();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Dispatched Loads
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage deliveries currently in transit and reconcile returns.
          </p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium border border-blue-100">
          <Send className="h-4 w-4" />
          {loads.length} Active Deliveries
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" />
            Vehicles In Transit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Load Ref</TableHead>
                  <TableHead>Dispatched Date</TableHead>
                  <TableHead>Vehicle & Driver</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead className="text-right">Load Value</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-10 w-10 text-green-500/30" />
                        <p>No active deliveries. All loads are completed.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  loads.map((load) => (
                    <TableRow key={load.id}>
                      <TableCell className="font-medium font-mono">
                        {load.loadId}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(load.loadingDate).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {load.lorryNumber}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" /> {load.driverName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{load.totalOrders}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        LKR {load.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() =>
                            // Navigate to Reconcile page (if implemented) or History detail
                            router.push(
                              `/dashboard/office/distribution/orders/loading/reconcile/${load.id}`
                            )
                          }
                        >
                          <ClipboardCheck className="h-4 w-4 mr-2" />
                          Reconcile
                          <ArrowRight className="h-3 w-3 ml-1 opacity-50" />
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

      {/* Information Alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-amber-800">
            Reconciliation Process
          </h4>
          <p className="text-sm text-amber-700 mt-1">
            Click "Reconcile" when a driver returns. You can mark orders as
            <strong> Delivered</strong>, <strong> Returned</strong>, or
            <strong> Change Amounts</strong> if items were rejected. This will
            update inventory and payment records automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
