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
  sold: number; // Matches API
  revenue: number; // Matches API
  cost: number; // Matches API
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
            const profit = item.revenue - item.cost;
            const margin = item.revenue > 0 ? (profit / item.revenue) * 100 : 0;
            const avgSellingPrice =
              item.sold > 0 ? item.revenue / item.sold : 0;
            const unitCost = item.sold > 0 ? item.cost / item.sold : 0;

            return (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.category}</Badge>
                </TableCell>
                <TableCell className="text-right">{item.sold}</TableCell>
                <TableCell className="text-right">
                  {avgSellingPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {unitCost.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell
                  className={`text-right font-bold ${
                    profit >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {profit.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
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
