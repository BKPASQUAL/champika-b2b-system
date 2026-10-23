"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package,
  Search,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Globe,
  ArrowRight,
  Check,
  Building2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

// Normalizes supplier names across Champika Hardware's database
export function getNormalizedSupplier(supplier?: string | null, brand?: string | null): string {
  const s = (supplier || "").toLowerCase().trim();
  const b = (brand || "").toLowerCase().trim();

  if (s.includes("wireman") || b.includes("wireman")) return "Wireman (Orel)";
  if (s.includes("orange") || b.includes("orange")) return "Orange (Orel Corporation)";
  if (s.includes("sierra") || b.includes("sierra")) return "Sierra Cables Plc";
  if (s.includes("china") || b.includes("china")) return "China";
  if (s.includes("mans lanka") || b.includes("mans lanka")) return "Mans Lanka";
  if (s.includes("viraj") || b.includes("viraj")) return "Viraj Electricals";
  if (s.includes("polycrome") || b.includes("polycrome")) return "Polycrome";
  if (s.includes("ls electrical") || b.includes("ls electrical")) return "LS Electrical";
  if (s.includes("water tec") || s.includes("anthony")) return "Water Tec (St. Anthony's)";
  if (s.includes("asiri")) return "Asiri Electricals";
  if (s.includes("martin")) return "Martin Electricals";
  if (s.includes("cb electrical")) return "CB Electricals";
  if (s.includes("usha")) return "Usha Nelsons";
  if (s.includes("green electrical")) return "Green Electrical";
  if (s.includes("acl")) return "ACL Cables";
  if (s.includes("kelani")) return "Kelani";
  if (s.includes("chint")) return "Chint";
  if (s.includes("sunzone")) return "Sunzone Electrical";
  if (s.includes("singer")) return "Singer Sri Lanka";

  if (supplier && supplier.trim()) return supplier.trim();
  if (brand && brand.trim()) return brand.trim();
  return "Other Suppliers";
}

export default function StorefrontCatalogPage() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [page, setPage] = useState<number>(1);
  const itemsPerPage = 50;

  // Selected product IDs for Step 1
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/storefront/manage/products");
      if (!res.ok) throw new Error("Failed to load catalog products");
      const data = await res.json();
      setProducts(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();

    try {
      const saved = localStorage.getItem("storefront_selected_for_website");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedProductIds(new Set(parsed));
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, selectedSupplier]);

  const fmt = (num: number) =>
    (num || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Compute all suppliers with exact item counts
  const suppliersWithCounts = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      const sup = getNormalizedSupplier(p.supplier || p.supplierName, p.brand);
      map.set(sup, (map.get(sup) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [products]);

  // Counts
  const publishedCount = useMemo(() => products.filter((p) => p.isPublished).length, [products]);

  // Filtered products by Supplier and Search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const prodSup = getNormalizedSupplier(p.supplier || p.supplierName, p.brand);

      if (selectedSupplier !== "all" && prodSup !== selectedSupplier) {
        return false;
      }

      if (search) {
        const q = search.toLowerCase();
        return (
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.supplier?.toLowerCase().includes(q) ||
          p.supplierName?.toLowerCase().includes(q) ||
          prodSup.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, selectedSupplier, search]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  }, [filteredProducts, page]);

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      try {
        localStorage.setItem(
          "storefront_selected_for_website",
          JSON.stringify(Array.from(next))
        );
      } catch (e) {}

      return next;
    });
  };

  // Select all filtered
  const selectAllFiltered = () => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      filteredProducts.forEach((p) => next.add(p.id));

      try {
        localStorage.setItem(
          "storefront_selected_for_website",
          JSON.stringify(Array.from(next))
        );
      } catch (e) {}

      return next;
    });
    toast.info(`Selected all ${filteredProducts.length} filtered items`);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedProductIds(new Set());
    try {
      localStorage.removeItem("storefront_selected_for_website");
    } catch (e) {}
  };

  // Navigate to Step 2 (Website Products Page) with selected items
  const proceedToStep2 = () => {
    if (selectedProductIds.size === 0) {
      toast.error("Please select at least 1 product from the catalog.");
      return;
    }

    try {
      localStorage.setItem(
        "storefront_selected_for_website",
        JSON.stringify(Array.from(selectedProductIds))
      );
    } catch (e) {}

    router.push("/dashboard/office/storefront/products?action=configure");
  };

  return (
    <div className="space-y-6 w-full pb-20">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/office/storefront">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  All Catalog Products
                </h1>
                <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700">
                  Step 1: Product Selection
                </Badge>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Browse warehouse products by supplier and select items to put on the customer website
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/dashboard/office/storefront/products">
            <Button
              variant="outline"
              className="gap-2 text-xs sm:text-sm text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100"
            >
              <Globe className="w-4 h-4 text-emerald-600" />
              Website Products ({publishedCount})
            </Button>
          </Link>

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              fetchProducts();
              toast.info("Refreshed catalog");
            }}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-slate-900">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Total Catalog Items</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{products.length}</div>
            <p className="text-xs text-slate-500 mt-1">Full warehouse inventory</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Already on Website</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{publishedCount}</div>
            <p className="text-xs text-emerald-600 font-medium mt-1">Live customer items</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Offline / Unlisted</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{products.length - publishedCount}</div>
            <p className="text-xs text-amber-600 font-medium mt-1">Available to add</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-blue-50/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Currently Selected</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-blue-700">{selectedProductIds.size}</div>
            <p className="text-xs text-blue-600 font-medium mt-1">Ready for Step 2</p>
          </CardContent>
        </Card>
      </div>

      {/* Search, Supplier Filter & Quick Action Toolbar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
        {/* Row 1: Search input + Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={`Search ${filteredProducts.length} items by product name, SKU, or supplier...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 text-xs bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllFiltered}
              className="text-xs h-10"
            >
              Select All Filtered ({filteredProducts.length})
            </Button>
            {selectedProductIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="text-xs h-10 text-rose-600 hover:text-rose-700"
              >
                Clear ({selectedProductIds.size})
              </Button>
            )}
            <Button
              onClick={proceedToStep2}
              disabled={selectedProductIds.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 gap-2 shadow-sm"
            >
              Continue to Step 2: Configure for Website ({selectedProductIds.size})
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Row 2: Accurate Supplier Filter Pills + Full Supplier Dropdown */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1 max-w-full">
            <span className="text-slate-500 font-bold text-xs shrink-0 flex items-center gap-1 mr-1">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              Supplier:
            </span>

            {/* All Suppliers Pill */}
            <button
              onClick={() => setSelectedSupplier("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0",
                selectedSupplier === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              All Suppliers ({products.length})
            </button>

            {/* Top Suppliers with item counts */}
            {suppliersWithCounts.slice(0, 10).map((s) => (
              <button
                key={s.name}
                onClick={() => setSelectedSupplier(s.name)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0",
                  selectedSupplier === s.name
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
              >
                <span>{s.name}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                    selectedSupplier === s.name ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  )}
                >
                  {s.count}
                </span>
              </button>
            ))}
          </div>

          {/* Quick Dropdown for All 23 Suppliers */}
          <div className="shrink-0 flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">All:</span>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="h-8 text-xs rounded-lg border border-slate-300 bg-white px-2.5 text-slate-800 font-medium focus:ring-slate-900"
            >
              <option value="all">Select Supplier ({suppliersWithCounts.length} total)...</option>
              {suppliersWithCounts.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} ({s.count} items)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Catalog Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg">
                {selectedSupplier === "all" ? "Warehouse Catalog Items" : selectedSupplier}
              </CardTitle>
              <Badge variant="secondary" className="text-xs font-bold bg-slate-100 text-slate-800">
                {filteredProducts.length} items
              </Badge>
            </div>
            <CardDescription className="text-xs mt-1">
              Select items using checkboxes and click &ldquo;Continue to Step 2&rdquo; to set categories and retail prices.
            </CardDescription>
          </div>

          {filteredProducts.length > 0 && (
            <div className="text-xs text-slate-500">
              Showing {Math.min((page - 1) * itemsPerPage + 1, filteredProducts.length)}-
              {Math.min(page * itemsPerPage, filteredProducts.length)} of {filteredProducts.length}
            </div>
          )}
        </CardHeader>

        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <span className="sr-only">Select</span>
                  </TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Supplier &amp; SKU</TableHead>
                  <TableHead>Catalog Category</TableHead>
                  <TableHead className="text-center">Physical Stock</TableHead>
                  <TableHead className="text-right">Wholesale Cost (Rs.)</TableHead>
                  <TableHead className="text-center">Website Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                      Loading catalog products...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                      No products found for this supplier or search query.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProducts.map((p) => {
                    const isSelected = selectedProductIds.has(p.id);
                    const normalizedSup = getNormalizedSupplier(p.supplier || p.supplierName, p.brand);

                    return (
                      <TableRow
                        key={p.id}
                        onClick={() => toggleSelect(p.id)}
                        className={cn(
                          "hover:bg-slate-50/80 cursor-pointer transition-colors",
                          isSelected && "bg-emerald-50/40"
                        )}
                      >
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(p.id)}
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                          />
                        </TableCell>

                        <TableCell>
                          <div className="font-semibold text-slate-900 text-xs sm:text-sm">{p.name}</div>
                          <div className="text-[11px] text-slate-400">{p.sku}</div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[11px] font-semibold text-slate-800 bg-slate-50 border-slate-200"
                          >
                            {normalizedSup}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <span className="text-xs text-slate-600">{p.category || "General"}</span>
                        </TableCell>

                        <TableCell className="text-center font-medium">
                          <span className={p.warehouseStock <= 0 ? "text-rose-600 font-bold" : "text-slate-800"}>
                            {p.warehouseStock || 0}
                          </span>
                        </TableCell>

                        <TableCell className="text-right text-xs text-slate-600 font-mono">
                          Rs. {fmt(p.basePrice || p.costPrice || p.wholesalePrice)}
                        </TableCell>

                        <TableCell className="text-center">
                          {p.isPublished ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                              🌐 Live on Website
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-slate-400">
                              Offline
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            className={cn(
                              "h-7 text-xs",
                              isSelected ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""
                            )}
                            onClick={() => toggleSelect(p.id)}
                          >
                            {isSelected ? (
                              <span className="flex items-center gap-1">
                                <Check className="w-3 h-3" /> Selected
                              </span>
                            ) : (
                              "Select"
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t mt-4 text-xs">
              <div className="text-slate-500">
                Page <span className="font-bold text-slate-900">{page}</span> of{" "}
                <span className="font-bold text-slate-900">{totalPages}</span> ({filteredProducts.length} total)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </Button>
                <div className="text-slate-600 font-mono text-xs px-2">
                  {page} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 text-xs gap-1"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Sticky Bottom Bar for Selection */}
      {selectedProductIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
              {selectedProductIds.size}
            </span>
            <span>products selected from catalog</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="text-xs text-slate-300 hover:text-white h-8"
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={proceedToStep2}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs h-8 gap-1.5 shadow-md"
            >
              Proceed to Step 2: Configure &amp; Publish
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
