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
import {
  Eye,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
} from "lucide-react";
import {
  Purchase,
  SortField,
  SortOrder,
  PaymentStatus,
  PurchaseStatus,
} from "../types";
import { Badge } from "@/components/ui/badge";

interface PurchaseTableProps {
  purchases: Purchase[];
  loading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onView: (purchase: Purchase) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PurchaseTable({
  purchases,
  loading,
  onView,
  currentPage,
  totalPages,
  onPageChange,
  onSort,
  sortField,
  sortOrder,
}: PurchaseTableProps) {
  const renderStatusBadge = (status: PurchaseStatus) => {
    const styles = {
      Ordered: "bg-blue-100 text-blue-700 hover:bg-blue-200",
      Received: "bg-green-100 text-green-700 hover:bg-green-200",
      Cancelled: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    };
    return (
      <Badge variant="secondary" className={`${styles[status]} border-none`}>
        {status}
      </Badge>
    );
  };

  const renderPaymentBadge = (status: PaymentStatus) => {
    const styles = {
      Paid: "bg-green-50 text-green-700 border border-green-200",
      Unpaid: "bg-red-50 text-red-700 border border-red-200",
      Partial: "bg-amber-50 text-amber-700 border border-amber-200",
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
      >
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-orange-600" />
        <span className="text-orange-900">Loading orders...</span>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader className="bg-orange-50/50">
            <TableRow>
              <TableHead
                onClick={() => onSort("purchaseDate")}
                className="cursor-pointer hover:text-orange-700"
              >
                Purchase Date
              </TableHead>
              <TableHead
                onClick={() => onSort("purchaseId")}
                className="cursor-pointer hover:text-orange-700"
              >
                PO Number
              </TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead
                onClick={() => onSort("status")}
                className="cursor-pointer hover:text-orange-700"
              >
                Status
              </TableHead>
              <TableHead
                onClick={() => onSort("paymentStatus")}
                className="cursor-pointer hover:text-orange-700"
              >
                Payment
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:text-orange-700"
                onClick={() => onSort("totalAmount")}
              >
                Total Amount
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-muted-foreground"
                >
                  No purchase orders found for Orel Corporation.
                </TableCell>
              </TableRow>
            ) : (
              purchases.map((purchase) => (
                <TableRow
                  key={purchase.id}
                  className="hover:bg-orange-50/10 transition-colors"
                >
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-3 h-3" />
                      {purchase.purchaseDate}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-orange-950">
                        {purchase.purchaseId}
                      </span>
                      {purchase.invoiceNo && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {purchase.invoiceNo}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {purchase.supplierName}
                    {/* Since there is only one supplier, we could hide this, but keeping it confirms correctness */}
                  </TableCell>
                  <TableCell>{renderStatusBadge(purchase.status)}</TableCell>
                  <TableCell>
                    {renderPaymentBadge(purchase.paymentStatus)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    LKR {purchase.totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onView(purchase)}
                      className="hover:bg-orange-100 hover:text-orange-700"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {purchases.length > 0 && (
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
