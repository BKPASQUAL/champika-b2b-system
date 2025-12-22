// app/dashboard/admin/products/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

import { Product, SortField, SortOrder, ProductFormData } from "./types";
import { ProductStats } from "./_components/ProductStats";
import { ProductHeader } from "./_components/ProductHeader";
import { ProductFilters } from "./_components/ProductFilters";
import { ProductTable } from "./_components/ProductTable";
import { ProductDialogs } from "./_components/ProductDialogs";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  const [categories, setCategories] = useState<
    { id: string; name: string; parent_id?: string }[]
  >([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>(
    []
  );
  const [loading, setLoading] = useState(true);

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
    isActive: true, // Default active
  });

  // --- Fetch Data ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, supRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/settings/categories?type=category"),
        fetch("/api/suppliers"),
      ]);

      if (prodRes.ok) setProducts(await prodRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
    } catch (error) {
      toast.error("Failed to load product data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Filter Logic ---
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());

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
      isActive: true, // Reset to active
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
      head: [
        [
          "SKU",
          "Name",
          "Category",
          "Supplier",
          "Stock",
          "Unit",
          "Price",
          "Status",
        ],
      ],
      body: sortedProducts.map((p) => [
        p.sku,
        p.name,
        p.category,
        p.supplier,
        p.stock,
        p.unitOfMeasure,
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
                isActive: p.isActive ?? true, // Load active status
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
    </div>
  );
}
