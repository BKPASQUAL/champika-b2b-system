// app/dashboard/office/distribution/purchases/_components/PurchaseTable.tsx
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
  Edit,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Purchase, SortField, SortOrder, PaymentStatus } from "../types";

interface PurchaseTableProps {
  purchases: Purchase[];
  loading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onEdit: (purchase: Purchase) => void;
  onDelete: (purchase: Purchase) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PurchaseTable({
  purchases,
  loading,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
}: PurchaseTableProps) {
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
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>PO Number</TableHead>
              {/* Removed Business Column for Distribution View */}
              <TableHead>Supplier</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
              <TableHead className="text-right">Unpaid Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  No purchases found
                </TableCell>
              </TableRow>
            ) : (
              purchases.map((purchase) => {
                const unpaid = purchase.totalAmount - purchase.paidAmount;
                return (
                  <TableRow key={purchase.id}>
                    <TableCell>{purchase.purchaseDate}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {purchase.purchaseId}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Inv:{" "}
                          {purchase.invoiceNo || "-"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="font-medium">
                      {purchase.supplierName}
                    </TableCell>
                    <TableCell>
                      {renderPaymentBadge(purchase.paymentStatus)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      LKR {purchase.totalAmount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      {unpaid > 0 ? `LKR ${unpaid.toLocaleString()}` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEdit(purchase)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onDelete(purchase)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {!loading && purchases.length > 0 && (
        <div className="flex items-center justify-between px-2 py-4 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * 7 + 1} to{" "}
            {Math.min(currentPage * 7, totalPages * 7)} of {totalPages * 7}{" "}
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
