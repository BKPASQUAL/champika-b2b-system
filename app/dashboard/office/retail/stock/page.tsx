// app/dashboard/office/retail/stock/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Search,
  RefreshCw,
  ArrowRightLeft,
  DollarSign,
  Layers,
  ArrowLeft,
  Filter,
  Download,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import {
  StockTable,
  RetailStockItem,
  SortField,
  SortOrder,
} from "./_components/StockTable";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function RetailStockPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stockItems, setStockItems] = useState<RetailStockItem[]>([]);
  const [businessName, setBusinessName] = useState("");

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchStock = async () => {
    const user = getUserBusinessContext();
    if (!user) {
      router.push("/login");
      return;
    }

    setBusinessName(user.businessName || "Retail Business");
    setLoading(true);

    try {
      const res = await fetch(`/api/rep/stock?userId=${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch stock data");
      const data = await res.json();
      setStockItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Stock fetch error:", error);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [router]);

  // --- Logic ---
  const categories = [
    "all",
    ...Array.from(new Set(stockItems.map((i) => i.category).filter(Boolean))),
  ];

  // 1. Filter
  const filteredItems = stockItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || item.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // 2. Sort
  const sortedItems = [...filteredItems].sort((a, b) => {
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

  // 3. Paginate
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  const paginatedItems = sortedItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // --- Handlers ---
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // --- Report Generation ---
  const generateExcel = () => {
    if (sortedItems.length === 0) {
      toast.error("No data to export");
      return;
    }

    const data = sortedItems.map((item) => ({
      SKU: item.sku,
      "Product Name": item.name,
      Category: item.category || "-",
      "Unit Price (LKR)": item.selling_price,
      "Stock Quantity": item.stock_quantity,
      Unit: item.unit_of_measure,
      "Total Value (LKR)": item.selling_price * item.stock_quantity,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Report");

    // Generate filename with date
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Retail_Stock_Report_${dateStr}.xlsx`);
    toast.success("Excel report generated successfully");
  };

  const generatePDF = () => {
    if (sortedItems.length === 0) {
      toast.error("No data to export");
      return;
    }

    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString();

    // Title
    doc.setFontSize(16);
    doc.text(`${businessName} - Inventory Report`, 14, 15);

    doc.setFontSize(10);
    doc.text(`Generated on: ${dateStr}`, 14, 22);
    doc.text(`Total Products: ${sortedItems.length}`, 14, 27);
    doc.text(`Total Value: LKR ${totalValue.toLocaleString()}`, 14, 32);

    // Table
    const tableColumn = [
      "SKU",
      "Product Name",
      "Category",
      "Price",
      "Stock",
      "Value",
    ];
    const tableRows = sortedItems.map((item) => [
      item.sku,
      item.name,
      item.category || "-",
      item.selling_price.toLocaleString(),
      `${item.stock_quantity} ${item.unit_of_measure}`,
      (item.selling_price * item.stock_quantity).toLocaleString(),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 163, 74] }, // Green header
    });

    const fileNameDate = new Date().toISOString().split("T")[0];
    doc.save(`Retail_Stock_Report_${fileNameDate}.pdf`);
    toast.success("PDF report generated successfully");
  };

  // Totals for Cards
  const totalValue = filteredItems.reduce(
    (sum, item) => sum + item.selling_price * item.stock_quantity,
    0
  );
  const totalItems = filteredItems.reduce(
    (sum, item) => sum + item.stock_quantity,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/office/retail")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Retail Stock</h1>
            <p className="text-muted-foreground mt-1">
              {businessName} - Inventory Overview
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStock} disabled={loading}>
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" /> Reports
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={generateExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={generatePDF}>
                <FileText className="w-4 h-4 mr-2 text-red-600" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={() =>
              router.push("/dashboard/office/retail/stock-requests")
            }
            className="bg-green-600 hover:bg-green-700"
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" /> Request Stock
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Stock Value
            </CardTitle>
            <DollarSign className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              LKR {totalValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on selling price
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Products
            </CardTitle>
            <Layers className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredItems.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Unique SKUs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Quantity
            </CardTitle>
            <Package className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalItems.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Units on hand</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Product Name or SKU..."
                className="pl-9 w-1/3"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1); // Reset page on search
                }}
              />
            </div>
            <div className="w-full md:w-[200px]">
              <Select
                value={categoryFilter}
                onValueChange={(val) => {
                  setCategoryFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(
                    (cat) =>
                      cat !== "all" && (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StockTable
            items={paginatedItems}
            loading={loading}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
