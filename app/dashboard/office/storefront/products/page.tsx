"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Globe,
  Package,
  Search,
  RefreshCw,
  ExternalLink,
  Loader2,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  Trash2,
  Tag,
  ArrowRight,
  ArrowLeft,
  Check,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

interface ConfiguredItem {
  productId: string;
  name: string;
  sku: string;
  brand: string;
  warehouseStock: number;
  basePrice: number;
  onlinePrice: number;
  category: string;
  stockBuffer: number;
}

const DEFAULT_CATEGORIES = [
  "House Wires & Cables",
  "Switches & Sockets",
  "Circuit Breakers & Distribution",
  "Lighting & Bulbs",
  "Conduit & Enclosures",
  "Power Plugs & Sockets",
];

const COMMON_CATEGORY_PATHS = [
  "Wiring Accessories > Cables & Wires > Household Cables & Wires",
  "Wiring Accessories > Cables & Wires > Industrial Cables & Wires",
  "Wiring Accessories > Cables & Wires > Flexible & Earth Cables",
  "Wiring Accessories > Switches & Sockets > Modular Switches",
  "Circuit Protection > MCB & RCD > Distribution Boards",
  "Lighting & Bulbs > LED Bulbs & Battens > Commercial Lighting",
  "Conduit & Enclosures > PVC Pipes & Fittings > Junction Boxes",
  "Power Accessories > Extension Cords & Multi-Plugs",
];

function WebsiteProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const actionParam = searchParams.get("action");

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState<number>(1);
  const itemsPerPage = 50;

  // Single Product Quick Edit State
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editBuffer, setEditBuffer] = useState<number>(5);
  const [editCategoryPath, setEditCategoryPath] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [savingProduct, setSavingProduct] = useState(false);

  // Step 2 Configuration State for newly selected items
  const [configuredItems, setConfiguredItems] = useState<ConfiguredItem[]>([]);
  const [isConfiguringNew, setIsConfiguringNew] = useState(false);
  const [batchCategory, setBatchCategory] = useState("");
  const [isCreatingCustomCategory, setIsCreatingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [batchBufferInput, setBatchBufferInput] = useState(5);
  const [publishingBatch, setPublishingBatch] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/storefront/manage/products");
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(data || []);
      return data || [];
    } catch (err: any) {
      toast.error(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts().then((allProds) => {
      // Check if arriving from Step 1 (catalog page) with selected products
      try {
        const saved = localStorage.getItem("storefront_selected_for_website");
        if (saved) {
          const selectedIds = JSON.parse(saved);
          if (Array.isArray(selectedIds) && selectedIds.length > 0) {
            const itemsToConfigure: ConfiguredItem[] = [];
            const idSet = new Set(selectedIds);

            allProds.forEach((p: any) => {
              if (idSet.has(p.id)) {
                const base = Number(p.costPrice || p.wholesalePrice || p.basePrice || 0);
                itemsToConfigure.push({
                  productId: p.id,
                  name: p.name,
                  sku: p.sku,
                  brand: p.brand,
                  warehouseStock: p.warehouseStock || 0,
                  basePrice: base,
                  onlinePrice: p.onlinePrice || (base > 0 ? base : Number(p.mrp || 0)),
                  category: p.category || "House Wires & Cables",
                  stockBuffer: p.stockBuffer ?? 5,
                });
              }
            });

            if (itemsToConfigure.length > 0) {
              setConfiguredItems(itemsToConfigure);
              setIsConfiguringNew(true);
            }
          }
        }
      } catch (e) {
        // ignore
      }
    });
  }, [actionParam]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter]);

  const fmt = (num: number) =>
    (num || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Known categories dynamically collected
  const allCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    products.forEach((p) => {
      if (p.category && p.category !== "General") set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Strictly Live Website Products
  const websiteProducts = useMemo(() => {
    return products.filter((p) => p.isPublished);
  }, [products]);

  const publishedCount = websiteProducts.length;

  const inStockOnlineCount = useMemo(() => {
    return websiteProducts.filter((p) => p.visibleOnlineStock > 0).length;
  }, [websiteProducts]);

  const liveCategories = useMemo(() => {
    const set = new Set<string>();
    websiteProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [websiteProducts]);

  // Filtered live website products
  const filteredWebsiteProducts = useMemo(() => {
    return websiteProducts.filter((p) => {
      if (categoryFilter !== "all" && p.category?.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      if (search) {
        const q = search.toLowerCase();
        return (
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [websiteProducts, categoryFilter, search]);

  const totalPages = Math.ceil(filteredWebsiteProducts.length / itemsPerPage) || 1;
  const paginatedWebsiteProducts = useMemo(() => {
    return filteredWebsiteProducts.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  }, [filteredWebsiteProducts, page]);

  // Toggle Live switch
  const togglePublish = async (prod: any, newValue: boolean) => {
    try {
      const res = await fetch("/api/storefront/manage/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: prod.id,
          isPublished: newValue,
          onlinePrice: prod.onlinePrice || prod.basePrice || 0,
          stockBuffer: prod.stockBuffer ?? 5,
          categorySlug: prod.categorySlug || prod.category || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update status");

      toast.success(
        newValue
          ? `${prod.name} is now LIVE on customer website!`
          : `${prod.name} removed from customer website`
      );

      setProducts((prev) =>
        prev.map((p) => (p.id === prod.id ? { ...p, isPublished: newValue } : p))
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Save single product settings
  const saveSingleProductSettings = async () => {
    if (!editingProduct) return;
    setSavingProduct(true);
    try {
      const res = await fetch("/api/storefront/manage/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editingProduct.id,
          isPublished: editingProduct.isPublished,
          onlineTitle: editTitle.trim() || editingProduct.name,
          onlineDescription: editDescription.trim(),
          onlinePrice: Number(editPrice),
          stockBuffer: Number(editBuffer),
          categorySlug: editCategoryPath.trim() || editingProduct.categorySlug || editingProduct.category,
        }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      toast.success("Website product settings saved!");
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                onlineTitle: editTitle.trim() || p.name,
                onlineDescription: editDescription.trim(),
                onlinePrice: Number(editPrice),
                stockBuffer: Number(editBuffer),
                category: editCategoryPath.trim() || p.category,
                categorySlug: editCategoryPath.trim() || p.categorySlug,
                visibleOnlineStock: Math.max(0, p.warehouseStock - Number(editBuffer)),
              }
            : p
        )
      );
      setEditingProduct(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingProduct(false);
    }
  };

  // Batch actions in Step 2 Configuration
  const applyBatchCategory = (category: string) => {
    if (!category) return;
    setConfiguredItems((prev) =>
      prev.map((item) => ({ ...item, category }))
    );
    toast.success(`Applied category "${category}" to all ${configuredItems.length} products!`);
  };

  const applyBatchMarkup = (percent: number) => {
    setConfiguredItems((prev) =>
      prev.map((item) => {
        const base = item.basePrice || 0;
        const newPrice = Math.round(base * (1 + percent / 100));
        return { ...item, onlinePrice: Math.max(newPrice, base) };
      })
    );
    toast.success(`Applied +${percent}% markup to all items!`);
  };

  const applyBatchBuffer = (buffer: number) => {
    setConfiguredItems((prev) =>
      prev.map((item) => ({ ...item, stockBuffer: buffer }))
    );
    toast.success(`Applied safety buffer (${buffer} units) to all items!`);
  };

  // Publish all configured items to website (Make Live)
  const handlePublishBatch = async () => {
    if (configuredItems.length === 0) {
      toast.error("No items to publish.");
      return;
    }

    setPublishingBatch(true);
    try {
      const itemsPayload = configuredItems.map((c) => ({
        productId: c.productId,
        isPublished: true,
        onlinePrice: Number(c.onlinePrice),
        stockBuffer: Number(c.stockBuffer),
        categorySlug: c.category,
      }));

      const res = await fetch("/api/storefront/manage/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsPayload }),
      });

      if (!res.ok) throw new Error("Failed to publish products");

      toast.success(
        `🎉 Successfully published ${configuredItems.length} products LIVE to BK Wiring Kade website!`
      );

      // Clear Step 2 configuration session
      try {
        localStorage.removeItem("storefront_selected_for_website");
      } catch (e) {}

      setIsConfiguringNew(false);
      setConfiguredItems([]);
      await fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish items");
    } finally {
      setPublishingBatch(false);
    }
  };

  const dismissConfiguration = () => {
    setIsConfiguringNew(false);
    setConfiguredItems([]);
    try {
      localStorage.removeItem("storefront_selected_for_website");
    } catch (e) {}
  };

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/office/storefront">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Website Products &amp; Live Pricing
                </h1>
                <Badge className="bg-emerald-600 text-white text-xs font-bold">
                  Step 2: Live Decision &amp; Pricing
                </Badge>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Decide which items are live on the website, configure categories, retail prices, and counter buffers
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Direct link to Step 1: All Catalog Products */}
          <Link href="/dashboard/office/storefront/catalog">
            <Button className="bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2 text-xs sm:text-sm">
              <Package className="w-4 h-4 text-amber-400" />
              Select More Items from Catalog (Step 1)
            </Button>
          </Link>

          <Button
            variant="outline"
            className="gap-2 text-xs sm:text-sm"
            onClick={() => window.open("/products", "_blank")}
          >
            <ExternalLink className="w-4 h-4 text-emerald-600" />
            View Live Customer Store
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              fetchProducts();
              toast.info("Refreshed website products");
            }}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Live on Website</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-700">{publishedCount}</div>
            <p className="text-xs text-emerald-600 font-medium mt-1">Visible to customer store</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">In Stock Online</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{inStockOnlineCount}</div>
            <p className="text-xs text-blue-600 font-medium mt-1">Available for instant order</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">Active Categories</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{liveCategories.length}</div>
            <p className="text-xs text-amber-600 font-medium mt-1">Shop departments</p>
          </CardContent>
        </Card>

        <Link href="/dashboard/office/storefront/catalog" className="block group">
          <Card className="border-l-4 border-l-slate-400 hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
                <span>Warehouse Catalog</span>
                <Package className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-slate-900">{products.length}</div>
              <p className="text-xs text-blue-600 font-medium mt-1 flex items-center gap-1">
                <span>Select more items</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ========================================================================= */}
      {/* STEP 2: ACTIVE CONFIGURATION PANEL (When selected items arrived from Step 1) */}
      {/* ========================================================================= */}
      {isConfiguringNew && configuredItems.length > 0 && (
        <Card className="border-2 border-emerald-500 shadow-md bg-white overflow-hidden animate-in fade-in slide-in-from-top-3">
          <CardHeader className="bg-emerald-950 text-white p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <CardTitle className="text-lg font-bold text-white">
                    Step 2: Configure &amp; Publish {configuredItems.length} Selected Products
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-emerald-200 mt-1">
                  Assign online categories, adjust retail prices, configure walk-in counter buffers, and publish live to the website.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismissConfiguration}
                  className="text-xs text-slate-300 hover:text-white"
                >
                  Discard
                </Button>
                <Button
                  onClick={handlePublishBatch}
                  disabled={publishingBatch}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs gap-1.5 shadow-md"
                >
                  {publishingBatch ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Save &amp; Publish All Live ({configuredItems.length})
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {/* Batch Action Toolbar */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                Batch Setup Tools (Apply to All {configuredItems.length} Items)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Tool 1: Assign Category */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Assign Category to All</label>
                  {!isCreatingCustomCategory ? (
                    <div className="flex gap-1.5">
                      <select
                        value={batchCategory}
                        onChange={(e) => {
                          if (e.target.value === "__NEW__") {
                            setIsCreatingCustomCategory(true);
                            setCustomCategoryInput("");
                          } else {
                            setBatchCategory(e.target.value);
                            applyBatchCategory(e.target.value);
                          }
                        }}
                        className="h-8 text-xs rounded-md border border-slate-300 bg-white px-2 flex-1"
                      >
                        <option value="">Choose category...</option>
                        {allCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value="__NEW__">➕ Create New Category...</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="Type new category..."
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!customCategoryInput.trim()) return;
                          applyBatchCategory(customCategoryInput.trim());
                          setIsCreatingCustomCategory(false);
                        }}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        Apply
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCreatingCustomCategory(false)}
                        className="h-8 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                {/* Tool 2: Batch Price Markup */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Adjust Prices (Batch Markup)</label>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyBatchMarkup(0)}
                      className="h-8 text-[11px] px-2 flex-1"
                    >
                      Cost (0%)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyBatchMarkup(10)}
                      className="h-8 text-[11px] px-2 flex-1 bg-emerald-50 text-emerald-800 border-emerald-200"
                    >
                      +10%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyBatchMarkup(15)}
                      className="h-8 text-[11px] px-2 flex-1 bg-emerald-50 text-emerald-800 border-emerald-200"
                    >
                      +15%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyBatchMarkup(20)}
                      className="h-8 text-[11px] px-2 flex-1 bg-emerald-50 text-emerald-800 border-emerald-200"
                    >
                      +20%
                    </Button>
                  </div>
                </div>

                {/* Tool 3: Walk-in Buffer */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Walk-in Buffer (Units)</label>
                  <div className="flex gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      value={batchBufferInput}
                      onChange={(e) => setBatchBufferInput(Number(e.target.value))}
                      className="h-8 text-xs w-20"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyBatchBuffer(batchBufferInput)}
                      className="h-8 text-xs flex-1"
                    >
                      Apply to All
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Editable Configuration Table */}
            <div className="rounded-md border max-h-[45vh] overflow-y-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="w-52">Online Category</TableHead>
                    <TableHead className="text-right">Wholesale Cost</TableHead>
                    <TableHead className="w-40 text-right">Online Retail Price (Rs.)</TableHead>
                    <TableHead className="w-24 text-center">Safety Buffer</TableHead>
                    <TableHead className="text-center">Live Units</TableHead>
                    <TableHead className="w-10 text-center">
                      <span className="sr-only">Remove</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configuredItems.map((item, index) => {
                    const visibleUnits = Math.max(0, item.warehouseStock - (item.stockBuffer || 0));

                    return (
                      <TableRow key={item.productId} className="hover:bg-slate-50">
                        <TableCell>
                          <div className="font-semibold text-slate-900 text-xs">{item.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {item.brand} • {item.sku}
                          </div>
                        </TableCell>

                        {/* Category selection */}
                        <TableCell>
                          <select
                            value={item.category}
                            onChange={(e) => {
                              const val = e.target.value;
                              setConfiguredItems((prev) =>
                                prev.map((c, i) => (i === index ? { ...c, category: val } : c))
                              );
                            }}
                            className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2"
                          >
                            {allCategories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </TableCell>

                        {/* Wholesale cost */}
                        <TableCell className="text-right text-xs text-slate-500 font-mono">
                          Rs. {fmt(item.basePrice)}
                        </TableCell>

                        {/* Online retail price */}
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            value={item.onlinePrice}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setConfiguredItems((prev) =>
                                prev.map((c, i) => (i === index ? { ...c, onlinePrice: val } : c))
                              );
                            }}
                            className="h-8 text-xs font-bold text-emerald-800 text-right"
                          />
                        </TableCell>

                        {/* Stock buffer */}
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            value={item.stockBuffer}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setConfiguredItems((prev) =>
                                prev.map((c, i) => (i === index ? { ...c, stockBuffer: val } : c))
                              );
                            }}
                            className="h-8 text-xs text-center w-16 mx-auto"
                          />
                        </TableCell>

                        {/* Live available units */}
                        <TableCell className="text-center font-bold text-xs">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs",
                              visibleUnits > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            )}
                          >
                            {visibleUnits}
                          </span>
                        </TableCell>

                        {/* Remove button */}
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setConfiguredItems((prev) => prev.filter((c) => c.productId !== item.productId));
                            }}
                            className="h-7 w-7 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* MAIN WEBSITE PRODUCTS TABLE (Strictly Live Items Only)                    */}
      {/* ========================================================================= */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg">
                Website Live Products
              </CardTitle>
              <Badge className="bg-emerald-600 text-white text-xs font-bold">
                {filteredWebsiteProducts.length} live
              </Badge>
            </div>
            <CardDescription className="text-xs mt-1">
              Strictly showing products currently visible and active on BK Wiring Kade customer store.
            </CardDescription>
          </div>

          {/* Search & Category Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {liveCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 text-xs rounded-md border border-slate-200 bg-white px-2.5"
              >
                <option value="all">All Departments ({publishedCount})</option>
                {liveCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={`Search ${publishedCount} live items...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Online Category</TableHead>
                  <TableHead>Brand &amp; SKU</TableHead>
                  <TableHead className="text-center">Warehouse Stock</TableHead>
                  <TableHead className="text-center">Safety Buffer</TableHead>
                  <TableHead className="text-center">Available Online</TableHead>
                  <TableHead className="text-right">Wholesale Cost</TableHead>
                  <TableHead className="text-right">Live Online Price (Rs.)</TableHead>
                  <TableHead className="text-center">Live Online</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-16 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                      Loading live website products...
                    </TableCell>
                  </TableRow>
                ) : filteredWebsiteProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-16 text-center">
                      <div className="max-w-md mx-auto space-y-4">
                        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                          <Globe className="w-7 h-7" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">
                            No products are currently live on the website
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                            Your customer storefront only displays products you choose. Head over to the All Catalog Products page to select items from your warehouse inventory.
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <Link href="/dashboard/office/storefront/catalog">
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs">
                              <Package className="w-4 h-4" />
                              Go to All Catalog Products (Step 1)
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedWebsiteProducts.map((p) => {
                    const isLive = p.isPublished;
                    const onlineStock = Math.max(0, (p.warehouseStock || 0) - (p.stockBuffer || 0));

                    return (
                      <TableRow key={p.id} className="hover:bg-slate-50/80">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Live Online" />
                            <div>
                              <div className="font-semibold text-slate-900 text-xs sm:text-sm">{p.name}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{p.sku}</div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold"
                          >
                            {p.category || "General"}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className="text-[11px]">
                            {p.brand || "BK"}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-center font-medium">
                          <span className={p.warehouseStock <= 0 ? "text-rose-600 font-bold" : "text-slate-800"}>
                            {p.warehouseStock || 0}
                          </span>
                        </TableCell>

                        <TableCell className="text-center text-slate-500">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">
                            {p.stockBuffer || 0}
                          </span>
                        </TableCell>

                        <TableCell className="text-center font-bold">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-bold",
                              onlineStock > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            )}
                          >
                            {onlineStock}
                          </span>
                        </TableCell>

                        <TableCell className="text-right text-xs text-slate-500 font-mono">
                          Rs. {fmt(p.basePrice || p.costPrice || p.wholesalePrice)}
                        </TableCell>

                        <TableCell className="text-right font-bold text-emerald-700 text-xs sm:text-sm">
                          Rs. {fmt(p.onlinePrice || p.basePrice)}
                        </TableCell>

                        <TableCell className="text-center">
                          <Switch
                            checked={isLive}
                            onCheckedChange={(val) => togglePublish(p, val)}
                          />
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => {
                              setEditingProduct(p);
                              setEditTitle(p.onlineTitle || p.name || "");
                              setEditPrice(p.onlinePrice || p.basePrice || 0);
                              setEditBuffer(p.stockBuffer ?? 5);
                              setEditCategoryPath(p.categorySlug || p.category || "Wiring Accessories > Cables & Wires > Household Cables & Wires");
                              setEditDescription(p.onlineDescription || "");
                            }}
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                            Settings
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t mt-4 text-xs">
              <div className="text-slate-500">
                Page <span className="font-bold text-slate-900">{page}</span> of{" "}
                <span className="font-bold text-slate-900">{totalPages}</span> ({filteredWebsiteProducts.length} total)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </Button>
                <div className="text-slate-600 font-mono text-xs px-2">
                  {page} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 text-xs gap-1"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* SINGLE PRODUCT QUICK EDIT MODAL                                           */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* SINGLE PRODUCT QUICK EDIT MODAL                                           */}
      {/* ========================================================================= */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                <Globe className="w-4 h-4" />
              </span>
              <div>
                <DialogTitle className="text-base font-extrabold text-slate-900">
                  Website Product &amp; Path Manager
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Link distribution inventory to BK Wiring Kade customer website with custom SEO titles and category breadcrumbs.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {editingProduct && (
            <div className="space-y-4 py-2">
              {/* Distribution Linked Item Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-slate-500" />
                    Linked Distribution Item
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    SKU: {editingProduct.sku}
                  </Badge>
                </div>
                <div className="font-semibold text-slate-900 text-sm">
                  {editingProduct.name}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 pt-1 border-t border-slate-200/60 text-[11px]">
                  <span>Supplier: <strong className="text-slate-700">{editingProduct.supplierName || editingProduct.brand || "Standard"}</strong></span>
                  <span>Warehouse Stock: <strong className="text-slate-700">{editingProduct.warehouseStock} units</strong></span>
                  <span>Wholesale Cost: <strong className="text-slate-700">Rs. {fmt(editingProduct.costPrice || editingProduct.basePrice)}</strong></span>
                </div>
                <p className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1 border border-amber-200/60 mt-1">
                  Distribution wholesale records are protected and cannot be changed here. The fields below only customize customer-facing storefront presentation.
                </p>
              </div>

              {/* Online Product Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Customer Website Display Title</span>
                  <span className="text-[10px] font-normal text-slate-400">Shown on public store</span>
                </label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. ACL Fire Guard 1/1.13mm Single Core 1mm² Cable..."
                  className="text-xs font-medium"
                />
              </div>

              {/* Category Path Management */}
              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    Category Hierarchy Breadcrumb Path
                  </label>
                  <span className="text-[10px] text-slate-400">Separate levels with &ldquo; &gt; &rdquo;</span>
                </div>

                <div className="space-y-1.5">
                  <select
                    onChange={(e) => {
                      if (e.target.value) setEditCategoryPath(e.target.value);
                    }}
                    defaultValue=""
                    className="w-full h-8 text-xs rounded-md border border-slate-300 bg-white px-2 text-slate-700 font-medium"
                  >
                    <option value="" disabled>-- Select a standard category path preset --</option>
                    {COMMON_CATEGORY_PATHS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  <Input
                    value={editCategoryPath}
                    onChange={(e) => setEditCategoryPath(e.target.value)}
                    placeholder="Main Category > Sub Category > Department"
                    className="text-xs font-mono bg-white"
                  />
                </div>

                {/* Live Breadcrumb Preview */}
                {editCategoryPath && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Live Storefront Breadcrumb Preview:
                    </span>
                    <div className="flex items-center gap-1 flex-wrap text-[11px] text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-medium">Home</span>
                      {editCategoryPath.split(">").map((seg, i) => (
                        <React.Fragment key={i}>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                          <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                            {seg.trim()}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Online Retail Price & Walk-in Stock Buffer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    Online Retail Price (Rs.)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="text-xs font-extrabold text-emerald-800"
                  />
                  <p className="text-[10px] text-slate-500">
                    Wholesale cost: Rs. {fmt(editingProduct?.basePrice || editingProduct?.costPrice)}
                    {editPrice > 0 && (editingProduct?.basePrice || editingProduct?.costPrice) > 0 && (
                      <span className="ml-1 text-emerald-600 font-bold">
                        (+{Math.round(((editPrice - (editingProduct?.basePrice || editingProduct?.costPrice)) / (editingProduct?.basePrice || editingProduct?.costPrice)) * 100)}% margin)
                      </span>
                    )}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    Walk-in Reserve Buffer
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={editBuffer}
                    onChange={(e) => setEditBuffer(Number(e.target.value))}
                    className="text-xs"
                  />
                  <p className="text-[10px] text-slate-500">
                    Online Visible Stock: <strong className="text-slate-800">{Math.max(0, (editingProduct?.warehouseStock || 0) - editBuffer)} units</strong>
                  </p>
                </div>
              </div>

              {/* Specifications / Key Points */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Product Specifications &amp; Features (Bullet Points)</span>
                  <span className="text-[10px] font-normal text-slate-400">One bullet per line</span>
                </label>
                <Textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder={"• Conductor Area: 1mm² Nominal Core Size\n• Insulation Type: Premium Double Insulated CU/PVC/PVC\n• Safety Ratings: Full SLS 733 / IEC 60227 Compliance\n• Voltage & Heat: 300V/500V Power Capacity at 70 °C"}
                  className="text-xs leading-relaxed font-sans"
                />
                <p className="text-[10px] text-slate-400">
                  Tip: Enter specs like SLS certifications, amperage, conductor type. Each line will show as a clean bullet point on the product page.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setEditingProduct(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
              disabled={savingProduct}
              onClick={saveSingleProductSettings}
            >
              {savingProduct ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Save Website Settings
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function StorefrontProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <WebsiteProductsContent />
    </Suspense>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
