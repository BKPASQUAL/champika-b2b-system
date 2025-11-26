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
  Edit,
  Loader2,
  Printer,
} from "lucide-react";
import { Invoice, SortField, SortOrder, PaymentStatus } from "../types";
import { printInvoice } from "../print-utils";
import { useState } from "react";

interface InvoiceTableProps {
  invoices: Invoice[];
  loading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onEdit: (id: string) => void; // <--- ADDED PROP
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
  onEdit, // <--- Destructure
  currentPage,
  totalPages,
  onPageChange,
}: InvoiceTableProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    await printInvoice(id);
    setDownloadingId(null);
  };

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
              {/* ... (Previous Headers remain same) ... */}
              <TableHead
                onClick={() => onSort("date")}
                className="cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center">
                  Date {getSortIcon("date")}
                </div>
              </TableHead>
              <TableHead
                onClick={() => onSort("customerName")}
                className="cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center">
                  Customer {getSortIcon("customerName")}
                </div>
              </TableHead>
              <TableHead
                onClick={() => onSort("invoiceNo")}
                className="cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center">
                  Invoice No {getSortIcon("invoiceNo")}
                </div>
              </TableHead>
              <TableHead
                onClick={() => onSort("totalAmount")}
                className="text-right cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center justify-end">
                  Total {getSortIcon("totalAmount")}
                </div>
              </TableHead>
              <TableHead
                onClick={() => onSort("paidAmount")}
                className="text-right cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center justify-end">
                  Paid {getSortIcon("paidAmount")}
                </div>
              </TableHead>
              <TableHead
                onClick={() => onSort("dueAmount")}
                className="text-right cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center justify-end">
                  Due Amount {getSortIcon("dueAmount")}
                </div>
              </TableHead>
              <TableHead
                onClick={() => onSort("status")}
                className="text-center cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center justify-center">
                  Payment Status {getSortIcon("status")}
                </div>
              </TableHead>
              <TableHead
                onClick={() => onSort("salesRepName")}
                className="cursor-pointer hover:bg-muted/50 hidden md:table-cell"
              >
                <div className="flex items-center">
                  Rep Name {getSortIcon("salesRepName")}
                </div>
              </TableHead>
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
                  <TableCell className="whitespace-nowrap">
                    {new Date(invoice.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    {invoice.customerName}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {invoice.invoiceNo}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    LKR {invoice.totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    LKR {invoice.paidAmount.toLocaleString()}
                  </TableCell>
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
                  <TableCell className="text-center">
                    {renderStatusBadge(invoice.status)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-3 h-3" />
                      {invoice.salesRepName}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Edit Button */}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEdit(invoice.id)}
                        title="Edit Invoice"
                      >
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      {/* Print Button */}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDownload(invoice.id)}
                        disabled={downloadingId === invoice.id}
                        title="Download/Print"
                      >
                        {downloadingId === invoice.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Printer className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {/* Pagination Controls... (Kept same) */}
    </>
  );
}
