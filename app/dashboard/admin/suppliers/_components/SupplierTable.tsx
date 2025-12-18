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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Tag,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Phone,
  Building2,
} from "lucide-react";
import { Supplier, SortField, SortOrder, SupplierStatus } from "../types";
import { useRouter } from "next/navigation";

interface SupplierTableProps {
  suppliers: Supplier[];
  loading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function SupplierTable({
  suppliers,
  loading,
  sortField,
  sortOrder,
  onSort,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
}: SupplierTableProps) {
  const router = useRouter();

  const getSortIcon = (field: SortField) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-4 h-4 ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1" />
    );
  };

  const renderStatusBadge = (status: SupplierStatus) => {
    switch (status) {
      case "Active":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Active
          </span>
        );
      case "Inactive":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <XCircle className="w-3 h-3 mr-1" /> Inactive
          </span>
        );
      case "Pending":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
            <Clock className="w-3 h-3 mr-1" /> Pending
          </span>
        );
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-muted-foreground">Loading suppliers...</span>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("name")}
              >
                <div className="flex items-center">
                  Supplier Info {getSortIcon("name")}
                </div>
              </TableHead>

              <TableHead className="cursor-pointer hover:bg-muted/50">
                <div className="flex items-center">Business</div>
              </TableHead>

              <TableHead
                className="hidden md:table-cell cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("contactPerson")}
              >
                <div className="flex items-center">
                  Contact {getSortIcon("contactPerson")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("category")}
              >
                <div className="flex items-center">
                  Category {getSortIcon("category")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("status")}
              >
                <div className="flex items-center">
                  Status {getSortIcon("status")}
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("duePayment")}
              >
                <div className="flex items-center justify-end">
                  Due Amount {getSortIcon("duePayment")}
                </div>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  No suppliers found
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => (
                <TableRow
                  key={supplier.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() =>
                    router.push(`/dashboard/admin/suppliers/${supplier.id}`)
                  }
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage
                          src={`https://ui-avatars.com/api/?name=${supplier.name}&background=random`}
                        />
                        <AvatarFallback>
                          {supplier.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {supplier.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {supplier.supplierId}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    {supplier.businessName ? (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Building2 className="w-3 h-3 text-muted-foreground" />
                        {supplier.businessName}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Global / Not Set
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-col text-sm">
                      <span className="font-medium">
                        {supplier.contactPerson}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {supplier.phone}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      <Tag className="w-3 h-3 mr-1" /> {supplier.category}
                    </span>
                  </TableCell>
                  <TableCell>{renderStatusBadge(supplier.status)}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        supplier.duePayment > 0
                          ? "text-red-600 font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      LKR {supplier.duePayment.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() =>
                          router.push(
                            `/dashboard/admin/suppliers/${supplier.id}`
                          )
                        }
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600"
                        onClick={() => onEdit(supplier)}
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => onDelete(supplier)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {/* Pagination */}
      {!loading && suppliers.length > 0 && (
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
            <div className="flex items-center gap-1">
              <Button variant="default" size="sm" className="w-9">
                {currentPage}
              </Button>
            </div>
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
