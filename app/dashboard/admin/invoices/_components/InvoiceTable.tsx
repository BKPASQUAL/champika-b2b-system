// app/dashboard/admin/invoices/_components/InvoiceTable.tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Download,
  User,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Invoice, SortField, SortOrder, PaymentStatus } from "../types";

interface InvoiceTableProps {
  invoices: Invoice[];
  loading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function InvoiceTable({
  invoices,
  loading,
  sortField,
  sortOrder,
  onSort,
  currentPage,
  totalPages,
  onPageChange,
}: InvoiceTableProps) {
  const getSortIcon = (field: SortField) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-4 h-4 ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1" />
    );
  };

  const renderStatusBadge = (status: PaymentStatus) => {
    const styles = {
      Paid: "bg-green-100 text-green-700 border-green-200",
      Unpaid: "bg-yellow-100 text-yellow-700 border-yellow-200",
      Partial: "bg-blue-100 text-blue-700 border-blue-200",
      Overdue: "bg-red-100 text-red-700 border-red-200",
    };
    return (
      <Badge variant="outline" className={`${styles[status]} border`}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-muted-foreground">Loading invoices...</span>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {/* 1. Date */}
              <TableHead
                onClick={() => onSort("date")}
                className="cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center">
                  Date {getSortIcon("date")}
                </div>
              </TableHead>

              {/* 2. Customer */}
              <TableHead
                onClick={() => onSort("customerName")}
                className="cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center">
                  Customer {getSortIcon("customerName")}
                </div>
              </TableHead>

              {/* 3. Invoice No */}
              <TableHead
                onClick={() => onSort("invoiceNo")}
                className="cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center">
                  Invoice No {getSortIcon("invoiceNo")}
                </div>
              </TableHead>

              {/* 4. Total */}
              <TableHead
                onClick={() => onSort("totalAmount")}
                className="text-right cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center justify-end">
                  Total {getSortIcon("totalAmount")}
                </div>
              </TableHead>

              {/* 5. Paid */}
              <TableHead
                onClick={() => onSort("paidAmount")}
                className="text-right cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center justify-end">
                  Paid {getSortIcon("paidAmount")}
                </div>
              </TableHead>

              {/* 6. Due Amount */}
              <TableHead
                onClick={() => onSort("dueAmount")}
                className="text-right cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center justify-end">
                  Due Amount {getSortIcon("dueAmount")}
                </div>
              </TableHead>

              {/* 7. Payment Status */}
              <TableHead
                onClick={() => onSort("status")}
                className="text-center cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center justify-center">
                  Payment Status {getSortIcon("status")}
                </div>
              </TableHead>

              {/* 8. Representative Name */}
              <TableHead
                onClick={() => onSort("salesRepName")}
                className="cursor-pointer hover:bg-muted/50 hidden md:table-cell"
              >
                <div className="flex items-center">
                  Rep Name {getSortIcon("salesRepName")}
                </div>
              </TableHead>

              {/* 9. Action */}
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-8 text-muted-foreground"
                >
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  {/* 1. Date */}
                  <TableCell className="whitespace-nowrap">
                    {new Date(invoice.date).toLocaleDateString()}
                  </TableCell>

                  {/* 2. Customer */}
                  <TableCell className="font-medium">
                    {invoice.customerName}
                  </TableCell>

                  {/* 3. Invoice No */}
                  <TableCell className="font-mono text-xs">
                    {invoice.invoiceNo}
                  </TableCell>

                  {/* 4. Total */}
                  <TableCell className="text-right font-medium">
                    LKR {invoice.totalAmount.toLocaleString()}
                  </TableCell>

                  {/* 5. Paid */}
                  <TableCell className="text-right text-muted-foreground">
                    LKR {invoice.paidAmount.toLocaleString()}
                  </TableCell>

                  {/* 6. Due Amount */}
                  <TableCell className="text-right">
                    <span
                      className={
                        invoice.dueAmount > 0
                          ? "text-red-600 font-semibold"
                          : "text-muted-foreground"
                      }
                    >
                      LKR {invoice.dueAmount.toLocaleString()}
                    </span>
                  </TableCell>

                  {/* 7. Payment Status */}
                  <TableCell className="text-center">
                    {renderStatusBadge(invoice.status)}
                  </TableCell>

                  {/* 8. Representative Name */}
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-3 h-3" />
                      {invoice.salesRepName}
                    </div>
                  </TableCell>

                  {/* 9. Action */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon-sm">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon-sm">
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && invoices.length > 0 && (
        <div className="flex items-center justify-between px-2 py-4 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * 10 + 1} to{" "}
            {Math.min(currentPage * 10, totalPages * 10)} of {totalPages * 10}{" "}
            entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
