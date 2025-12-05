import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function RepReportTable({ data }: { data: any[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Representative</TableHead>
          <TableHead className="text-right">Orders</TableHead>
          <TableHead className="text-right">Total Sales</TableHead>
          <TableHead className="text-right">Total Profit</TableHead>
          <TableHead className="text-right">Margin %</TableHead>
          <TableHead className="text-right">Comm. (2%)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((r) => {
          // Calculate Margin safely
          const margin = r.sales > 0 ? (r.profit / r.sales) * 100 : 0;

          return (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-right">{r.orders}</TableCell>
              <TableCell className="text-right">
                LKR {r.sales.toLocaleString()}
              </TableCell>
              <TableCell
                className={`text-right font-bold ${
                  r.profit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                LKR {r.profit.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant={
                    margin > 25
                      ? "default"
                      : margin > 10
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {margin.toFixed(1)}%
                </Badge>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                LKR {(r.sales * 0.02).toLocaleString()}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
