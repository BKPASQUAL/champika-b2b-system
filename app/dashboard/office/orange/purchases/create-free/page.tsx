"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  Factory,
  RefreshCcw,
  X,
  Search,
  Gift,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants";

interface ClaimableProduct {
  id: string;
  sku: string;
  name: string;
  totalPendingQty: number;
  unit: string;
}

interface PurchaseItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
}

function CreateOrangeFreeBillContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");

  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [claimableProducts, setClaimableProducts] = useState<ClaimableProduct[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierName, setSupplierName] = useState<string>("Orange (Orel Corporation)");

  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [preSelectedIds, setPreSelectedIds] = useState<string[]>([]);
  const [items, setItems] = useState<PurchaseItem[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [currentItem, setCurrentItem] = useState<{
    productId: string;
    sku: string;
    name: string;
    quantity: number | string;
    unit: string;
    maxQty: number;
  }>({
    productId: "",
    sku: "",
    name: "",
    quantity: "",
    unit: "",
    maxQty: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      setLoadingData(true);
      try {
        const [claimsRes, productsRes, suppliersRes] = await Promise.all([
          fetch("/api/orange/claims/free-issues"),
          fetch("/api/products?active=true"),
          fetch(`/api/suppliers?businessId=${BUSINESS_IDS.ORANGE_AGENCY}`),
        ]);

        if (!claimsRes.ok || !productsRes.ok || !suppliersRes.ok)
          throw new Error("Failed to load data");

        const allClaims = await claimsRes.json();
        const allProducts = await productsRes.json();
        const allSuppliers = await suppliersRes.json();

        // Auto-select the Orange / Orel supplier
        const orangeSupplier = allSuppliers.find((s: any) =>
          s.name.toLowerCase().includes("orange"),
        );
        if (orangeSupplier) {
          setSupplierId(orangeSupplier.id);
          setSupplierName(orangeSupplier.name);
        } else if (allSuppliers.length === 1) {
          setSupplierId(allSuppliers[0].id);
          setSupplierName(allSuppliers[0].name);
        }

        // Build pending qty map from unclaimed items
        const pendingQtyMap = new Map<string, number>();
        allClaims.forEach((claim: any) => {
          const pid = claim.product_id;
          pendingQtyMap.set(pid, (pendingQtyMap.get(pid) || 0) + Number(claim.free_quantity));
        });

        // Filter to orange products only
        const orangeProducts: ClaimableProduct[] = allProducts
          .filter((p: any) => p.supplier?.toLowerCase().includes("orange"))
          .map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            totalPendingQty: pendingQtyMap.get(p.id) || 0,
            unit: p.unitOfMeasure || "Pcs",
          }));

        setClaimableProducts(orangeProducts);

        // Pre-fill items if IDs passed via URL
        if (idsParam) {
          const ids = idsParam.split(",");
          setPreSelectedIds(ids);

          const selectedClaims = allClaims.filter((c: any) => ids.includes(c.id));
          const billGroup: Record<string, PurchaseItem> = {};
          selectedClaims.forEach((c: any) => {
            const pid = c.product_id;
            const qty = Number(c.free_quantity);
            if (billGroup[pid]) {
              billGroup[pid].quantity += qty;
            } else {
              billGroup[pid] = {
                id: pid,
                productId: pid,
                sku: c.products.sku,
                productName: c.products.name,
                quantity: qty,
                unit: "Pcs",
              };
            }
          });
          setItems(Object.values(billGroup));
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to load data");
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [idsParam]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleProductSelect = (prod: ClaimableProduct) => {
    setCurrentItem({
      productId: prod.id,
      sku: prod.sku,
      name: prod.name,
      quantity: "",
      unit: prod.unit,
      maxQty: prod.totalPendingQty,
    });
    setSearchTerm(prod.name);
    setIsDropdownOpen(false);
  };

  const handleAddItem = () => {
    const qty = Number(currentItem.quantity);
    if (!currentItem.productId || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (qty > currentItem.maxQty && currentItem.maxQty > 0) {
      toast.warning(`Note: Adding ${qty} but only ${currentItem.maxQty} pending.`);
    }

    const existingIdx = items.findIndex((i) => i.productId === currentItem.productId);
    if (existingIdx >= 0) {
      const newItems = [...items];
      newItems[existingIdx].quantity += qty;
      setItems(newItems);
    } else {
      setItems([
        ...items,
        {
          id: Date.now().toString(),
          productId: currentItem.productId,
          sku: currentItem.sku,
          productName: currentItem.name,
          quantity: qty,
          unit: currentItem.unit,
        },
      ]);
    }
    setCurrentItem({ productId: "", sku: "", name: "", quantity: "", unit: "", maxQty: 0 });
    setSearchTerm("");
  };

  const handleRemoveItem = (id: string) => setItems(items.filter((i) => i.id !== id));

  const handleSaveBill = async () => {
    if (items.length === 0) return toast.error("Add at least one item");
    if (!invoiceNumber) return toast.error("Enter Invoice Number");
    if (!supplierId) return toast.error("Supplier not loaded. Please refresh.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/orange/purchases/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNo: invoiceNumber,
          purchaseDate,
          supplierId,
          billItems: items,
          explicitClaimIds: preSelectedIds.length > 0 ? preSelectedIds : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create bill");

      toast.success("Free Bill Created & Stock Updated!");
      router.push("/dashboard/office/orange/purchases");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = claimableProducts.filter((p) => {
    const term = searchTerm.toLowerCase();
    return p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
  });

  const totalQty = items.reduce((a, b) => a + b.quantity, 0);

  if (loadingData) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-orange-800">
            Create Free Issue Bill
          </h1>
          <p className="text-muted-foreground mt-1">
            Add free items to stock. Pending claims are matched automatically.
          </p>
        </div>
        <Badge
          variant="outline"
          className="px-3 py-1 bg-orange-50 text-orange-700 border-orange-200 gap-2"
        >
          <Gift className="w-4 h-4" />
          Free Issue Mode
        </Badge>
        <Button
          onClick={handleSaveBill}
          disabled={items.length === 0 || submitting}
          className="bg-orange-600 hover:bg-orange-700"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Confirm & Update Stock
        </Button>
      </div>

      {/* Bill Details */}
      <Card className="border-orange-200 w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="w-4 h-4 text-orange-600" /> Bill Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Input
                value={supplierName}
                disabled
                className="bg-muted text-orange-800 font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label>Bill Date</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Invoice Number <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Enter Invoice No"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="border-orange-200 focus:border-orange-500"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center h-10 px-3 border rounded-md bg-orange-50 text-orange-700 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 mr-2" /> Paid / Received
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Items */}
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Add Items</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            <RefreshCcw className="w-3 h-3 mr-1" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            {/* Product Search */}
            <div className="md:col-span-3 relative" ref={dropdownRef}>
              <Label className="mb-2 block">Find Product (Orange / Orel Items)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Type product name or SKU..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                />
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setCurrentItem((prev) => ({ ...prev, productId: "" }));
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
                    <div className="p-3 text-sm text-center text-gray-500">
                      No products found.
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        className="p-2 hover:bg-orange-50 cursor-pointer border-b border-gray-50 last:border-0"
                        onClick={() => handleProductSelect(product)}
                      >
                        <div className="font-medium text-sm flex justify-between">
                          <span>{product.name}</span>
                          {product.totalPendingQty > 0 && (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                              {product.totalPendingQty} Pending
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{product.sku}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="md:col-span-1">
              <Label className="mb-2 block text-xs">Item Code</Label>
              <Input value={currentItem.sku || ""} disabled className="h-9 bg-muted text-xs" />
            </div>

            <div className="md:col-span-1">
              <Label className="mb-2 block text-xs font-semibold text-orange-600">
                Claim Qty{" "}
                {currentItem.maxQty > 0 && `(Pending: ${currentItem.maxQty})`}
              </Label>
              <Input
                type="number"
                min="1"
                value={currentItem.quantity}
                onChange={(e) =>
                  setCurrentItem({
                    ...currentItem,
                    quantity: e.target.value === "" ? "" : parseInt(e.target.value),
                  })
                }
                className="h-9 border-orange-200 text-xs"
                placeholder="Qty"
              />
            </div>

            <div className="md:col-span-1">
              <Label className="mb-2 block text-xs opacity-0">Add</Label>
              <Button
                onClick={handleAddItem}
                className="w-full h-9 bg-orange-600 hover:bg-orange-700"
                disabled={!currentItem.productId}
              >
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Table — full width */}
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bill Items</CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{items.length} line(s)</span>
            <span className="font-semibold text-orange-700">Total Qty: {totalQty}</span>
            <Badge className="bg-orange-50 text-orange-700 border-orange-200 border">
              Net Payable: LKR 0.00
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-orange-50/50">
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No items added yet. Search and add products above.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground text-sm">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.sku}</TableCell>
                    <TableCell className="text-center font-bold text-orange-700 text-lg">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">0.00</TableCell>
                    <TableCell className="text-right font-bold">0.00</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Footer Action */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleSaveBill}
            className="bg-orange-600 hover:bg-orange-700 px-8"
            size="lg"
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Confirm Free Bill
          </Button>
        </div>
      )}
    </div>
  );
}

export default function OrangeCreateFreeBillPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      }
    >
      <CreateOrangeFreeBillContent />
    </Suspense>
  );
}
