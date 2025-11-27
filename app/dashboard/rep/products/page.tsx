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
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ShoppingCart,
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
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

  // --- Preview Modal State ---
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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

  // --- Preview Handlers ---
  const openPreview = (product: Product) => {
    setPreviewProduct(product);
    setCurrentImageIndex(0);
  };

  const closePreview = () => {
    setPreviewProduct(null);
  };

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (previewProduct && previewProduct.images.length > 1) {
      setCurrentImageIndex((prev) =>
        prev === previewProduct.images.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (previewProduct && previewProduct.images.length > 1) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? previewProduct.images.length - 1 : prev - 1
      );
    }
  };

  const nextProduct = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!previewProduct) return;
    const currentIndex = filteredProducts.findIndex(
      (p) => p.id === previewProduct.id
    );
    const nextIndex =
      currentIndex === filteredProducts.length - 1 ? 0 : currentIndex + 1;
    setPreviewProduct(filteredProducts[nextIndex]);
    setCurrentImageIndex(0);
  };

  const prevProduct = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!previewProduct) return;
    const currentIndex = filteredProducts.findIndex(
      (p) => p.id === previewProduct.id
    );
    const prevIndex =
      currentIndex === 0 ? filteredProducts.length - 1 : currentIndex - 1;
    setPreviewProduct(filteredProducts[prevIndex]);
    setCurrentImageIndex(0);
  };

  const handleDownloadImage = async () => {
    if (!previewProduct || !previewProduct.images[currentImageIndex]) return;

    const imageUrl = previewProduct.images[currentImageIndex];
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${previewProduct.name.replace(/\s+/g, "_")}_${
        currentImageIndex + 1
      }.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Image downloaded");
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to download image");
      window.open(imageUrl, "_blank");
    }
  };

  const handleAddToCart = (product: Product) => {
    if (product.stock === 0) return;
    toast.success(`Added ${product.name} to order`);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header & Filters */}
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

      {/* Product Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {loading
          ? [...Array(12)].map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="aspect-square rounded-lg bg-gray-200 animate-pulse" />
                <div className="h-3 w-2/3 bg-gray-200 rounded animate-pulse" />
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
                  className="group flex flex-col gap-1.5 cursor-pointer bg-white p-2 rounded-lg border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all duration-200"
                  onClick={() => openPreview(product)}
                >
                  {/* Image Card Box */}
                  <div className="relative aspect-square w-full bg-gray-50 rounded-md overflow-hidden mb-1 border border-gray-100">
                    {/* Top Right: Stock Status Badge */}
                    <div className="absolute top-1 right-1 z-10">
                      <span
                        className={cn(
                          "text-[8px] font-bold px-1 py-0.5 rounded border uppercase tracking-wider bg-white/90 backdrop-blur-sm",
                          stockStatus.color
                        )}
                      >
                        {stockStatus.label}
                      </span>
                    </div>

                    {/* Center: Image */}
                    <div className="w-full h-full flex items-center justify-center bg-white">
                      {product.images && product.images.length > 0 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-contain p-2 mix-blend-multiply transition-transform duration-300 group-hover:scale-110"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-gray-300">
                          <ImageIcon className="h-6 w-6 mb-1" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Details Footer */}
                  <div className="flex flex-col gap-1">
                    <div className="min-h-[2.2rem]">
                      <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider truncate leading-none mb-0.5">
                        {product.brand || product.category}
                      </p>
                      <h3
                        className="text-[11px] font-medium text-gray-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors"
                        title={product.name}
                      >
                        {product.name}
                      </h3>
                    </div>

                    <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-50">
                      <span className="text-xs font-bold text-orange-600">
                        {formatCurrency(product.sellingPrice)}
                      </span>

                      <Button
                        size="icon"
                        className={cn(
                          "h-6 w-6 rounded-full shrink-0 transition-all shadow-sm",
                          product.stock === 0
                            ? "bg-gray-100 text-gray-300 hover:bg-gray-100 cursor-not-allowed"
                            : "bg-black text-white hover:bg-gray-800 hover:shadow-md"
                        )}
                        disabled={product.stock === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
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
            className="text-xs h-auto p-0 mt-1"
            onClick={() => {
              setSearchQuery("");
              setCategoryFilter("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* FULL SCREEN PREVIEW DIALOG */}
      {previewProduct && (
        <Dialog
          open={!!previewProduct}
          onOpenChange={(open) => !open && closePreview()}
        >
          <DialogContent className="max-w-md w-full p-0 overflow-hidden bg-white border-0 shadow-2xl rounded-xl gap-0 max-h-[90vh] flex flex-col outline-none">
            <VisuallyHidden>
              <DialogTitle>Product Preview: {previewProduct.name}</DialogTitle>
            </VisuallyHidden>

            {/* Close Button */}
            <div className="absolute top-3 right-3 z-50">
              <Button
                variant="ghost"
                size="icon"
                className="bg-white/90 hover:bg-white rounded-full backdrop-blur-md shadow-sm h-8 w-8"
                onClick={closePreview}
              >
                <X className="h-4 w-4 text-gray-700" />
              </Button>
            </div>

            {/* Content Container - Scrollable Vertical Layout */}
            <div className="flex flex-col overflow-y-auto">
              {/* Image Viewer (Top) */}
              <div className="relative bg-gray-50 flex items-center justify-center h-[320px] w-full border-b border-gray-100 shrink-0">
                {/* Product Navigation Arrows (Left/Right of Image) */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full shadow-md z-20 h-9 w-9 border border-gray-100"
                  onClick={prevProduct}
                  title="Previous Product"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-700" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full shadow-md z-20 h-9 w-9 border border-gray-100"
                  onClick={nextProduct}
                  title="Next Product"
                >
                  <ChevronRight className="h-5 w-5 text-gray-700" />
                </Button>

                {/* Main Image Area */}
                <div className="w-full h-full flex items-center justify-center p-8 relative group">
                  {previewProduct.images && previewProduct.images.length > 0 ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewProduct.images[currentImageIndex]}
                        alt={previewProduct.name}
                        className="max-w-full max-h-full object-contain mix-blend-multiply"
                      />

                      {/* Multiple Images Navigation (Tap/Click zones could be implemented, using arrows for now if multiple) */}
                      {previewProduct.images.length > 1 && (
                        <>
                          {/* Internal Image Arrows - Hidden by default, visible on hover or always on mobile if needed
                               For cleanliness, using dots below is standard, but adding small inner arrows for clarity */}
                        </>
                      )}

                      {/* Dots Indicator for Images */}
                      {previewProduct.images.length > 1 && (
                        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-auto z-10">
                          {previewProduct.images.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentImageIndex(idx);
                              }}
                              className={cn(
                                "h-1.5 rounded-full transition-all shadow-sm",
                                currentImageIndex === idx
                                  ? "w-4 bg-black"
                                  : "w-1.5 bg-gray-300 hover:bg-gray-400"
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-gray-300">
                      <ImageIcon className="h-16 w-16 mb-2 opacity-40" />
                      <span className="text-xs font-medium text-gray-400">
                        No Image
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Details Panel (Bottom) */}
              <div className="flex flex-col bg-white p-5 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold uppercase tracking-wider text-gray-500 border-gray-200 px-1.5 py-0"
                    >
                      {previewProduct.brand || previewProduct.category}
                    </Badge>
                    <div
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
                        previewProduct.stock === 0
                          ? "bg-red-50 text-red-700"
                          : previewProduct.stock <= previewProduct.minStock
                          ? "bg-amber-50 text-amber-700"
                          : "bg-green-50 text-green-700"
                      )}
                    >
                      {previewProduct.stock === 0 ? "OUT OF STOCK" : "IN STOCK"}
                    </div>
                  </div>

                  <h2 className="text-lg font-bold text-gray-900 leading-tight pt-1">
                    {previewProduct.name}
                  </h2>
                  <p className="text-xs text-gray-400 font-mono">
                    SKU: {previewProduct.sku}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-b border-gray-50 py-3">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                      Price
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-orange-600">
                        {formatCurrency(previewProduct.sellingPrice)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                      Available
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {previewProduct.stock} Units
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-gray-200 text-gray-600 hover:bg-gray-50 h-11"
                    onClick={handleDownloadImage}
                    disabled={
                      !previewProduct.images ||
                      previewProduct.images.length === 0
                    }
                  >
                    <Download className="h-4 w-4" />
                  </Button>

                  <Button
                    className="flex-[3] h-11 text-sm font-semibold bg-black hover:bg-gray-800 text-white shadow-lg active:scale-[0.98]"
                    disabled={previewProduct.stock === 0}
                    onClick={() => handleAddToCart(previewProduct)}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Add to Order
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
