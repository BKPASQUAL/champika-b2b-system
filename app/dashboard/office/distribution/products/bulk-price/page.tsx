"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, RotateCcw, Search, Tags, Pencil } from "lucide-react";
import { Product } from "../types";

interface RowEdit {
  mrp: string;
  costPrice: string;
  sellingPrice: string;
}

function parseNum(val: string | undefined, fallback: number): number {
  if (val === undefined || val === "") return fallback;
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

function isRowDirty(product: Product, rows: Map<string, RowEdit>): boolean {
  const row = rows.get(product.id);
  if (!row) return false;
  return (
    parseNum(row.mrp, product.mrp) !== product.mrp ||
    parseNum(row.costPrice, product.costPrice) !== product.costPrice ||
    parseNum(row.sellingPrice, product.sellingPrice) !== product.sellingPrice
  );
}

function calcDiscount(mrp: number, selling: number): number {
  if (mrp <= 0) return 0;
  return Math.round(((mrp - selling) / mrp) * 10000) / 100;
}

function calcMargin(selling: number, cost: number): number {
  if (selling <= 0) return 0;
  return Math.round(((selling - cost) / selling) * 10000) / 100;
}

const ITEMS_PER_PAGE = 30;

export default function BulkPricePage() {
  const { data: products, loading, refetch } =
    useCachedFetch<Product[]>("/api/products", []);

  const [rows, setRows] = useState<Map<string, RowEdit>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products],
  );

  const suppliers = useMemo(
    () => [...new Set(products.map((p) => p.supplier).filter(Boolean))].sort(),
    [products],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products
      .filter((p) => !p.retailOnly)
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.companyCode && p.companyCode.toLowerCase().includes(q)) ||
          p.supplier.toLowerCase().includes(q)
        );
      })
      .filter((p) => categoryFilter === "all" || p.category === categoryFilter)
      .filter((p) => supplierFilter === "all" || p.supplier === supplierFilter);
  }, [products, searchQuery, categoryFilter, supplierFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const dirtyCount = useMemo(
    () => products.filter((p) => isRowDirty(p, rows)).length,
    [products, rows],
  );

  // Selection helpers
  const pageIds = paginated.map((p) => p.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected =
    !allPageSelected && pageIds.some((id) => selectedIds.has(id));

  function toggleSelectPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getVal(productId: string, field: keyof RowEdit, original: number): string {
    const val = rows.get(productId)?.[field];
    return val !== undefined && val !== "" ? val : original.toString();
  }

  function handleChange(product: Product, field: keyof RowEdit, value: string) {
    setRows((prev) => {
      const next = new Map(prev);
      // Seed all three fields from the product when this row is first touched
      // so the other inputs don't go blank
      const existing = next.get(product.id) ?? {
        mrp: product.mrp.toString(),
        costPrice: product.costPrice.toString(),
        sellingPrice: product.sellingPrice.toString(),
      };
      next.set(product.id, { ...existing, [field]: value });
      return next;
    });
  }

  async function handleSave(onlySelected = false) {
    const targetProducts = onlySelected
      ? products.filter((p) => selectedIds.has(p.id))
      : products;

    const updates: Array<{ id: string; mrp: number; costPrice: number; sellingPrice: number }> = [];

    for (const product of targetProducts) {
      if (!isRowDirty(product, rows)) continue;
      const row = rows.get(product.id);
      const mrp = parseNum(row?.mrp, product.mrp);
      const costPrice = parseNum(row?.costPrice, product.costPrice);
      const sellingPrice = parseNum(row?.sellingPrice, product.sellingPrice);

      if (sellingPrice <= costPrice) {
        toast.error(`"${product.name}": selling price must be greater than cost price`);
        return;
      }
      updates.push({ id: product.id, mrp, costPrice, sellingPrice });
    }

    if (updates.length === 0) {
      toast.info("No changes to save");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/products/bulk-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      toast.success(json.message);
      setRows(new Map());
      setSelectedIds(new Set());
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    setRows(new Map());
  }

  function handleEnter(
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
  ) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = paginated[rowIndex + 1];
    if (next) {
      const el = document.getElementById(`bp-${next.id}-mrp`) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }
  }

  function handlePageChange(page: number) {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)));
  }

  const selectedDirtyCount = useMemo(
    () => products.filter((p) => selectedIds.has(p.id) && isRowDirty(p, rows)).length,
    [products, selectedIds, rows],
  );

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Bulk Price Update</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Edit MRP, cost price, and selling price for multiple products at once
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dirtyCount > 0 && (
            <>
              <Badge variant="secondary" className="text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300">
                {dirtyCount} unsaved {dirtyCount === 1 ? "change" : "changes"}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Reset
              </Button>
              <Button size="sm" onClick={() => handleSave(false)} disabled={isSaving}>
                <Save className="h-4 w-4 mr-1.5" />
                {isSaving ? "Saving..." : `Save All (${dirtyCount})`}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Selection action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedIds.size} product{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex-1" />
          {selectedDirtyCount > 0 && (
            <Button
              size="sm"
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="h-4 w-4 mr-1.5" />
              Save Selected ({selectedDirtyCount})
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            className="text-blue-600"
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search name, SKU, or code..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={supplierFilter}
          onValueChange={(v) => { setSupplierFilter(v); setCurrentPage(1); }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {loading ? "Loading..." : `${filtered.length} products`}
        </span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              {/* Select-all checkbox */}
              <th className="px-3 py-2.5 w-10">
                <Checkbox
                  checked={allPageSelected}
                  data-state={somePageSelected ? "indeterminate" : undefined}
                  onCheckedChange={toggleSelectPage}
                  aria-label="Select all on page"
                />
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">SKU</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Product Name</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Category</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Supplier</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-32">MRP</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-32">Cost Price</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-32">Selling Price</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-24">Discount %</th>
              <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-24">Margin %</th>
              <th className="px-3 py-2.5 w-12" />
            </tr>
          </thead>
          <tbody>
            {paginated.map((product, idx) => {
              const row = rows.get(product.id);
              const dirty = isRowDirty(product, rows);
              const selected = selectedIds.has(product.id);
              const mrpVal = parseNum(row?.mrp, product.mrp);
              const sellingVal = parseNum(row?.sellingPrice, product.sellingPrice);
              const costVal = parseNum(row?.costPrice, product.costPrice);
              const discount = calcDiscount(mrpVal, sellingVal);
              const margin = calcMargin(sellingVal, costVal);
              const sellingBelowCost =
                sellingVal <= costVal &&
                (row?.sellingPrice !== undefined || row?.costPrice !== undefined);

              return (
                <tr
                  key={product.id}
                  className={`border-t transition-colors ${
                    dirty
                      ? "bg-amber-50 dark:bg-amber-950/20"
                      : selected
                      ? "bg-blue-50/60 dark:bg-blue-950/20"
                      : "hover:bg-muted/20"
                  }`}
                >
                  {/* Checkbox */}
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleSelectOne(product.id)}
                      aria-label={`Select ${product.name}`}
                    />
                  </td>

                  {/* SKU */}
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {product.sku}
                  </td>

                  {/* Name */}
                  <td className="px-3 py-2 font-medium max-w-[200px]">
                    <span className="block truncate" title={product.name}>
                      {product.name}
                    </span>
                    {product.companyCode && (
                      <span className="text-xs text-muted-foreground">{product.companyCode}</span>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {product.category}
                  </td>

                  {/* Supplier */}
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[130px]">
                    <span className="block truncate" title={product.supplier}>
                      {product.supplier}
                    </span>
                  </td>

                  {/* MRP */}
                  <td className="px-2 py-1.5">
                    <Input
                      id={`bp-${product.id}-mrp`}
                      type="number"
                      step="0.01"
                      min="0"
                      className="text-right h-8 text-sm"
                      value={getVal(product.id, "mrp", product.mrp)}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleChange(product, "mrp", e.target.value)}
                      onKeyDown={(e) => handleEnter(e, idx)}
                    />
                  </td>

                  {/* Cost Price */}
                  <td className="px-2 py-1.5">
                    <Input
                      id={`bp-${product.id}-costPrice`}
                      type="number"
                      step="0.01"
                      min="0"
                      className={`text-right h-8 text-sm ${sellingBelowCost ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                      value={getVal(product.id, "costPrice", product.costPrice)}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleChange(product, "costPrice", e.target.value)}
                      onKeyDown={(e) => handleEnter(e, idx)}
                    />
                  </td>

                  {/* Selling Price */}
                  <td className="px-2 py-1.5">
                    <Input
                      id={`bp-${product.id}-sellingPrice`}
                      type="number"
                      step="0.01"
                      min="0"
                      className={`text-right h-8 text-sm ${sellingBelowCost ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                      value={getVal(product.id, "sellingPrice", product.sellingPrice)}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleChange(product, "sellingPrice", e.target.value)}
                      onKeyDown={(e) => handleEnter(e, idx)}
                    />
                  </td>

                  {/* Discount % */}
                  <td className="px-3 py-2 text-right">
                    <span className={`font-medium tabular-nums ${discount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {discount.toFixed(1)}%
                    </span>
                  </td>

                  {/* Margin % */}
                  <td className="px-3 py-2 text-right">
                    <span className={`font-medium tabular-nums ${
                      margin >= 20
                        ? "text-emerald-600 dark:text-emerald-400"
                        : margin >= 10
                        ? "text-yellow-600 dark:text-yellow-400"
                        : margin > 0
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-red-500"
                    }`}>
                      {margin.toFixed(1)}%
                    </span>
                  </td>

                  {/* Edit link */}
                  <td className="px-2 py-2 text-center">
                    <Link
                      href={`/dashboard/office/distribution/products/${product.id}`}
                      title="Open full product editor"
                    >
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              );
            })}

            {paginated.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">
                  {loading ? "Loading products..." : "No products found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination + bottom save */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
            <span className="ml-2 hidden sm:inline">
              ({(currentPage - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length})
            </span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>

        {dirtyCount > 0 && (
          <Button onClick={() => handleSave(false)} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1.5" />
            {isSaving ? "Saving..." : `Save All Changes (${dirtyCount})`}
          </Button>
        )}
      </div>
    </div>
  );
}
