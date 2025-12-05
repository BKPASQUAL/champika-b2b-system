import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function ProductReportTable({ data }: { data: any[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Qty Sold</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Profit</TableHead>
          <TableHead className="text-right">Margin</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((p) => {
          const margin =
            p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0;
          return (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{p.category}</Badge>
              </TableCell>
              <TableCell className="text-right">{p.sold}</TableCell>
              <TableCell className="text-right">
                {p.revenue.toLocaleString()}
              </TableCell>
              <TableCell className="text-right text-green-600 font-bold">
                {p.revenue - p.cost > 0
                  ? (p.revenue - p.cost).toLocaleString()
                  : 0}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant={margin > 20 ? "default" : "destructive"}>
                  {margin.toFixed(1)}%
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
