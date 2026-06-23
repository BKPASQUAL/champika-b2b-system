"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

import { Product, SortField, SortOrder, ProductFormData } from "./types";
import { printPriceListReport } from "@/app/dashboard/admin/products/print-price-list";
import { ProductStats } from "./_components/ProductStats";
import { ProductHeader } from "./_components/ProductHeader";
import { ProductFilters } from "./_components/ProductFilters";
import { ProductTable } from "./_components/ProductTable";
import { ProductDialogs } from "./_components/ProductDialogs";
import { SelectionDiscountDialog } from "@/components/SelectionDiscountDialog";
import { useDiscountFeature } from "@/hooks/useDiscountFeature";

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

// Strip /, ., ,, - so "1/113", "1.113", "1,113" all normalize to "1113"
function normNum(s: string): string {
  return s.replace(/[/.,\-]/g, "");
}

// All match variants for one token (normalized + number-word conversions)
function tokenVariants(t: string): string[] {
  const vs = new Set<string>([t]);
  const n = normNum(t);
  if (n !== t) vs.add(n);
  if (NUMBER_WORDS[t]) vs.add(NUMBER_WORDS[t]);
  if (WORD_NUMBERS[t]) vs.add(WORD_NUMBERS[t]);
  Object.entries(NUMBER_WORDS).forEach(([num, word]) => {
    if (word.includes(t)) { vs.add(word); vs.add(num); }
    if (num.startsWith(t)) { vs.add(num); vs.add(word); }
  });
  return Array.from(vs);
}

// True if a token matches any field value
function tokenMatches(token: string, fields: string[]): boolean {
  const variants = tokenVariants(token);
  return fields.some((f) => {
    const fl = f.toLowerCase();
    const fn = normNum(fl);
    return variants.some((v) => fl.includes(v) || fn.includes(normNum(v)));
  });
}

// Relevance score for sorting (higher = better match)
function nameScore(name: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  const nl = name.toLowerCase();
  const nn = normNum(nl);
  const full = tokens.join(" ");
  const fullN = normNum(full);
  if (nl === full) return 100;
  if (nn === fullN) return 90;
  if (nl.startsWith(full)) return 80;
  if (nn.startsWith(fullN)) return 70;
  const hits = tokens.filter((t) => {
    const vs = tokenVariants(t);
    return vs.some((v) => nl.includes(v) || nn.includes(normNum(v)));
  }).length;
  return (hits / tokens.length) * 50;
}

export default function ProductsPage() {
  const { enabled: discountEnabled } = useDiscountFeature("distribution");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [showCost, setShowCost] = useState(false);

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // Dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Row selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState(false);

  // Form Data
  const [formData, setFormData] = useState<ProductFormData>({
    sku: "",
    companyCode: "",
    name: "",
    category: "",
    subCategory: "",
    brand: "",
    subBrand: "",
    modelType: "",
    subModel: "",
    sizeSpec: "",
    supplier: "",
    stock: "",
    minStock: "",
    mrp: "",
    sellingPrice: "",
    costPrice: "",
    images: [],
    unitOfMeasure: "Pcs",
    isActive: true,
  });

  const { data: products = [], loading: l1, refetch: refetchProducts } = useCachedFetch<Product[]>("/api/products", []);
  const { data: categories = [], loading: l2 } = useCachedFetch<{ id: string; name: string; parent_id?: string }[]>(
    "/api/settings/categories?type=category", []
  );
  const { data: rawSuppliers = [], loading: l3 } = useCachedFetch<any[]>("/api/suppliers", []);
  const { data: settingSuppliers = [], loading: l4 } = useCachedFetch<any[]>(
    "/api/settings/categories?type=supplier", []
  );

  const loading = l1 || l2 || l3 || l4;

  const FIXED_SUPPLIERS = [{ id: "orange-orel", name: "Orange (Orel Corporation)" }];

  const suppliers = useMemo(
    () =>
      [...FIXED_SUPPLIERS, ...rawSuppliers, ...settingSuppliers].filter(
        (v, i, a) => a.findIndex((t) => t.name === v.name) === i
      ),
    [rawSuppliers, settingSuppliers]
  );

  const fetchData = useCallback(() => {
    refetchProducts();
  }, [refetchProducts]);

  // Filter Logic — token-based AND matching with numeric normalization
  const searchTokens = useMemo(
    () => searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [searchQuery]
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesSearch =
          searchTokens.length === 0 ||
          searchTokens.every((token) =>
            tokenMatches(token, [
              product.name,
              product.category,
              product.sku,
              product.supplier,
              product.brand ?? "",
              product.subCategory ?? "",
              product.modelType ?? "",
              product.sizeSpec ?? "",
              product.companyCode ?? "",
            ])
          );

        const matchesCategory =
          categoryFilter === "all" || product.category === categoryFilter;
        const matchesSupplier =
          supplierFilter === "all" || product.supplier === supplierFilter;

        let matchesStock = true;
        if (stockFilter === "out-of-stock") matchesStock = product.stock === 0;
        else if (stockFilter === "low")
          matchesStock = product.stock > 0 && product.stock < product.minStock;
        else if (stockFilter === "in-stock")
          matchesStock = product.stock >= product.minStock;

        return matchesSearch && matchesCategory && matchesSupplier && matchesStock && !product.retailOnly;
      }),
    [products, searchTokens, categoryFilter, supplierFilter, stockFilter]
  );

  // Sort Logic — relevance first when searching, then field sort
  const sortedProducts = useMemo(
    () =>
      [...filteredProducts].sort((a, b) => {
        if (searchTokens.length > 0) {
          const diff = nameScore(b.name, searchTokens) - nameScore(a.name, searchTokens);
          if (diff !== 0) return diff;
        }

        let aValue: any = a[sortField];
        let bValue: any = b[sortField];
        if (aValue == null) aValue = "";
        if (bValue == null) bValue = "";
        if (typeof aValue === "string") aValue = aValue.toLowerCase();
        if (typeof bValue === "string") bValue = bValue.toLowerCase();
        if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
        return 0;
      }),
    [filteredProducts, searchTokens, sortField, sortOrder]
  );

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
    setSelectAllMode(false);
  }, [searchQuery, categoryFilter, supplierFilter, stockFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleSaveProduct = async () => {
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
    };

    try {
      let res;
      if (selectedProduct) {
        // UPDATE
        res = await fetch(`/api/products/${selectedProduct.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // CREATE
        res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      // ✅ Parse response to capture specific errors (e.g. Duplicate Name)
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Operation failed");
      }

      toast.success(
        selectedProduct
          ? "Product updated successfully"
          : "Product created successfully",
      );
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      // ✅ Display the specific error message from API
      toast.error(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      sku: "",
      companyCode: "",
      name: "",
      category: "",
      subCategory: "",
      brand: "",
      subBrand: "",
      modelType: "",
      subModel: "",
      sizeSpec: "",
      supplier: "",
      stock: "",
      minStock: "",
      mrp: "",
      sellingPrice: "",
      costPrice: "",
      images: [],
      unitOfMeasure: "Pcs",
      isActive: true,
    });
    setSelectedProduct(null);
  };

  const generateExcel = () => {
    if (sortedProducts.length === 0) {
      toast.error("No data to export");
      return;
    }
    const data = sortedProducts.map((p) => ({
      SKU: p.sku,
      "Company Code": p.companyCode || "-",
      Name: p.name,
      Category: p.category,
      Supplier: p.supplier,
      Stock: p.stock,
      Unit: p.unitOfMeasure,
      MRP: p.mrp,
      "Selling Price": p.sellingPrice,
      Status: p.isActive ? "Active" : "Inactive",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "products.xlsx");
  };

  const generatePDF = () => {
    if (sortedProducts.length === 0) {
      toast.error("No data to export");
      return;
    }
    const doc = new jsPDF();
    doc.text("Product Catalog", 14, 15);
    autoTable(doc, {
      head: [
        [
          "SKU",
          "Company Code",
          "Name",
          "Category",
          "Supplier",
          "Stock",
          "Price",
          "Status",
        ],
      ],
      body: sortedProducts.map((p) => [
        p.sku,
        p.companyCode || "-",
        p.name,
        p.category,
        p.supplier,
        p.stock,
        p.sellingPrice,
        p.isActive ? "Active" : "Inactive",
      ]),
      startY: 20,
    });
    doc.save("products.pdf");
  };

  return (
    <div className="space-y-6">
      <ProductHeader
        onAddClick={() => {
          resetForm();
          setIsAddDialogOpen(true);
        }}
        onExportExcel={generateExcel}
        onExportPDF={generatePDF}
        onPriceListReport={() => printPriceListReport(sortedProducts.filter((p) => p.isActive !== false))}
      />
      <ProductStats products={products} />

      {/* ── Selection Action Bar ── */}
      {discountEnabled && selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
          <span className="text-sm font-medium text-purple-800">
            {selectAllMode
              ? `All ${sortedProducts.length} products selected`
              : `${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""} selected`}
          </span>
          <div className="flex items-center gap-2">
            {!selectAllMode && selectedIds.size < sortedProducts.length && (
              <button
                className="text-xs text-purple-700 font-medium underline hover:text-purple-900"
                onClick={() => {
                  setSelectedIds(new Set(sortedProducts.map((p) => p.id)));
                  setSelectAllMode(true);
                }}
              >
                Select all {sortedProducts.length} products
              </button>
            )}
            <button
              className="text-xs text-purple-600 underline hover:text-purple-800"
              onClick={() => { setSelectedIds(new Set()); setSelectAllMode(false); }}
            >
              Clear selection
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
              onClick={() => setIsDiscountDialogOpen(true)}
            >
              Apply Discount
            </button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <ProductFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            supplierFilter={supplierFilter}
            setSupplierFilter={setSupplierFilter}
            stockFilter={stockFilter}
            setStockFilter={setStockFilter}
            categories={[
              "all",
              ...Array.from(new Set(categories.map((c) => c.name))),
            ]}
            suppliers={[
              "all",
              ...Array.from(new Set(suppliers.map((s) => s.name))),
            ]}
            showCost={showCost}
            onToggleCost={() => setShowCost((v) => !v)}
          />
        </CardHeader>
        <CardContent className="p-0">
          <ProductTable
            products={selectAllMode ? sortedProducts : paginatedProducts}
            loading={loading}
            showCost={showCost}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            selectedIds={discountEnabled ? selectedIds : new Set<string>()}
            onSelectionChange={(ids) => {
              setSelectedIds(ids);
              if (ids.size === 0) setSelectAllMode(false);
            }}
            showPagination={!selectAllMode}
            allFilteredCount={sortedProducts.length}
            onSelectAll={() => {
              setSelectedIds(new Set(sortedProducts.map((p) => p.id)));
              setSelectAllMode(true);
            }}
            onEdit={(p) => {
              setFormData({
                sku: p.sku,
                companyCode: p.companyCode || "",
                name: p.name,
                category: p.category,
                subCategory: p.subCategory || "",
                brand: p.brand || "",
                subBrand: p.subBrand || "",
                modelType: p.modelType || "",
                subModel: p.subModel || "",
                sizeSpec: p.sizeSpec || "",
                supplier: p.supplier,
                stock: p.stock,
                minStock: p.minStock,
                mrp: p.mrp,
                sellingPrice: p.sellingPrice,
                costPrice: p.costPrice,
                images: p.images || [],
                unitOfMeasure: p.unitOfMeasure || "Pcs",
                isActive: p.isActive ?? true,
              });
              setSelectedProduct(p);
              setIsAddDialogOpen(true);
            }}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      <ProductDialogs
        isAddDialogOpen={isAddDialogOpen}
        setIsAddDialogOpen={setIsAddDialogOpen}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSaveProduct}
        selectedProduct={selectedProduct}
        categories={categories}
        suppliers={suppliers}
      />

      <SelectionDiscountDialog
        open={isDiscountDialogOpen}
        onOpenChange={setIsDiscountDialogOpen}
        selectedIds={Array.from(selectedIds)}
        onSuccess={() => {
          setSelectedIds(new Set());
          setSelectAllMode(false);
          fetchData();
        }}
      />

    </div>
  );
}
