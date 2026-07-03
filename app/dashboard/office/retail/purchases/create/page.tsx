"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Save, Loader2, ShoppingCart, RefreshCcw, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { ProductDialogs } from "@/app/dashboard/admin/products/_components/ProductDialogs";
import { ProductFormData } from "@/app/dashboard/admin/products/types";
import { SupplierDialogs } from "@/app/dashboard/admin/suppliers/_components/SupplierDialogs";
import { SupplierFormData } from "@/app/dashboard/admin/suppliers/types";

interface Product {
  id: string;
  sku: string;
  companyCode?: string;
  name: string;
  sellingPrice: number;
  costPrice: number;
  mrp: number;
  stock: number;
  unitOfMeasure: string;
  supplier: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface PurchaseItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  freeQuantity: number;
  unit: string;
  mrp: number;
  sellingPrice: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  total: number;
}

const parseNumber = (val: string | number) => {
  if (val === "" || val === undefined || val === null) return 0;
  return Number(val);
};

export default function CreateRetailPurchasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedSupplierId = searchParams.get("supplierId");

  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string; parent_id?: string }[]>([]);
  const [supplierCategories, setSupplierCategories] = useState<{ id: string; name: string }[]>([]);
  const [submittingProduct, setSubmittingProduct] = useState(false);

  const [productFormData, setProductFormData] = useState<ProductFormData>({
    sku: "", companyCode: "", name: "", category: "", subCategory: "", brand: "", subBrand: "",
    modelType: "", subModel: "", sizeSpec: "", supplier: "", stock: "0", minStock: "0",
    mrp: "", sellingPrice: "", costPrice: "", images: [], unitOfMeasure: "Pcs", isActive: true,
    retailOnly: false, retailPrice: "",
  });

  const [isAddSupplierDialogOpen, setIsAddSupplierDialogOpen] = useState(false);
  const [submittingSupplier, setSubmittingSupplier] = useState(false);
  const [supplierFormData, setSupplierFormData] = useState<SupplierFormData>({
    name: "", contactPerson: "", email: "", phone: "", address: "", category: "", status: "Active",
    duePayment: 0, businessId: BUSINESS_IDS.CHAMPIKA_RETAIL,
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [supplierId, setSupplierId] = useState<string | null>(preSelectedSupplierId);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [arrivalDate, setArrivalDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [extraDiscountPercent, setExtraDiscountPercent] = useState<number | string>("");
  const [items, setItems] = useState<PurchaseItem[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const [currentItem, setCurrentItem] = useState<{
    productId: string; sku: string; quantity: number | string; freeQuantity: number | string;
    mrp: number; sellingPrice: number; unitPrice: number | string; discountPercent: number | string; unit: string;
  }>({ productId: "", sku: "", quantity: "", freeQuantity: "", mrp: 0, sellingPrice: 0, unitPrice: "", discountPercent: "", unit: "" });

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [prodRes, supRes, catRes, supCatRes] = await Promise.all([
        fetch("/api/products?active=true"),
        fetch(`/api/suppliers?businessId=${BUSINESS_IDS.CHAMPIKA_RETAIL}`),
        fetch("/api/settings/categories?type=category"),
        fetch("/api/settings/categories?type=supplier"),
      ]);
      if (catRes.ok) setCategories(await catRes.json());
      if (supCatRes.ok) setSupplierCategories(await supCatRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
      if (supRes.ok) {
        const supData = await supRes.json();
        setSuppliers(supData);
        if (!preSelectedSupplierId && supData.length === 1) setSupplierId(supData[0].id);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        searchInputRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  const filteredProducts = products.filter((p) => {
    if (!searchTerm) return true;
    const words = searchTerm.toLowerCase().trim().split(/\s+/);
    return words.every((w) =>
      (p.name?.toLowerCase() || "").includes(w) ||
      (p.sku?.toLowerCase() || "").includes(w) ||
      (p.companyCode?.toLowerCase() || "").includes(w)
    );
  });

  const handleProductSelect = (product: Product) => {
    setCurrentItem({
      ...currentItem, productId: product.id, sku: product.sku, mrp: product.mrp || 0,
      sellingPrice: product.sellingPrice || 0, unitPrice: product.costPrice > 0 ? product.costPrice : "",
      discountPercent: "", freeQuantity: "", quantity: "", unit: product.unitOfMeasure || "Pcs",
    });
    setSearchTerm(product.name);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    setTimeout(() => qtyInputRef.current?.focus({ preventScroll: true }), 100);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") setIsDropdownOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => { const next = prev < filteredProducts.length - 1 ? prev + 1 : prev; itemRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "nearest" }); return next; });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => { const next = prev > 0 ? prev - 1 : prev; itemRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "nearest" }); return next; });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) handleProductSelect(filteredProducts[highlightedIndex]);
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  const handleAddItem = () => {
    const qty = parseNumber(currentItem.quantity);
    const unitPrice = parseNumber(currentItem.unitPrice);
    if (!currentItem.productId || qty <= 0) { toast.error("Please enter a valid quantity"); return; }
    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;
    const discountPct = parseNumber(currentItem.discountPercent);
    const freeQty = parseNumber(currentItem.freeQuantity);
    const unitDiscountAmount = (unitPrice * discountPct) / 100;
    const netUnitPrice = unitPrice - unitDiscountAmount;
    setItems([...items, {
      id: Date.now().toString(), productId: currentItem.productId, sku: product.sku,
      productName: product.name, quantity: qty, freeQuantity: freeQty, unit: currentItem.unit,
      mrp: currentItem.mrp, sellingPrice: currentItem.sellingPrice, unitPrice, discountPercent: discountPct,
      discountAmount: unitDiscountAmount * qty, finalPrice: netUnitPrice, total: netUnitPrice * qty,
    }]);
    setCurrentItem({ productId: "", sku: "", quantity: "", freeQuantity: "", mrp: 0, sellingPrice: 0, unitPrice: "", discountPercent: "", unit: "" });
    setSearchTerm("");
  };

  const handleRemoveItem = (id: string) => setItems(items.filter((item) => item.id !== id));

  const totalGross = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const totalLineDiscount = items.reduce((s, i) => s + i.discountAmount, 0);
  const subtotal = totalGross - totalLineDiscount;
  const extraDiscountAmount = (subtotal * parseNumber(extraDiscountPercent)) / 100;
  const finalTotal = subtotal - extraDiscountAmount;
  const currentLineDiscountAmount = ((parseNumber(currentItem.unitPrice) * parseNumber(currentItem.discountPercent)) / 100) * parseNumber(currentItem.quantity);

  const handleSavePurchase = async () => {
    if (items.length === 0) return toast.error("Add at least one item");
    if (!supplierId) return toast.error("Select a supplier");
    setSubmitting(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId, business_id: BUSINESS_IDS.CHAMPIKA_RETAIL,
          purchase_date: purchaseDate, arrival_date: arrivalDate || "",
          invoice_number: invoiceNumber || "", total_amount: finalTotal,
          extra_discount: extraDiscountAmount, extra_discount_percent: parseNumber(extraDiscountPercent),
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create purchase");
      toast.success("Purchase created successfully!");
      router.push("/dashboard/office/retail/purchases");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateProduct = async () => {
    if (!productFormData.name || !productFormData.category) {
      toast.error("Please fill required fields (Name, Category)"); return;
    }
    setSubmittingProduct(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productFormData, stock: Number(productFormData.stock) || 0,
          minStock: Number(productFormData.minStock) || 0, mrp: Number(productFormData.mrp) || 0,
          sellingPrice: Number(productFormData.sellingPrice) || 0, costPrice: Number(productFormData.costPrice) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Operation failed");
      toast.success("Product created successfully!");
      setIsAddProductDialogOpen(false);
      setProductFormData({ sku: "", companyCode: "", name: "", category: "", subCategory: "", brand: "", subBrand: "", modelType: "", subModel: "", sizeSpec: "", supplier: "", stock: "0", minStock: "0", mrp: "", sellingPrice: "", costPrice: "", images: [], unitOfMeasure: "Pcs", isActive: true, retailOnly: false, retailPrice: "" });
      await loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmittingProduct(false);
    }
  };

  const handleCreateSupplier = async () => {
    if (!supplierFormData.name) { toast.error("Please enter a supplier name"); return; }
    setSubmittingSupplier(true);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...supplierFormData, businessId: BUSINESS_IDS.CHAMPIKA_RETAIL }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create supplier");
      toast.success("Supplier created!");
      setIsAddSupplierDialogOpen(false);
      setSupplierFormData({ name: "", contactPerson: "", email: "", phone: "", address: "", category: "", status: "Active", duePayment: 0, businessId: BUSINESS_IDS.CHAMPIKA_RETAIL });
      await loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmittingSupplier(false);
    }
  };

  if (loadingData) return (
    <div className="flex justify-center items-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-green-600" />
    </div>
  );

  return (
    <div className="space-y-4 mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/office/retail/purchases")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-green-900">New Purchase</h1>
          <p className="text-muted-foreground mt-1">Champika Hardware — Retail</p>
        </div>
        <Button onClick={handleSavePurchase} disabled={items.length === 0 || submitting} className="bg-green-600 hover:bg-green-700">
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Purchase
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-3">
          {/* Purchase Details */}
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-green-600" /> Purchase Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Supplier</Label>
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-green-600 hover:text-green-700 hover:bg-transparent" onClick={() => setIsAddSupplierDialogOpen(true)}>
                      <Plus className="w-3 h-3 mr-1" /> New
                    </Button>
                  </div>
                  <Select value={supplierId || ""} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Purchase Date</Label>
                  <Input id="date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice">Supplier Invoice No.</Label>
                  <Input id="invoice" placeholder="Enter Invoice No" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arrivalDate">Arrival Date</Label>
                  <Input id="arrivalDate" type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Add Items</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsAddProductDialogOpen(true)} className="text-xs border-dashed border-green-300 text-green-600 hover:text-green-700 hover:bg-green-50">
                  <Plus className="w-3 h-3 mr-1" /> New Product
                </Button>
                <Button variant="ghost" size="sm" onClick={loadData} className="text-xs">
                  <RefreshCcw className="w-3 h-3 mr-1" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Product search dropdown */}
                <div className="w-full relative" ref={dropdownRef}>
                  <Label className="mb-2 block">
                    Product Search ({products.length} products loaded) — <span className="text-xs text-muted-foreground">Shift+F to focus</span>
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Type product name, SKU or code…"
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); setHighlightedIndex(-1); }}
                      onFocus={() => setIsDropdownOpen(true)}
                      onKeyDown={handleSearchKeyDown}
                    />
                    {searchTerm && (
                      <button onClick={() => { setSearchTerm(""); setCurrentItem((p) => ({ ...p, productId: "" })); setHighlightedIndex(-1); }} className="absolute right-2 top-2.5 text-muted-foreground hover:text-black">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {isDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <div className="p-3 text-sm text-center text-gray-500">No products found</div>
                      ) : filteredProducts.map((product, index) => (
                        <div key={product.id} ref={(el) => { itemRefs.current[index] = el; }}
                          className={`p-2 cursor-pointer border-b border-gray-50 last:border-0 ${highlightedIndex === index ? "bg-green-100" : "hover:bg-green-50"}`}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          onClick={() => handleProductSelect(product)}
                        >
                          <div className="font-medium text-sm text-gray-900 border-b border-gray-100 pb-1 mb-1">{product.name}</div>
                          <div className="text-xs text-gray-600 grid grid-cols-2 gap-1">
                            <div><span className="text-gray-400">SKU:</span> {product.sku}</div>
                            {product.companyCode && <div><span className="text-gray-400">Code:</span> <span className="text-blue-600">{product.companyCode}</span></div>}
                            <div className="col-span-2"><span className="text-gray-400">Supplier:</span> {product.supplier || "—"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Item detail fields */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
                  <div><Label className="mb-2 block text-xs">Item Code</Label><Input value={currentItem.sku || ""} disabled className="h-9 bg-muted text-xs" placeholder="Auto" /></div>
                  <div><Label className="mb-2 block text-xs">Unit</Label><Input value={currentItem.unit || ""} disabled className="h-9 bg-muted text-xs" placeholder="Unit" /></div>
                  <div>
                    <Label className="mb-2 block text-xs">Quantity</Label>
                    <Input ref={qtyInputRef} type="number" min="1" value={currentItem.quantity}
                      onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value === "" ? "" : parseInt(e.target.value) })}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                      className="h-9 text-xs" />
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs text-green-600">Free Qty</Label>
                    <Input type="number" min="0" value={currentItem.freeQuantity}
                      onChange={(e) => setCurrentItem({ ...currentItem, freeQuantity: e.target.value === "" ? "" : parseInt(e.target.value) })}
                      className="h-9 border-green-200 text-xs" />
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs font-semibold text-blue-600">Cost Price</Label>
                    <Input type="number" min="0" step="0.01" value={currentItem.unitPrice}
                      onChange={(e) => setCurrentItem({ ...currentItem, unitPrice: e.target.value === "" ? "" : parseFloat(e.target.value) })}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(); } }}
                      className="h-9 border-blue-200 text-xs" />
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs">Disc %</Label>
                    <Input type="number" min="0" max="100" step="0.01" value={currentItem.discountPercent}
                      onChange={(e) => setCurrentItem({ ...currentItem, discountPercent: e.target.value === "" ? "" : parseFloat(e.target.value) })}
                      className="h-9 text-xs" />
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs text-muted-foreground">Disc Amt</Label>
                    <Input value={currentLineDiscountAmount > 0 ? currentLineDiscountAmount.toFixed(2) : ""} disabled className="h-9 bg-muted text-xs" placeholder="0.00" />
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs">Selling Price</Label>
                    <Input type="number" min="0" step="0.01" value={currentItem.sellingPrice || ""}
                      onChange={(e) => setCurrentItem({ ...currentItem, sellingPrice: parseFloat(e.target.value) || 0 })}
                      className="h-9 text-xs" />
                  </div>
                  <div>
                    <Button onClick={handleAddItem} className="w-full h-9 bg-green-600 hover:bg-green-700" disabled={!currentItem.productId}>
                      <Plus className="w-4 h-4 mr-2" /> Add
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-green-50/50">
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Free</TableHead>
                    <TableHead className="text-right">Disc</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No items added yet</TableCell></TableRow>
                  ) : items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-xs text-muted-foreground">{item.sku}</div>
                      </TableCell>
                      <TableCell className="text-right">{item.unitPrice}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right text-green-600">{item.freeQuantity || "—"}</TableCell>
                      <TableCell className="text-right text-red-500">{item.discountAmount > 0 ? item.discountAmount.toFixed(2) : "—"}</TableCell>
                      <TableCell className="text-right font-bold">{item.total.toLocaleString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT - Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 border-green-200 shadow-md">
            <CardHeader className="bg-green-50/30 pb-4">
              <CardTitle className="text-lg">Purchase Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier:</span>
                  <span className="font-medium">{suppliers.find((s) => s.id === supplierId)?.name || "None"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{new Date(purchaseDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice #:</span>
                  <span className="font-medium">{invoiceNumber || "—"}</span>
                </div>
              </div>
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between text-sm font-medium border-t border-dashed pt-2">
                  <span>Subtotal:</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>
                <div className="space-y-2 bg-green-50 p-3 rounded-md border border-green-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-green-800">Extra Discount (%)</Label>
                    <Input type="number" min="0" max="100" value={extraDiscountPercent} onChange={(e) => setExtraDiscountPercent(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0%" className="h-7 w-20 text-right text-xs bg-white" />
                  </div>
                  {extraDiscountAmount > 0 && (
                    <div className="flex justify-between text-xs text-red-600 font-medium">
                      <span>Amount:</span>
                      <span>- LKR {extraDiscountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center pt-4 border-t-2 border-green-100 mt-2">
                  <span className="font-bold text-lg">Net Payable:</span>
                  <span className="text-2xl font-bold text-green-600">LKR {Math.max(0, finalTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <Button onClick={handleSavePurchase} className="w-full bg-green-600 hover:bg-green-700 mt-4" size="lg" disabled={items.length === 0 || submitting}>
                {submitting ? "Processing…" : <><Save className="w-4 h-4 mr-2" /> Confirm Purchase</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ProductDialogs
        isAddDialogOpen={isAddProductDialogOpen}
        setIsAddDialogOpen={setIsAddProductDialogOpen}
        formData={productFormData}
        setFormData={setProductFormData}
        onSave={handleCreateProduct}
        selectedProduct={null}
        isDeleteDialogOpen={false}
        setIsDeleteDialogOpen={() => {}}
        onDeleteConfirm={async () => {}}
        categories={categories}
        suppliers={suppliers}
      />
      <SupplierDialogs
        isAddDialogOpen={isAddSupplierDialogOpen}
        setIsAddDialogOpen={setIsAddSupplierDialogOpen}
        formData={supplierFormData}
        setFormData={setSupplierFormData}
        onSave={handleCreateSupplier}
        selectedSupplier={null}
        categoryOptions={supplierCategories}
        businessOptions={[]}
        isDeleteDialogOpen={false}
        setIsDeleteDialogOpen={() => {}}
        onDeleteConfirm={() => {}}
      />
    </div>
  );
}
