import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function CustomerReportTable({ data }: { data: any[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Shop Name</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead className="text-right">Order Count</TableHead>
          <TableHead className="text-right">Total Purchase</TableHead>
          <TableHead className="text-right">Profit Generated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">{c.shop}</TableCell>
            <TableCell>{c.owner}</TableCell>
            <TableCell className="text-right">{c.count}</TableCell>
            <TableCell className="text-right">
              {c.revenue.toLocaleString()}
            </TableCell>
            <TableCell className="text-right text-green-600 font-medium">
              {c.profit.toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
