// app/dashboard/admin/products/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { Product, SortField, SortOrder, ProductFormData } from "./types";
import { ProductStats } from "./_components/ProductStats";
import { ProductHeader } from "./_components/ProductHeader";
import { ProductFilters } from "./_components/ProductFilters";
import { ProductTable } from "./_components/ProductTable";
import { ProductDialogs } from "./_components/ProductDialogs";

// Mock Data
const initialMockProducts: Product[] = [
  {
    id: "PROD-001",
    sku: "SKU-829102",
    name: "Holcim Cement 50kg",
    category: "Construction",
    supplier: "Lanka Builders Pvt Ltd",
    stock: 150,
    minStock: 50,
    mrp: 2800,
    sellingPrice: 2750,
    costPrice: 2600,
    discountPercent: 1.79,
    totalValue: 412500,
    totalCost: 390000,
    profitMargin: 5.77,
  },
  {
    id: "PROD-002",
    sku: "SKU-192834",
    name: "Dulux Weather Shield 10L",
    category: "Paints",
    supplier: "Global Paints & Coatings",
    stock: 25,
    minStock: 30,
    mrp: 18500,
    sellingPrice: 18500,
    costPrice: 16000,
    discountPercent: 0,
    totalValue: 462500,
    totalCost: 400000,
    profitMargin: 15.63,
  },
  {
    id: "PROD-003",
    sku: "SKU-773812",
    name: "Orange Electric Switch Socket",
    category: "Electrical",
    supplier: "Ruhuna Hardware Suppliers",
    stock: 500,
    minStock: 100,
    mrp: 450,
    sellingPrice: 420,
    costPrice: 350,
    discountPercent: 6.67,
    totalValue: 210000,
    totalCost: 175000,
    profitMargin: 20.0,
  },
  {
    id: "PROD-004",
    sku: "SKU-992101",
    name: "PVC Pipe 4 inch (Type 600)",
    category: "Plumbing",
    supplier: "S-Lon Lanka",
    stock: 0,
    minStock: 40,
    mrp: 1200,
    sellingPrice: 1200,
    costPrice: 950,
    discountPercent: 0,
    totalValue: 0,
    totalCost: 0,
    profitMargin: 26.32,
  },
  {
    id: "PROD-005",
    sku: "SKU-332190",
    name: "Roofing Sheet (Asbestos) 8ft",
    category: "Roofing",
    supplier: "Colombo Cement Corp",
    stock: 85,
    minStock: 100,
    mrp: 3200,
    sellingPrice: 3100,
    costPrice: 2800,
    discountPercent: 3.13,
    totalValue: 263500,
    totalCost: 238000,
    profitMargin: 10.71,
  },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(initialMockProducts);
  const [loading, setLoading] = useState(false);

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
    name: "",
    category: "",
    supplier: "",
    stock: 0,
    minStock: 0,
    mrp: 0,
    sellingPrice: 0,
    costPrice: 0,
  });

  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // --- Logic ---
  const categories = ["all", ...new Set(products.map((p) => p.category))];
  const suppliers = ["all", ...new Set(products.map((p) => p.supplier))];

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.supplier.toLowerCase().includes(searchQuery.toLowerCase());
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

  const handleSaveProduct = () => {
    if (
      !formData.name ||
      !formData.category ||
      !formData.supplier ||
      formData.mrp <= 0
    ) {
      alert("Please fill required fields and ensure positive values.");
      return;
    }

    const finalSP =
      formData.sellingPrice > 0 ? formData.sellingPrice : formData.mrp;
    const totalVal = formData.stock * finalSP;
    const totalCst = formData.stock * formData.costPrice;

    if (selectedProduct) {
      setProducts(
        products.map((p) =>
          p.id === selectedProduct.id
            ? {
                ...p,
                ...formData,
                sellingPrice: finalSP,
                totalValue: totalVal,
                totalCost: totalCst,
              }
            : p
        )
      );
      setSuccessMessage("Product updated!");
    } else {
      setProducts([
        {
          id: `PROD-${Date.now()}`,
          sku: `SKU-${Date.now().toString().slice(-6)}`,
          ...formData,
          sellingPrice: finalSP,
          totalValue: totalVal,
          totalCost: totalCst,
          discountPercent: 0,
          profitMargin: 0,
        },
        ...products,
      ]);
      setSuccessMessage("Product added!");
    }
    setShowSuccessAlert(true);
    setIsAddDialogOpen(false);
    resetForm();
    setTimeout(() => setShowSuccessAlert(false), 3000);
  };

  const handleDeleteConfirm = () => {
    if (!selectedProduct) return;
    setProducts(products.filter((p) => p.id !== selectedProduct.id));
    setSuccessMessage("Product deleted!");
    setShowSuccessAlert(true);
    setIsDeleteDialogOpen(false);
    setSelectedProduct(null);
    setTimeout(() => setShowSuccessAlert(false), 3000);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      supplier: "",
      stock: 0,
      minStock: 0,
      mrp: 0,
      sellingPrice: 0,
      costPrice: 0,
    });
    setSelectedProduct(null);
  };

  const generateExcel = () => console.log("Export Excel");
  const generatePDF = () => console.log("Export PDF");

  return (
    <div className="space-y-6">
      {showSuccessAlert && (
        <div className="fixed top-4 right-4 z-50 w-96 animate-in slide-in-from-right">
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success!</AlertTitle>
            <AlertDescription className="text-green-700">
              {successMessage}
            </AlertDescription>
            <button
              onClick={() => setShowSuccessAlert(false)}
              className="absolute top-2 right-2 p-1 hover:bg-green-100 rounded"
            >
              <X className="h-4 w-4 text-green-600" />
            </button>
          </Alert>
        </div>
      )}

      <ProductHeader
        onAddClick={() => {
          resetForm();
          setIsAddDialogOpen(true);
        }}
        onExportExcel={generateExcel}
        onExportPDF={generatePDF}
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
            categories={categories}
            suppliers={suppliers}
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
              setFormData(p);
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
      />
    </div>
  );
}
