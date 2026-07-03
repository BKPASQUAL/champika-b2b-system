"use client";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Edit, Trash2, Eye, ArrowUpDown, Phone, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Supplier, SortField, SortOrder } from "@/app/dashboard/admin/suppliers/types";

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

const statusBadge = (status: string) => {
  if (status === "Active") return <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle2 className="w-3 h-3" />Active</Badge>;
  if (status === "Inactive") return <Badge variant="outline" className="text-muted-foreground gap-1"><XCircle className="w-3 h-3" />Inactive</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
};

export function SupplierTable({ suppliers, loading, onSort, onEdit, onDelete }: Props) {
  const router = useRouter();

  if (loading) {
    return <div className="text-center py-10 text-muted-foreground">Loading suppliers…</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-green-50/50">
            <TableHead className="cursor-pointer select-none" onClick={() => onSort("name")}>
              <span className="flex items-center gap-1">Supplier <ArrowUpDown className="w-3 h-3 opacity-50" /></span>
            </TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Due Amount</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No suppliers found</TableCell>
            </TableRow>
          ) : (
            suppliers.map((s) => (
              <TableRow
                key={s.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/dashboard/office/retail/suppliers/${s.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-green-100 text-green-700 text-sm font-bold">
                        {s.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold text-sm">{s.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{s.supplierId}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{s.contactPerson}</div>
                  {s.phone && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />{s.phone}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">{s.category || "—"}</Badge>
                </TableCell>
                <TableCell className="text-center">{statusBadge(s.status)}</TableCell>
                <TableCell className="text-right font-semibold">
                  {s.duePayment > 0
                    ? <span className="text-red-600">LKR {s.duePayment.toLocaleString()}</span>
                    : <span className="text-green-600">Nil</span>
                  }
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/dashboard/office/retail/suppliers/${s.id}`)}>
                      <Eye className="w-4 h-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(s)}>
                      <Edit className="w-4 h-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(s)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
