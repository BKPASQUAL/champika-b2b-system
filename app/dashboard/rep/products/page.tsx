// app/dashboard/rep/products/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  Package,
  ImageIcon,
  Layers,
  Box,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Types ---
interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand?: string;
  sellingPrice: number;
  stock: number;
  minStock: number;
  images: string[];
}

export default function RepProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/products");
        if (!res.ok) throw new Error("Failed to load products");
        const data = await res.json();
        setProducts(data);
      } catch (error) {
        toast.error("Could not load product catalog");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // --- Filters ---
  const uniqueCategories = [
    "all",
    ...Array.from(new Set(products.map((p) => p.category))),
  ];

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || product.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // --- Helpers ---
  const getStockStatus = (stock: number, min: number) => {
    if (stock === 0)
      return { label: "Out", color: "text-red-600 bg-red-50 border-red-100" };
    if (stock <= min)
      return {
        label: "Low",
        color: "text-amber-600 bg-amber-50 border-amber-100",
      };
    return {
      label: "In Stock",
      color: "text-green-600 bg-green-50 border-green-100",
    };
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
    }).format(val);

  return (
    <div className="space-y-4 pb-20">
      {/* Header & Filters - Kept Compact */}
      <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60 py-2 -mx-4 px-4 sm:mx-0 sm:px-0 mb-4 border-b sm:border-0 border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <Box className="h-5 w-5 text-blue-600" />
              Catalog
            </h1>
          </div>

          <div className="flex flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-8 h-9 text-sm bg-white border-gray-200 shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs bg-white border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground truncate">
                  <Filter className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {categoryFilter === "all" ? "Category" : categoryFilter}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {uniqueCategories.map((cat) => (
                  <SelectItem
                    key={cat}
                    value={cat}
                    className="capitalize text-xs"
                  >
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Product Grid - "File Browser" Style */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-7 xl:grid-cols-8 gap-x-4 gap-y-6">
        {loading
          ? [...Array(12)].map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="aspect-square rounded-xl bg-gray-200 animate-pulse" />
                <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse" />
              </div>
            ))
          : filteredProducts.map((product) => {
              const stockStatus = getStockStatus(
                product.stock,
                product.minStock
              );

              return (
                <div
                  key={product.id}
                  className="group flex flex-col gap-2 cursor-pointer"
                >
                  {/* 1. Image Card Box */}
                  <div className="relative aspect-square w-full bg-white rounded-lg border border-gray-200 shadow-sm group-hover:shadow-md group-hover:border-blue-300 transition-all duration-200 overflow-hidden">
                    {/* Top Left: Brand/Category Icon */}
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Layers className="h-3.5 w-3.5 text-blue-600" />
                    </div>

                    {/* Top Right: Stock Status Badge */}
                    <div className="absolute top-2 right-2 z-10">
                      <span
                        className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider",
                          stockStatus.color
                        )}
                      >
                        {stockStatus.label}
                      </span>
                    </div>

                    {/* Center: Image */}
                    <div className="w-full h-full p-6 flex items-center justify-center">
                      {product.images && product.images.length > 0 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-110"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-gray-300">
                          <ImageIcon className="h-8 w-8 mb-1" />
                          <span className="text-[9px]">No Image</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Right: Price Tag (Floating style like reference) */}
                    <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded text-right">
                      <span className="text-xs font-bold text-orange-600 block leading-none">
                        {formatCurrency(product.sellingPrice)}
                      </span>
                    </div>
                  </div>

                  {/* 2. Details Footer (Outside Box) */}
                  <div className="flex justify-between items-start px-0.5">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3
                        className="text-xs font-medium text-gray-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors"
                        title={product.name}
                      >
                        {product.name}
                      </h3>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate font-mono">
                        {product.sku}
                      </p>
                    </div>

                    {/* Add Button - Black Background */}
                    <Button
                      size="icon"
                      className={cn(
                        "h-7 w-7 rounded-full shrink-0 transition-all shadow-sm cursor-pointer",
                        product.stock === 0
                          ? "bg-gray-100 text-gray-300 hover:bg-gray-100 cursor-not-allowed"
                          : "bg-black text-white hover:bg-gray-800 hover:shadow-md" // Changed to Black
                      )}
                      disabled={product.stock === 0}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent parent click
                        toast.success(`Added ${product.name}`);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
      </div>

      {/* Empty State */}
      {!loading && filteredProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
          <Package className="h-8 w-8 text-gray-300 mb-2" />
          <p className="text-sm text-muted-foreground">No products found.</p>
          <Button
            variant="link"
            className="text-xs h-auto p-0 mt-1 "
            onClick={() => {
              setSearchQuery("");
              setCategoryFilter("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
