"use client";

import React, { useState, useEffect } from "react";
import {
  Package,
  Boxes,
  ReceiptText,
  AlertCircle,
  ChevronsUpDown,
  Check,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface GoodsSettlementItem {
  id: string;
  type: "own_product";
  isCustomerPurchased: boolean;
  productId: string;
  productName: string;
  sku: string;
  invoiceNo?: string;
  manualInvoiceNo?: string;
  returnType: "Good" | "Damage";
  locationId: string;
  locationName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
}

interface PurchasedProduct {
  id: string;
  sku: string;
  name: string;
  companyCode?: string;
  stock?: number;
  currentStock?: number;
  supplier?: string;
  brand?: string;
  retailOnly?: boolean;
  totalPurchasedQty?: number;
  latestUnitPrice?: number;
  latestInvoiceNo?: string;
  latestManualInvoiceNo?: string;
  sellingPrice?: number;
  invoices?: Array<{ invoiceNo: string; manualInvoiceNo?: string; unitPrice: number; quantity: number }>;
  history?: Array<{ invoiceNo: string; manualInvoiceNo?: string; unitPrice: number; quantity: number }>;
}

interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  companyCode?: string;
  stock?: number;
  sellingPrice?: number;
  supplier?: string;
  brand?: string;
  retailOnly?: boolean;
}

interface Location {
  id: string;
  name: string;
}

interface GoodsSettlementSectionProps {
  agencyName: string;
  businessId: string | null;
  selectedCustomerId: string;
  goodsItems: GoodsSettlementItem[];
  setGoodsItems: React.Dispatch<React.SetStateAction<GoodsSettlementItem[]>>;
  formatCurrency?: (amount: number) => string;
  productFilter?: (p: any) => boolean;
}

export function GoodsSettlementSection({
  agencyName,
  businessId,
  selectedCustomerId,
  goodsItems,
  setGoodsItems,
  formatCurrency = (amt: number) => `LKR ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  productFilter,
}: GoodsSettlementSectionProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [purchasedProducts, setPurchasedProducts] = useState<PurchasedProduct[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSource, setProductSource] = useState<"invoiced" | "catalog">("catalog");
  const [productSelectOpen, setProductSelectOpen] = useState(false);

  // Form state
  const [ownProductId, setOwnProductId] = useState("");
  const [ownQuantity, setOwnQuantity] = useState<number>(1);
  const [ownUnitPrice, setOwnUnitPrice] = useState<number>(0);
  const [ownReturnType, setOwnReturnType] = useState<"Good" | "Damage">("Good");
  const [ownLocationId, setOwnLocationId] = useState<string>("");
  const [ownInvoiceNo, setOwnInvoiceNo] = useState<string>("");
  const [ownManualInvoiceNo, setOwnManualInvoiceNo] = useState<string>("");
  const [ownIsCustomerPurchased, setOwnIsCustomerPurchased] = useState<boolean>(true);

  // Edit dialog state
  const [editingItem, setEditingItem] = useState<GoodsSettlementItem | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editUnitPrice, setEditUnitPrice] = useState<number>(0);
  const [editInvoiceNo, setEditInvoiceNo] = useState<string>("");
  const [editManualInvoiceNo, setEditManualInvoiceNo] = useState<string>("");
  const [editReturnType, setEditReturnType] = useState<"Good" | "Damage">("Good");
  const [editLocationId, setEditLocationId] = useState<string>("");
  const [editIsCustomerPurchased, setEditIsCustomerPurchased] = useState<boolean>(true);

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const url = businessId ? `/api/settings/locations?businessId=${businessId}` : "/api/settings/locations";
        const res = await fetch(url);
        if (res.ok) {
          const locs = await res.json();
          if (locs && locs.length > 0) {
            setLocations(locs);
            setOwnLocationId(locs[0].id);
            return;
          }
        }
      } catch {}
      const fallback = [{ id: "0b68fd7b-6a40-496f-9279-0a003c26b211", name: "Main Warehouse" }];
      setLocations(fallback);
      setOwnLocationId(fallback[0].id);
    };
    fetchLocations();
  }, [businessId]);

  // Fetch catalog products
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const url = businessId ? `/api/products?business_id=${businessId}&is_active=true` : "/api/products?is_active=true";
        const res = await fetch(url);
        if (res.ok) {
          const pData = await res.json();
          let filtered = pData || [];
          if (productFilter) {
            filtered = filtered.filter(productFilter);
          } else if (agencyName) {
            const agLow = agencyName.toLowerCase();
            filtered = filtered.filter((p: any) => {
              if (p.retailOnly) return false;
              const supplier = (p.supplier || p.supplier_name || "").toLowerCase();
              const brand = (p.brand || "").toLowerCase();
              const name = (p.name || "").toLowerCase();
              return supplier.includes(agLow) || brand.includes(agLow) || name.includes(agLow);
            });
          }
          const catalog = filtered.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku || "",
            companyCode: p.companyCode || p.company_code || "",
            stock: p.stock ?? p.stock_quantity ?? 0,
            sellingPrice: p.sellingPrice || p.selling_price || 0,
            supplier: p.supplier || p.supplier_name || "",
            brand: p.brand || "",
            retailOnly: p.retailOnly || false,
          }));
          setCatalogProducts(catalog);
        }
      } catch {}
    };
    fetchCatalog();
  }, [businessId, agencyName, productFilter]);

  // Fetch customer's past purchased products
  useEffect(() => {
    if (!selectedCustomerId) {
      setPurchasedProducts([]);
      return;
    }
    setLoadingProducts(true);
    const url = businessId
      ? `/api/customers/${selectedCustomerId}/purchased-products?businessId=${businessId}`
      : `/api/customers/${selectedCustomerId}/purchased-products`;

    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => {
        let filtered = data || [];
        if (productFilter) {
          filtered = filtered.filter(productFilter);
        } else if (agencyName) {
          const agLow = agencyName.toLowerCase();
          filtered = filtered.filter((p: any) => {
            if (p.retailOnly) return false;
            const supplier = (p.supplier || p.supplier_name || "").toLowerCase();
            const brand = (p.brand || "").toLowerCase();
            const name = (p.name || "").toLowerCase();
            return supplier.includes(agLow) || brand.includes(agLow) || name.includes(agLow);
          });
        }
        const mapped = filtered.map((p: any) => ({
          ...p,
          companyCode: p.companyCode || p.company_code || "",
          stock: p.currentStock ?? p.stock ?? p.stock_quantity ?? 0,
        }));
        setPurchasedProducts(mapped);
        if (mapped.length > 0) {
          setProductSource("invoiced");
        } else {
          setProductSource("catalog");
        }
      })
      .catch(() => setPurchasedProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [selectedCustomerId, businessId, agencyName, productFilter]);

  const handleAddProduct = () => {
    if (!ownProductId) {
      toast.error(`Please select a ${agencyName} product`);
      return;
    }
    if (ownQuantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (ownUnitPrice < 0) {
      toast.error("Unit price cannot be negative");
      return;
    }

    const currentList = productSource === "invoiced" ? purchasedProducts : catalogProducts;
    const selectedProd =
      currentList.find((p) => p.id === ownProductId) ||
      catalogProducts.find((p) => p.id === ownProductId) ||
      purchasedProducts.find((p) => p.id === ownProductId);

    const loc = locations.find((l) => l.id === ownLocationId) || locations[0];

    const newItem: GoodsSettlementItem = {
      id: `${agencyName.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: "own_product",
      isCustomerPurchased: ownIsCustomerPurchased,
      productId: ownProductId,
      productName: selectedProd?.name || `${agencyName} Product`,
      sku: selectedProd?.sku || "",
      invoiceNo: ownInvoiceNo.trim() || undefined,
      manualInvoiceNo: ownManualInvoiceNo.trim() || undefined,
      returnType: ownReturnType,
      locationId: loc?.id || "0b68fd7b-6a40-496f-9279-0a003c26b211",
      locationName: loc?.name || "Main Warehouse",
      quantity: ownQuantity,
      unitPrice: ownUnitPrice,
      totalValue: Math.round(ownQuantity * ownUnitPrice * 100) / 100,
    };

    setGoodsItems((prev) => [...prev, newItem]);
    toast.success(`Added ${newItem.productName} (${formatCurrency(newItem.totalValue)})`);

    setOwnProductId("");
    setOwnQuantity(1);
    setOwnUnitPrice(0);
    setOwnInvoiceNo("");
    setOwnManualInvoiceNo("");
    setOwnIsCustomerPurchased(productSource === "invoiced");
  };

  const handleRemoveGoodsItem = (id: string) => {
    setGoodsItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleOpenEdit = (item: GoodsSettlementItem) => {
    setEditingItem(item);
    setEditQuantity(item.quantity);
    setEditUnitPrice(item.unitPrice);
    setEditInvoiceNo(item.invoiceNo || "");
    setEditManualInvoiceNo(item.manualInvoiceNo || "");
    setEditReturnType(item.returnType);
    setEditLocationId(item.locationId);
    setEditIsCustomerPurchased(item.isCustomerPurchased !== false);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    if (editQuantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (editUnitPrice < 0) {
      toast.error("Unit price cannot be negative");
      return;
    }

    const loc =
      locations.find((l) => l.id === editLocationId) ||
      locations.find((l) => l.id === editingItem.locationId) ||
      locations[0];

    setGoodsItems((prev) =>
      prev.map((it) => {
        if (it.id !== editingItem.id) return it;
        return {
          ...it,
          quantity: editQuantity,
          unitPrice: editUnitPrice,
          totalValue: Math.round(editQuantity * editUnitPrice * 100) / 100,
          invoiceNo: editInvoiceNo.trim() || undefined,
          manualInvoiceNo: editManualInvoiceNo.trim() || undefined,
          returnType: editReturnType,
          locationId: loc?.id || editingItem.locationId,
          locationName: loc?.name || editingItem.locationName,
          isCustomerPurchased: editIsCustomerPurchased,
        };
      })
    );

    toast.success(`Updated ${editingItem.productName}`);
    setEditingItem(null);
  };

  const soldToCustomerItems = goodsItems.filter((it) => it.isCustomerPurchased !== false);
  const notSoldToCustomerItems = goodsItems.filter((it) => it.isCustomerPurchased === false);
  const soldSubtotal = soldToCustomerItems.reduce((acc, it) => acc + (it.totalValue || 0), 0);
  const notSoldSubtotal = notSoldToCustomerItems.reduce((acc, it) => acc + (it.totalValue || 0), 0);
  const totalSettlementValue = soldSubtotal + notSoldSubtotal;

  const currentProductList = productSource === "invoiced" && purchasedProducts.length > 0 ? purchasedProducts : catalogProducts;
  const selectedProductObj = currentProductList.find((p) => p.id === ownProductId) || catalogProducts.find((p) => p.id === ownProductId);

  return (
    <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-purple-200 bg-gradient-to-b from-purple-50/40 via-white to-purple-50/20 p-4 space-y-4 shadow-sm">
      {/* Header & Source Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-sm">
            <Package className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-purple-950">{agencyName} Products Settlement Breakdown</h3>
            <p className="text-xs text-muted-foreground">
              Record returned {agencyName} products from customer bills or agency stock to credit their pending invoices
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-purple-100/70 p-1 self-start sm:self-auto">
          <Button
            type="button"
            size="sm"
            variant={productSource === "invoiced" ? "default" : "ghost"}
            className={cn(
              "h-7 text-xs font-medium rounded-md px-3",
              productSource === "invoiced"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-purple-800 hover:text-purple-950 hover:bg-purple-200/50"
            )}
            onClick={() => {
              setProductSource("invoiced");
              setOwnProductId("");
              setOwnUnitPrice(0);
              setOwnInvoiceNo("");
              setOwnManualInvoiceNo("");
              setOwnIsCustomerPurchased(true);
            }}
          >
            <ReceiptText className="w-3.5 h-3.5 mr-1.5" /> Customer Invoiced {agencyName} Items ({purchasedProducts.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={productSource === "catalog" ? "default" : "ghost"}
            className={cn(
              "h-7 text-xs font-medium rounded-md px-3",
              productSource === "catalog"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-purple-800 hover:text-purple-950 hover:bg-purple-200/50"
            )}
            onClick={() => {
              setProductSource("catalog");
              setOwnProductId("");
              setOwnUnitPrice(0);
              setOwnInvoiceNo("");
              setOwnManualInvoiceNo("");
              setOwnIsCustomerPurchased(false);
            }}
          >
            <Boxes className="w-3.5 h-3.5 mr-1.5" /> All {agencyName} Products Catalog ({catalogProducts.length})
          </Button>
        </div>
      </div>

      {/* Product Entry Form */}
      <div className="bg-white/90 backdrop-blur rounded-lg border border-purple-100 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-purple-600" />
            {productSource === "invoiced"
              ? `Return Customer's Invoiced ${agencyName} Product`
              : `Select Any ${agencyName} Agency Catalog Product`}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {productSource === "invoiced"
              ? "Pre-fills invoiced unit rate & bill ref"
              : `Pre-fills standard ${agencyName} selling price`}
          </span>
        </div>

        {productSource === "invoiced" && purchasedProducts.length === 0 && !loadingProducts && (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              {!selectedCustomerId
                ? `Please select a customer in Step 1 to view their previous ${agencyName} invoices, or switch to 'All ${agencyName} Products Catalog' above.`
                : `No previous ${agencyName} invoice items found for this customer. Switch to 'All ${agencyName} Products Catalog' above to select any product.`}
            </span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Product *</Label>
            <Popover open={productSelectOpen} onOpenChange={setProductSelectOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productSelectOpen}
                  className="w-full justify-between font-normal h-9"
                >
                  {selectedProductObj ? (
                    <span className="truncate">{selectedProductObj.name}</span>
                  ) : (
                    <span className="text-muted-foreground">Select Product</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                style={{ width: "var(--radix-popover-trigger-width)" }}
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Search product..." />
                  <CommandList className="max-h-60">
                    <CommandEmpty>No products found.</CommandEmpty>
                    <CommandGroup heading={productSource === "invoiced" ? `Customer Invoiced ${agencyName} Items` : `All ${agencyName} Agency Products`}>
                      {(productSource === "invoiced" && purchasedProducts.length > 0 ? purchasedProducts : catalogProducts).map((p: any) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.name} ${p.sku} ${p.companyCode || ""}`}
                          onSelect={() => {
                            setOwnProductId(p.id);
                            const unitRate = productSource === "invoiced" ? (p.latestUnitPrice ?? p.sellingPrice ?? 0) : (p.sellingPrice ?? 0);
                            setOwnUnitPrice(unitRate);
                            const invRef = p.latestInvoiceNo || p.invoices?.[0]?.invoiceNo || p.history?.[0]?.invoiceNo || "";
                            setOwnInvoiceNo(invRef);
                            const manRef = p.latestManualInvoiceNo || p.invoices?.[0]?.manualInvoiceNo || p.history?.[0]?.manualInvoiceNo || "";
                            setOwnManualInvoiceNo(manRef);
                            setOwnIsCustomerPurchased(productSource === "invoiced");
                            setProductSelectOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              ownProductId === p.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.companyCode ? `${p.companyCode} • ` : ""}
                              {p.sku} • Stock: {p.stock ?? p.currentStock ?? 0} • LKR {(p.sellingPrice || p.latestUnitPrice || 0).toLocaleString()}
                              {productSource === "invoiced" && p.totalPurchasedQty !== undefined && ` • Billed: ${p.totalPurchasedQty}`}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    {productSource === "invoiced" && purchasedProducts.length > 0 && (
                      <CommandGroup heading={`Other ${agencyName} Catalog Products`}>
                        {catalogProducts
                          .filter((cp) => !purchasedProducts.some((pp) => pp.id === cp.id))
                          .map((p: any) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.name} ${p.sku} ${p.companyCode || ""}`}
                              onSelect={() => {
                                setOwnProductId(p.id);
                                setOwnUnitPrice(p.sellingPrice ?? 0);
                                setOwnInvoiceNo("");
                                setOwnManualInvoiceNo("");
                                setOwnIsCustomerPurchased(false);
                                setProductSelectOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  ownProductId === p.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex-1">
                                <div className="font-medium">{p.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {p.companyCode ? `${p.companyCode} • ` : ""}
                                  {p.sku} • Stock: {p.stock ?? 0} • LKR {(p.sellingPrice || 0).toLocaleString()}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Return Qty *</Label>
            <Input
              type="number"
              min="0.01"
              step="any"
              className="h-9"
              placeholder="1"
              value={ownQuantity || ""}
              onChange={(e) => setOwnQuantity(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Credit Unit Rate (LKR) *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              className="h-9"
              placeholder="0.00"
              value={ownUnitPrice || ""}
              onChange={(e) => setOwnUnitPrice(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Invoice No (System Ref)</Label>
            <Input
              className="h-9"
              placeholder="e.g. INV-0102"
              value={ownInvoiceNo}
              onChange={(e) => setOwnInvoiceNo(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Manual Bill Ref</Label>
            <Input
              className="h-9"
              placeholder="e.g. 1042 / MB-09"
              value={ownManualInvoiceNo}
              onChange={(e) => setOwnManualInvoiceNo(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Stock Condition *</Label>
            <Select value={ownReturnType} onValueChange={(v) => setOwnReturnType(v as "Good" | "Damage")}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Good">Good (Restores Sellable Stock)</SelectItem>
                <SelectItem value="Damage">Damaged (Sends to Damaged Stock)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Receiving Location</Label>
            <Select value={ownLocationId} onValueChange={setOwnLocationId}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center space-x-2 bg-purple-50/70 border border-purple-200/80 px-3 py-2 rounded-lg">
              <Checkbox
                id="own-is-purchased"
                checked={ownIsCustomerPurchased}
                onCheckedChange={(checked) => setOwnIsCustomerPurchased(!!checked)}
              />
              <Label htmlFor="own-is-purchased" className="text-xs font-medium cursor-pointer text-purple-950">
                Sold to customer on bill (Check if this item was billed to this customer; Uncheck for other {agencyName} items)
              </Label>
            </div>

            <Button
              type="button"
              className="h-9 px-6 bg-purple-700 hover:bg-purple-800 text-white font-medium shrink-0"
              onClick={handleAddProduct}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add {agencyName} Return Item
            </Button>
          </div>
        </div>
      </div>

      {/* Tables of Added Goods Items */}
      {goodsItems.length > 0 ? (
        <div className="space-y-4">
          {/* Table 1: Returns from Customer Bills */}
          <div className="rounded-lg border border-emerald-200 overflow-hidden bg-white shadow-sm">
            <div className="bg-emerald-50/80 px-4 py-2.5 flex items-center justify-between border-b border-emerald-200">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-semibold">
                  Customer Bill Items
                </Badge>
                <span className="text-xs font-semibold text-emerald-950">
                  Items Sold to Customer on Past Bills ({soldToCustomerItems.length})
                </span>
              </div>
              <div className="text-xs font-bold text-emerald-900">
                Subtotal: {formatCurrency(soldSubtotal)}
              </div>
            </div>

            {soldToCustomerItems.length > 0 ? (
              <Table>
                <TableHeader className="bg-emerald-50/30">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">{agencyName} Product</TableHead>
                    <TableHead className="text-xs font-semibold">Bill &amp; Manual Ref</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Quantity</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Credit Rate (LKR)</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Total Credit (LKR)</TableHead>
                    <TableHead className="text-xs font-semibold">Stock Destination</TableHead>
                    <TableHead className="text-xs font-semibold text-center w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {soldToCustomerItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-emerald-50/20">
                      <TableCell className="py-2.5">
                        <div className="font-semibold text-xs text-gray-900">
                          {item.productName}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {item.sku && <span>SKU: {item.sku}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs">
                        <div className="flex flex-col gap-0.5">
                          {item.invoiceNo ? (
                            <span className="font-medium text-emerald-800 flex items-center gap-1">
                              <ReceiptText className="w-3 h-3 text-emerald-600" />
                              {item.invoiceNo}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {item.manualInvoiceNo && (
                            <span className="text-[11px] text-purple-700 font-medium">
                              Manual: {item.manualInvoiceNo}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-medium text-xs">
                        {item.quantity} units
                      </TableCell>
                      <TableCell className="py-2.5 text-right text-xs">
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-bold text-xs text-emerald-950">
                        {formatCurrency(item.totalValue)}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-block w-2 h-2 rounded-full",
                              item.returnType === "Damage" ? "bg-red-500" : "bg-emerald-500"
                            )}
                          />
                          <span className="font-medium text-gray-700">{item.returnType} Stock</span> &bull; {item.locationName}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Edit Item & Bill Details"
                            className="h-7 w-7 text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Remove Item"
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemoveGoodsItem(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-3 text-center text-xs text-muted-foreground italic">
                No items returned from customer bills in this settlement.
              </div>
            )}
          </div>

          {/* Table 2: Other Agency Products Received */}
          <div className="rounded-lg border border-amber-200 overflow-hidden bg-white shadow-sm">
            <div className="bg-amber-50/80 px-4 py-2.5 flex items-center justify-between border-b border-amber-200">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-600 text-white hover:bg-amber-700 text-xs font-semibold">
                  Other {agencyName} Stock
                </Badge>
                <span className="text-xs font-semibold text-amber-950">
                  {agencyName} Products Not Sold to this Customer ({notSoldToCustomerItems.length})
                </span>
              </div>
              <div className="text-xs font-bold text-amber-900">
                Subtotal: {formatCurrency(notSoldSubtotal)}
              </div>
            </div>

            {notSoldToCustomerItems.length > 0 ? (
              <Table>
                <TableHeader className="bg-amber-50/30">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">{agencyName} Product</TableHead>
                    <TableHead className="text-xs font-semibold">Reference / Notes</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Quantity</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Credit Rate (LKR)</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Total Credit (LKR)</TableHead>
                    <TableHead className="text-xs font-semibold">Stock Destination</TableHead>
                    <TableHead className="text-xs font-semibold text-center w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notSoldToCustomerItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-amber-50/20">
                      <TableCell className="py-2.5">
                        <div className="font-semibold text-xs text-gray-900">
                          {item.productName}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {item.sku && <span>SKU: {item.sku}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs">
                        <div className="flex flex-col gap-0.5">
                          {item.invoiceNo || item.manualInvoiceNo ? (
                            <>
                              {item.invoiceNo && (
                                <span className="font-medium text-amber-800">Ref: {item.invoiceNo}</span>
                              )}
                              {item.manualInvoiceNo && (
                                <span className="text-[11px] text-gray-600">Manual: {item.manualInvoiceNo}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-amber-800/80 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50 inline-block w-fit">
                              General Stock Settlement
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-medium text-xs">
                        {item.quantity} units
                      </TableCell>
                      <TableCell className="py-2.5 text-right text-xs">
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-bold text-xs text-amber-950">
                        {formatCurrency(item.totalValue)}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-block w-2 h-2 rounded-full",
                              item.returnType === "Damage" ? "bg-red-500" : "bg-amber-500"
                            )}
                          />
                          <span className="font-medium text-gray-700">{item.returnType} Stock</span> &bull; {item.locationName}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Edit Item Details"
                            className="h-7 w-7 text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Remove Item"
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemoveGoodsItem(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-3 text-center text-xs text-muted-foreground italic">
                No other {agencyName} items added in this settlement.
              </div>
            )}
          </div>

          {/* Combined Bottom Summary Bar */}
          <div className="rounded-lg bg-purple-100/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-purple-200">
            <div className="text-xs text-purple-950 font-medium">
              Total {goodsItems.length} {agencyName} return item{goodsItems.length === 1 ? "" : "s"} (
              <span className="font-semibold text-emerald-800">{soldToCustomerItems.length} from customer bills</span>,{" "}
              <span className="font-semibold text-amber-800">{notSoldToCustomerItems.length} other {agencyName} items</span>
              )
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-purple-950 uppercase tracking-wide">
                Total Settlement Credit:
              </span>
              <span className="text-lg font-extrabold text-purple-900">
                {formatCurrency(totalSettlementValue)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-purple-200 bg-white/50 p-6 text-center text-xs text-muted-foreground">
          <Package className="w-8 h-8 text-purple-300 mx-auto mb-2" />
          No {agencyName} return items added yet. Choose from the customer&apos;s invoiced {agencyName} items or the {agencyName} catalog above to credit their bill.
        </div>
      )}

      {/* Edit Goods Settlement Item Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Pencil className="w-4 h-4 text-purple-600" />
              Edit {editingItem?.productName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update return quantity, credit rate, bill reference, or stock classification.
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Return Quantity</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="any"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Credit Unit Rate (LKR)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editUnitPrice}
                    onChange={(e) => setEditUnitPrice(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Invoice No (System Ref)</Label>
                  <Input
                    placeholder="e.g. INV-0102"
                    value={editInvoiceNo}
                    onChange={(e) => setEditInvoiceNo(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Manual Bill Ref</Label>
                  <Input
                    placeholder="e.g. 1042 / MB-09"
                    value={editManualInvoiceNo}
                    onChange={(e) => setEditManualInvoiceNo(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Stock Condition</Label>
                  <Select
                    value={editReturnType}
                    onValueChange={(v) => setEditReturnType(v as "Good" | "Damage")}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good">Good (Sellable Stock)</SelectItem>
                      <SelectItem value="Damage">Damaged Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Receiving Location</Label>
                  <Select value={editLocationId} onValueChange={setEditLocationId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2 bg-purple-50/70 border border-purple-200/80 p-2.5 rounded-lg mt-2">
                <Checkbox
                  id="edit-is-purchased"
                  checked={editIsCustomerPurchased}
                  onCheckedChange={(checked) => setEditIsCustomerPurchased(!!checked)}
                />
                <Label htmlFor="edit-is-purchased" className="text-xs font-medium cursor-pointer text-purple-950">
                  Item Sold on Customer Bill (Moves to Table 1; Uncheck for Other {agencyName} Stock)
                </Label>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-xs text-muted-foreground">
                  New Total: <span className="font-bold text-gray-900">{formatCurrency(editQuantity * editUnitPrice)}</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingItem(null)}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSaveEdit}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
