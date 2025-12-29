"use client";

import React, { useState, useEffect, useCallback } from "react";
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
} from "@/app/dashboard/admin/products/types";

// Import LOCAL Orange Components
import { ProductStats } from "./_components/ProductStats";
import { ProductHeader } from "./_components/ProductHeader";
import { ProductFilters } from "./_components/ProductFilters";
import { ProductTable } from "./_components/ProductTable";
import { ProductDialogs } from "./_components/ProductDialogs";

export default function OrangeProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<
    { id: string; name: string; parent_id?: string }[]
  >([]);

  const [loading, setLoading] = useState(true);

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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form Data - Force Supplier to Orange Agency
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
    supplier: "Orange Agency", // Locked to Orange
    stock: "",
    minStock: "",
    mrp: "",
    sellingPrice: "",
    costPrice: "",
    images: [],
    unitOfMeasure: "Pcs",
    isActive: true,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [prodRes, catRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/settings/categories?type=category"),
      ]);

      if (prodRes.ok) {
        const allProducts: Product[] = await prodRes.json();
        // Strict Filter: Only Orange products
        const orangeOnly = allProducts.filter((p) =>
          p.supplier?.toLowerCase().includes("orange")
        );
        setProducts(orangeOnly);
      }
      if (catRes.ok) setCategories(await catRes.json());
    } catch (error) {
      toast.error("Failed to load product data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());

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

  useEffect(
    () => setCurrentPage(1),
    [searchQuery, categoryFilter, stockFilter]
  );

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
      name: "",
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
      />

      <ProductStats products={products} />

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
    </div>
  );
}
