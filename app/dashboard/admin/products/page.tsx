"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  Package,
  Loader2,
  DollarSign,
  CheckCircle2,
  X,
  FileSpreadsheet,
  FileText,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Import export libraries
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// --- Product Interface ---
interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  supplier: string;
  stock: number;
  minStock: number;
  mrp: number;
  sellingPrice: number;
  costPrice: number;
  discountPercent: number;
  totalValue: number;
  totalCost: number;
  profitMargin: number;
}

type SortField =
  | "name"
  | "category"
  | "supplier"
  | "stock"
  | "costPrice"
  | "sellingPrice"
  | "mrp"
  | "totalCost";
type SortOrder = "asc" | "desc";

export default function ChampikaBB2ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
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

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // -----------------------------------------------------------
  // 1. Data Fetching
  // -----------------------------------------------------------
  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Replace with your API endpoint
      const response = await fetch("/api/products");
      const data = await response.json();

      if (response.ok && data.products) {
        setProducts(data.products);
      } else {
        console.error("Failed to fetch products:", data.error);
        setProducts([]);
      }
    } catch (error) {
      console.error("Network error fetching products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // -----------------------------------------------------------
  // 2. CRUD Handlers
  // -----------------------------------------------------------

  const handleAddProduct = async () => {
    if (
      !formData.name ||
      !formData.category ||
      !formData.supplier ||
      formData.mrp <= 0 ||
      isNaN(formData.mrp)
    ) {
      alert(
        "Please fill all required fields: Name, Category, Supplier, and MRP (must be positive)."
      );
      return;
    }

    const finalSellingPrice =
      formData.sellingPrice > 0 ? formData.sellingPrice : formData.mrp;

    const payload = {
      name: formData.name,
      category: formData.category,
      supplier: formData.supplier,
      unit_price: finalSellingPrice,
      selling_price: finalSellingPrice,
      cost_price: formData.costPrice,
      stock_quantity: formData.stock,
      reorder_level: formData.minStock,
      is_active: true,
      mrp: formData.mrp,
    };

    try {
      let response;
      if (selectedProduct) {
        response = await fetch(`/api/products/${selectedProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error("Failed to update product");
        setSuccessMessage(`Product "${formData.name}" updated successfully!`);
      } else {
        const insertPayload = {
          ...payload,
          sku: `SKU-${Date.now().toString().slice(-6)}`,
        };

        response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(insertPayload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("API Error Response:", errorData);
          throw new Error(errorData.error || "Failed to add new product");
        }
        setSuccessMessage(`Product "${formData.name}" added successfully!`);
      }

      setShowSuccessAlert(true);
      setTimeout(() => {
        setShowSuccessAlert(false);
      }, 3000);

      await fetchProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      alert(`Error saving product: ${(error as Error).message}`);
    }

    setIsAddDialogOpen(false);
    setSelectedProduct(null);
    resetForm();
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    try {
      const response = await fetch(`/api/products/${selectedProduct.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete product");

      setSuccessMessage(
        `Product "${selectedProduct.name}" deleted successfully!`
      );
      setShowSuccessAlert(true);
      setTimeout(() => {
        setShowSuccessAlert(false);
      }, 3000);

      await fetchProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      alert(`Error deleting product. See console for details.`);
    }

    setIsDeleteDialogOpen(false);
    setSelectedProduct(null);
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
  };

  const openEditDialog = (product: Product) => {
    setFormData({
      name: product.name,
      category: product.category,
      supplier: product.supplier,
      stock: product.stock,
      minStock: product.minStock,
      mrp: product.mrp,
      sellingPrice: product.sellingPrice,
      costPrice: product.costPrice,
    });
    setSelectedProduct(product);
    setIsAddDialogOpen(true);
  };

  // -----------------------------------------------------------
  // 3. Sorting Handlers
  // -----------------------------------------------------------

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-4 h-4 ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1" />
    );
  };

  // -----------------------------------------------------------
  // 4. Filtering and Sorting
  // -----------------------------------------------------------

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
    if (stockFilter === "out-of-stock") {
      matchesStock = product.stock === 0;
    } else if (stockFilter === "low") {
      matchesStock = product.stock > 0 && product.stock < product.minStock;
    } else if (stockFilter === "in-stock") {
      matchesStock = product.stock > 0 && product.stock >= product.minStock;
    }

    return matchesSearch && matchesCategory && matchesSupplier && matchesStock;
  });

  // Apply sorting
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

  const categories = ["all", ...new Set(products.map((p) => p.category))];
  const suppliers = ["all", ...new Set(products.map((p) => p.supplier))];

  const totalProducts = products.length;
  const totalStockValue = products.reduce((sum, p) => sum + p.totalValue, 0);
  const totalCostValue = products.reduce((sum, p) => sum + p.totalCost, 0);
  const lowStockProducts = products.filter(
    (p) => p.stock > 0 && p.stock < p.minStock
  ).length;
  const outOfStockProducts = products.filter((p) => p.stock === 0).length;

  // Pagination calculations
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageProducts = sortedProducts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    categoryFilter,
    supplierFilter,
    stockFilter,
    sortField,
    sortOrder,
  ]);

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // -----------------------------------------------------------
  // 5. Report Generation Functions
  // -----------------------------------------------------------

  const generateExcelReport = () => {
    if (sortedProducts.length === 0) {
      alert("No products to export. Please adjust your filters.");
      return;
    }

    const excelData = sortedProducts.map((product) => ({
      SKU: product.sku,
      "Product Name": product.name,
      Category: product.category,
      Supplier: product.supplier,
      "Stock (units)": product.stock,
      "Min Stock": product.minStock,
      "Cost Price (LKR)": product.costPrice,
      "Selling Price (LKR)": product.sellingPrice,
      "MRP (LKR)": product.mrp,
      "Total Cost (LKR)": product.totalCost,
      "Total Value (LKR)": product.totalValue,
    }));

    const totalStockAll = sortedProducts.reduce((sum, p) => sum + p.stock, 0);
    const totalCostAll = sortedProducts.reduce(
      (sum, p) => sum + p.totalCost,
      0
    );
    const totalValueAll = sortedProducts.reduce(
      (sum, p) => sum + p.totalValue,
      0
    );

    excelData.push({
      SKU: "",
      "Product Name": "TOTAL",
      Category: "",
      Supplier: "",
      "Stock (units)": totalStockAll,
      "Min Stock": "",
      "Cost Price (LKR)": "",
      "Selling Price (LKR)": "",
      "MRP (LKR)": "",
      "Total Cost (LKR)": totalCostAll,
      "Total Value (LKR)": totalValueAll,
    } as any);

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products Report");

    const maxWidth = excelData.reduce((w: any, r: any) => {
      return Object.keys(r).map((k, i) => {
        const currentWidth = w[i] || 10;
        const cellValue = String(r[k] || "");
        return Math.max(currentWidth, cellValue.length + 2);
      });
    }, []);

    ws["!cols"] = maxWidth.map((w: number) => ({ width: w }));

    const fileName = `Champika_B2B_Products_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    XLSX.writeFile(wb, fileName);

    setSuccessMessage(
      `Excel report generated successfully! (${sortedProducts.length} products)`
    );
    setShowSuccessAlert(true);
    setTimeout(() => setShowSuccessAlert(false), 3000);
  };

  const generatePDFReport = () => {
    if (sortedProducts.length === 0) {
      alert("No products to export. Please adjust your filters.");
      return;
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    // Add title
    doc.setFontSize(16);
    doc.setTextColor(40);
    doc.text("Champika B2B", 14, 15);
    doc.setFontSize(12);
    doc.text("Products Report", 14, 22);

    // Add metadata
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Products: ${sortedProducts.length}`, 14, 33);

    const tableData = sortedProducts.map((product) => [
      product.sku,
      product.name,
      product.category,
      product.supplier,
      product.stock.toString(),
      product.minStock.toString(),
      product.costPrice.toLocaleString(),
      product.sellingPrice.toLocaleString(),
      product.mrp.toLocaleString(),
      product.totalCost.toLocaleString(),
    ]);

    const totalStockAll = sortedProducts.reduce((sum, p) => sum + p.stock, 0);
    const totalCostAll = sortedProducts.reduce(
      (sum, p) => sum + p.totalCost,
      0
    );

    tableData.push([
      "",
      "TOTAL",
      "",
      "",
      totalStockAll.toString(),
      "",
      "",
      "",
      "",
      totalCostAll.toLocaleString(),
    ]);

    autoTable(doc, {
      head: [
        [
          "SKU",
          "Product Name",
          "Category",
          "Supplier",
          "Stock",
          "Min",
          "Cost",
          "Sell Price",
          "MRP",
          "Total Cost",
        ],
      ],
      body: tableData,
      startY: 38,
      theme: "grid",
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 20, halign: "left" },
        1: { cellWidth: 50, halign: "left" },
        2: { cellWidth: 30, halign: "center" },
        3: { cellWidth: 35, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 15, halign: "center" },
        6: { cellWidth: 20, halign: "right" },
        7: { cellWidth: 22, halign: "right" },
        8: { cellWidth: 20, halign: "right" },
        9: { cellWidth: 25, halign: "right" },
      },
      didParseCell: (data: any) => {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
      margin: { left: 14, right: 14 },
    });

    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    const fileName = `Champika_B2B_Products_${
      new Date().toISOString().split("T")[0]
    }.pdf`;
    doc.save(fileName);

    setSuccessMessage(
      `PDF report generated successfully! (${sortedProducts.length} products)`
    );
    setShowSuccessAlert(true);
    setTimeout(() => setShowSuccessAlert(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Success Alert */}
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
              className="absolute top-2 right-2 rounded-md p-1 hover:bg-green-100"
            >
              <X className="h-4 w-4 text-green-600" />
            </button>
          </Alert>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage products and inventory for Champika B2B
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Report Generation Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={generateExcelReport}>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                Export to Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={generatePDFReport}>
                <FileText className="w-4 h-4 mr-2 text-red-600" />
                Export to PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => {
              setSelectedProduct(null);
              resetForm();
              setIsAddDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Product
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Products
            </CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Products in catalog
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Stock Value (MRP)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              LKR {totalStockValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              At selling price
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stock Cost</CardTitle>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              LKR {totalCostValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Acquisition cost
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, category, or supplier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category === "all" ? "All Categories" : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier} value={supplier}>
                      {supplier === "all" ? "All Suppliers" : supplier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock</SelectItem>
                  <SelectItem value="in-stock">In Stock</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-muted-foreground">Loading products...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center">
                        Product Name
                        {getSortIcon("name")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("category")}
                    >
                      <div className="flex items-center">
                        Category
                        {getSortIcon("category")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("supplier")}
                    >
                      <div className="flex items-center">
                        Supplier
                        {getSortIcon("supplier")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("stock")}
                    >
                      <div className="flex items-center justify-end">
                        Stock
                        {getSortIcon("stock")}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Cost Price</TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("sellingPrice")}
                    >
                      <div className="flex items-center justify-end">
                        Selling Price
                        {getSortIcon("sellingPrice")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("mrp")}
                    >
                      <div className="flex items-center justify-end">
                        MRP
                        {getSortIcon("mrp")}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPageProducts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No products found
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentPageProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {product.name}
                            {product.stock === 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Out of Stock
                              </span>
                            ) : product.stock < product.minStock ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Low Stock
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            <Tag className="w-3 h-3 mr-1" />
                            {product.category}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <Building2 className="w-3 h-3 mr-1" />
                            {product.supplier}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              product.stock === 0
                                ? "text-red-600 font-bold"
                                : product.stock < product.minStock
                                ? "text-destructive font-medium"
                                : ""
                            }
                          >
                            {product.stock} units
                          </span>
                          <span className="text-xs text-muted-foreground block">
                            Min: {product.minStock}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-blue-600">
                          LKR {product.costPrice.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          LKR {product.sellingPrice.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          LKR {product.mrp.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          LKR {product.totalCost.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() =>
                                (window.location.href = `/products/${product.id}`)
                              }
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditDialog(product)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setSelectedProduct(product);
                                setIsDeleteDialogOpen(true);
                              }}
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
          )}

          {/* Pagination Controls */}
          {!loading && sortedProducts.length > 0 && (
            <div className="flex items-center justify-between px-2 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to{" "}
                {Math.min(endIndex, sortedProducts.length)} of{" "}
                {sortedProducts.length} products
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {currentPage > 3 && (
                    <>
                      <Button
                        variant={currentPage === 1 ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(1)}
                        className="w-9"
                      >
                        1
                      </Button>
                      {currentPage > 4 && (
                        <span className="px-2 text-muted-foreground">...</span>
                      )}
                    </>
                  )}

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (page) =>
                        page === currentPage ||
                        page === currentPage - 1 ||
                        page === currentPage + 1 ||
                        page === currentPage - 2 ||
                        page === currentPage + 2
                    )
                    .filter((page) => page > 0 && page <= totalPages)
                    .map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(page)}
                        className="w-9"
                      >
                        {page}
                      </Button>
                    ))}

                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && (
                        <span className="px-2 text-muted-foreground">...</span>
                      )}
                      <Button
                        variant={
                          currentPage === totalPages ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => goToPage(totalPages)}
                        className="w-9"
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct ? "Edit Product" : "Add New Product"}
            </DialogTitle>
            <DialogDescription>
              {selectedProduct
                ? "Update product information below"
                : "Enter the details of the new product"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Office Chair Executive"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                placeholder="e.g., Furniture, Electronics, etc."
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Input
                id="supplier"
                placeholder="e.g., ABC Suppliers Ltd."
                value={formData.supplier}
                onChange={(e) =>
                  setFormData({ ...formData, supplier: e.target.value })
                }
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costPrice">Cost Price per Unit (LKR)</Label>
              <Input
                id="costPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={formData.costPrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    costPrice: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                What you paid to supplier
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mrp">MRP per Unit (LKR) *</Label>
              <Input
                id="mrp"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={formData.mrp}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mrp: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Maximum Retail Price
              </p>
            </div>
            <div className="col-span-2 space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="sellingPrice">
                  Default Selling Price (LKR)
                </Label>
                <span className="text-xs text-muted-foreground italic">
                  Optional
                </span>
              </div>
              <Input
                id="sellingPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="Leave empty to use MRP"
                value={formData.sellingPrice || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sellingPrice: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                💡 If you want a different default price than MRP, enter it
                here. Leave empty to use MRP as selling price.
              </p>
              {formData.sellingPrice > 0 && formData.mrp > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                  <p className="text-xs text-blue-700">
                    <strong>Discount:</strong>{" "}
                    {(
                      ((formData.mrp - formData.sellingPrice) / formData.mrp) *
                      100
                    ).toFixed(1)}
                    % off MRP
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">Current Stock (units) *</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                placeholder="0"
                value={formData.stock}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stock: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStock">Minimum Stock Level (units) *</Label>
              <Input
                id="minStock"
                type="number"
                min="0"
                placeholder="0"
                value={formData.minStock}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    minStock: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setSelectedProduct(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddProduct}>
              {selectedProduct ? "Update Product" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedProduct?.name}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedProduct(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduct}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
