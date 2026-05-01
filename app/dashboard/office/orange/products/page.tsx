"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

// Import Types
import {
  Product,
  SortField,
  SortOrder,
  ProductFormData,
} from "./types";
import { printPriceListReport } from "@/app/dashboard/admin/products/print-price-list";

// Import LOCAL Orange Components
import { ProductStats } from "./_components/ProductStats";
import { ProductHeader } from "./_components/ProductHeader";
import { ProductFilters } from "./_components/ProductFilters";
import { ProductTable } from "./_components/ProductTable";
import { ProductDialogs } from "./_components/ProductDialogs";
import { SelectionDiscountDialog } from "@/components/SelectionDiscountDialog";
import { useDiscountFeature } from "@/hooks/useDiscountFeature";

// Number ↔ word cross-search: builds all search terms from a query
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

  // Exact number → add its word ("12" → "twelve")
  if (NUMBER_WORDS[q]) terms.add(NUMBER_WORDS[q]);
  // Exact word → add its number ("twelve" → "12")
  if (WORD_NUMBERS[q]) terms.add(WORD_NUMBERS[q]);

  // Partial match: find all word-forms that contain the query as substring
  // e.g. "thir" → matches "thirteen","thirty","thirty four" → also adds "13","30","24"
  Object.entries(NUMBER_WORDS).forEach(([num, word]) => {
    if (word.includes(q)) {
      terms.add(word); // the full word form
      terms.add(num);  // the number
    }
  });

  // Partial match: query is partial number → match any word whose number starts with it
  // e.g. "1" → matches "10","11","12"... words too
  Object.entries(NUMBER_WORDS).forEach(([num, word]) => {
    if (num.startsWith(q)) {
      terms.add(num);
      terms.add(word);
    }
  });

  return Array.from(terms);
}

export default function OrangeProductsPage() {
  const { enabled: discountEnabled } = useDiscountFeature("orange");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // Dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Row selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState(false);

  // Form Data - Force Supplier to Orange Agency
  const [formData, setFormData] = useState<ProductFormData>({
    sku: "",
    companyCode: "",
    name: "Orange ",
    category: "",
    subCategory: "",
    brand: "",
    subBrand: "",
    modelType: "",
    subModel: "",
    sizeSpec: "",
    supplier: "Orange Agency",
    stock: "",
    minStock: "",
    mrp: "",
    sellingPrice: "",
    costPrice: "",
    images: [],
    unitOfMeasure: "Pcs",
    isActive: true,
  });

  const { data: allProductsRaw = [], loading: l1, refetch: refetchProducts } = useCachedFetch<Product[]>("/api/products", []);
  const { data: categories = [], loading: l2 } = useCachedFetch<{ id: string; name: string; parent_id?: string }[]>(
    "/api/settings/categories?type=category", []
  );

  const loading = l1 || l2;

  const products = useMemo(
    () => allProductsRaw.filter((p) => p.supplier?.toLowerCase().includes("orange") && !p.retailOnly),
    [allProductsRaw]
  );

  const fetchData = useCallback(() => {
    refetchProducts();
  }, [refetchProducts]);

  const filteredProducts = products.filter((product) => {
    const searchTerms = getSearchTerms(searchQuery);
    const haystack = [
      product.name,
      product.category,
      product.sku,
      product.brand ?? "",
      product.subCategory ?? "",
      product.modelType ?? "",
      product.sizeSpec ?? "",
      product.companyCode ?? "",
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch =
      searchQuery.trim() === "" ||
      searchTerms.some((term) => haystack.includes(term));

    const matchesCategory =
      categoryFilter === "all" || product.category === categoryFilter;

    let matchesStock = true;
    if (stockFilter === "out-of-stock") matchesStock = product.stock === 0;
    else if (stockFilter === "low")
      matchesStock = product.stock > 0 && product.stock < product.minStock;
    else if (stockFilter === "in-stock")
      matchesStock = product.stock >= product.minStock;

    return matchesSearch && matchesCategory && matchesStock;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];
    if (typeof aValue === "string") {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
    setSelectAllMode(false);
  }, [searchQuery, categoryFilter, stockFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleSaveProduct = async () => {
    if (!formData.name || !formData.category) {
      toast.error("Please fill required fields (Name, Category)");
      return;
    }

    const payload = {
      ...formData,
      supplier: "Orange Agency", // Ensure it's always Orange
      stock: Number(formData.stock) || 0,
      minStock: Number(formData.minStock) || 0,
      mrp: Number(formData.mrp) || 0,
      sellingPrice: Number(formData.sellingPrice) || 0,
      costPrice: Number(formData.costPrice) || 0,
    };

    try {
      if (selectedProduct) {
        const res = await fetch(`/api/products/${selectedProduct.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed update");
        toast.success("Product updated");
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed create");
        toast.success("Product created");
      }
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Operation failed");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProduct) return;
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed delete");
      toast.success("Product deleted");
      setIsDeleteDialogOpen(false);
      setSelectedProduct(null);
      fetchData();
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  const resetForm = () => {
    setFormData({
      sku: "",
      companyCode: "",
      name: "Orange ",
      category: "",
      subCategory: "",
      brand: "",
      subBrand: "",
      modelType: "",
      subModel: "",
      sizeSpec: "",
      supplier: "Orange Agency",
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
      toast.error("No data");
      return;
    }
    const data = sortedProducts.map((p) => ({
      SKU: p.sku,
      Name: p.name,
      Category: p.category,
      Stock: p.stock,
      Price: p.sellingPrice,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orange_Products");
    XLSX.writeFile(wb, "orange_inventory.xlsx");
  };

  const generatePDF = () => {
    if (sortedProducts.length === 0) {
      toast.error("No data");
      return;
    }
    const doc = new jsPDF();
    doc.text("Orange Agency Inventory", 14, 15);
    autoTable(doc, {
      head: [["SKU", "Name", "Category", "Stock", "Price"]],
      body: sortedProducts.map((p) => [
        p.sku,
        p.name,
        p.category,
        p.stock,
        p.sellingPrice,
      ]),
      startY: 20,
    });
    doc.save("orange_inventory.pdf");
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
        onPriceListReport={() => printPriceListReport(sortedProducts)}
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

      <Card className="border-orange-100">
        <CardHeader>
          <ProductFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            stockFilter={stockFilter}
            setStockFilter={setStockFilter}
            categories={[
              "all",
              ...Array.from(new Set(categories.map((c) => c.name))),
            ]}
          />
        </CardHeader>
        <CardContent className="p-0">
          <ProductTable
            products={selectAllMode ? sortedProducts : paginatedProducts}
            loading={loading}
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
                supplier: "Orange Agency",
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
            onDelete={(p) => {
              setSelectedProduct(p);
              setIsDeleteDialogOpen(true);
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
        isDeleteDialogOpen={isDeleteDialogOpen}
        setIsDeleteDialogOpen={setIsDeleteDialogOpen}
        onDeleteConfirm={handleDeleteConfirm}
        categories={categories}
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
