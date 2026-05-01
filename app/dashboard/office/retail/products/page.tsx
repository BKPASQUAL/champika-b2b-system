// app/dashboard/office/retail/products/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Filter, Package, ShoppingBag, Tag, AlertTriangle,
  ChevronLeft, ChevronRight, RefreshCw, ToggleLeft, ToggleRight,
  Plus, Edit, Eye, Trash2, DollarSign, Percent, Building2,
  ArrowUpDown, ArrowUp, ArrowDown, X, Save, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { Product, ProductFormData } from "@/app/dashboard/admin/products/types";
import { ProductDialogs } from "@/app/dashboard/admin/products/_components/ProductDialogs";

// ── Number-word search (same as other portals) ──────────────────────────────
const NUMBER_WORDS: Record<string, string> = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
  "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
  "10": "ten", "11": "eleven", "12": "twelve", "13": "thirteen",
  "14": "fourteen", "15": "fifteen", "16": "sixteen", "17": "seventeen",
  "18": "eighteen", "19": "nineteen", "20": "twenty", "24": "twenty four",
  "30": "thirty", "40": "forty", "50": "fifty", "100": "hundred",
};
const WORD_NUMBERS: Record<string, string> = Object.fromEntries(
  Object.entries(NUMBER_WORDS).map(([n, w]) => [w, n])
);
function getSearchTerms(query: string): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const terms = new Set<string>([q]);
  if (NUMBER_WORDS[q]) terms.add(NUMBER_WORDS[q]);
  if (WORD_NUMBERS[q]) terms.add(WORD_NUMBERS[q]);
  Object.entries(NUMBER_WORDS).forEach(([num, word]) => {
    if (word.includes(q)) { terms.add(word); terms.add(num); }
  });
  Object.entries(NUMBER_WORDS).forEach(([num, word]) => {
    if (num.startsWith(q)) { terms.add(num); terms.add(word); }
  });
  return Array.from(terms);
}

type SortField = "name" | "category" | "supplier" | "stock" | "sellingPrice" | "retailPrice" | "mrp";
type SortOrder = "asc" | "desc";
const ITEMS_PER_PAGE = 10;

const EMPTY_FORM: ProductFormData = {
  sku: "", name: "", category: "", subCategory: "", brand: "", subBrand: "",
  modelType: "", subModel: "", sizeSpec: "", supplier: "", stock: "",
  minStock: "", mrp: "", sellingPrice: "", costPrice: "", images: [],
  unitOfMeasure: "Pcs", isActive: true, retailOnly: true, retailPrice: "",
  companyCode: "",
};

export default function RetailProductCatalogPage() {
  const router = useRouter();

  // ── Data ────────────────────────────────────────────────────────────────
  const { data: products = [], loading: l1, refetch: refetchProducts } =
    useCachedFetch<Product[]>("/api/products", [], () =>
      toast.error("Failed to load products")
    );
  const { data: categories = [], refetch: refetchCategories } =
    useCachedFetch<{ id: string; name: string; parent_id?: string }[]>(
      "/api/settings/categories?type=category", []
    );
  const { data: rawSuppliers = [], refetch: refetchSuppliers } =
    useCachedFetch<{ id: string; name: string }[]>("/api/suppliers", []);
  const { data: settingSuppliers = [], refetch: refetchSettingSuppliers } =
    useCachedFetch<{ id: string; name: string }[]>(
      "/api/settings/categories?type=supplier", []
    );

  const suppliers = useMemo(
    () => [...rawSuppliers, ...settingSuppliers].filter(
      (v, i, a) => a.findIndex((t) => t.name === v.name) === i
    ),
    [rawSuppliers, settingSuppliers]
  );

  const fetchData = useCallback(() => {
    refetchProducts();
    refetchCategories();
    refetchSuppliers();
    refetchSettingSuppliers();
  }, [refetchProducts, refetchCategories, refetchSuppliers, refetchSettingSuppliers]);

  // ── View toggle & filters ────────────────────────────────────────────────
  const [retailOnlyView, setRetailOnlyView] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // ── Sorting & pagination ─────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);

  // ── Add / Edit dialog ────────────────────────────────────────────────────
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(EMPTY_FORM);

  // ── Quick retail price dialog ─────────────────────────────────────────────
  const [priceDialogProduct, setPriceDialogProduct] = useState<Product | null>(null);
  const [newRetailPrice, setNewRetailPrice] = useState<string>("");
  const [savingPrice, setSavingPrice] = useState(false);

  // ── Lightbox ─────────────────────────────────────────────────────────────
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // ── Category list for filter dropdown ───────────────────────────────────
  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category))).filter(Boolean).sort();
    return ["all", ...cats];
  }, [products]);

  // ── Filter & sort ────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (retailOnlyView && !product.retailOnly) return false;

      const searchTerms = getSearchTerms(searchQuery);
      const haystack = [
        product.name, product.category, product.sku, product.supplier,
        product.brand ?? "", product.subCategory ?? "",
      ].join(" ").toLowerCase();
      const matchesSearch =
        searchQuery.trim() === "" ||
        searchTerms.some((t) => haystack.includes(t));

      const matchesCategory =
        categoryFilter === "all" || product.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [products, retailOnlyView, searchQuery, categoryFilter]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      let av: any = a[sortField as keyof Product];
      let bv: any = b[sortField as keyof Product];
      if (av === null || av === undefined) av = "";
      if (bv === null || bv === undefined) bv = "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortOrder === "asc" ? -1 : 1;
      if (av > bv) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => setCurrentPage(1), [searchQuery, categoryFilter, retailOnlyView]);

  // ── Sort helper ──────────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortOrder("asc"); }
  };
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40" />;
    return sortOrder === "asc"
      ? <ArrowUp className="w-3.5 h-3.5 ml-1" />
      : <ArrowDown className="w-3.5 h-3.5 ml-1" />;
  };

  // ── Form helpers ─────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setSelectedProduct(null);
  };

  const handleEdit = (p: Product) => {
    setFormData({
      sku: p.sku, name: p.name, category: p.category,
      subCategory: p.subCategory || "", brand: p.brand || "",
      subBrand: p.subBrand || "", modelType: p.modelType || "",
      subModel: p.subModel || "", sizeSpec: p.sizeSpec || "",
      supplier: p.supplier, stock: p.stock, minStock: p.minStock,
      mrp: p.mrp, sellingPrice: p.sellingPrice, costPrice: p.costPrice,
      images: p.images || [], unitOfMeasure: p.unitOfMeasure || "Pcs",
      isActive: p.isActive, retailOnly: p.retailOnly ?? false,
      retailPrice: p.retailPrice ?? "", companyCode: p.companyCode || "",
    });
    setSelectedProduct(p);
    setIsAddDialogOpen(true);
  };

  // ── Save product ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formData.name || !formData.category || !formData.supplier) {
      toast.error("Please fill required fields (Name, Category, Supplier)");
      return;
    }
    const payload = {
      ...formData,
      stock: Number(formData.stock) || 0,
      minStock: Number(formData.minStock) || 0,
      mrp: Number(formData.mrp) || 0,
      sellingPrice: Number(formData.sellingPrice) || 0,
      costPrice: Number(formData.costPrice) || 0,
      retailPrice: formData.retailPrice !== "" ? Number(formData.retailPrice) : null,
      companyCode: formData.companyCode || "",
    };
    try {
      const url = selectedProduct ? `/api/products/${selectedProduct.id}` : "/api/products";
      const method = selectedProduct ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(selectedProduct ? "Product updated" : "Product created");
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    }
  };

  // ── Delete product ───────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!selectedProduct) return;
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Product deleted");
      setIsDeleteDialogOpen(false);
      setSelectedProduct(null);
      fetchData();
    } catch {
      toast.error("Delete failed");
    }
  };

  // ── Quick retail price save ──────────────────────────────────────────────
  const handleSaveRetailPrice = async () => {
    if (!priceDialogProduct) return;
    setSavingPrice(true);
    try {
      const price = newRetailPrice !== "" ? Number(newRetailPrice) : null;
      const res = await fetch(`/api/products/${priceDialogProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retailPrice: price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Retail price updated");
      setPriceDialogProduct(null);
      setNewRetailPrice("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update price");
    } finally {
      setSavingPrice(false);
    }
  };

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalRetailOnly = products.filter((p) => p.retailOnly).length;
  const withRetailPrice = products.filter((p) => p.retailOnly && p.retailPrice).length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Catalog</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {retailOnlyView ? "Retail-exclusive products" : "All available products"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={l1}>
            <RefreshCw className={`w-4 h-4 mr-2 ${l1 ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
            onClick={() => { resetForm(); setIsAddDialogOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="border-purple-200 bg-purple-50/40">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Retail Only</p>
                <p className="text-xl font-bold text-purple-700">{totalRetailOnly}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">All Products</p>
                <p className="text-xl font-bold">{products.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">With Retail Price</p>
                <p className="text-xl font-bold text-green-700">{withRetailPrice}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Table Card ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            {/* Search + Category */}
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c === "all" ? "All Categories" : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Retail Only Toggle */}
            <button
              onClick={() => setRetailOnlyView(!retailOnlyView)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all whitespace-nowrap ${
                retailOnlyView
                  ? "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                  : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {retailOnlyView
                ? <ToggleRight className="w-5 h-5 text-purple-600" />
                : <ToggleLeft className="w-5 h-5" />}
              {retailOnlyView ? "Retail Only" : "All Products"}
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* ── Desktop Table ── */}
          <div className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      Product Name <SortIcon field="name" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("category")}
                  >
                    <div className="flex items-center">
                      Category <SortIcon field="category" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("supplier")}
                  >
                    <div className="flex items-center">
                      Supplier <SortIcon field="supplier" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("sellingPrice")}
                  >
                    <div className="flex items-center justify-end">
                      Selling Price <SortIcon field="sellingPrice" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("retailPrice")}
                  >
                    <div className="flex items-center justify-end">
                      Retail Price <SortIcon field="retailPrice" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("mrp")}
                  >
                    <div className="flex items-center justify-end">
                      MRP <SortIcon field="mrp" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("stock")}
                  >
                    <div className="flex items-center justify-end">
                      Stock <SortIcon field="stock" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {l1 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading products...
                    </TableCell>
                  </TableRow>
                ) : paginatedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      {retailOnlyView
                        ? 'No retail-only products. Mark products as "Retail Only" in admin or add one here.'
                        : "No products found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProducts.map((product) => (
                    <TableRow key={product.id}>
                      {/* Image */}
                      <TableCell className="w-12 px-3 py-2">
                        {product.images?.[0] ? (
                          <button onClick={() => setLightboxImage(product.images[0])}>
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

                      {/* Name */}
                      <TableCell className="font-medium">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{product.name}</span>
                          {product.retailOnly && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">
                              <ShoppingBag className="w-2.5 h-2.5 mr-0.5" /> Retail
                            </span>
                          )}
                          {!product.isActive && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                              Inactive
                            </span>
                          )}
                          {product.stock === 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Out
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{product.sku}</p>
                      </TableCell>

                      {/* Category */}
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          <Tag className="w-3 h-3 mr-1" /> {product.category}
                        </span>
                      </TableCell>

                      {/* Supplier */}
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <Building2 className="w-3 h-3 mr-1" /> {product.supplier}
                        </span>
                      </TableCell>

                      {/* Selling Price */}
                      <TableCell className="text-right text-green-600 font-medium">
                        LKR {product.sellingPrice.toLocaleString()}
                      </TableCell>

                      {/* Retail Price */}
                      <TableCell className="text-right">
                        {product.retailPrice ? (
                          <span className="text-purple-700 font-semibold">
                            LKR {Number(product.retailPrice).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>

                      {/* MRP */}
                      <TableCell className="text-right text-muted-foreground">
                        {product.mrp > 0 ? `LKR ${product.mrp.toLocaleString()}` : "—"}
                      </TableCell>

                      {/* Stock */}
                      <TableCell className="text-right">
                        <span className={
                          product.stock === 0 ? "text-red-600 font-bold" :
                          product.stock < product.minStock ? "text-destructive font-medium" : ""
                        }>
                          {product.stock} {product.unitOfMeasure}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Change Retail Price */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Change Retail Price"
                            className="text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                            onClick={() => {
                              setPriceDialogProduct(product);
                              setNewRetailPrice(product.retailPrice ? String(product.retailPrice) : "");
                            }}
                          >
                            <DollarSign className="w-4 h-4" />
                          </Button>
                          {/* View */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="View details"
                            onClick={() => router.push(`/dashboard/admin/products/${product.id}`)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {/* Edit */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Edit product"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete product"
                            onClick={() => { setSelectedProduct(product); setIsDeleteDialogOpen(true); }}
                          >
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

          {/* ── Mobile Cards ── */}
          <div className="lg:hidden">
            {l1 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading...
              </div>
            ) : paginatedProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground px-4">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                {retailOnlyView ? "No retail-only products found." : "No products found."}
              </div>
            ) : (
              <div className="divide-y">
                {paginatedProducts.map((product) => (
                  <div key={product.id} className="p-4 flex gap-3">
                    {/* Image */}
                    <div className="shrink-0">
                      {product.images?.[0] ? (
                        <button onClick={() => setLightboxImage(product.images[0])}>
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-16 h-16 rounded-lg object-cover border border-border"
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
                      <div className="flex flex-wrap items-start gap-1.5 mb-0.5">
                        <span className="font-semibold text-sm">{product.name}</span>
                        {product.retailOnly && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">
                            <ShoppingBag className="w-2.5 h-2.5 mr-0.5" /> Retail
                          </span>
                        )}
                        {product.stock === 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                            <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Out
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono mb-2">{product.sku}</p>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
                          <Tag className="w-2.5 h-2.5 mr-1" /> {product.category}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700">
                          <Building2 className="w-2.5 h-2.5 mr-1" /> {product.supplier}
                        </span>
                      </div>

                      {/* Price grid */}
                      <div className="grid grid-cols-3 gap-1 mb-2 text-xs">
                        <div className="bg-muted/50 rounded p-1.5 text-center">
                          <div className="text-muted-foreground text-[10px] mb-0.5">Selling</div>
                          <div className="text-green-600 font-medium">LKR {product.sellingPrice.toLocaleString()}</div>
                        </div>
                        <div className="bg-purple-50 rounded p-1.5 text-center">
                          <div className="text-muted-foreground text-[10px] mb-0.5">Retail</div>
                          <div className="text-purple-700 font-semibold">
                            {product.retailPrice ? `LKR ${Number(product.retailPrice).toLocaleString()}` : "—"}
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded p-1.5 text-center">
                          <div className="text-muted-foreground text-[10px] mb-0.5">Stock</div>
                          <div className={`font-medium ${product.stock === 0 ? "text-red-600" : ""}`}>
                            {product.stock} {product.unitOfMeasure}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                          onClick={() => {
                            setPriceDialogProduct(product);
                            setNewRetailPrice(product.retailPrice ? String(product.retailPrice) : "");
                          }}
                        >
                          <DollarSign className="w-3 h-3 mr-1" /> Retail Price
                        </Button>
                        <Button variant="ghost" size="icon-sm"
                          onClick={() => router.push(`/dashboard/admin/products/${product.id}`)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(product)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm"
                          onClick={() => { setSelectedProduct(product); setIsDeleteDialogOpen(true); }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Pagination ── */}
          {!l1 && sortedProducts.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                {sortedProducts.length} product{sortedProducts.length !== 1 ? "s" : ""}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm">{currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add / Edit Dialog (reuses admin component) ── */}
      <ProductDialogs
        isAddDialogOpen={isAddDialogOpen}
        setIsAddDialogOpen={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSave}
        selectedProduct={selectedProduct}
        isDeleteDialogOpen={isDeleteDialogOpen}
        setIsDeleteDialogOpen={setIsDeleteDialogOpen}
        onDeleteConfirm={handleDeleteConfirm}
        suppliers={suppliers}
        categories={categories}
      />

      {/* ── Quick Retail Price Dialog ── */}
      <Dialog
        open={!!priceDialogProduct}
        onOpenChange={(open) => {
          if (!open) { setPriceDialogProduct(null); setNewRetailPrice(""); }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <DollarSign className="w-5 h-5" />
              Change Retail Price
            </DialogTitle>
            <DialogDescription>
              {priceDialogProduct?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">Selling Price</p>
                <p className="font-medium text-green-600">
                  LKR {priceDialogProduct?.sellingPrice.toLocaleString()}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">MRP</p>
                <p className="font-medium">
                  {priceDialogProduct?.mrp ? `LKR ${priceDialogProduct.mrp.toLocaleString()}` : "—"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-purple-700">New Retail Price (LKR)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newRetailPrice}
                onChange={(e) => setNewRetailPrice(e.target.value)}
                placeholder="e.g. 350.00"
                className="border-purple-200 focus-visible:ring-purple-400"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to remove the retail price (will use selling price instead).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setPriceDialogProduct(null); setNewRetailPrice(""); }}
              disabled={savingPrice}
            >
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleSaveRetailPrice}
              disabled={savingPrice}
            >
              {savingPrice ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Product?</DialogTitle>
            <DialogDescription>
              <strong>{selectedProduct?.name}</strong> will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Image Lightbox ── */}
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
    </div>
  );
}
