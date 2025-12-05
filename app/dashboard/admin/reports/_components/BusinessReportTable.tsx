import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function BusinessReportTable({ data }: { data: any[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Business Unit</TableHead>
          <TableHead className="text-right">Orders</TableHead>
          <TableHead className="text-right">Total Revenue</TableHead>
          <TableHead className="text-right">Total Profit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((b) => (
          <TableRow key={b.id}>
            <TableCell className="font-medium">{b.name}</TableCell>
            <TableCell className="text-right">{b.orders}</TableCell>
            <TableCell className="text-right">
              {b.revenue.toLocaleString()}
            </TableCell>
            <TableCell className="text-right text-green-600 font-bold">
              {b.profit.toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
