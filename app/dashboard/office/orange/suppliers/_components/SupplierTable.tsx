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
  Eye,
  ArrowUpDown,
  Phone,
  Tag,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Supplier,
  SortField,
  SortOrder,
} from "@/app/dashboard/admin/suppliers/types";

interface Props {
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
  onEdit,
  onDelete,
  onSort,
}: Props) {
  const router = useRouter();

  // Helper to render status badge (omitted for brevity, copy from admin if needed)

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead onClick={() => onSort("name")}>Supplier Info</TableHead>
            <TableHead onClick={() => onSort("contactPerson")}>
              Contact
            </TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Due Amount</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((supplier) => (
            <TableRow
              key={supplier.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() =>
                router.push(`/dashboard/office/orange/suppliers/${supplier.id}`)
              }
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>
                      {supplier.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span>{supplier.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {supplier.supplierId}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell>{supplier.contactPerson}</TableCell>
              <TableCell>
                <Tag className="w-3 h-3 inline mr-1" />
                {supplier.category}
              </TableCell>
              <TableCell className="text-right text-red-600 font-medium">
                LKR {supplier.duePayment.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                <div
                  className="flex justify-end gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      router.push(
                        `/dashboard/office/orange/suppliers/${supplier.id}`
                      )
                    }
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(supplier)}
                  >
                    <Edit className="w-4 h-4 text-blue-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(supplier)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
