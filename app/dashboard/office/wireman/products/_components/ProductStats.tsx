// app/dashboard/office/wireman/products/_components/ProductStats.tsx
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
      {/* Red Theme Card */}
      <Card className="border-l-4 border-l-red-500 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Wireman Products
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
            Stock Value (Selling)
          </CardTitle>
          <DollarSign className="w-4 h-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-800">
            LKR {totalStockValue.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total projected revenue
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
          <div className="text-2xl font-bold text-gray-800">
            LKR {totalCostValue.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total inventory investment
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
