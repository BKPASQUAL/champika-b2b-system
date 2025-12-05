import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export interface ProfitItem {
  id: string;
  name: string;
  category: string;
  soldQuantity: number;
  avgSellingPrice: number;
  unitCost: number;
}

interface ProfitMarginTableProps {
  data: ProfitItem[];
}

export function ProfitMarginTable({ data }: ProfitMarginTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Qty Sold</TableHead>
            <TableHead className="text-right">Avg. Selling Price</TableHead>
            <TableHead className="text-right">Unit Cost</TableHead>
            <TableHead className="text-right">Total Profit</TableHead>
            <TableHead className="text-right">Margin %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const totalRevenue = item.avgSellingPrice * item.soldQuantity;
            const totalCost = item.unitCost * item.soldQuantity;
            const profit = totalRevenue - totalCost;
            const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

            return (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.category}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {item.soldQuantity}
                </TableCell>
                <TableCell className="text-right">
                  {item.avgSellingPrice.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.unitCost.toLocaleString()}
                </TableCell>
                <TableCell
                  className={`text-right font-bold ${
                    profit >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {profit.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={
                      margin > 20
                        ? "default"
                        : margin > 10
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {margin.toFixed(1)}%
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
