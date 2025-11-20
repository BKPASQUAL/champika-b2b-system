// app/dashboard/admin/products/_components/ProductStats.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, DollarSign } from "lucide-react";
import { Product } from "../types";

interface ProductStatsProps {
  products: Product[];
}

export function ProductStats({ products }: ProductStatsProps) {
  const totalProducts = products.length;
  const totalStockValue = products.reduce((sum, p) => sum + p.totalValue, 0);
  const totalCostValue = products.reduce((sum, p) => sum + p.totalCost, 0);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          <Package className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalProducts}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Products in catalog
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            Stock Value (MRP)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            LKR {totalStockValue.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">At selling price</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Stock Cost</CardTitle>
          <DollarSign className="w-4 h-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            LKR {totalCostValue.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Acquisition cost</p>
        </CardContent>
      </Card>
    </div>
  );
}
