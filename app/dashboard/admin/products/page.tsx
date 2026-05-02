"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

import { Product, SortField, SortOrder, ProductFormData } from "./types";
import { printPriceListReport } from "./print-price-list";
import { ProductStats } from "./_components/ProductStats";
import { ProductHeader } from "./_components/ProductHeader";
import { ProductFilters } from "./_components/ProductFilters";
import { ProductTable } from "./_components/ProductTable";
import { ProductDialogs } from "./_components/ProductDialogs";

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

export default function ProductsPage() {
  const { data: products = [], loading: l1, refetch: refetchProducts } =
    useCachedFetch<Product[]>("/api/products", [], () =>
      toast.error("Failed to load product data")
    );
  const { data: categories = [], loading: l2, refetch: refetchCategories } =
    useCachedFetch<{ id: string; name: string; parent_id?: string }[]>(
      "/api/settings/categories?type=category",
      []
    );
  const { data: rawSuppliers = [], loading: l3, refetch: refetchSuppliers } =
    useCachedFetch<{ id: string; name: string }[]>("/api/suppliers", []);
  const { data: settingSuppliers = [], loading: l4, refetch: refetchSettingSuppliers } =
    useCachedFetch<{ id: string; name: string }[]>(
      "/api/settings/categories?type=supplier",
      []
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

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // Dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form Data
  const [formData, setFormData] = useState<ProductFormData>({
    sku: "",
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
    retailOnly: false,
    retailPrice: "",
    companyCode: "",
  });

  const fetchData = useCallback(() => {
    refetchProducts();
    refetchCategories();
    refetchSuppliers();
    refetchSettingSuppliers();
  }, [refetchProducts, refetchCategories, refetchSuppliers, refetchSettingSuppliers]);

  // --- Filter Logic ---
  const filteredProducts = products.filter((product) => {
    const searchTerms = getSearchTerms(searchQuery);
    const haystack = [
      product.name, product.category, product.sku, product.supplier,
      product.brand ?? "", product.subCategory ?? "",
      product.modelType ?? "", product.sizeSpec ?? "",
      product.companyCode ?? "",
    ].join(" ").toLowerCase();
    const matchesSearch =
      searchQuery.trim() === "" ||
      searchTerms.some((term) => haystack.includes(term));

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

    return matchesSearch && matchesCategory && matchesSupplier && matchesStock;
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

  useEffect(
    () => setCurrentPage(1),
    [searchQuery, categoryFilter, supplierFilter, stockFilter]
  );

  // --- Actions ---
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

    // Convert empty strings to 0 or appropriate numbers for the API
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
      if (selectedProduct) {
        // UPDATE
        const res = await fetch(`/api/products/${selectedProduct.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed update");
        }

        toast.success("Product updated successfully");
      } else {
        // CREATE
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed create");
        }

        toast.success("Product created successfully");
      }

      setIsAddDialogOpen(false);
      resetForm();
      fetchData(); // Refresh data
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
      retailOnly: false,
      retailPrice: "",
      companyCode: "",
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
      head: [["SKU", "Name", "Category", "Supplier", "Stock", "Unit", "Price"]],
      body: sortedProducts.map((p) => [
        p.sku,
        p.name,
        p.category,
        p.supplier,
        p.stock,
        p.unitOfMeasure,
        p.sellingPrice,
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
        onPriceListReport={() => printPriceListReport(sortedProducts)}
      />
      <ProductStats products={products} />

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
          />
        </CardHeader>
        <CardContent className="p-0">
          <ProductTable
            products={paginatedProducts}
            loading={loading}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            onEdit={(p) => {
              setFormData({
                sku: p.sku,
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
                isActive: p.isActive,
                retailOnly: p.retailOnly ?? false,
                retailPrice: p.retailPrice ?? "",
                companyCode: p.companyCode || "",
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
        suppliers={suppliers}
      />
    </div>
  );
}
