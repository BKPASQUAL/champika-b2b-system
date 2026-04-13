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
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  Building2,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Percent,
  PackageX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Product, SortField, SortOrder } from "../types";
import { TablePagination } from "@/components/ui/TablePagination";

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

  const [packSizes, setPackSizes] = useState<
    { id: string; name: string; description?: string }[]
  >([]);

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
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <PackageX className="w-10 h-10 opacity-30" />
        <p className="text-sm">No products found</p>
      </div>
    );
  }


  const pagination = (
    <TablePagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  );

  return (
    <>
      {/* ─── MOBILE & TABLET: Card Grid (hidden on lg+) ─── */}
      <div className="lg:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
          {products.map((product) => {
            const packQty = getPackQuantity(product.unitOfMeasure);
            const isMultiPack = packQty > 1;

            return (
              <div
                key={product.id}
                className={`rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col ${
                  !product.isActive ? "opacity-60" : ""
                }`}
              >
                {/* Card Header */}
                <div className="bg-orange-50/60 px-4 py-3 border-b flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground leading-snug line-clamp-2">
                      {product.name}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        SKU: {product.sku}
                      </span>
                      {product.companyCode && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          CC: {product.companyCode}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stock Alert */}
                  <div className="shrink-0">
                    {product.stock === 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Out
                      </span>
                    ) : product.stock < product.minStock ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Low
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Card Body */}
                <div className="px-4 py-3 flex-1 space-y-3">
                  {/* Badges Row */}
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      <Tag className="w-3 h-3 mr-1" />
                      {product.category}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      <Building2 className="w-3 h-3 mr-1" />
                      {product.supplier}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      <Percent className="w-3 h-3 mr-1" />
                      {product.commissionValue ?? 0}%
                    </span>
                    {product.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-green-500 text-green-600 bg-green-50 text-[11px] px-2"
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-gray-400 text-gray-500 bg-gray-100 text-[11px] px-2"
                      >
                        Inactive
                      </Badge>
                    )}
                  </div>

                  {/* Price Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 rounded-lg px-2 py-2">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Cost</p>
                      <p className="text-xs font-semibold text-blue-600">
                        {product.costPrice > 0
                          ? `LKR ${product.costPrice.toLocaleString()}`
                          : "-"}
                      </p>
                      {isMultiPack && product.costPrice > 0 && (
                        <p className="text-[9px] text-muted-foreground">
                          Pcs: {(product.costPrice / packQty).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="bg-green-50 rounded-lg px-2 py-2">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Price</p>
                      <p className="text-xs font-semibold text-green-600">
                        LKR {product.sellingPrice.toLocaleString()}
                      </p>
                      {isMultiPack && product.sellingPrice > 0 && (
                        <p className="text-[9px] text-muted-foreground">
                          Pcs: {(product.sellingPrice / packQty).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-lg px-2 py-2">
                      <p className="text-[10px] text-muted-foreground mb-0.5">MRP</p>
                      <p className="text-xs font-semibold">
                        {product.mrp > 0
                          ? `LKR ${product.mrp.toLocaleString()}`
                          : "-"}
                      </p>
                      {isMultiPack && product.mrp > 0 && (
                        <p className="text-[9px] text-muted-foreground">
                          Pcs: {(product.mrp / packQty).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stock Row */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">Stock</span>
                    <span
                      className={`font-medium text-xs ${
                        product.stock === 0
                          ? "text-red-600"
                          : product.stock < product.minStock
                          ? "text-amber-600"
                          : "text-foreground"
                      }`}
                    >
                      {product.stock}{" "}
                      <span className="font-normal text-muted-foreground">
                        {product.unitOfMeasure}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Card Footer: Actions */}
                <div className="px-4 py-2 border-t bg-slate-50/50 flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                    onClick={() =>
                      router.push(
                        `/dashboard/office/orange/products/${product.id}`
                      )
                    }
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    <span className="text-xs">View</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                    onClick={() => onEdit(product)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    <span className="text-xs">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-slate-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => onDelete(product)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    <span className="text-xs">Delete</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {pagination}
      </div>

      {/* ─── DESKTOP: Full Table (hidden below lg) ─── */}
      <div className="hidden lg:block">
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
                <TableHead className="text-right">Commission</TableHead>
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
              {products.map((product) => {
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
                          {product.companyCode && (
                            <span>CC: {product.companyCode}</span>
                          )}
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
                      <div className="text-blue-600">
                        LKR {product.costPrice.toLocaleString()}
                      </div>
                      {isMultiPack && product.costPrice > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          Pcs: {(product.costPrice / packQty).toFixed(2)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-green-600 font-medium">
                        LKR {product.sellingPrice.toLocaleString()}
                      </div>
                      {isMultiPack && product.sellingPrice > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          Pcs: {(product.sellingPrice / packQty).toFixed(2)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        {product.mrp && product.mrp > 0
                          ? `LKR ${product.mrp.toLocaleString()}`
                          : "-"}
                      </div>
                      {isMultiPack && product.mrp > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          Pcs: {(product.mrp / packQty).toFixed(2)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
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
                );
              })}
            </TableBody>
          </Table>
        </div>
        {pagination}
      </div>
    </>
  );
}
