// app/dashboard/office/wireman/payments/_components/PaymentTable.tsx
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
  MoreHorizontal,
  FileText,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Payment, SortField, SortOrder, ChequeStatus } from "../types";
import { Loader2 } from "lucide-react";

interface PaymentTableProps {
  payments: Payment[];
  loading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onUpdateStatus: (payment: Payment) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaymentTable({
  payments,
  loading,
  sortField,
  sortOrder,
  onSort,
  onUpdateStatus,
  currentPage,
  totalPages,
  onPageChange,
}: PaymentTableProps) {
  const getSortIcon = (field: SortField) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-4 h-4 ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1" />
    );
  };

  const renderChequeStatus = (status?: ChequeStatus) => {
    if (!status) return null;
    const styles = {
      Pending: "bg-amber-100 text-amber-700 border-amber-200",
      Cleared: "bg-green-100 text-green-700 border-green-200",
      Bounced: "bg-red-100 text-red-700 border-red-200",
      Returned: "bg-gray-100 text-gray-700 border-gray-200",
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-red-600" />
        <span className="text-muted-foreground">Loading payments...</span>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader className="bg-red-50/50">
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-red-100/50"
                onClick={() => onSort("date")}
              >
                <div className="flex items-center text-red-900">
                  Date {getSortIcon("date")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-red-100/50"
                onClick={() => onSort("customerName")}
              >
                <div className="flex items-center text-red-900">
                  Customer {getSortIcon("customerName")}
                </div>
              </TableHead>
              <TableHead className="text-red-900">Reference</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-red-100/50"
                onClick={() => onSort("method")}
              >
                <div className="flex items-center text-red-900">
                  Method {getSortIcon("method")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-red-100/50"
                onClick={() => onSort("chequeStatus")}
              >
                <div className="flex items-center text-red-900">
                  Status {getSortIcon("chequeStatus")}
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-red-100/50"
                onClick={() => onSort("amount")}
              >
                <div className="flex items-center justify-end text-red-900">
                  Amount {getSortIcon("amount")}
                </div>
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-muted-foreground"
                >
                  No payments found
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow
                  key={payment.id}
                  className="hover:bg-red-50/10 transition-colors"
                >
                  <TableCell className="font-medium text-muted-foreground whitespace-nowrap">
                    {new Date(payment.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    {payment.customerName}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span className="font-mono text-muted-foreground">
                        INV: {payment.invoiceNo}
                      </span>
                      {payment.chequeNo && (
                        <span className="text-blue-600 font-mono">
                          CHQ: {payment.chequeNo}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {payment.method}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {payment.method === "Cheque" ? (
                      renderChequeStatus(payment.chequeStatus)
                    ) : (
                      <span className="text-xs text-green-600 flex items-center">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-800">
                    LKR {payment.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() =>
                            window.open(
                              `/dashboard/office/wireman/invoices/${payment.invoiceId}`,
                              "_blank"
                            )
                          }
                        >
                          <FileText className="mr-2 h-4 w-4" /> View Invoice
                        </DropdownMenuItem>
                        {payment.method === "Cheque" && (
                          <DropdownMenuItem
                            onClick={() => onUpdateStatus(payment)}
                          >
                            <Calendar className="mr-2 h-4 w-4" /> Update Status
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && payments.length > 0 && (
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
