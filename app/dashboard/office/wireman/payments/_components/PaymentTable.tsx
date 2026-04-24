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
  RefreshCw,
  Eye,
  Banknote,
  CreditCard,
  Building2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Payment, SortField, SortOrder, ChequeStatus } from "../types";
import { Loader2 } from "lucide-react";
import { TablePagination } from "@/components/ui/TablePagination";

interface PaymentTableProps {
  payments: Payment[];
  loading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onUpdateStatus: (payment: Payment) => void;
  onView: (payment: Payment) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const CHEQUE_STATUS_STYLES: Record<string, string> = {
  Pending:   "bg-amber-50 text-amber-700 border-amber-200",
  Cleared:   "bg-green-50 text-green-700 border-green-200",
  Bounced:   "bg-red-50 text-red-700 border-red-200",
  Returned:  "bg-gray-100 text-gray-600 border-gray-200",
  Deposited: "bg-blue-50 text-blue-700 border-blue-200",
};

const CHEQUE_STATUS_DOTS: Record<string, string> = {
  Pending:   "bg-amber-400",
  Cleared:   "bg-green-500",
  Bounced:   "bg-red-500",
  Returned:  "bg-gray-400",
  Deposited: "bg-blue-500",
};

function ChequeStatusBadge({ status }: { status?: ChequeStatus }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        CHEQUE_STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600 border-gray-200"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CHEQUE_STATUS_DOTS[status] ?? "bg-gray-400"}`} />
      {status}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const m = method?.toLowerCase();
  if (m === "cheque") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs font-medium">
        <CreditCard className="w-3 h-3" /> Cheque
      </span>
    );
  }
  if (m === "bank") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-xs font-medium">
        <Building2 className="w-3 h-3" /> Bank
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-medium">
      <Banknote className="w-3 h-3" /> Cash
    </span>
  );
}

export function PaymentTable({
  payments,
  loading,
  sortField,
  sortOrder,
  onSort,
  onUpdateStatus,
  onView,
  currentPage,
  totalPages,
  onPageChange,
}: PaymentTableProps) {
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40" />;
    return sortOrder === "asc"
      ? <ArrowUp className="w-3.5 h-3.5 ml-1 text-red-600" />
      : <ArrowDown className="w-3.5 h-3.5 ml-1 text-red-600" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead
                className="cursor-pointer text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4 whitespace-nowrap"
                onClick={() => onSort("date")}
              >
                <div className="flex items-center">Date {getSortIcon("date")}</div>
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">
                Payment ID
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">
                Bill No
              </TableHead>
              <TableHead
                className="cursor-pointer text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4"
                onClick={() => onSort("customerName")}
              >
                <div className="flex items-center">Customer {getSortIcon("customerName")}</div>
              </TableHead>
              <TableHead
                className="cursor-pointer text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4 text-right"
                onClick={() => onSort("amount")}
              >
                <div className="flex items-center justify-end">Amount {getSortIcon("amount")}</div>
              </TableHead>
              <TableHead
                className="cursor-pointer text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4"
                onClick={() => onSort("method")}
              >
                <div className="flex items-center">Method {getSortIcon("method")}</div>
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">
                Deposit Account
              </TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">
                Cheque / Bank Details
              </TableHead>
              <TableHead
                className="cursor-pointer text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4"
                onClick={() => onSort("chequeStatus")}
              >
                <div className="flex items-center">Cheque Status {getSortIcon("chequeStatus")}</div>
              </TableHead>
              <TableHead className="w-12 py-3 px-4" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-16 text-muted-foreground">
                  No payments found
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => {
                const isCheque = payment.method?.toLowerCase() === "cheque";
                const dateStr = payment.date
                  ? new Date(payment.date).toLocaleDateString("en-LK", {
                      day: "numeric",
                      month: "numeric",
                      year: "numeric",
                    })
                  : "—";
                const chequeDateStr = payment.chequeDate
                  ? new Date(payment.chequeDate).toLocaleDateString("en-LK", {
                      day: "numeric",
                      month: "numeric",
                      year: "numeric",
                    })
                  : null;

                return (
                  <TableRow
                    key={payment.id}
                    className={`transition-colors border-b border-gray-100 last:border-0 ${payment.chequeStatus === "Returned" ? "bg-red-50/40 hover:bg-red-50/60" : "hover:bg-red-50/20"}`}
                  >
                    {/* Date */}
                    <TableCell className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                      {dateStr}
                    </TableCell>

                    {/* Payment ID */}
                    <TableCell className="py-3 px-4">
                      <span className="font-mono text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                        PAY-{payment.paymentNumber}
                      </span>
                    </TableCell>

                    {/* Bill No */}
                    <TableCell className="py-3 px-4">
                      <span className="text-sm font-semibold text-gray-800">
                        {payment.invoiceNo}
                      </span>
                    </TableCell>

                    {/* Customer */}
                    <TableCell className="py-3 px-4">
                      <button
                        onClick={() =>
                          window.open(
                            `/dashboard/office/wireman/invoices/${payment.invoiceId}`,
                            "_blank"
                          )
                        }
                        className="text-sm font-medium text-blue-600 hover:underline text-left"
                      >
                        {payment.customerName}
                      </button>
                    </TableCell>

                    {/* Amount */}
                    <TableCell className="py-3 px-4 text-right">
                      <span className={`text-sm font-bold ${payment.chequeStatus === "Returned" ? "line-through text-gray-400" : "text-gray-800"}`}>
                        LKR {payment.amount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                      </span>
                      {payment.chequeStatus === "Returned" && (
                        <p className="text-[10px] text-red-500 font-medium mt-0.5">Reversed</p>
                      )}
                    </TableCell>

                    {/* Method */}
                    <TableCell className="py-3 px-4">
                      <MethodBadge method={payment.method} />
                    </TableCell>

                    {/* Deposit Account */}
                    <TableCell className="py-3 px-4">
                      {payment.depositAccountName ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-800">
                            {payment.depositAccountName}
                          </span>
                          {payment.depositAccountType && (
                            <span className="text-xs text-muted-foreground">
                              {payment.depositAccountType}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>

                    {/* Cheque / Bank Details */}
                    <TableCell className="py-3 px-4">
                      {isCheque ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-gray-800">
                            Cheque: {payment.chequeNo || "—"}
                          </span>
                          {(payment.bankCode || payment.bankName) && (
                            <span className="text-xs text-muted-foreground">
                              {[payment.bankCode, payment.bankName].filter(Boolean).join(" - ")}
                            </span>
                          )}
                          {chequeDateStr && (
                            <span className="text-xs text-muted-foreground">
                              Date: {chequeDateStr}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          {payment.method?.toLowerCase() === "cash" ? "Cash Payment" : "Bank Transfer"}
                        </span>
                      )}
                    </TableCell>

                    {/* Cheque Status */}
                    <TableCell className="py-3 px-4">
                      {isCheque ? (
                        <ChequeStatusBadge status={payment.chequeStatus} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3 px-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4 text-gray-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                            Actions
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onView(payment)} className="cursor-pointer">
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              window.open(
                                `/dashboard/office/wireman/invoices/${payment.invoiceId}`,
                                "_blank"
                              )
                            }
                            className="cursor-pointer"
                          >
                            <FileText className="mr-2 h-4 w-4" /> View Invoice
                          </DropdownMenuItem>
                          {isCheque && payment.chequeStatus !== "Returned" && payment.chequeStatus !== "Cleared" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onUpdateStatus(payment)}
                                className="cursor-pointer"
                              >
                                <RefreshCw className="mr-2 h-4 w-4" /> Update Status
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </>
  );
}
