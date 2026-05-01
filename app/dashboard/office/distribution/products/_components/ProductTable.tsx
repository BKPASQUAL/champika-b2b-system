"use client";

import React, { useState, useEffect } from "react";

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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Eye,
  Edit,
  AlertTriangle,
  Building2,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Percent,
  X,
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
  const [packSizes, setPackSizes] = useState<{ id: string; name: string; description?: string }[]>([]);

  useEffect(() => {
    fetch("/api/settings/categories?type=pack_size")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setPackSizes(data); })
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

  

  return (
    <>
      {/* ── DESKTOP TABLE (lg+) ── */}
      <div className="hidden lg:block overflow-x-auto px-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4 w-10">
                <Checkbox
                  checked={allPageSelected}
                  ref={(el) => { if (el) (el as any).indeterminate = somePageSelected && !allPageSelected; }}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="w-14" />
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => onSort("name")}>
                <div className="flex items-center">Product Name {getSortIcon("name")}</div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => onSort("category")}>
                <div className="flex items-center">Category {getSortIcon("category")}</div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => onSort("supplier")}>
                <div className="flex items-center">Supplier {getSortIcon("supplier")}</div>
              </TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => onSort("stock")}>
                <div className="flex items-center justify-end">Stock {getSortIcon("stock")}</div>
              </TableHead>
              <TableHead className="text-right">Cost Price</TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => onSort("sellingPrice")}>
                <div className="flex items-center justify-end">Selling Price {getSortIcon("sellingPrice")}</div>
              </TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => onSort("mrp")}>
                <div className="flex items-center justify-end">MRP {getSortIcon("mrp")}</div>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* ── Select-all banner ── */}
            {allPageSelected && allFilteredCount > products.length && showPagination && (
              <TableRow className="bg-purple-50 hover:bg-purple-50">
                <TableCell colSpan={12} className="py-2 text-center text-sm text-purple-800">
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
                <TableCell colSpan={12} className="py-2 text-center text-sm text-purple-800 font-medium">
                  All <strong>{allFilteredCount}</strong> products are selected.
                </TableCell>
              </TableRow>
            )}

            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const packQty = getPackQuantity(product.unitOfMeasure);
                const isMultiPack = packQty > 1;
                return (
                  <TableRow key={product.id} className={`${!product.isActive ? "opacity-60 bg-muted/20" : ""} ${selectedIds.has(product.id) ? "bg-purple-50/40" : ""}`}>
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selectedIds.has(product.id)}
                        onCheckedChange={() => toggleOne(product.id)}
                      />
                    </TableCell>
                    <TableCell className="w-14 px-3 py-2 align-middle">
                      {product.images?.[0] ? (
                        <button onClick={() => setLightboxImage(product.images[0])} className="focus:outline-none">
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-10 h-10 rounded object-cover border border-border hover:opacity-80 cursor-zoom-in transition-opacity"
                          />
                        </button>
                      ) : (
                        <div className="w-10 h-10 rounded border border-border bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground text-[10px]">No img</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium align-middle">
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
                    <TableCell className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                        <Percent className="w-3 h-3 mr-1" />{product.commissionValue ?? 0}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {product.isActive ? (
                        <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="border-gray-400 text-gray-500 bg-gray-100">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={
                        product.stock === 0 ? "text-red-600 font-bold"
                        : product.stock < product.minStock ? "text-destructive font-medium"
                        : ""
                      }>
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
                        <Button variant="ghost" size="icon-sm" onClick={() => router.push(`/dashboard/office/distribution/products/${product.id}`)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => onEdit(product)}>
                          <Edit className="w-4 h-4" />
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

      {/* ── MOBILE / TABLET CARDS (< lg) ── */}
      <div className="lg:hidden">
        {products.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No products found</div>
        ) : (
          <div className="divide-y">
            {products.map((product) => {
              const packQty = getPackQuantity(product.unitOfMeasure);
              const isMultiPack = packQty > 1;
              return (
                <div key={product.id} className={`p-4 flex gap-3 ${!product.isActive ? "opacity-60 bg-muted/20" : ""} ${selectedIds.has(product.id) ? "bg-purple-50/40" : ""}`}>
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
                      <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center">
                        <span className="text-muted-foreground text-[10px]">No img</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Name + status + stock badge */}
                    <div className="flex flex-wrap items-start gap-1.5 mb-1">
                      <span className="font-semibold text-sm leading-tight">{product.name}</span>
                      {product.isActive ? (
                        <Badge variant="outline" className="text-[10px] border-green-500 text-green-600 bg-green-50 px-1.5 py-0">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-gray-400 text-gray-500 bg-gray-100 px-1.5 py-0">Inactive</Badge>
                      )}
                      {product.stock === 0 ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 whitespace-nowrap">
                          <AlertTriangle className="w-3 h-3 mr-0.5" /> Out of Stock
                        </span>
                      ) : product.stock < product.minStock ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive whitespace-nowrap">
                          <AlertTriangle className="w-3 h-3 mr-0.5" /> Low Stock
                        </span>
                      ) : null}
                    </div>

                    {/* SKU + company code */}
                    <div className="flex gap-3 text-[11px] text-muted-foreground font-mono mb-2">
                      {product.sku && <span>SKU: {product.sku}</span>}
                      {product.companyCode && <span>CC: {product.companyCode}</span>}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
                        <Tag className="w-2.5 h-2.5 mr-1" /> {product.category}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700">
                        <Building2 className="w-2.5 h-2.5 mr-1" /> {product.supplier}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-100 text-orange-700">
                        <Percent className="w-2.5 h-2.5 mr-1" /> {product.commissionValue ?? 0}%
                      </span>
                    </div>

                    {/* Prices grid */}
                    <div className="grid grid-cols-3 gap-1 mb-2 text-xs">
                      <div className="bg-muted/50 rounded p-1.5 text-center">
                        <div className="text-muted-foreground text-[10px] mb-0.5">Cost</div>
                        <div className="text-blue-600 font-medium">LKR {product.costPrice.toLocaleString()}</div>
                        {isMultiPack && product.costPrice > 0 && (
                          <div className="text-[9px] text-muted-foreground">Pcs: {(product.costPrice / packQty).toFixed(2)}</div>
                        )}
                      </div>
                      <div className="bg-muted/50 rounded p-1.5 text-center">
                        <div className="text-muted-foreground text-[10px] mb-0.5">Selling</div>
                        <div className="text-green-600 font-semibold">LKR {product.sellingPrice.toLocaleString()}</div>
                        {isMultiPack && product.sellingPrice > 0 && (
                          <div className="text-[9px] text-muted-foreground">Pcs: {(product.sellingPrice / packQty).toFixed(2)}</div>
                        )}
                      </div>
                      <div className="bg-muted/50 rounded p-1.5 text-center">
                        <div className="text-muted-foreground text-[10px] mb-0.5">MRP</div>
                        <div className="font-medium">{product.mrp > 0 ? `LKR ${product.mrp.toLocaleString()}` : "-"}</div>
                        {isMultiPack && product.mrp > 0 && (
                          <div className="text-[9px] text-muted-foreground">Pcs: {(product.mrp / packQty).toFixed(2)}</div>
                        )}
                      </div>
                    </div>

                    {/* Stock + actions */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${
                        product.stock === 0 ? "text-red-600"
                        : product.stock < product.minStock ? "text-destructive"
                        : "text-muted-foreground"
                      }`}>
                        Stock: {product.stock} {product.unitOfMeasure}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => router.push(`/dashboard/office/distribution/products/${product.id}`)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => onEdit(product)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PAGINATION ── */}
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
