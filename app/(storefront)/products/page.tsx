"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  ShoppingCart,
  FileSpreadsheet,
  Filter,
  Loader2,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useStorefrontCart } from "@/hooks/useStorefrontCart";
import { toast } from "sonner";

function ProductsContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "all";
  const initialSearch = searchParams.get("search") || "";

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedBrand, setSelectedBrand] = useState("all");

  const { addToCart, addToQuote } = useStorefrontCart();

  useEffect(() => {
    setLoading(true);
    fetch("/api/storefront/public/products")
      .then((res) => res.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching products", err))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (num: number) =>
    (num || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !search ||
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" ||
      p.category?.toLowerCase().includes(selectedCategory.toLowerCase()) ||
      p.subCategory?.toLowerCase().includes(selectedCategory.toLowerCase());

    const matchesBrand =
      selectedBrand === "all" ||
      p.brand?.toLowerCase() === selectedBrand.toLowerCase();

    return matchesSearch && matchesCategory && matchesBrand;
  });

  const categories = [
    { id: "all", label: "All Items" },
    { id: "cables", label: "House Wires & Cables" },
    { id: "switches", label: "Switches & Sockets" },
    { id: "breakers", label: "MCB & Trip Switches" },
    { id: "conduit", label: "Conduit & Enclosures" },
  ];

  const brands = [
    "all",
    "Orange Electric",
    "Sierra Cables",
    "Wireman Agency",
    "Kelani Cables",
    "ACL Cables",
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Page Title & Search Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Electrical Wiring &amp; Switch Catalog
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Browse genuine home wiring cables, modular switch plates, and circuit breakers with live stock counts
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Input
            placeholder="Search 1.0mm, 2.5mm, switches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 bg-white border-slate-200 rounded-xl text-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Category Pills & Brand Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Button
              key={c.id}
              variant={selectedCategory === c.id ? "default" : "outline"}
              size="sm"
              className={`rounded-xl text-xs h-9 font-bold ${
                selectedCategory === c.id
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
              onClick={() => setSelectedCategory(c.id)}
            >
              {c.label}
            </Button>
          ))}
        </div>

        {/* Brand Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-slate-400 shrink-0">Brand:</span>
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBrand(b)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                selectedBrand === b
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {b === "all" ? "All Brands" : b}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">No electrical items found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search query, selecting &ldquo;All Items&rdquo;, or contact our electrical support desk.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setSelectedCategory("all");
              setSelectedBrand("all");
            }}
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="border border-slate-200/90 hover:shadow-xl transition-all rounded-2xl overflow-hidden flex flex-col justify-between bg-white group"
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-600">
                    {product.brand}
                  </Badge>
                  <Badge
                    className={`text-[10px] font-bold ${
                      product.isStockAvailable
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {product.stockStatus}
                  </Badge>
                </div>

                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 line-clamp-2 group-hover:text-amber-600 transition-colors">
                    {product.title}
                  </h4>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                    <span>SKU: {product.sku}</span>
                    <span>&bull;</span>
                    <span>{product.unit}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                  <div>
                    <div className="text-lg font-black text-slate-900">
                      LKR {fmt(product.price)}
                    </div>
                    {product.mrp > product.price && (
                      <div className="text-[11px] text-slate-400 line-through">
                        MRP: LKR {fmt(product.mrp)}
                      </div>
                    )}
                  </div>
                  {product.discountPercent > 0 && (
                    <span className="text-[11px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {product.discountPercent}% OFF
                    </span>
                  )}
                </div>
              </CardContent>

              {/* Action Buttons */}
              <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  className="h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl gap-1 shadow-sm"
                  onClick={() => {
                    addToCart(product, 1);
                    toast.success(`Added ${product.title} to Cart!`);
                  }}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  + Cart
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs border-slate-200 hover:bg-slate-50 font-bold rounded-xl gap-1"
                  onClick={() => {
                    addToQuote(product, 1);
                    toast.success(`Added ${product.title} to Project Quote!`);
                  }}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  + Quote
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="py-20 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}
