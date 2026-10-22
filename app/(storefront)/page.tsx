"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Zap,
  ArrowRight,
  ShieldCheck,
  Truck,
  FileSpreadsheet,
  CheckCircle2,
  Phone,
  Sparkles,
  Layers,
  Box,
  ShoppingCart,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useStorefrontCart } from "@/hooks/useStorefrontCart";
import { toast } from "sonner";

export default function StorefrontHomePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToCart, addToQuote } = useStorefrontCart();

  useEffect(() => {
    fetch("/api/storefront/public/products")
      .then((res) => res.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching storefront products", err))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (num: number) =>
    (num || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-14 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white py-16 sm:py-24 px-4 sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.15),transparent_50%)] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Specialized Electrical Wiring Store
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              Quality Electrical Wires, Switches &amp; Breakers For Your Home
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-xl leading-relaxed">
              Shop certified house wiring cables, modular switch plates, trip switches, and conduit accessories. Check live stock quantities and generate an official project quotation in seconds.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/products">
                <Button size="lg" className="h-12 px-6 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm rounded-xl gap-2 shadow-lg shadow-amber-500/20">
                  <ShoppingCart className="w-4 h-4" />
                  Shop Electrical Items
                </Button>
              </Link>
              <Link href="/quotation-builder">
                <Button size="lg" variant="outline" className="h-12 px-6 border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-white font-bold text-sm rounded-xl gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Build Project BOQ / Quote (PDF)
                </Button>
              </Link>
            </div>

            {/* Quality Badges */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-800/80 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-slate-300 font-medium">100% Genuine Copper Cables</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-slate-300 font-medium">Fast Islandwide Delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
                <span className="text-slate-300 font-medium">Live Warehouse Stock</span>
              </div>
            </div>
          </div>

          {/* Hero Highlight Card */}
          <div className="lg:col-span-5">
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-800/40 border border-slate-700/60 backdrop-blur-md shadow-2xl space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Fast-Moving Special</span>
                  <h3 className="text-xl font-extrabold text-white mt-1">House Wiring Cables</h3>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">In Stock</Badge>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Complete range of single-core and twin-earth cables for residential installations. 1.0mm (Lighting), 2.5mm (Power Sockets), 4.0mm &amp; 6.0mm (A/C &amp; Cooker).
              </p>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                  <span className="text-slate-400">1.0mm Single Core (100m)</span>
                  <span className="font-bold text-white">From LKR 8,950</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                  <span className="text-slate-400">2.5mm Single Core (100m)</span>
                  <span className="font-bold text-white">From LKR 19,450</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                  <span className="text-slate-400">Orange 13A Single Socket</span>
                  <span className="font-bold text-white">From LKR 980</span>
                </div>
              </div>
              <Link href="/products?category=cables" className="block">
                <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs h-10 rounded-xl gap-2">
                  View Full Cable Catalog
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Brand Badges Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-6">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Authorized Brands We Supply</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {["Orange Electric", "Sierra Cables", "Wireman Agency", "Kelani Cables", "ACL Cables"].map((brand) => (
            <div key={brand} className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs text-center font-bold text-slate-800 text-xs sm:text-sm flex items-center justify-center gap-2 hover:border-amber-400 transition-colors">
              <Zap className="w-4 h-4 text-amber-500" />
              {brand}
            </div>
          ))}
        </div>
      </section>

      {/* Featured Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Essential Wiring Categories
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Select items directly for your electrical installation phases
            </p>
          </div>
          <Link href="/products" className="text-xs sm:text-sm font-bold text-amber-600 hover:underline flex items-center gap-1">
            All Products <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/products?category=cables" className="group">
            <Card className="h-full border border-slate-200 hover:border-amber-500 transition-all hover:shadow-md">
              <CardContent className="p-5 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900 group-hover:text-amber-600 transition-colors">
                  House Wiring Cables
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  1.0mm, 2.5mm, 4.0mm, 6.0mm &amp; 7/0.67 earth wires in red, black, blue, and yellow-green.
                </p>
                <div className="text-xs font-bold text-amber-600 flex items-center gap-1 pt-1">
                  Browse Wires &rarr;
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/products?category=switches" className="group">
            <Card className="h-full border border-slate-200 hover:border-blue-500 transition-all hover:shadow-md">
              <CardContent className="p-5 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold group-hover:scale-110 transition-transform">
                  <Box className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900 group-hover:text-blue-600 transition-colors">
                  Modular Switches &amp; Sockets
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  1-Gang to 4-Gang switches, 13A single &amp; double switched sockets, fan dimmers, and cooker switches.
                </p>
                <div className="text-xs font-bold text-blue-600 flex items-center gap-1 pt-1">
                  Browse Switches &rarr;
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/products?category=breakers" className="group">
            <Card className="h-full border border-slate-200 hover:border-purple-500 transition-all hover:shadow-md">
              <CardContent className="p-5 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 font-bold group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900 group-hover:text-purple-600 transition-colors">
                  MCB &amp; Trip Switches
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  6A, 10A, 16A, 20A, 32A MCB breakers, RCCB 30mA earth leakage trip switches &amp; metal/PVC distribution boxes.
                </p>
                <div className="text-xs font-bold text-purple-600 flex items-center gap-1 pt-1">
                  Browse Breakers &rarr;
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/products?category=conduit" className="group">
            <Card className="h-full border border-slate-200 hover:border-emerald-500 transition-all hover:shadow-md">
              <CardContent className="p-5 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold group-hover:scale-110 transition-transform">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900 group-hover:text-emerald-600 transition-colors">
                  Conduit &amp; Accessories
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  20mm &amp; 25mm PVC conduits, bends, circular junction boxes, sunk metal switch boxes, and flexible pipes.
                </p>
                <div className="text-xs font-bold text-emerald-600 flex items-center gap-1 pt-1">
                  Browse Conduits &rarr;
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Featured Products Catalog Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Featured Electrical Products
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Live warehouse prices &bull; Visible stock updated in real time
            </p>
          </div>
          <Link href="/products">
            <Button variant="outline" size="sm" className="text-xs font-bold">
              View All ({products.length})
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border p-8 space-y-3">
            <p className="text-sm font-semibold text-slate-600">No products currently published to the storefront.</p>
            <p className="text-xs text-slate-400">
              Staff can toggle products online in the <Link href="/dashboard/office/storefront" className="text-amber-600 font-bold underline">Storefront Operations Hub</Link>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.slice(0, 8).map((product) => (
              <Card key={product.id} className="border border-slate-200/90 hover:shadow-lg transition-all rounded-2xl overflow-hidden flex flex-col justify-between">
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
                    <h4 className="font-extrabold text-sm text-slate-900 line-clamp-2 hover:text-amber-600 transition-colors">
                      {product.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{product.sku} &bull; {product.unit}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
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

                {/* Card Action Buttons */}
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
      </section>

      {/* Instant Project Quotation Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900 text-white relative overflow-hidden shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Self-Service Project BOQ Builder
            </div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Wiring a New House or Commercial Building?
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Create an official Bill of Quantities (BOQ) with your exact wire lengths, switches, and breakers. Download an official <strong>BK WIRING KADE</strong> quotation PDF instantly without waiting for counter staff!
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <Link href="/quotation-builder">
                <Button size="lg" className="h-11 px-6 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl shadow-lg gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Generate Free Quotation (PDF)
                </Button>
              </Link>
              <Link href="/track">
                <Button size="lg" variant="outline" className="h-11 px-6 border-slate-700 text-white text-xs font-bold rounded-xl">
                  Track Existing Order
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
