// app/dashboard/admin/products/_components/ProductStats.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, DollarSign, AlertTriangle, XCircle } from "lucide-react";
import { Product } from "../types";

interface ProductStatsProps {
  products: Product[];
}

export function ProductStats({ products }: ProductStatsProps) {
  const totalProducts = products.length;
  const totalCostValue = products.reduce((sum, p) => sum + p.totalCost, 0);
  const lowStockCount = products.filter(
    (p) => p.stock > 0 && p.stock < p.minStock
  ).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1 px-3 pt-3 sm:px-6 sm:pt-6 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Total Products</CardTitle>
          <Package className="w-4 h-4 text-muted-foreground shrink-0" />
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="text-xl sm:text-2xl font-bold">{totalProducts}</div>
          <p className="text-xs text-muted-foreground mt-1">Products in catalog</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1 px-3 pt-3 sm:px-6 sm:pt-6 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Stock Cost</CardTitle>
          <DollarSign className="w-4 h-4 text-blue-600 shrink-0" />
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="font-bold text-blue-600 leading-tight">
            <span className="text-[10px] font-semibold tracking-wide">LKR</span>
            <div className="text-sm sm:text-xl break-all leading-tight">{totalCostValue.toLocaleString()}</div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Acquisition cost</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1 px-3 pt-3 sm:px-6 sm:pt-6 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Low Stock</CardTitle>
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="text-xl sm:text-2xl font-bold text-amber-500">{lowStockCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Below minimum level</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-1 px-3 pt-3 sm:px-6 sm:pt-6 sm:pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">Out of Stock</CardTitle>
          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="text-xl sm:text-2xl font-bold text-red-500">{outOfStockCount}</div>
          <p className="text-xs text-muted-foreground mt-1">No stock available</p>
        </CardContent>
      </Card>
    </div>
  );
}
