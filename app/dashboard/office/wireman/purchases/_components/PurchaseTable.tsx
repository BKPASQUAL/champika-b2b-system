// app/dashboard/office/wireman/purchases/_components/PurchaseTable.tsx
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
      Ordered: "bg-blue-100 text-blue-700",
      Received: "bg-green-100 text-green-700",
      Cancelled: "bg-gray-100 text-gray-700",
    };
    return (
      <Badge variant="secondary" className={`${styles[status]} border-none`}>
        {status}
      </Badge>
    );
  };

  const renderPaymentBadge = (status: PaymentStatus) => {
    const styles = {
      Paid: "bg-green-50 text-green-700 border-green-200",
      Unpaid: "bg-red-50 text-red-700 border-red-200",
      Partial: "bg-amber-50 text-amber-700 border-amber-200",
    };
    return (
      <Badge variant="outline" className={`${styles[status]}`}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-red-600" />
        <span className="text-red-900">Loading bills...</span>
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
                onClick={() => onSort("purchaseDate")}
                className="cursor-pointer hover:text-red-700"
              >
                Date
              </TableHead>
              <TableHead
                onClick={() => onSort("purchaseId")}
                className="cursor-pointer hover:text-red-700"
              >
                PO Number
              </TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead
                onClick={() => onSort("status")}
                className="cursor-pointer hover:text-red-700"
              >
                Status
              </TableHead>
              <TableHead
                onClick={() => onSort("paymentStatus")}
                className="cursor-pointer hover:text-red-700"
              >
                Payment
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:text-red-700"
                onClick={() => onSort("totalAmount")}
              >
                Total
              </TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-12 text-muted-foreground"
                >
                  No purchase records found.
                </TableCell>
              </TableRow>
            ) : (
              purchases.map((purchase) => (
                <TableRow key={purchase.id} className="hover:bg-red-50/10">
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-3 h-3" />
                      {new Date(purchase.purchaseDate).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {purchase.purchaseId}
                  </TableCell>
                  <TableCell>
                    {purchase.invoiceNo && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="w-3 h-3" />
                        {purchase.invoiceNo}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {purchase.supplierName}
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
                      className="hover:bg-red-100 hover:text-red-700"
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
