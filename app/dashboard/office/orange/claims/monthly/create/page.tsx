"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Factory, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants";

const BUSINESS_ID = BUSINESS_IDS.ORANGE_AGENCY;

type Line = {
  key: string;
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  actualCost: number;
};

const money = (n: number) =>
  (Number(n) || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function CreateMonthlyClaimPage() {
  const router = useRouter();
  const now = new Date();

  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Bill header
  const [supplierId, setSupplierId] = useState("");
  const [claimNo, setClaimNo] = useState("");
  const [claimDate, setClaimDate] = useState(iso(now));
  const [periodFrom, setPeriodFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
  const [periodTo, setPeriodTo] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 0)));
  const [discountPercent, setDiscountPercent] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  // Item entry (same flow as the purchase bill)
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [current, setCurrent] = useState<{ productId: string; sku: string; quantity: string; unitPrice: string }>({
    productId: "",
    sku: "",
    quantity: "",
    unitPrice: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const [pRes, sRes] = await Promise.all([
          fetch("/api/products?active=true"),
          fetch(`/api/suppliers?businessId=${BUSINESS_ID}`),
        ]);
        const allProducts = pRes.ok ? await pRes.json() : [];
        const allSuppliers = sRes.ok ? await sRes.json() : [];
        setSuppliers(allSuppliers);
        const orange = allSuppliers.find((s: any) => s.name?.toLowerCase().includes("orange"));
        if (orange) setSupplierId(orange.id);
        setProducts(
          allProducts.filter(
            (p: any) =>
              String(p.supplier || "").toLowerCase().includes("orange") ||
              (p.secondarySuppliers || []).some((s: string) => s?.toLowerCase().includes("orange")),
          ),
        );
      } catch {
        toast.error("Failed to load products");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Shift+F → product search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        searchInputRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredProducts = products.filter((p) => {
    if (!searchTerm) return true;
    const words = searchTerm.toLowerCase().trim().split(/\s+/);
    const name = String(p.name || "").toLowerCase();
    const sku = String(p.sku || "").toLowerCase();
    const code = String(p.companyCode || "").toLowerCase();
    return words.every((w) => name.includes(w) || sku.includes(w) || code.includes(w));
  });

  const selectProduct = (p: any) => {
    setCurrent({
      productId: p.id,
      sku: p.sku,
      quantity: "",
      unitPrice: p.sellingPrice ? String(p.sellingPrice) : "",
    });
    setSearchTerm(p.name);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    setTimeout(() => qtyInputRef.current?.focus({ preventScroll: true }), 50);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") setIsDropdownOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev < filteredProducts.length - 1 ? prev + 1 : prev;
        itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : prev;
        itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
        selectProduct(filteredProducts[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  const addItem = () => {
    const qty = Number(current.quantity) || 0;
    const price = Number(current.unitPrice) || 0;
    if (!current.productId) return toast.error("Select an item");
    if (qty <= 0) return toast.error("Please enter a valid quantity");
    const p = products.find((x) => x.id === current.productId);
    if (!p) return;

    setLines((prev) => {
      // Same item at the same price again → add to the existing line
      const existing = prev.find((l) => l.productId === p.id && l.unitPrice === price);
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + qty } : l));
      }
      return [
        ...prev,
        {
          key: `${p.id}-${Date.now()}`,
          productId: p.id,
          name: p.name,
          sku: p.sku,
          quantity: qty,
          unitPrice: price,
          actualCost: Number(p.actualCostPrice) || Number(p.costPrice) || 0,
        },
      ];
    });

    setCurrent({ productId: "", sku: "", quantity: "", unitPrice: "" });
    setSearchTerm("");
    setTimeout(() => searchInputRef.current?.focus({ preventScroll: true }), 50);
  };

  const onEntryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  // Totals
  const grossTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const pct = Number(discountPercent) || 0;
  const discountAmount = (grossTotal * pct) / 100;

  const lineCalc = (l: Line) => {
    const gross = l.quantity * l.unitPrice;
    const share = grossTotal > 0 ? (gross / grossTotal) * discountAmount : 0;
    return { gross, share };
  };

  const save = async () => {
    if (!supplierId) return toast.error("Select the supplier");
    if (!claimNo.trim()) return toast.error("Enter the claim bill number");
    if (lines.length === 0) return toast.error("Add the items on the claim bill");
    if (discountAmount <= 0) return toast.error("Enter the Document Discount %");

    setSaving(true);
    try {
      const res = await fetch("/api/supplier-claim-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: BUSINESS_ID,
          supplierId,
          claimNo: claimNo.trim(),
          claimDate,
          periodFrom,
          periodTo,
          discountPercent: pct,
          notes,
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            costBefore: l.actualCost,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success(
        `Claim saved. Rs ${money(data.appliedToSold)} taken off ${data.linesUpdated} sold invoice lines, ` +
          `Rs ${money(data.appliedToStock)} taken off unsold stock.`,
        { duration: 10000 },
      );
      if (data.notAppliedAmount > 0.01) {
        toast.warning(
          `Rs ${money(data.notAppliedAmount)} could not be applied: ` +
            data.notApplied
              .slice(0, 5)
              .map((n: any) => `${n.name} (${n.reason})`)
              .join("; ") +
            (data.notApplied.length > 5 ? "…" : ""),
          { duration: 20000 },
        );
      }
      router.push("/dashboard/office/orange/claims/monthly");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const supplierName = suppliers.find((s) => s.id === supplierId)?.name || "None";

  return (
    <div className="space-y-4 mx-auto pb-10">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/office/orange/claims/monthly")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-orange-900">New Claim Bill</h1>
          <p className="text-muted-foreground mt-1">
            Enter Orange&apos;s monthly discount bill. Discount only — no stock or supplier payment change.
          </p>
        </div>
        <Button onClick={save} disabled={lines.length === 0 || saving} className="bg-orange-600 hover:bg-orange-700">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Claim
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-3">
          {/* Claim Bill Details */}
          <Card className="border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-orange-600" /> Claim Bill Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select value={supplierId || ""} onValueChange={setSupplierId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="claimDate">Bill Date</Label>
                  <Input id="claimDate" type="date" value={claimDate} onChange={(e) => setClaimDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="claimNo">Claim Bill Number</Label>
                  <Input id="claimNo" placeholder="Enter Claim Bill No" value={claimNo}
                    onChange={(e) => setClaimNo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pFrom">Purchase Period From</Label>
                  <Input id="pFrom" type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pTo">Purchase Period To</Label>
                  <Input id="pTo" type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Add Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="w-full relative" ref={dropdownRef}>
                  <Label className="mb-2 block">
                    Product Search ({products.length} Orange products loaded) —{" "}
                    <span className="text-xs text-muted-foreground">Shift+F to focus</span>
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Type product name or SKU..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsDropdownOpen(true);
                        setHighlightedIndex(-1);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      onKeyDown={onSearchKeyDown}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm("");
                          setCurrent({ productId: "", sku: "", quantity: "", unitPrice: "" });
                          setHighlightedIndex(-1);
                        }}
                        className="absolute right-2 top-2.5 text-muted-foreground hover:text-black"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <div className="p-3 text-sm text-center text-gray-500">No products found</div>
                      ) : (
                        filteredProducts.map((p, index) => (
                          <div
                            key={p.id}
                            ref={(el) => { itemRefs.current[index] = el; }}
                            className={`p-2 cursor-pointer border-b border-gray-50 last:border-0 ${
                              highlightedIndex === index ? "bg-orange-100" : "hover:bg-orange-50"
                            }`}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            onClick={() => selectProduct(p)}
                          >
                            <div className="font-medium text-sm text-gray-900 border-b border-gray-100 pb-1 mb-1">
                              {p.name}
                            </div>
                            <div className="text-xs text-gray-600 grid grid-cols-2 gap-1 font-medium">
                              <div>
                                <span className="text-gray-400 font-normal">Item Code:</span> {p.sku}
                              </div>
                              {p.companyCode && (
                                <div>
                                  <span className="text-gray-400 font-normal">Company Code:</span>{" "}
                                  <span className="text-blue-600">{p.companyCode}</span>
                                </div>
                              )}
                              <div className="col-span-2">
                                <span className="text-gray-400 font-normal">Selling Price:</span> {money(p.sellingPrice)}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Item Detail Fields */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Item Code</Label>
                    <Input value={current.sku || ""} disabled className="h-9 bg-muted text-xs" placeholder="Auto" />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Quantity</Label>
                    <Input
                      ref={qtyInputRef}
                      type="number"
                      min="1"
                      value={current.quantity}
                      onChange={(e) => setCurrent({ ...current, quantity: e.target.value })}
                      onKeyDown={onEntryKeyDown}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs font-semibold text-blue-600">Price</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={current.unitPrice}
                      onChange={(e) => setCurrent({ ...current, unitPrice: e.target.value })}
                      onKeyDown={onEntryKeyDown}
                      className="h-9 border-blue-200 text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs text-muted-foreground">Gross Value</Label>
                    <Input
                      value={
                        current.productId
                          ? money((Number(current.quantity) || 0) * (Number(current.unitPrice) || 0))
                          : ""
                      }
                      disabled
                      className="h-9 bg-muted text-xs"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      onClick={addItem}
                      className="w-full h-9 bg-orange-600 hover:bg-orange-700"
                      disabled={!current.productId}
                    >
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
                <TableHeader className="bg-orange-50/50">
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Gross Value</TableHead>
                    <TableHead className="text-right">Disc</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No items added
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((l, idx) => {
                      const c = lineCalc(l);
                      return (
                        <TableRow key={l.key}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium">{l.name}</div>
                            <div className="text-xs text-muted-foreground">{l.sku}</div>
                          </TableCell>
                          <TableCell className="text-right">{money(l.unitPrice)}</TableCell>
                          <TableCell className="text-right">{l.quantity}</TableCell>
                          <TableCell className="text-right font-bold">{money(c.gross)}</TableCell>
                          <TableCell className="text-right text-red-500">
                            {c.share > 0 ? money(c.share) : "-"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon-sm" onClick={() => removeLine(l.key)}>
                              <Trash2 className="w-4 h-4 text-orange-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN - Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 border-orange-200 shadow-md">
            <CardHeader className="bg-orange-50/30 pb-4">
              <CardTitle className="text-lg">Claim Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier:</span>
                  <span className="font-medium">{supplierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{new Date(claimDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Claim #:</span>
                  <span className="font-medium">{claimNo || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Purchase period:</span>
                  <span className="font-medium">{periodFrom} → {periodTo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items / Qty:</span>
                  <span className="font-medium">
                    {lines.length} / {lines.reduce((s, l) => s + l.quantity, 0).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between text-sm font-medium border-t border-dashed pt-2">
                  <span>Gross Value Total:</span>
                  <span>LKR {money(grossTotal)}</span>
                </div>
                <div className="space-y-2 bg-orange-50 p-3 rounded-md border border-orange-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-orange-800">Document Discount (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      placeholder="0%"
                      className="h-7 w-24 text-right text-xs bg-white"
                    />
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-xs text-red-600 font-medium">
                      <span>Discount ({pct}%):</span>
                      <span>- LKR {money(discountAmount)}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center pt-4 border-t-2 border-orange-100 mt-2">
                  <span className="font-bold text-lg">Net After Discount:</span>
                  <span className="text-2xl font-bold text-orange-600">
                    LKR {money(Math.max(0, grossTotal - discountAmount))}
                  </span>
                </div>
              </div>
              <Button
                onClick={save}
                className="w-full bg-orange-600 hover:bg-orange-700 mt-4"
                size="lg"
                disabled={lines.length === 0 || saving}
              >
                {saving ? (
                  "Processing..."
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" /> Confirm Claim
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
