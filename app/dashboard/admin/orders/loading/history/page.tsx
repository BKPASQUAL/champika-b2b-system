"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  ArrowLeft,
  Truck,
  User,
  FileText,
  Eye
} from "lucide-react";

import { MOCK_DELIVERY_HISTORY } from "../types";

export default function DeliveryHistoryPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loading Deliveries</h1>
          <p className="text-muted-foreground mt-1">
            History of dispatched delivery loads.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Load ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Responsible Person</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_DELIVERY_HISTORY.map((load) => (
                  <TableRow key={load.id}>
                    <TableCell className="font-medium font-mono">
                      {load.loadId}
                    </TableCell>
                    <TableCell>
                      {new Date(load.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-muted-foreground" />
                        {load.lorryNumber}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <div className="flex flex-col text-sm">
                            <span>{load.driver}</span>
                            {load.helper && <span className="text-xs text-muted-foreground">+ {load.helper}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {load.totalOrders}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={load.status === 'Completed' ? 'default' : 'secondary'}
                        className={load.status === 'Completed' ? 'bg-green-600' : 'bg-blue-600 text-white'}
                      >
                        {load.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4 mr-2" /> View
                      </Button>
                      <Button variant="ghost" size="sm">
                        <FileText className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}