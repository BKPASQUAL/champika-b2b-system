// app/dashboard/admin/purchases/_components/PurchaseTable.tsx
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
  Loader2,
  Building2, // Added icon
} from "lucide-react";
import { Purchase, SortField, SortOrder, PaymentStatus } from "../types";
import { TablePagination } from "@/components/ui/TablePagination";

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
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
              {/* ✅ Added Business Column Header */}
              <TableHead>Business</TableHead>
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
                  colSpan={8} // Increased colSpan to account for new column
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

                    {/* ✅ Added Business Data Cell */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          {purchase.businessName || "N/A"}
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
      {/* Pagination */}
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </>
  );
}
