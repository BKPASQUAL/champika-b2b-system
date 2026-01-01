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
  Edit,
  Trash2,
  AlertTriangle,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Percent,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Product,
  SortField,
  SortOrder,
} from "@/app/dashboard/admin/products/types";

interface ProductTableProps {
  products: Product[];
  loading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ProductTable({
  products,
  loading,
  sortField,
  sortOrder,
  onSort,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
}: ProductTableProps) {
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-orange-600" />
        <span className="text-muted-foreground">Loading inventory...</span>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-orange-50/50">
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-orange-100/50 pl-4"
                onClick={() => onSort("name")}
              >
                <div className="flex items-center text-orange-900">
                  Product Details {getSortIcon("name")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-orange-100/50"
                onClick={() => onSort("category")}
              >
                <div className="flex items-center text-orange-900">
                  Category {getSortIcon("category")}
                </div>
              </TableHead>

              {/* Removed Supplier Column - Redundant */}

              <TableHead className="text-right text-orange-900">
                Commission
              </TableHead>

              <TableHead
                className="text-right cursor-pointer hover:bg-orange-100/50"
                onClick={() => onSort("stock")}
              >
                <div className="flex items-center justify-end text-orange-900">
                  Stock {getSortIcon("stock")}
                </div>
              </TableHead>

              {/* ✅ ADDED MRP COLUMN */}
              <TableHead
                className="text-right cursor-pointer hover:bg-orange-100/50"
                onClick={() => onSort("mrp")}
              >
                <div className="flex items-center justify-end text-orange-900">
                  MRP {getSortIcon("mrp")}
                </div>
              </TableHead>

              <TableHead
                className="text-right cursor-pointer hover:bg-orange-100/50"
                onClick={() => onSort("sellingPrice")}
              >
                <div className="flex items-center justify-end text-orange-900">
                  Price {getSortIcon("sellingPrice")}
                </div>
              </TableHead>
              <TableHead className="text-right text-orange-900 pr-4">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8} // Increased colSpan to account for new column
                  className="text-center py-8 text-muted-foreground"
                >
                  No Orange products found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow
                  key={product.id}
                  className="hover:bg-orange-50/10 transition-colors"
                >
                  <TableCell className="font-medium pl-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground">
                        {product.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {product.sku}
                      </span>
                      <div className="mt-1">
                        {product.stock === 0 ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                            Out of Stock
                          </span>
                        ) : product.stock < product.minStock ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">
                            Low Stock
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border">
                      <Tag className="w-3 h-3 mr-1" /> {product.category}
                    </span>
                  </TableCell>

                  {/* Commission Value */}
                  <TableCell className="text-right">
                    <span className="font-mono text-sm text-muted-foreground">
                      {product.commissionValue ?? 0}%
                    </span>
                  </TableCell>

                  <TableCell className="text-right">
                    <span
                      className={`font-medium text-sm ${
                        product.stock === 0
                          ? "text-red-600"
                          : product.stock < product.minStock
                          ? "text-orange-600"
                          : "text-foreground"
                      }`}
                    >
                      {product.stock}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {product.unitOfMeasure}
                      </span>
                    </span>
                  </TableCell>

                  {/* ✅ ADDED MRP CELL */}
                  <TableCell className="text-right font-medium text-sm text-muted-foreground">
                    LKR {product.mrp.toLocaleString()}
                  </TableCell>

                  <TableCell className="text-right font-medium text-sm">
                    LKR {product.sellingPrice.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                        onClick={() =>
                          router.push(
                            `/dashboard/office/orange/products/${product.id}`
                          )
                        }
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => onEdit(product)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => onDelete(product)}
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

      {!loading && products.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50/30">
          <div className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
