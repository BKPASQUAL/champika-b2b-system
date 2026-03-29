"use client";

import { useState, useEffect } from "react";

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
  AlertTriangle,
  Building2,
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
import { Product, SortField, SortOrder } from "../types";
import { Badge } from "@/components/ui/badge";

interface ProductTableProps {
  products: Product[];
  loading: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onEdit: (product: Product) => void;
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
  currentPage,
  totalPages,
  onPageChange,
}: ProductTableProps) {
  const router = useRouter();

  const [packSizes, setPackSizes] = useState<{ id: string; name: string; description?: string }[]>([]);

  useEffect(() => {
    fetch("/api/settings/categories?type=pack_size")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPackSizes(data);
      })
      .catch((err) => console.error(err));
  }, []);

  const getPackQuantity = (unit: string) => {
    const pack = packSizes.find((p) => p.name === unit);
    return pack && pack.description ? parseFloat(pack.description) : 1;
  };

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
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-muted-foreground">Loading products...</span>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto px-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("name")}
              >
                <div className="flex items-center">
                  Product Name {getSortIcon("name")}
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
                onClick={() => onSort("supplier")}
              >
                <div className="flex items-center">
                  Supplier {getSortIcon("supplier")}
                </div>
              </TableHead>

              {/* Commission Column */}
              <TableHead className="text-right">Commission</TableHead>

              {/* Status Column */}
              <TableHead className="text-center">Status</TableHead>

              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("stock")}
              >
                <div className="flex items-center justify-end">
                  Stock {getSortIcon("stock")}
                </div>
              </TableHead>
              <TableHead className="text-right">Cost Price</TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("sellingPrice")}
              >
                <div className="flex items-center justify-end">
                  Selling Price {getSortIcon("sellingPrice")}
                </div>
              </TableHead>
              <TableHead
                className="text-right cursor-pointer hover:bg-muted/50"
                onClick={() => onSort("mrp")}
              >
                <div className="flex items-center justify-end">
                  MRP {getSortIcon("mrp")}
                </div>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="text-center py-8 text-muted-foreground"
                >
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const packQty = getPackQuantity(product.unitOfMeasure);
                const isMultiPack = packQty > 1;

                return (
                  <TableRow
                    key={product.id}
                    className={!product.isActive ? "opacity-60 bg-muted/20" : ""}
                  >
                    <TableCell className="font-medium align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {product.name}
                          {product.stock === 0 ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Out
                            </span>
                          ) : product.stock < product.minStock ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Low
                            </span>
                          ) : null}
                        </div>
                        <div className="flex gap-2 text-[10px] text-muted-foreground font-mono">
                          <span>SKU: {product.sku}</span>
                          {product.companyCode && <span>CC: {product.companyCode}</span>}
                        </div>
                      </div>
                    </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      <Tag className="w-3 h-3 mr-1" /> {product.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      <Building2 className="w-3 h-3 mr-1" /> {product.supplier}
                    </span>
                  </TableCell>

                  {/* Display Commission Value */}
                  <TableCell className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      <Percent className="w-3 h-3 mr-1" />
                      {product.commissionValue ?? 0}%
                    </span>
                  </TableCell>

                  <TableCell className="text-center">
                    {product.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-green-500 text-green-600 bg-green-50"
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-gray-400 text-gray-500 bg-gray-100"
                      >
                        Inactive
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <span
                      className={
                        product.stock === 0
                          ? "text-red-600 font-bold"
                          : product.stock < product.minStock
                          ? "text-destructive font-medium"
                          : ""
                      }
                    >
                      {product.stock} {product.unitOfMeasure}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-blue-600">LKR {product.costPrice.toLocaleString()}</div>
                    {isMultiPack && product.costPrice > 0 && (
                      <div className="text-[10px] text-muted-foreground">Pcs: {(product.costPrice / packQty).toFixed(2)}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-green-600 font-medium">LKR {product.sellingPrice.toLocaleString()}</div>
                    {isMultiPack && product.sellingPrice > 0 && (
                      <div className="text-[10px] text-muted-foreground">Pcs: {(product.sellingPrice / packQty).toFixed(2)}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{product.mrp && product.mrp > 0 ? `LKR ${product.mrp.toLocaleString()}` : "-"}</div>
                    {isMultiPack && product.mrp > 0 && (
                      <div className="text-[10px] text-muted-foreground">Pcs: {(product.mrp / packQty).toFixed(2)}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          router.push(`/dashboard/office/distribution/products/${product.id}`)
                        }
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEdit(product)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {/* Delete button removed as requested */}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && products.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 border-t ">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * 7 + 1} to{" "}
            {Math.min(currentPage * 7, totalPages * 7)} of {totalPages * 7}{" "}
            entries
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            {(() => {
              const pages: (number | "ellipsis")[] = [];
              if (totalPages <= 6) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (currentPage > 3) pages.push("ellipsis");
                for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                  pages.push(i);
                }
                if (currentPage < totalPages - 2) pages.push("ellipsis");
                pages.push(totalPages);
              }
              return pages.map((page, idx) =>
                page === "ellipsis" ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                    ...
                  </span>
                ) : (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    className="w-9"
                    onClick={() => onPageChange(page)}
                  >
                    {page}
                  </Button>
                )
              );
            })()}
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
