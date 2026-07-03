"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Package,
  Loader2,
  Check,
  ChevronsUpDown,
  Pencil,
  X,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

interface Product {
  id: string;
  sku: string;
  name: string;
  selling_price: number;
  retail_price?: number | null;
  mrp: number;
  stock_quantity: number;
  unit_of_measure: string;
  supplier?: string;
  retailOnly?: boolean;
}

interface Customer {
  id: string;
  name: string;
  shop_name: string;
  owner_name: string;
}

interface QuotationItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  freeQuantity: number;
  unit: string;
  mrp: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  currentStock: number;
  supplier?: string;
  retailOnly?: boolean;
}

interface CurrentItemState {
  productId: string;
  sku: string;
  quantity: number | "";
  freeQuantity: number | "";
  unit: string;
  mrp: number | "";
  unitPrice: number | "";
  discountPercent: number | "";
  currentStock: number;
}

export default function CreateQuotationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [businessId] = useState(BUSINESS_IDS.CHAMPIKA_RETAIL);
  const [businessName, setBusinessName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [guestCustomerId, setGuestCustomerId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentType, setPaymentType] = useState("Cash");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<QuotationItem[]>([]);
  const [extraDiscount, setExtraDiscount] = useState(0);

  const [customerOpen, setCustomerOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<"all" | "sierra" | "wireman" | "orange" | "retail" | "other">("all");

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<CurrentItemState>({
    productId: "", sku: "", quantity: "", freeQuantity: "", unit: "",
    mrp: "", unitPrice: "", discountPercent: "", currentStock: 0,
  });

  const quantityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const user = getUserBusinessContext();
        if (!user) { router.push("/login"); return; }

        setBusinessName(user.businessName ?? BUSINESS_NAMES[BUSINESS_IDS.CHAMPIKA_RETAIL]);
        setUserId(user.id);

        const [customersRes, productsRes] = await Promise.all([
          fetch(`/api/customers?businessId=${BUSINESS_IDS.CHAMPIKA_RETAIL}`),
          fetch(`/api/rep/stock?userId=${user.id}&includeOutOfStock=true`),
        ]);

        const customersData = await customersRes.json();
        const productsData = await productsRes.json();

        const retailCustomers = (customersData || []).filter(
          (c: any) => c.business_id === BUSINESS_IDS.CHAMPIKA_RETAIL || c.businessId === BUSINESS_IDS.CHAMPIKA_RETAIL
        );

        const guest = retailCustomers.find((c: any) => {
          const n = (c.shop_name || c.shopName || c.name || "").toLowerCase();
          return n.includes("walk-in") || n.includes("guest");
        });
        if (guest) { setGuestCustomerId(guest.id); setCustomerId(guest.id); }

        setCustomers(retailCustomers.map((c: any) => ({
          id: c.id,
          name: c.shop_name || c.shopName,
          shop_name: c.shop_name || c.shopName,
          owner_name: c.owner_name || c.ownerName,
        })));

        if (Array.isArray(productsData)) {
          setProducts(productsData.map((p: any) => ({
            id: p.id, sku: p.sku, name: p.name,
            selling_price: p.selling_price || 0,
            retail_price: p.retail_price ?? null,
            mrp: p.mrp || 0,
            stock_quantity: p.stock_quantity || 0,
            unit_of_measure: p.unit_of_measure || "unit",
            supplier: p.supplier || "",
            retailOnly: p.retailOnly ?? p.retail_only ?? false,
          })));
        }
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setCurrentItem({
      productId: product.id, sku: product.sku,
      quantity: "", freeQuantity: "", unit: product.unit_of_measure,
      mrp: product.mrp, unitPrice: product.retail_price ?? product.selling_price,
      discountPercent: "", currentStock: product.stock_quantity,
    });
    setTimeout(() => { quantityInputRef.current?.focus(); quantityInputRef.current?.select(); }, 150);
  };

  const resetCurrentItem = () => {
    setCurrentItem({ productId: "", sku: "", quantity: "", freeQuantity: "", unit: "", mrp: "", unitPrice: "", discountPercent: "", currentStock: 0 });
    setEditingItemId(null);
  };

  const handleEditItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    setEditingItemId(itemId);
    setCurrentItem({
      productId: item.productId, sku: item.sku, quantity: item.quantity,
      freeQuantity: item.freeQuantity, unit: item.unit, mrp: item.mrp,
      unitPrice: item.unitPrice, discountPercent: item.discountPercent,
      currentStock: item.currentStock,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAddItem = () => {
    if (!currentItem.productId) { toast.error("Please select a product"); return; }
    const qty = currentItem.quantity === "" ? 0 : currentItem.quantity;
    if (qty <= 0) { toast.error("Quantity must be greater than 0"); return; }

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    const unitPrice = currentItem.unitPrice === "" ? 0 : currentItem.unitPrice;
    const mrp = currentItem.mrp === "" ? 0 : currentItem.mrp;
    const freeQty = currentItem.freeQuantity === "" ? 0 : currentItem.freeQuantity;
    const discountPercent = currentItem.discountPercent === "" ? 0 : currentItem.discountPercent;
    const grossTotal = unitPrice * qty;
    const discountAmount = (grossTotal * discountPercent) / 100;

    const updatedItem: QuotationItem = {
      id: editingItemId ?? Date.now().toString(),
      productId: currentItem.productId, sku: product.sku, productName: product.name,
      unit: product.unit_of_measure, quantity: qty, freeQuantity: freeQty,
      mrp, unitPrice, discountPercent, discountAmount,
      total: grossTotal - discountAmount,
      currentStock: product.stock_quantity,
      supplier: product.supplier || "", retailOnly: product.retailOnly || false,
    };

    if (editingItemId) {
      setItems(items.map((i) => (i.id === editingItemId ? updatedItem : i)));
      toast.success("Item updated");
    } else {
      setItems([...items, updatedItem]);
    }
    resetCurrentItem();
  };

  const handleSave = async () => {
    if (!customerId) { toast.error("Please select a customer"); return; }
    if (items.length === 0) { toast.error("Please add at least one item"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          businessId,
          salesRepId: userId,
          items: items.map((i) => ({
            productId: i.productId, sku: i.sku, productName: i.productName,
            quantity: i.quantity, freeQuantity: i.freeQuantity, unit: i.unit,
            mrp: i.mrp, unitPrice: i.unitPrice, discountPercent: i.discountPercent,
            discountAmount: i.discountAmount, total: i.total,
            supplier: i.supplier, retailOnly: i.retailOnly,
          })),
          invoiceDate: quotationDate,
          subTotal: subtotal,
          extraDiscountPercent: extraDiscount,
          extraDiscountAmount: extraDiscountAmount,
          grandTotal,
          paymentType,
          notes: notes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create quotation");

      toast.success(`Quotation ${data.data.quotation_no} saved!`);
      router.push(`/dashboard/office/retail/quotations/${data.data.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save quotation");
    } finally {
      setSaving(false);
    }
  };

  // Totals
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const grossTotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const totalItemDiscount = items.reduce((s, i) => s + i.discountAmount, 0);
  const extraDiscountAmount = (subtotal * extraDiscount) / 100;
  const grandTotal = subtotal - extraDiscountAmount;

  const safeUnitPrice = currentItem.unitPrice === "" ? 0 : currentItem.unitPrice;
  const safeQty = currentItem.quantity === "" ? 0 : currentItem.quantity;
  const safeDiscount = currentItem.discountPercent === "" ? 0 : currentItem.discountPercent;
  const currentLineTotal = safeUnitPrice * safeQty - (safeUnitPrice * safeQty * safeDiscount) / 100;

  const filteredProducts = products.filter((p) => {
    if (!items.some((i) => i.productId === p.id) || p.id === currentItem.productId) {
      if (supplierFilter === "all") return true;
      if (supplierFilter === "retail") return p.retailOnly;
      const sup = (p.supplier || "").toLowerCase();
      if (supplierFilter === "sierra") return sup.includes("sierra") && !p.retailOnly;
      if (supplierFilter === "wireman") return sup.includes("wireman") && !p.retailOnly;
      if (supplierFilter === "orange") return sup.includes("orange") && !p.retailOnly;
      if (supplierFilter === "other") return !sup.includes("sierra") && !sup.includes("wireman") && !sup.includes("orange") && !p.retailOnly;
    }
    return false;
  });

  if (loading) return <div className="flex justify-center items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-green-600" /></div>;

  return (
    <div className="space-y-4 pb-28 xl:pb-6 mx-auto">
      {/* Desktop header */}
      <div className="hidden xl:flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.push("/dashboard/office/retail/quotations")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Create Quotation</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{businessName} · New quotation (no stock deducted until converted)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={items.length === 0 || saving}
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Quotation
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* LEFT */}
        <div className="xl:col-span-2 space-y-4">
          {/* Details */}
          <Card>
            <CardHeader className="pb-0 flex flex-row items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 xl:hidden" onClick={() => router.push("/dashboard/office/retail/quotations")}>
                <ArrowLeft className="w-4 h-4 text-slate-500" />
              </Button>
              <div className="flex-1">
                <CardTitle className="text-base">Quotation Details</CardTitle>
                <p className="text-xs text-amber-600 mt-0.5">Stock is NOT deducted until this quotation is converted to a bill.</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Customer <span className="text-red-500">*</span></Label>
                    {guestCustomerId && customerId !== guestCustomerId && (
                      <Button variant="secondary" size="sm" className="h-6 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200" onClick={() => { setCustomerId(guestCustomerId); setCustomerOpen(false); }}>
                        Select Walk-in
                      </Button>
                    )}
                  </div>
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between">
                        {customerId ? customers.find((c) => c.id === customerId)?.name : "Select Customer"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search customer..." />
                        <CommandList>
                          <CommandEmpty>No customer found</CommandEmpty>
                          <CommandGroup>
                            {customers.map((c) => (
                              <CommandItem key={c.id} value={`${c.name} ${c.owner_name || ""}`} onSelect={() => { setCustomerId(c.id); setCustomerOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", customerId === c.id ? "opacity-100" : "opacity-0")} />
                                <div>
                                  <div className="font-medium">{c.name}</div>
                                  {c.owner_name && <div className="text-xs text-muted-foreground">{c.owner_name}</div>}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} className="h-11" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">💵 Cash</SelectItem>
                      <SelectItem value="Credit">📋 Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input placeholder="Optional note for this quotation..." value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add Products */}
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Add Products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              {/* Supplier filter */}
              <div className="flex gap-2 pb-2 border-b overflow-x-auto scrollbar-hide flex-nowrap">
                {(["all", "sierra", "wireman", "orange", "retail", "other"] as const).map((f) => {
                  const labels: Record<string, string> = { all: "🌐 All", sierra: "🟣 Sierra", wireman: "🔴 Wireman", orange: "🟠 Orange", retail: "🛍️ Retail Only", other: "⚪ Other" };
                  const colors: Record<string, string> = { all: "bg-slate-900", sierra: "bg-purple-600", wireman: "bg-red-600", orange: "bg-orange-500", retail: "bg-emerald-600", other: "bg-slate-600" };
                  return (
                    <Button key={f} type="button" variant={supplierFilter === f ? "default" : "outline"} size="sm"
                      onClick={() => setSupplierFilter(f)}
                      className={cn("h-8 text-xs font-semibold rounded-full shrink-0 transition-all", supplierFilter === f && `${colors[f]} text-white`)}>
                      {labels[f]}
                    </Button>
                  );
                })}
              </div>

              {/* Product search */}
              <Popover open={productOpen} onOpenChange={setProductOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between" disabled={stockLoading}>
                    {currentItem.productId ? products.find((p) => p.id === currentItem.productId)?.name : "Select Product"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" side="bottom" avoidCollisions={false}>
                  <Command>
                    <CommandInput placeholder="Search product..." />
                    <CommandList className="max-h-[400px]">
                      <CommandEmpty>No products found</CommandEmpty>
                      <CommandGroup>
                        {filteredProducts.map((p) => {
                          const isSierra = (p.supplier || "").toLowerCase().includes("sierra");
                          const isWireman = (p.supplier || "").toLowerCase().includes("wireman");
                          const isOrange = (p.supplier || "").toLowerCase().includes("orange");
                          const isRetailOnly = p.retailOnly;
                          let borderClass = "border-l-4 border-slate-300";
                          let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
                          let supplierLabel = "Other";
                          if (isRetailOnly) { borderClass = "border-l-4 border-emerald-500"; badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200"; supplierLabel = "Retail Only"; }
                          else if (isSierra) { borderClass = "border-l-4 border-purple-500"; badgeColor = "bg-purple-100 text-purple-700 border-purple-200"; supplierLabel = "Sierra"; }
                          else if (isWireman) { borderClass = "border-l-4 border-red-500"; badgeColor = "bg-red-100 text-red-700 border-red-200"; supplierLabel = "Wireman"; }
                          else if (isOrange) { borderClass = "border-l-4 border-orange-500"; badgeColor = "bg-orange-100 text-orange-700 border-orange-200"; supplierLabel = "Orange"; }
                          return (
                            <CommandItem key={p.id} value={`${p.name} ${p.sku} ${p.supplier || ""}`}
                              onSelect={() => { handleProductSelect(p.id); setProductOpen(false); }}
                              className={cn("px-3 py-2 cursor-pointer", borderClass)}>
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", currentItem.productId === p.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-900 truncate">{p.name}</span>
                                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0", badgeColor)}>{supplierLabel}</span>
                                </div>
                                <div className="text-xs text-muted-foreground flex gap-x-2 mt-0.5">
                                  <span className="font-mono">{p.sku}</span>
                                  <span>•</span>
                                  <span>Stock: <strong className={p.stock_quantity === 0 ? "text-red-500" : "text-slate-700"}>{p.stock_quantity}</strong></span>
                                  <span>•</span>
                                  <span>LKR {(p.retail_price ?? p.selling_price).toLocaleString()}</span>
                                </div>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Qty + Free Qty + Unit + Stock */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Quantity</Label>
                  <Input ref={quantityInputRef} type="number" min="1" value={currentItem.quantity} className="h-11"
                    onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value === "" ? "" : Number(e.target.value) })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Free Qty</Label>
                  <Input type="number" min="0" value={currentItem.freeQuantity} className="h-11"
                    onChange={(e) => setCurrentItem({ ...currentItem, freeQuantity: e.target.value === "" ? "" : Number(e.target.value) })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Unit</Label>
                  <Input value={currentItem.unit || "—"} disabled className="bg-muted h-11 text-center font-medium" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">In Stock</Label>
                  <Input value={currentItem.currentStock || "—"} disabled
                    className={cn("h-11 text-center font-bold bg-muted", currentItem.currentStock === 0 ? "text-red-500" : "text-slate-700")} />
                </div>
              </div>

              {/* Price row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">MRP</Label>
                  <Input type="number" value={currentItem.mrp} className="h-11"
                    onChange={(e) => setCurrentItem({ ...currentItem, mrp: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Unit Price</Label>
                  <Input type="number" value={currentItem.unitPrice} className="h-11"
                    onChange={(e) => setCurrentItem({ ...currentItem, unitPrice: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Discount %</Label>
                  <Input type="number" min="0" max="100" value={currentItem.discountPercent} className="h-11"
                    onChange={(e) => setCurrentItem({ ...currentItem, discountPercent: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Line Total</Label>
                  <Input value={currentLineTotal.toFixed(2)} disabled className="h-11 font-bold bg-green-50 text-green-700 border-green-100 text-right" />
                </div>
              </div>

              {/* Add/Update button */}
              <div className={cn("grid gap-2", editingItemId ? "grid-cols-2" : "grid-cols-1")}>
                {editingItemId && (
                  <Button variant="outline" onClick={resetCurrentItem} className="h-12"><X className="w-4 h-4 mr-2" />Cancel</Button>
                )}
                <Button onClick={handleAddItem} disabled={!currentItem.productId}
                  className={cn("h-12 text-base font-bold", editingItemId ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700")}>
                  {editingItemId ? <><Pencil className="w-4 h-4 mr-2" />Update Item</> : <><Plus className="w-4 h-4 mr-2" />Add to Quotation</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quotation Items</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground rounded-lg border border-dashed">
                  <Package className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">No items added yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const isSierra = (item.supplier || "").toLowerCase().includes("sierra");
                    const isWireman = (item.supplier || "").toLowerCase().includes("wireman");
                    const isOrange = (item.supplier || "").toLowerCase().includes("orange");
                    const isRetailOnly = item.retailOnly;
                    let leftBorder = "border-l-4 border-l-slate-200";
                    let supplierLabel = "";
                    let badgeCls = "bg-slate-100 text-slate-600 border-slate-200";
                    if (isRetailOnly) { leftBorder = "border-l-4 border-l-emerald-500"; supplierLabel = "Retail Only"; badgeCls = "bg-emerald-100 text-emerald-700 border-emerald-200"; }
                    else if (isSierra) { leftBorder = "border-l-4 border-l-purple-500"; supplierLabel = "Sierra"; badgeCls = "bg-purple-100 text-purple-700 border-purple-200"; }
                    else if (isWireman) { leftBorder = "border-l-4 border-l-red-500"; supplierLabel = "Wireman"; badgeCls = "bg-red-100 text-red-700 border-red-200"; }
                    else if (isOrange) { leftBorder = "border-l-4 border-l-orange-500"; supplierLabel = "Orange"; badgeCls = "bg-orange-100 text-orange-700 border-orange-200"; }
                    const isEditing = editingItemId === item.id;
                    return (
                      <div key={item.id} className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors", leftBorder, isEditing ? "bg-blue-50/60 border-blue-200" : "hover:bg-muted/40")}>
                        <span className="text-xs text-muted-foreground w-5 shrink-0 text-center">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm">{item.productName}</span>
                            {supplierLabel && <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0", badgeCls)}>{supplierLabel}</span>}
                            {item.currentStock === 0 && (
                              <span className="text-[10px] font-bold text-red-500 border border-red-200 bg-red-50 px-1.5 py-0.5 rounded shrink-0">Out of Stock</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-2.5 mt-1 text-xs text-muted-foreground">
                            <span className="font-mono text-[11px]">{item.sku}</span>
                            <span>·</span>
                            <span>{item.quantity} {item.unit}</span>
                            {item.freeQuantity > 0 && <><span>·</span><span className="text-green-600">+{item.freeQuantity} free</span></>}
                            <span>·</span>
                            <span>LKR {item.unitPrice.toLocaleString()}</span>
                            <span>·</span>
                            <span className="text-slate-500">Avail: {item.currentStock}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-bold text-sm text-slate-800 min-w-[60px] text-right">{item.total.toLocaleString()}</span>
                          <Button variant="ghost" size="icon" className={cn("h-7 w-7", isEditing && "bg-blue-100")} onClick={() => handleEditItem(item.id)}>
                            <Pencil className="w-3.5 h-3.5 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setItems(items.filter((i) => i.id !== item.id)); if (editingItemId === item.id) resetCurrentItem(); }}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="xl:col-span-1 hidden xl:block">
          <Card className="sticky top-6">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-base font-semibold text-slate-700">Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Customer</p>
                <p className="text-sm font-semibold text-slate-800">
                  {customers.find((c) => c.id === customerId)?.name || <span className="text-muted-foreground italic">Not selected</span>}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Payment</p>
                <p className={cn("text-sm font-semibold", paymentType === "Cash" ? "text-green-600" : "text-orange-600")}>
                  {paymentType === "Cash" ? "💵 Cash" : "📋 Credit"}
                </p>
              </div>
              <div className="border-t pt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Gross Total</span><span>LKR {grossTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Item Discounts</span><span className="text-red-500">− LKR {totalItemDiscount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-1">
                  <span>Subtotal</span><span>LKR {subtotal.toLocaleString()}</span>
                </div>
              </div>
              <div className="border-t pt-3 space-y-2">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Extra Discount %</Label>
                <Input type="number" min="0" max="100" value={extraDiscount} onChange={(e) => setExtraDiscount(Number(e.target.value))} className="h-10" />
                {extraDiscountAmount > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Extra Discount</span><span className="text-red-500">− LKR {extraDiscountAmount.toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3.5">
                <p className="text-[10px] uppercase tracking-widest text-amber-700 font-bold mb-1">Quotation Total</p>
                <p className="text-2xl font-black text-amber-700">LKR {grandTotal.toLocaleString()}</p>
                {items.length > 0 && <p className="text-[11px] text-amber-600 mt-1">{items.length} product{items.length !== 1 ? "s" : ""}</p>}
              </div>
              <Button onClick={handleSave} disabled={items.length === 0 || saving} className="w-full h-11 bg-green-600 hover:bg-green-700 font-bold">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Save Quotation
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-lg px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="font-bold text-base text-amber-600 truncate">LKR {grandTotal.toLocaleString()}</span>
            </div>
            <div className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Extra %</Label>
            <Input type="number" min="0" max="100" placeholder="0" value={extraDiscount} onChange={(e) => setExtraDiscount(Number(e.target.value))} className="w-16 h-9 text-sm text-center" />
          </div>
          <Button size="sm" onClick={handleSave} disabled={items.length === 0 || saving} className="h-10 bg-green-600 hover:bg-green-700 font-bold shrink-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 sm:mr-1.5" />}
            <span className="hidden sm:inline ml-1.5">Save Quotation</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
