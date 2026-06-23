"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { toast } from "sonner";
import {
  ArrowLeft, Search, Plus, Trash2, Printer, Save, Layers, Package,
  ChevronDown, ChevronRight, Loader2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { printQuotation } from "@/app/lib/quotation-print";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  sku: string;
  name: string;
  brand?: string;
  sizeSpec?: string;
  category: string;
  supplier: string;
  mrp: number;
  sellingPrice: number;
  images: string[];
  retailOnly?: boolean;
}

interface QuoteItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  brand: string;
  sizeSpec: string;
  qty: number;
  mrp: number;
  unitPrice: number;
  discountPercent: number;
  total: number;
}

// ─── Search utilities (same as products page) ─────────────────────────────────

function normNum(s: string) { return s.replace(/[/.,\-]/g, ""); }

function tokenMatches(token: string, fields: string[]): boolean {
  const n = normNum(token);
  return fields.some((f) => {
    const fl = f.toLowerCase();
    return fl.includes(token) || normNum(fl).includes(n);
  });
}

// ─── Group key: strip brand prefix from name ──────────────────────────────────

function groupKey(p: Product): string {
  if (p.brand && p.name.toLowerCase().startsWith(p.brand.toLowerCase() + " ")) {
    return p.name.slice(p.brand.length + 1).trim();
  }
  return p.name;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateQuotationPage() {
  const router = useRouter();

  const { data: allProducts = [], loading: loadingProducts } = useCachedFetch<Product[]>("/api/products", []);

  // Header fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("");

  // Add-item area
  const [searchMode, setSearchMode] = useState<"group" | "individual">("group");
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Items
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [pendingQty, setPendingQty] = useState<Record<string, string>>({}); // productId → qty
  const [pendingPrice, setPendingPrice] = useState<Record<string, string>>({});

  // Saving
  const [saving, setSaving] = useState(false);

  const products = useMemo(
    () => allProducts.filter((p) => !p.retailOnly),
    [allProducts]
  );

  // ── Group search results ────────────────────────────────────────────────────
  const groupSearchResults = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const base = tokens.length === 0
      ? products
      : products.filter((p) =>
          tokens.every((t) =>
            tokenMatches(t, [p.name, p.brand ?? "", p.sizeSpec ?? "", p.category, p.sku, p.supplier])
          )
        );

    const grouped: Record<string, Product[]> = {};
    base.forEach((p) => {
      const key = groupKey(p);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });
    return Object.entries(grouped)
      .map(([key, prods]) => ({ key, products: prods }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [products, search]);

  // ── Individual search results ───────────────────────────────────────────────
  const individualResults = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return products.slice(0, 50);
    return products.filter((p) =>
      tokens.every((t) =>
        tokenMatches(t, [p.name, p.brand ?? "", p.sizeSpec ?? "", p.category, p.sku])
      )
    );
  }, [products, search]);

  // ── Add item ───────────────────────────────────────────────────────────────
  const addItem = useCallback((p: Product) => {
    const qty = Number(pendingQty[p.id]) || 1;
    const unitPrice = Number(pendingPrice[p.id]) || p.sellingPrice || p.mrp;
    const existing = items.find((i) => i.productId === p.id);
    if (existing) {
      setItems((prev) =>
        prev.map((i) =>
          i.productId === p.id
            ? { ...i, qty: i.qty + qty, total: (i.qty + qty) * i.unitPrice }
            : i
        )
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: `${p.id}-${Date.now()}`,
          productId: p.id,
          sku: p.sku,
          productName: p.name,
          brand: p.brand ?? "",
          sizeSpec: p.sizeSpec ?? "",
          qty,
          mrp: p.mrp,
          unitPrice,
          discountPercent: 0,
          total: qty * unitPrice,
        },
      ]);
    }
    setPendingQty((prev) => ({ ...prev, [p.id]: "" }));
    setPendingPrice((prev) => ({ ...prev, [p.id]: "" }));
    toast.success(`Added: ${p.name}`);
  }, [items, pendingQty, pendingPrice]);

  const updateItemQty = (id: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) => i.id === id ? { ...i, qty, total: qty * i.unitPrice } : i)
    );
  };

  const updateItemPrice = (id: string, unitPrice: number) => {
    setItems((prev) =>
      prev.map((i) => i.id === id ? { ...i, unitPrice, total: i.qty * unitPrice } : i)
    );
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  // ── Totals ─────────────────────────────────────────────────────────────────
  const subTotal = useMemo(() => items.reduce((s, i) => s + i.total, 0), [items]);
  const discountAmt = useMemo(() => Number(discount) || 0, [discount]);
  const grandTotal = useMemo(() => Math.max(0, subTotal - discountAmt), [subTotal, discountAmt]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async (andPrint = false) => {
    if (!customerName.trim()) { toast.error("Customer name is required"); return; }
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    setSaving(true);
    try {
      const payload = {
        date,
        valid_until: validUntil || null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone || null,
        customer_address: customerAddress || null,
        prepared_by: preparedBy || null,
        notes: notes || null,
        items,
        sub_total: subTotal,
        discount: discountAmt,
        grand_total: grandTotal,
      };
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      toast.success(`Quotation ${saved.quotation_no} saved`);
      if (andPrint) printQuotation(saved);
      router.push("/dashboard/office/distribution/quotations");
    } catch {
      toast.error("Failed to save quotation");
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Quotation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Search by product type to see all brand options and pricing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Customer Info ─────────────────────────────────────────── */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quotation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Customer Name <span className="text-red-500">*</span></Label>
              <Input placeholder="Shop or customer name" value={customerName}
                onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input placeholder="07X XXXXXXX" value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Address</Label>
              <Input placeholder="Customer address" value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valid Until</Label>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prepared By</Label>
              <Input placeholder="Staff name" value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <textarea
                rows={2}
                placeholder="Terms, conditions, remarks…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Right: Product Search ───────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mode toggle + search */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-base">Add Products</CardTitle>
                <div className="flex rounded-lg border overflow-hidden text-xs font-medium">
                  <button
                    className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                      searchMode === "group" ? "bg-blue-600 text-white" : "hover:bg-muted"
                    }`}
                    onClick={() => setSearchMode("group")}
                  >
                    <Layers className="w-3.5 h-3.5" /> Group View
                  </button>
                  <button
                    className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                      searchMode === "individual" ? "bg-blue-600 text-white" : "hover:bg-muted"
                    }`}
                    onClick={() => setSearchMode("individual")}
                  >
                    <Package className="w-3.5 h-3.5" /> Individual
                  </button>
                </div>
              </div>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={
                    searchMode === "group"
                      ? "Search product type… e.g. 1/113 Brown, One Gang Switch"
                      : "Search by name, SKU, brand…"
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
                {search && (
                  <button onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </CardHeader>

            {/* ── Group view ─── */}
            {searchMode === "group" && (
              <CardContent className="p-0">
                {loadingProducts ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading products…
                  </div>
                ) : groupSearchResults.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No products found</div>
                ) : (
                  <div className="divide-y max-h-[420px] overflow-y-auto">
                    {groupSearchResults.map(({ key, products: gProds }) => {
                      const isExpanded = expandedGroups.has(key) || (search.length > 0 && groupSearchResults.length <= 5);
                      return (
                        <div key={key}>
                          {/* Group header */}
                          <button
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                            onClick={() => toggleGroup(key)}
                          >
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                            <span className="font-semibold text-sm flex-1">{key}</span>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {gProds.length} brand{gProds.length !== 1 ? "s" : ""}
                            </Badge>
                          </button>

                          {/* Brand variants */}
                          {isExpanded && (
                            <div className="divide-y bg-muted/20">
                              {gProds.map((p) => {
                                const qty = pendingQty[p.id] ?? "";
                                const price = pendingPrice[p.id] ?? String(p.sellingPrice || p.mrp);
                                const inQuote = items.some((i) => i.productId === p.id);
                                return (
                                  <div key={p.id}
                                    className={`flex items-center gap-3 pl-10 pr-4 py-2.5 ${inQuote ? "bg-blue-50" : ""}`}>
                                    {p.images?.[0] ? (
                                      <img src={p.images[0]} alt={p.name}
                                        className="w-9 h-9 rounded border object-cover shrink-0" />
                                    ) : (
                                      <div className="w-9 h-9 rounded border bg-muted flex items-center justify-center shrink-0">
                                        <Package className="w-4 h-4 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {p.brand && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-700">
                                            {p.brand}
                                          </span>
                                        )}
                                        {p.sizeSpec && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700">
                                            {p.sizeSpec}
                                          </span>
                                        )}
                                        {inQuote && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                                            ✓ In quote
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-0.5">
                                        MRP: Rs.{p.mrp} &nbsp;·&nbsp; {p.supplier}
                                      </div>
                                    </div>
                                    {/* Qty + Price + Add */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Input
                                        type="number" placeholder="Price"
                                        value={price}
                                        onChange={(e) => setPendingPrice((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                        className="h-8 w-24 text-xs"
                                        onFocus={(e) => e.target.select()}
                                      />
                                      <Input
                                        type="number" placeholder="Qty" min={1}
                                        value={qty}
                                        onChange={(e) => setPendingQty((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                        className="h-8 w-16 text-xs"
                                        onKeyDown={(e) => e.key === "Enter" && addItem(p)}
                                      />
                                      <Button size="sm" className="h-8 px-3" onClick={() => addItem(p)}>
                                        <Plus className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            )}

            {/* ── Individual view ─── */}
            {searchMode === "individual" && (
              <CardContent className="p-0">
                {loadingProducts ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading products…
                  </div>
                ) : (
                  <div className="divide-y max-h-[420px] overflow-y-auto">
                    {individualResults.length === 0 && (
                      <div className="py-8 text-center text-sm text-muted-foreground">No products found</div>
                    )}
                    {individualResults.map((p) => {
                      const qty = pendingQty[p.id] ?? "";
                      const price = pendingPrice[p.id] ?? String(p.sellingPrice || p.mrp);
                      const inQuote = items.some((i) => i.productId === p.id);
                      return (
                        <div key={p.id}
                          className={`flex items-center gap-3 px-4 py-2.5 ${inQuote ? "bg-blue-50" : "hover:bg-muted/30"}`}>
                          {p.images?.[0] ? (
                            <img src={p.images[0]} alt={p.name}
                              className="w-9 h-9 rounded border object-cover shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded border bg-muted flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.sku} &nbsp;·&nbsp; Rs.{p.mrp} MRP &nbsp;·&nbsp; {p.supplier}
                              {inQuote && <span className="ml-1 text-green-600 font-medium">✓ Added</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Input
                              type="number" placeholder="Price"
                              value={price}
                              onChange={(e) => setPendingPrice((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              className="h-8 w-24 text-xs"
                              onFocus={(e) => e.target.select()}
                            />
                            <Input
                              type="number" placeholder="Qty" min={1}
                              value={qty}
                              onChange={(e) => setPendingQty((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              className="h-8 w-16 text-xs"
                              onKeyDown={(e) => e.key === "Enter" && addItem(p)}
                            />
                            <Button size="sm" className="h-8 px-3" onClick={() => addItem(p)}>
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* ── Quotation Items Table ───────────────────────────────────────── */}
          {items.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Quotation Items ({items.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 w-6">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Brand / Spec</TableHead>
                      <TableHead className="text-right w-20">Qty</TableHead>
                      <TableHead className="text-right">MRP</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="pl-4 text-muted-foreground text-xs">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{item.productName}</div>
                          <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {item.brand && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700 w-fit">
                                {item.brand}
                              </span>
                            )}
                            {item.sizeSpec && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 w-fit">
                                {item.sizeSpec}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number" min={1}
                            value={item.qty}
                            onChange={(e) => updateItemQty(item.id, Number(e.target.value))}
                            className="h-7 w-16 text-xs text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          Rs.{item.mrp.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number" min={0}
                            value={item.unitPrice}
                            onChange={(e) => updateItemPrice(item.id, Number(e.target.value))}
                            className="h-7 w-24 text-xs text-right ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">
                          Rs.{item.total.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <button onClick={() => removeItem(item.id)}
                            className="text-muted-foreground hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Totals */}
                <div className="flex justify-end p-4 border-t">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sub Total</span>
                      <span>Rs. {subTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Discount (Rs.)</span>
                      <Input
                        type="number" min={0} placeholder="0"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        className="h-7 w-28 text-xs text-right"
                      />
                    </div>
                    <div className="flex justify-between font-bold text-base pt-2 border-t">
                      <span>Grand Total</span>
                      <span className="text-blue-700">Rs. {grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between items-center py-4 border-t">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={saving || items.length === 0}
            onClick={() => handleSave(true)}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            Save & Print
          </Button>
          <Button disabled={saving || items.length === 0} onClick={() => handleSave(false)}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Quotation
          </Button>
        </div>
      </div>
    </div>
  );
}
