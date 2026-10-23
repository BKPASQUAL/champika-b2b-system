"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronRight,
  ZoomIn,
  ShoppingCart,
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  Truck,
  ArrowLeft,
  Share2,
  Package,
  Layers,
  Sparkles,
  Loader2,
  PhoneCall,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useStorefrontCart } from "@/hooks/useStorefrontCart";
import { toast } from "sonner";

interface ProductDetail {
  id: string;
  sku: string;
  title: string;
  originalName: string;
  brand: string;
  supplierName: string;
  category: string;
  categoryPath: string;
  breadcrumbSegments: string[];
  price: number;
  mrp: number;
  discountPercent: number;
  unit: string;
  images: string[];
  stockQuantity: number;
  isStockAvailable: boolean;
  stockStatus: string;
  allowBackorder: boolean;
  summaryText: string;
  specifications: string[];
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [sidebarData, setSidebarData] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Variant selections
  const [selectedLength, setSelectedLength] = useState("100m Coil");
  const [selectedColor, setSelectedColor] = useState("Red");
  const [selectedBrand, setSelectedBrand] = useState("");

  const { addToCart, addToQuote } = useStorefrontCart();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/storefront/public/products/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Product not found");
        return res.json();
      })
      .then((data) => {
        setProduct(data.product);
        setSidebarData(data.categorySidebar);
        setRelated(data.relatedProducts || []);
        if (data.product?.brand) {
          setSelectedBrand(data.product.brand);
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error("Could not load product details");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const fmt = (num: number) =>
    (num || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-amber-600" />
        <p className="text-sm font-semibold text-slate-500">Loading electrical specifications &amp; live pricing...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-4 text-center space-y-4">
        <Package className="w-16 h-16 text-slate-300 mx-auto" />
        <h2 className="text-2xl font-black text-slate-800">Product Not Found</h2>
        <p className="text-sm text-slate-500">The product you requested might be offline or removed from the catalog.</p>
        <Link href="/products">
          <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Catalog
          </Button>
        </Link>
      </div>
    );
  }

  // Pre-fill WhatsApp message
  const whatsappUrl = `https://wa.me/94770000000?text=${encodeURIComponent(
    `Hello BK Wiring Kade, I would like to inquire about:
*${product.title}*
SKU: ${product.sku}
Price: Rs. ${fmt(product.price)}
Brand: ${selectedBrand || product.brand}
Length: ${selectedLength}
Color: ${selectedColor}
Could you please confirm availability and direct delivery?`
  )}`;

  // Default electrical product images if none uploaded
  const displayImages =
    product.images && product.images.length > 0
      ? product.images
      : [
          "/images/products/cables_placeholder.png",
          "/images/products/cables_coil_detail.png",
        ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP BREADCRUMB NAVIGATION                                              */}
      {/* ========================================================================= */}
      <nav className="flex items-center gap-1.5 flex-wrap text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
        <Link
          href="/"
          className="hover:text-amber-600 transition-colors font-semibold px-1.5 py-0.5 rounded hover:bg-white"
        >
          Home
        </Link>

        {product.breadcrumbSegments && product.breadcrumbSegments.length > 0 ? (
          product.breadcrumbSegments.map((seg, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <Link
                href={`/products?category=${encodeURIComponent(seg)}`}
                className="hover:text-amber-600 transition-colors font-semibold px-2 py-0.5 rounded bg-white border border-slate-200/70 text-slate-700 shadow-xs"
              >
                {seg}
              </Link>
            </React.Fragment>
          ))
        ) : (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold px-2 py-0.5 rounded bg-white border border-slate-200/70">
              {product.category}
            </span>
          </>
        )}

        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-slate-400 truncate max-w-xs sm:max-w-md font-medium" title={product.title}>
          {product.title}
        </span>
      </nav>

      {/* ========================================================================= */}
      {/* 2. MAIN 2-COLUMN LAYOUT: SIDEBAR + PRODUCT DETAIL                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ======================================================================= */}
        {/* LEFT COLUMN: CATEGORIES TREE & SIDE BANNER (MATCHING SCREENSHOT)        */}
        {/* ======================================================================= */}
        <aside className="lg:col-span-3 space-y-6 order-2 lg:order-1">
          {/* Categories Sidebar Box */}
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <Link
                href="/products"
                className="text-xs font-bold text-slate-900 hover:text-amber-600 flex items-center gap-1.5"
              >
                <Layers className="w-4 h-4 text-amber-600" />
                Show All Categories
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>

            <div className="p-4 space-y-3">
              {/* Primary Category Group */}
              <div>
                <Link
                  href={`/products?category=${encodeURIComponent(product.breadcrumbSegments?.[0] || product.category)}`}
                  className="font-extrabold text-xs text-slate-900 hover:text-amber-600 flex items-center justify-between group"
                >
                  <span className="group-hover:underline">
                    {product.breadcrumbSegments?.[1] || product.breadcrumbSegments?.[0] || product.category}
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-mono h-5 px-1.5">
                    {sidebarData?.categories?.[product.breadcrumbSegments?.[0]] || 59}
                  </Badge>
                </Link>

                {/* Subcategories */}
                <div className="mt-2.5 pl-3 border-l-2 border-amber-500/40 space-y-2 text-xs">
                  <Link
                    href="/products?category=Data%20Cables"
                    className="flex items-center justify-between text-slate-600 hover:text-amber-600 py-0.5"
                  >
                    <span>Data Cables</span>
                    <span className="text-[11px] text-slate-400 font-mono">(22)</span>
                  </Link>
                  <Link
                    href="/products?category=Earth%20Cables"
                    className="flex items-center justify-between text-slate-600 hover:text-amber-600 py-0.5"
                  >
                    <span>Earth Cables</span>
                    <span className="text-[11px] text-slate-400 font-mono">(6)</span>
                  </Link>
                  <Link
                    href="/products?category=Flexible%20Cables"
                    className="flex items-center justify-between text-slate-600 hover:text-amber-600 py-0.5"
                  >
                    <span>Flexible Cables</span>
                    <span className="text-[11px] text-slate-400 font-mono">(18)</span>
                  </Link>
                  <Link
                    href="/products?category=Household%20Cables"
                    className="flex items-center justify-between text-amber-700 font-bold bg-amber-50/80 px-2 py-1 rounded-md"
                  >
                    <span>Household Cables &amp; Wires</span>
                    <span className="text-[11px] text-amber-800 font-mono">(12)</span>
                  </Link>
                </div>
              </div>

              {/* Other Common Categories */}
              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <Link
                  href="/products?category=Switches%20%26%20Sockets"
                  className="flex items-center justify-between text-slate-700 hover:text-amber-600 py-1 font-medium"
                >
                  <span>Switches &amp; Sockets</span>
                  <span className="text-[11px] text-slate-400 font-mono">(84)</span>
                </Link>
                <Link
                  href="/products?category=Circuit%20Breakers"
                  className="flex items-center justify-between text-slate-700 hover:text-amber-600 py-1 font-medium"
                >
                  <span>Circuit Breakers &amp; DB</span>
                  <span className="text-[11px] text-slate-400 font-mono">(42)</span>
                </Link>
                <Link
                  href="/products?category=Conduit%20%26%20Enclosures"
                  className="flex items-center justify-between text-slate-700 hover:text-amber-600 py-1 font-medium"
                >
                  <span>Conduit &amp; PVC Pipes</span>
                  <span className="text-[11px] text-slate-400 font-mono">(31)</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Promo Side Banner (as seen in screenshot) */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-600 via-sky-700 to-slate-900 text-white p-5 shadow-lg border border-cyan-500/20">
            {/* Top decorative badge */}
            <div className="inline-block bg-amber-400 text-slate-950 font-black text-[10px] tracking-wider uppercase px-2.5 py-0.5 rounded-full mb-3">
              Official Partner Deal
            </div>
            <div className="text-xl font-black tracking-tight leading-tight">
              HIKVISION
            </div>
            <div className="text-lg font-extrabold text-amber-300">
              CCTV MEGA SALE!
            </div>
            <p className="text-xs text-cyan-100 mt-2 font-medium">
              Special Contractor &amp; Electrician Discounts Up to 40%
            </p>
            <div className="mt-4 pt-3 border-t border-cyan-400/30 flex items-center justify-between">
              <span className="text-[11px] font-bold text-cyan-200">Package kits available</span>
              <Link href="/products?category=CCTV">
                <Button size="sm" className="h-7 text-xs bg-amber-400 hover:bg-amber-300 text-slate-900 font-black px-3 rounded-lg">
                  Shop Now
                </Button>
              </Link>
            </div>
          </div>

          {/* Trust Guarantees */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 text-xs text-slate-600">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800 block">100% SLS Certified Copper</strong>
                Full electrical compliance test reports available.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Truck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800 block">Site Direct Delivery</strong>
                Fast dispatch across Sri Lanka within 24-48 hours.
              </div>
            </div>
          </div>
        </aside>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: PRODUCT DETAIL, IMAGES, SPECS, AND ACTIONS                */}
        {/* ======================================================================= */}
        <main className="lg:col-span-9 space-y-8 order-1 lg:order-2">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* ------------------------------------------------------------------- */}
            {/* PRODUCT IMAGE GALLERY (WITH -5% BADGE & ZOOM)                        */}
            {/* ------------------------------------------------------------------- */}
            <div className="md:col-span-6 space-y-3">
              <div className="relative aspect-4/3 bg-white rounded-2xl border border-slate-200/90 p-6 flex items-center justify-center overflow-hidden shadow-xs group">
                {/* Discount Badge (-5% like screenshot) */}
                {product.discountPercent > 0 && (
                  <div className="absolute top-3 left-3 z-10 bg-red-600 text-white font-black text-xs px-2.5 py-1 rounded-md shadow-xs">
                    -{product.discountPercent}%
                  </div>
                )}

                {/* Zoom Icon */}
                <button
                  type="button"
                  className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 shadow-xs hover:bg-white transition-all"
                  title="Zoom In"
                  onClick={() => toast.info("Full resolution zoom active")}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                {/* Product Image */}
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="w-56 h-56 rounded-full bg-gradient-to-tr from-sky-500/20 via-blue-500/10 to-amber-500/10 flex items-center justify-center p-6 border-4 border-white shadow-inner">
                    <Package className="w-28 h-28 text-sky-600 drop-shadow-md" />
                  </div>
                </div>
              </div>

              {/* Thumbnails row */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedImageIndex(0)}
                  className={`w-16 h-16 rounded-xl border-2 p-1.5 bg-white transition-all overflow-hidden flex items-center justify-center ${
                    selectedImageIndex === 0 ? "border-amber-500 shadow-sm" : "border-slate-200 opacity-70 hover:opacity-100"
                  }`}
                >
                  <Package className="w-8 h-8 text-sky-600" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedImageIndex(1)}
                  className={`w-16 h-16 rounded-xl border-2 p-1.5 bg-white transition-all overflow-hidden flex items-center justify-center ${
                    selectedImageIndex === 1 ? "border-amber-500 shadow-sm" : "border-slate-200 opacity-70 hover:opacity-100"
                  }`}
                >
                  <Layers className="w-8 h-8 text-amber-600" />
                </button>
              </div>
            </div>

            {/* ------------------------------------------------------------------- */}
            {/* PRODUCT TITLE, SPECS, PRICE & ADD TO CART                          */}
            {/* ------------------------------------------------------------------- */}
            <div className="md:col-span-6 space-y-4">
              {/* Category Path Tags */}
              <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                {product.breadcrumbSegments?.slice(-2).join(" • ") || product.category}
              </div>

              {/* Rich E-commerce Title */}
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                {product.title}
              </h1>

              {/* SKU & Brand Line */}
              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                <span>SKU: <strong className="font-mono text-slate-800">{product.sku}</strong></span>
                <span>•</span>
                <span>Brand: <strong className="text-slate-800">{product.brand}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-600 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {product.stockStatus}
                </span>
              </div>

              {/* Product Short Summary Paragraph */}
              <p className="text-xs text-slate-600 leading-relaxed pt-1">
                {product.summaryText}
              </p>

              {/* Bulleted Specifications (as shown in screenshot) */}
              <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
                <span className="font-extrabold text-slate-900 block text-[11px] tracking-wider uppercase">
                  Technical Specifications &amp; Features:
                </span>
                <ul className="space-y-1.5 text-slate-700">
                  {product.specifications.map((spec, i) => {
                    const parts = spec.split(":");
                    return (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <div>
                          {parts.length > 1 ? (
                            <>
                              <strong className="text-slate-900">{parts[0]}:</strong>
                              <span>{parts.slice(1).join(":")}</span>
                            </>
                          ) : (
                            <span>{spec}</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Price Block */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900">
                    Rs. {fmt(product.price)}
                  </span>
                  {product.mrp > product.price && (
                    <span className="text-sm text-slate-400 line-through">
                      Rs. {fmt(product.mrp)}
                    </span>
                  )}
                  {product.discountPercent > 0 && (
                    <Badge className="bg-emerald-600 text-white font-extrabold text-xs">
                      SAVE {product.discountPercent}%
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Unit price including VAT &amp; standard wholesale pricing terms.
                </p>
              </div>

              {/* Options / Dropdowns (Brand, Length, Color like screenshot) */}
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 text-[11px] block mb-1">Brand</label>
                    <select
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      className="w-full h-8 text-xs rounded-lg border border-slate-300 bg-white px-2 font-medium"
                    >
                      <option value={product.brand}>{product.brand}</option>
                      <option value="ACL Cables">ACL Cables</option>
                      <option value="Orange Electric">Orange Electric</option>
                      <option value="Kelani Cables">Kelani Cables</option>
                      <option value="Sierra Cables">Sierra Cables</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 text-[11px] block mb-1">Length</label>
                    <select
                      value={selectedLength}
                      onChange={(e) => setSelectedLength(e.target.value)}
                      className="w-full h-8 text-xs rounded-lg border border-slate-300 bg-white px-2 font-medium"
                    >
                      <option value="100m Coil">100m Coil</option>
                      <option value="50m Coil">50m Coil</option>
                      <option value="Loose Cut per Meter">Per Meter</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 text-[11px] block mb-1">Color</label>
                    <select
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-full h-8 text-xs rounded-lg border border-slate-300 bg-white px-2 font-medium"
                    >
                      <option value="Red">Red (Live)</option>
                      <option value="Black">Black (Neutral)</option>
                      <option value="Blue">Blue (Live Phase)</option>
                      <option value="Yellow">Yellow (Live Phase)</option>
                      <option value="Green/Earth">Green (Earth)</option>
                    </select>
                  </div>
                </div>

                {/* Quantity and Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden h-11 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-9 h-full flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      -
                    </button>
                    <span className="w-10 text-center text-xs font-bold font-mono">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="w-9 h-full flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      +
                    </button>
                  </div>

                  <Button
                    className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-2 rounded-xl shadow-md"
                    onClick={() => {
                      addToCart(product, quantity);
                      toast.success(`Added ${quantity}x ${product.title} to Cart!`);
                    }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add to Cart
                  </Button>

                  <Button
                    variant="outline"
                    className="h-11 border-slate-300 hover:bg-slate-50 font-bold text-xs gap-2 rounded-xl"
                    onClick={() => {
                      addToQuote(product, quantity);
                      toast.success(`Added ${quantity}x ${product.title} to Project Quote!`);
                    }}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    + BOQ Quote
                  </Button>
                </div>

                {/* Direct WhatsApp Inquiry */}
                <div className="pt-2">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    <PhoneCall className="w-4 h-4" />
                    Order / Inquire via WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Floating WhatsApp Action Button in bottom-right (matching screenshot) */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-2xl hover:scale-105 transition-all p-3 border-2 border-white"
        title="Chat on WhatsApp"
      >
        <svg
          viewBox="0 0 24 24"
          width="28"
          height="28"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </a>
    </div>
  );
}
