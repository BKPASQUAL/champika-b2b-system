"use client";

import React, { useState } from "react";
import { Package, Search, Plus, Filter, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  sellingPrice: number;
  costPrice: number;
  mrp: number;
  status: "active" | "inactive";
}

// Mock data for demonstration
const MOCK_PRODUCTS: Product[] = [
  {
    id: "1",
    sku: "PRD-001",
    name: "Cement 50kg Bag",
    category: "Building Materials",
    stock: 150,
    minStock: 50,
    sellingPrice: 1500,
    costPrice: 1200,
    mrp: 1600,
    status: "active",
  },
  {
    id: "2",
    sku: "PRD-002",
    name: "Steel Rod 12mm",
    category: "Building Materials",
    stock: 45,
    minStock: 50,
    sellingPrice: 850,
    costPrice: 700,
    mrp: 900,
    status: "active",
  },
  {
    id: "3",
    sku: "PRD-003",
    name: "Paint White 5L",
    category: "Paints",
    stock: 80,
    minStock: 30,
    sellingPrice: 3500,
    costPrice: 2800,
    mrp: 3800,
    status: "active",
  },
  {
    id: "4",
    sku: "PRD-004",
    name: "Tiles 60x60cm",
    category: "Flooring",
    stock: 200,
    minStock: 100,
    sellingPrice: 250,
    costPrice: 180,
    mrp: 280,
    status: "active",
  },
  {
    id: "5",
    sku: "PRD-005",
    name: "Door Handle Brass",
    category: "Hardware",
    stock: 25,
    minStock: 30,
    sellingPrice: 1200,
    costPrice: 900,
    mrp: 1300,
    status: "active",
  },
  {
    id: "6",
    sku: "PRD-006",
    name: "Electrical Wire 2.5mm",
    category: "Electrical",
    stock: 120,
    minStock: 40,
    sellingPrice: 180,
    costPrice: 140,
    mrp: 200,
    status: "active",
  },
  {
    id: "7",
    sku: "PRD-007",
    name: "PVC Pipe 4 inch",
    category: "Plumbing",
    stock: 60,
    minStock: 40,
    sellingPrice: 650,
    costPrice: 500,
    mrp: 700,
    status: "active",
  },
  {
    id: "8",
    sku: "PRD-008",
    name: "Sand (per cube)",
    category: "Building Materials",
    stock: 15,
    minStock: 10,
    sellingPrice: 4500,
    costPrice: 3500,
    mrp: 5000,
    status: "active",
  },
];

export default function ProductsPage() {
  const [products] = useState<Product[]>(MOCK_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate totals
  const totalStock = filteredProducts.reduce((sum, p) => sum + p.stock, 0);
  const totalValue = filteredProducts.reduce(
    (sum, p) => sum + p.stock * p.sellingPrice,
    0
  );
  const lowStockCount = filteredProducts.filter(
    (p) => p.stock <= p.minStock
  ).length;

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Products
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your product inventory ({filteredProducts.length} products)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
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
            <div className="text-2xl font-bold">{filteredProducts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active inventory
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStock.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Units in stock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Low Stock Items
            </CardTitle>
            <Package className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Need reorder</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products by name, SKU, or category..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="icon" title="Filter">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Min Stock</TableHead>
                  <TableHead className="text-right">Cost Price</TableHead>
                  <TableHead className="text-right">Selling Price</TableHead>
                  <TableHead className="text-right">MRP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      No products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.sku}
                      </TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            product.stock <= product.minStock
                              ? "text-destructive font-semibold"
                              : ""
                          }
                        >
                          {product.stock}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {product.minStock}
                      </TableCell>
                      <TableCell className="text-right">
                        LKR {product.costPrice.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        LKR {product.sellingPrice.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        LKR {product.mrp.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            product.status === "active"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
