"use client";

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
  Edit,
  Loader2,
  Printer,
  User,
  Truck,
  Eye,
} from "lucide-react";
import {
  Invoice,
  SortField,
  SortOrder,
  PaymentStatus,
  OrderStatus,
} from "../types";
import { printInvoice } from "../print-utils";
import { useState } from "react";

interface InvoiceTableProps {
  invoices: Invoice[];
  loading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
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
  onEdit,
  onView,
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

  const renderPaymentBadge = (status: PaymentStatus) => {
    const styles = {
      Paid: "bg-green-100 text-green-700 border-green-200",
      Unpaid: "bg-red-100 text-red-700 border-red-200",
      Partial: "bg-orange-100 text-orange-700 border-orange-200",
      Overdue: "bg-red-600 text-white border-red-700",
    };
    return (
      <Badge
        variant="outline"
        className={`${styles[status]} border whitespace-nowrap`}
      >
        {status}
      </Badge>
    );
  };

  const renderOrderStatusBadge = (status: OrderStatus) => {
    const styles: Record<string, string> = {
      Pending: "bg-yellow-50 text-yellow-800 border-yellow-200",
      Processing: "bg-blue-50 text-blue-800 border-blue-200",
      Checking: "bg-purple-50 text-purple-800 border-purple-200",
      Loading: "bg-indigo-50 text-indigo-800 border-indigo-200",
      "In Transit": "bg-indigo-100 text-indigo-800 border-indigo-200",
      Delivered: "bg-green-50 text-green-800 border-green-200",
      Completed: "bg-gray-100 text-gray-800 border-gray-200",
      Cancelled: "bg-red-50 text-red-800 border-red-200",
    };
    return (
      <Badge
        variant="outline"
        className={`${
          styles[status] || "bg-gray-100"
        } border whitespace-nowrap`}
      >
        {status}
      </Badge>
    );
  };

  const isLocked = (status: string) => {
    return [
      "Loading",
      "In Transit",
      "Delivered",
      "Completed",
      "Cancelled",
    ].includes(status);
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
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                onClick={() => onSort("date")}
                className="cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center">
                  Date {getSortIcon("date")}
                </div>
              </TableHead>
              <TableHead
                onClick={() => onSort("invoiceNo")}
                className="cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center">
                  Invoice # {getSortIcon("invoiceNo")}
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
                onClick={() => onSort("orderStatus")}
                className="text-center cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center justify-center">
                  <Truck className="w-3 h-3 mr-1" /> Order Status{" "}
                  {getSortIcon("orderStatus")}
                </div>
              </TableHead>
              <TableHead
                onClick={() => onSort("status")}
                className="text-center cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center justify-center">
                  Payment {getSortIcon("status")}
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
                onClick={() => onSort("dueAmount")}
                className="text-right cursor-pointer hover:bg-muted/50"
              >
                <div className="flex items-center justify-end">
                  Due {getSortIcon("dueAmount")}
                </div>
              </TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-12 text-muted-foreground"
                >
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="whitespace-nowrap font-medium text-muted-foreground">
                    {new Date(invoice.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {invoice.invoiceNo}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">
                      {invoice.customerName}
                    </div>
                    <div className="text-xs text-muted-foreground hidden md:flex items-center gap-1">
                      <User className="w-3 h-3" /> {invoice.salesRepName}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {renderOrderStatusBadge(invoice.orderStatus)}
                  </TableCell>
                  <TableCell className="text-center">
                    {renderPaymentBadge(invoice.status)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    LKR {invoice.totalAmount.toLocaleString()}
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
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onView(invoice.id)}
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-blue-600" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEdit(invoice.id)}
                        disabled={isLocked(invoice.orderStatus)}
                      >
                        <Edit
                          className={`w-4 h-4 ${
                            isLocked(invoice.orderStatus)
                              ? "opacity-30"
                              : "text-muted-foreground"
                          }`}
                        />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDownload(invoice.id)}
                        disabled={downloadingId === invoice.id}
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
      {!loading && invoices.length > 0 && (
        <div className="flex items-center justify-between px-2 py-4">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
