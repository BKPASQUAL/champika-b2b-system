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
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertTriangle,
  XCircle,
  X,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
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
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  showPagination?: boolean;
  allFilteredCount?: number;
  onSelectAll?: () => void;
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
  selectedIds,
  onSelectionChange,
  showPagination = true,
  allFilteredCount = 0,
  onSelectAll,
}: ProductTableProps) {
  const router = useRouter();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const pageIds = products.map((p) => p.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allPageSelected) {
      pageIds.forEach((id) => next.delete(id));
    } else {
      pageIds.forEach((id) => next.add(id));
    }
    onSelectionChange(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
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

  return (
    <>
      {/* ── MOBILE / TABLET CARDS (< lg) ── */}
      <div className="lg:hidden">
        {products.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No Sierra products found</div>
        ) : (
          <div className="divide-y">
            {products.map((product) => (
              <div key={product.id} className={`p-4 flex gap-3 hover:bg-red-50/10 transition-colors ${selectedIds.has(product.id) ? "bg-purple-50/40" : ""} ${!product.isActive ? "opacity-50 bg-muted/20" : ""}`}>
                {/* Checkbox */}
                <div className="flex items-start pt-1 shrink-0">
                  <Checkbox
                    checked={selectedIds.has(product.id)}
                    onCheckedChange={() => toggleOne(product.id)}
                  />
                </div>
                {/* Image */}
                <div className="shrink-0">
                  {product.images?.[0] ? (
                    <button onClick={() => setLightboxImage(product.images[0])} className="focus:outline-none">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-16 h-16 rounded-lg object-cover border border-border hover:opacity-80 cursor-zoom-in transition-opacity"
                      />
                    </button>
                  ) : (
                    <div className="w-16 h-16 rounded-lg border border-red-100 bg-red-50/30 flex items-center justify-center">
                      <span className="text-muted-foreground text-[10px]">No img</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Name + badges */}
                  <div className="flex flex-wrap items-start gap-1.5 mb-1">
                    <span className="font-semibold text-sm leading-tight">{product.name}</span>
                    {!product.isActive && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-600 whitespace-nowrap">
                        Inactive
                      </span>
                    )}
                    {product.stock === 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 whitespace-nowrap">
                        <XCircle className="w-3 h-3 mr-0.5" /> Out of Stock
                      </span>
                    ) : product.stock < product.minStock ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap">
                        <AlertTriangle className="w-3 h-3 mr-0.5" /> Low Stock
                      </span>
                    ) : null}
                  </div>

                  {/* SKU + Company Code */}
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground font-mono mb-2">
                    {product.sku && <span>SKU: {product.sku}</span>}
                    {product.companyCode && (
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border text-slate-700">
                        CC: {product.companyCode}
                      </span>
                    )}
                  </div>

                  {/* Category + Commission */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border">
                      <Tag className="w-2.5 h-2.5 mr-1" /> {product.category}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-100 text-orange-700">
                      Commission: {product.commissionValue ?? 0}%
                    </span>
                  </div>

                  {/* Price grid */}
                  <div className="grid grid-cols-3 gap-1 mb-2 text-xs">
                    <div className="bg-muted/50 rounded p-1.5 text-center">
                      <div className="text-muted-foreground text-[10px] mb-0.5">MRP</div>
                      <div className="font-medium">{product.mrp > 0 ? `LKR ${product.mrp.toLocaleString()}` : "-"}</div>
                    </div>
                    <div className="bg-orange-50 rounded p-1.5 text-center">
                      <div className="text-muted-foreground text-[10px] mb-0.5">Discount</div>
                      <div className="text-orange-600 font-medium">{product.discountPercent ? product.discountPercent.toFixed(2) : "0.00"}%</div>
                    </div>
                    <div className="bg-green-50 rounded p-1.5 text-center">
                      <div className="text-muted-foreground text-[10px] mb-0.5">Price</div>
                      <div className="text-green-600 font-semibold">LKR {product.sellingPrice.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Stock + actions */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${
                      product.stock === 0 ? "text-red-600"
                      : product.stock < product.minStock ? "text-amber-600"
                      : "text-muted-foreground"
                    }`}>
                      Stock: {product.stock} {product.unitOfMeasure}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => router.push(`/dashboard/office/sierra/products/${product.id}`)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => onEdit(product)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => onDelete(product)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── DESKTOP TABLE (lg+) ── */}
      <div className="hidden lg:block overflow-x-auto">
        <Table>
          <TableHeader className="bg-red-50/50">
            <TableRow>
              <TableHead className="pl-4 w-10">
                <Checkbox
                  checked={allPageSelected}
                  ref={(el) => { if (el) (el as any).indeterminate = somePageSelected && !allPageSelected; }}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-red-100/50 w-[420px]"
                onClick={() => onSort("name")}
              >
                <div className="flex items-center text-red-900">
                  Product Details {getSortIcon("name")}
                </div>
              </TableHead>

              {/* Company Code Column */}
              <TableHead className="text-red-900 ">
                Company Code
              </TableHead>

              <TableHead
                className="cursor-pointer hover:bg-red-100/50 "
                onClick={() => onSort("category")}
              >
                <div className="flex items-center text-red-900">
                  Category {getSortIcon("category")}
                </div>
              </TableHead>

              <TableHead className="text-right text-red-900">
                Commission
              </TableHead>

              <TableHead
                className="text-right cursor-pointer hover:bg-red-100/50"
                onClick={() => onSort("stock")}
              >
                <div className="flex items-center justify-end text-red-900">
                  Stock {getSortIcon("stock")}
                </div>
              </TableHead>

              <TableHead
                className="text-right cursor-pointer hover:bg-red-100/50"
                onClick={() => onSort("mrp")}
              >
                <div className="flex items-center justify-end text-red-900">
                  MRP {getSortIcon("mrp")}
                </div>
              </TableHead>

              <TableHead className="text-right text-red-900">
                Discount %
              </TableHead>

              <TableHead
                className="text-right cursor-pointer hover:bg-red-100/50"
                onClick={() => onSort("sellingPrice")}
              >
                <div className="flex items-center justify-end text-red-900">
                  Price {getSortIcon("sellingPrice")}
                </div>
              </TableHead>
              <TableHead className="text-right text-red-900 pr-4">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* ── Select-all banner ── */}
            {allPageSelected && allFilteredCount > products.length && !showPagination === false && (
              <TableRow className="bg-purple-50 hover:bg-purple-50">
                <TableCell colSpan={11} className="py-2 text-center text-sm text-purple-800">
                  All <strong>{products.length}</strong> products on this page are selected.{" "}
                  <button
                    className="font-semibold underline hover:text-purple-900"
                    onClick={onSelectAll}
                  >
                    Select all {allFilteredCount} products
                  </button>
                </TableCell>
              </TableRow>
            )}
            {selectedIds.size === allFilteredCount && allFilteredCount > 0 && !showPagination && (
              <TableRow className="bg-purple-100 hover:bg-purple-100">
                <TableCell colSpan={11} className="py-2 text-center text-sm text-purple-800 font-medium">
                  All <strong>{allFilteredCount}</strong> products are selected.
                </TableCell>
              </TableRow>
            )}

            {products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="text-center py-8 text-muted-foreground"
                >
                  No Sierra products found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow
                  key={product.id}
                  className={`hover:bg-red-50/10 transition-colors ${selectedIds.has(product.id) ? "bg-purple-50/40" : ""} ${!product.isActive ? "opacity-50 bg-muted/20" : ""}`}
                >
                  {/* Checkbox Column */}
                  <TableCell className="pl-4">
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onCheckedChange={() => toggleOne(product.id)}
                    />
                  </TableCell>

                  {/* Product Details Column */}
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-foreground">
                          {product.name}
                        </span>
                        {!product.isActive && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-600 whitespace-nowrap">
                            Inactive
                          </span>
                        )}
                        {product.stock === 0 ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 whitespace-nowrap">
                            <XCircle className="w-3 h-3 mr-1" />
                            Out of Stock
                          </span>
                        ) : product.stock < product.minStock ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Low Stock
                          </span>
                        ) : null}
                      </div>

                      {/* SKU (Below Name) */}
                      <span className="text-[10px] text-muted-foreground font-mono pl-0.5">
                        SKU: {product.sku}
                      </span>
                    </div>
                  </TableCell>

                  {/* Company Code Column */}
                  <TableCell>
                    {product.companyCode ? (
                      <span className="font-mono text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded border">
                        {product.companyCode}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>

                  {/* Category Column */}
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border">
                      <Tag className="w-3 h-3 mr-1" /> {product.category}
                    </span>
                  </TableCell>

                  {/* Commission Column */}
                  <TableCell className="text-right">
                    <span className="font-mono text-sm text-muted-foreground">
                      {product.commissionValue ?? 0}%
                    </span>
                  </TableCell>

                  {/* Stock Column */}
                  <TableCell className="text-right">
                    <span
                      className={`font-medium text-sm ${
                        product.stock === 0
                          ? "text-red-600"
                          : product.stock < product.minStock
                            ? "text-amber-600"
                            : "text-foreground"
                      }`}
                    >
                      {product.stock}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {product.unitOfMeasure}
                      </span>
                    </span>
                  </TableCell>

                  {/* MRP Column */}
                  <TableCell className="text-right font-medium text-sm text-muted-foreground">
                    {product.mrp && product.mrp > 0 ? `LKR ${product.mrp.toLocaleString()}` : "-"}
                  </TableCell>

                  {/* Discount Percentage Column */}
                  <TableCell className="text-right font-medium text-sm text-orange-600">
                    {product.discountPercent ? product.discountPercent.toFixed(2) : "0.00"}%
                  </TableCell>

                  {/* Price Column */}
                  <TableCell className="text-right font-medium text-sm">
                    LKR {product.sellingPrice.toLocaleString()}
                  </TableCell>

                  {/* Actions Column */}
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() =>
                          router.push(
                            `/dashboard/office/sierra/products/${product.id}`,
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

      {!loading && products.length > 0 && showPagination && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}

      {/* ── IMAGE LIGHTBOX ── */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-7 h-7" />
          </button>
          <img
            src={lightboxImage}
            alt="Product"
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
