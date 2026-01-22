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
import { cn } from "@/lib/utils";

// --- Types ---
interface ClaimableProduct {
  id: string; // Product ID
  sku: string;
  name: string;
  totalPendingQty: number; // Sum of all unclaimed free issues
  unit: string;
}

interface PurchaseItem {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  cost: number;
  total: number;
}

// Wireman Supplier ID
const WIREMAN_SUPPLIER_ID = "ccc7c82c-52ba-41de-89e5-5586849bcf88";

function CreateFreeBillContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");

  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Data States
  const [claimableProducts, setClaimableProducts] = useState<
    ClaimableProduct[]
  >([]);

  // Form States
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // If navigated via "Convert Selected", we store IDs here
  const [preSelectedIds, setPreSelectedIds] = useState<string[]>([]);

  // Items State (The Bill)
  const [items, setItems] = useState<PurchaseItem[]>([]);

  // --- Search Dropdown State ---
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Current Item Input State
  const [currentItem, setCurrentItem] = useState<{
    productId: string;
    sku: string;
    name: string;
    quantity: number | string;
    unit: string;
    maxQty: number; // To limit input to available claims
  }>({
    productId: "",
    sku: "",
    name: "",
    quantity: "",
    unit: "",
    maxQty: 0,
  });

  // --- 1. Load Data ---
  useEffect(() => {
    const loadData = async () => {
      setLoadingData(true);
      try {
        // Fetch ALL pending free issues from the API
        // AND Fetch ALL Products to allow selecting items without pending claims
        const [claimsRes, productsRes] = await Promise.all([
          fetch("/api/wireman/claims/free-issues"),
          fetch("/api/products"),
        ]);

        if (!claimsRes.ok || !productsRes.ok)
          throw new Error("Failed to load data");

        const allClaims = await claimsRes.json();
        const allProducts = await productsRes.json();

        // 1. Calculate Pending Qty Map
        const pendingQtyMap = new Map<string, number>();
        allClaims.forEach((claim: any) => {
          const pid = claim.product_id;
          const qty = Number(claim.free_quantity);
          pendingQtyMap.set(pid, (pendingQtyMap.get(pid) || 0) + qty);
        });

        // 2. Filter Wireman Products and Build Dropdown List
        // We filter by supplier name containing "Wireman" or check against ID if available in product data
        const wiremanProducts: ClaimableProduct[] = allProducts
          .filter(
            (p: any) =>
              p.supplier?.toLowerCase().includes("wireman") ||
              p.supplierId === WIREMAN_SUPPLIER_ID,
          )
          .map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            totalPendingQty: pendingQtyMap.get(p.id) || 0,
            unit: p.unitOfMeasure || "Unit",
          }));

        setClaimableProducts(wiremanProducts);

        // 3. If IDs passed in URL, pre-fill the bill table
        if (idsParam) {
          const ids = idsParam.split(",");
          setPreSelectedIds(ids);

          // Filter claims to only the selected ones
          const selectedClaims = allClaims.filter((c: any) =>
            ids.includes(c.id),
          );

          // Group selected claims for the table
          const billGroup: Record<string, PurchaseItem> = {};
          selectedClaims.forEach((c: any) => {
            const pid = c.product_id;
            const qty = Number(c.free_quantity);

            if (billGroup[pid]) {
              billGroup[pid].quantity += qty;
            } else {
              billGroup[pid] = {
                id: pid, // temporary ID
                productId: pid,
                sku: c.products.sku,
                productName: c.products.name,
                quantity: qty,
                unit: "Unit",
                cost: 0,
                total: 0,
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

  // --- Close Dropdown ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Handlers ---

  const handleProductSelect = (prod: ClaimableProduct) => {
    setCurrentItem({
      productId: prod.id,
      sku: prod.sku,
      name: prod.name,
      quantity: "", // Reset qty
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

    // Optional: Warn if exceeding pending claims (but allow it if they want to force stock)
    if (qty > currentItem.maxQty && currentItem.maxQty > 0) {
      toast.warning(
        `Note: You are adding ${qty}, but only ${currentItem.maxQty} are pending claim.`,
      );
    }

    // Check if exists in table
    const existingIdx = items.findIndex(
      (i) => i.productId === currentItem.productId,
    );

    if (existingIdx >= 0) {
      const newItems = [...items];
      newItems[existingIdx].quantity += qty;
      setItems(newItems);
    } else {
      const newItem: PurchaseItem = {
        id: Date.now().toString(),
        productId: currentItem.productId,
        sku: currentItem.sku,
        productName: currentItem.name,
        quantity: qty,
        unit: currentItem.unit,
        cost: 0,
        total: 0,
      };
      setItems([...items, newItem]);
    }

    // Reset Input
    setCurrentItem({
      productId: "",
      sku: "",
      name: "",
      quantity: "",
      unit: "",
      maxQty: 0,
    });
    setSearchTerm("");
  };

  const handleRemoveItem = (id: string) =>
    setItems(items.filter((i) => i.id !== id));

  const handleSaveBill = async () => {
    if (items.length === 0) return toast.error("Add at least one item");
    if (!invoiceNumber) return toast.error("Enter Invoice Number");

    setSubmitting(true);

    try {
      const payload = {
        invoiceNo: invoiceNumber,
        purchaseDate,
        supplierId: WIREMAN_SUPPLIER_ID,
        billItems: items,
        // If we manually added items, preSelectedIds might not cover everything.
        // The Backend will handle finding the correct claims to close based on the Products in billItems.
        explicitClaimIds: preSelectedIds.length > 0 ? preSelectedIds : null,
      };

      const res = await fetch("/api/wireman/purchases/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to create bill");

      toast.success("Free Bill Created & Stock Updated!");
      router.push("/dashboard/office/wireman/purchases");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter for dropdown
  const filteredProducts = claimableProducts.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
    );
  });

  if (loadingData) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4  ">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-green-800">
            Create Free Issue Bill
          </h1>
          <p className="text-muted-foreground mt-1">
            Add any free items to stock. Pending claims are matched
            automatically.
          </p>
        </div>
        <Badge
          variant="outline"
          className="px-3 py-1 bg-green-50 text-green-700 border-green-200 gap-2"
        >
          <Gift className="w-4 h-4" />
          Free Issue Mode
        </Badge>
        <Button
          onClick={handleSaveBill}
          disabled={items.length === 0 || submitting}
          className="bg-green-600 hover:bg-green-700"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Confirm & Update Stock
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT COLUMN: Bill Info */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-green-600" /> Bill Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Input
                    value="Wireman (Orel Corporation)"
                    disabled
                    className="bg-muted text-green-800 font-medium"
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
                    className="border-green-200 focus:border-green-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center h-10 px-3 border rounded-md bg-green-50 text-green-700 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Paid / Received
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Add Items</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.reload()}
              >
                <RefreshCcw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Custom Search Dropdown */}
                <div className="w-full relative" ref={dropdownRef}>
                  <Label className="mb-2 block">
                    Find Product (All Wireman Items)
                  </Label>
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
                          setCurrentItem((prev) => ({
                            ...prev,
                            productId: "",
                          }));
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
                            className="p-2 hover:bg-green-50 cursor-pointer border-b border-gray-50 last:border-0"
                            onClick={() => handleProductSelect(product)}
                          >
                            <div className="font-medium text-sm flex justify-between">
                              <span>{product.name}</span>
                              {product.totalPendingQty > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="bg-orange-100 text-orange-700"
                                >
                                  {product.totalPendingQty} Pending
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {product.sku}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Item Code</Label>
                    <Input
                      value={currentItem.sku || ""}
                      disabled
                      className="h-9 bg-muted text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs">Unit</Label>
                    <Input
                      value={currentItem.unit || ""}
                      disabled
                      className="h-9 bg-muted text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="mb-2 block text-xs font-semibold text-green-600">
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
                          quantity:
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value),
                        })
                      }
                      className="h-9 border-green-200 text-xs"
                      placeholder="Qty"
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      onClick={handleAddItem}
                      className="w-full h-9 bg-green-600 hover:bg-green-700"
                      disabled={!currentItem.productId}
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
                <TableHeader className="bg-green-50/50">
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No items added yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.sku}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          0.00
                        </TableCell>
                        <TableCell className="text-center font-bold text-green-700">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          0.00
                        </TableCell>
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
        </div>

        {/* RIGHT COLUMN: Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 border-green-200 shadow-md">
            <CardHeader className="bg-green-50/30 pb-4">
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Items:</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Qty:</span>
                  <span className="font-medium">
                    {items.reduce((a, b) => a + b.quantity, 0)}
                  </span>
                </div>
              </div>
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between items-center pt-2 border-t-2 border-green-100 mt-2">
                  <span className="font-bold text-lg">Net Payable:</span>
                  <span className="text-2xl font-bold text-green-600">
                    LKR 0.00
                  </span>
                </div>
              </div>
              <Button
                onClick={handleSaveBill}
                className="w-full bg-green-600 hover:bg-green-700 mt-4"
                size="lg"
                disabled={items.length === 0 || submitting}
              >
                {submitting ? "Processing..." : "Confirm Free Bill"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function CreateFreeBillPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      }
    >
      <CreateFreeBillContent />
    </Suspense>
  );
}
