// app/dashboard/admin/suppliers/components/SupplierStats.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, Truck, AlertCircle } from "lucide-react";
import { Supplier } from "../types";

interface SupplierStatsProps {
  suppliers: Supplier[];
}

export function SupplierStats({ suppliers }: SupplierStatsProps) {
  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter((s) => s.status === "Active").length;
  const totalDueAmount = suppliers.reduce((sum, s) => sum + s.duePayment, 0);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
          <Factory className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalSuppliers}</div>
          <p className="text-xs text-muted-foreground mt-1">Registered partners</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Active Partners</CardTitle>
          <Truck className="w-4 h-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{activeSuppliers}</div>
          <p className="text-xs text-muted-foreground mt-1">Currently supplying</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
          <AlertCircle className="w-4 h-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            LKR {(totalDueAmount / 1000000).toFixed(1)}M
          </div>
          <p className="text-xs text-muted-foreground mt-1">Due to suppliers</p>
        </CardContent>
      </Card>
    </div>
  );
}