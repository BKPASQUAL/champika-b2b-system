// app/dashboard/office/sierra/products/_components/ProductStats.tsx
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
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      {/* Red Theme Card */}
      <Card className="border-l-4 border-l-red-500 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Sierra Products
          </CardTitle>
          <Package className="w-4 h-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-800">
            {totalProducts}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Active items in catalog
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Stock Cost
          </CardTitle>
          <DollarSign className="w-4 h-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-gray-800 leading-tight">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">LKR</span>
            <div className="text-xl break-all">{totalCostValue.toLocaleString()}</div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total inventory investment
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Low Stock
          </CardTitle>
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-500">
            {lowStockCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Below minimum level
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Out of Stock
          </CardTitle>
          <XCircle className="w-4 h-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-500">
            {outOfStockCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            No stock available
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
