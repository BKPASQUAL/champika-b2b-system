"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Loader2,
  CreditCard,
  Banknote,
  Building2,
  Package,
  Plus,
  Trash2,
  Pencil,
  Check,
  ChevronsUpDown,
  ReceiptText,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { ReceiptNumberInput } from "@/components/receipt-books/ReceiptNumberInput";
import { cn } from "@/lib/utils";

export interface GoodsSettlementItem {
  id: string;
  type?: "own_product" | "external_goods";
  isCustomerPurchased?: boolean;
  productId: string;
  productName: string;
  sku: string;
  companyCode?: string;
  invoiceNo?: string;
  manualInvoiceNo?: string;
  returnType: "Good" | "Damage";
  locationId: string;
  locationName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
}

interface RecordPaymentDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  invoice: any; // The selected invoice object
  onPaymentSuccess: () => void;
  agencyName?: string;
  businessId?: string;
}

const formatCurrency = (amt: number) =>
  `LKR ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function RecordPaymentDialog({
  isOpen,
  setIsOpen,
  invoice,
  onPaymentSuccess,
  agencyName = "Wireman",
  businessId = BUSINESS_IDS.WIREMAN_AGENCY,
}: RecordPaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Form State
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("cash");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Method Specific State
  const [depositAccountId, setDepositAccountId] = useState<string>("");
  const [chequeNo, setChequeNo] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptBookId, setReceiptBookId] = useState<string | undefined>(undefined);
  const [chequeDate, setChequeDate] = useState("");

  // Goods Settlement State
  const [goodsItems, setGoodsItems] = useState<GoodsSettlementItem[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [purchasedProducts, setPurchasedProducts] = useState<any[]>([]);
  const [productSource, setProductSource] = useState<"invoiced" | "catalog">("invoiced");
  const [productSelectOpen, setProductSelectOpen] = useState(false);

  // Add Item form state
  const [addProductId, setAddProductId] = useState("");
  const [addQuantity, setAddQuantity] = useState<number>(1);
  const [addUnitPrice, setAddUnitPrice] = useState<number>(0);
  const [addReturnType, setAddReturnType] = useState<"Good" | "Damage">("Good");
  const [addLocationId, setAddLocationId] = useState<string>("");
  const [addInvoiceNo, setAddInvoiceNo] = useState<string>("");
  const [addManualInvoiceNo, setAddManualInvoiceNo] = useState<string>("");
  const [addIsCustomerPurchased, setAddIsCustomerPurchased] = useState<boolean>(true);

  // Edit Item modal state
  const [editingItem, setEditingItem] = useState<GoodsSettlementItem | null>(null);
  const [editProductId, setEditProductId] = useState("");
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editUnitPrice, setEditUnitPrice] = useState<number>(0);
  const [editReturnType, setEditReturnType] = useState<"Good" | "Damage">("Good");
  const [editLocationId, setEditLocationId] = useState<string>("");
  const [editInvoiceNo, setEditInvoiceNo] = useState<string>("");
  const [editManualInvoiceNo, setEditManualInvoiceNo] = useState<string>("");
  const [editProductSelectOpen, setEditProductSelectOpen] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setAmount(invoice?.dueAmount?.toString() || "");
      setMethod("cash");
      setNotes("");
      setChequeNo("");
      setChequeDate("");
      setGoodsItems([]);

      fetch(`/api/finance/accounts?businessId=${businessId}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setAccounts((data || []).filter((a: any) => a.is_active)))
        .catch(() => {});

      fetch(`/api/settings/locations?businessId=${businessId}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((locs) => {
          if (locs && locs.length > 0) {
            setLocations(locs);
            setAddLocationId(locs[0].id);
          } else {
            const fallback = [{ id: "0b68fd7b-6a40-496f-9279-0a003c26b211", name: "Main Warehouse" }];
            setLocations(fallback);
            setAddLocationId(fallback[0].id);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, invoice, businessId]);

  // Fetch products when method is goods
  useEffect(() => {
    if (!isOpen || method !== "goods") return;

    fetch(`/api/products?business_id=${businessId}&is_active=true`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        let filtered = data || [];
        if (agencyName) {
          const agLow = agencyName.toLowerCase();
          filtered = filtered.filter((p: any) => {
            if (p.retailOnly) return false;
            const supplier = (p.supplier || p.supplier_name || "").toLowerCase();
            const brand = (p.brand || "").toLowerCase();
            const name = (p.name || "").toLowerCase();
            return supplier.includes(agLow) || brand.includes(agLow) || name.includes(agLow);
          });
        }
        setCatalogProducts(
          filtered.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku || "",
            companyCode: p.companyCode || p.company_code || "",
            stock: p.stock ?? p.stock_quantity ?? 0,
            sellingPrice: Number(p.sellingPrice || p.selling_price || 0),
          }))
        );
      })
      .catch(() => {});

    const customerId = invoice?.customerId || invoice?.customer_id;
    if (customerId) {
      fetch(`/api/customers/${customerId}/purchased-products?businessId=${businessId}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          let filtered = data || [];
          if (agencyName) {
            const agLow = agencyName.toLowerCase();
            filtered = filtered.filter((p: any) => {
              if (p.retailOnly) return false;
              const supplier = (p.supplier || p.supplier_name || "").toLowerCase();
              const brand = (p.brand || "").toLowerCase();
              const name = (p.name || "").toLowerCase();
              return supplier.includes(agLow) || brand.includes(agLow) || name.includes(agLow);
            });
          }
          setPurchasedProducts(filtered);
          if (filtered.length > 0) setProductSource("invoiced");
          else setProductSource("catalog");
        })
        .catch(() => {});
    } else {
      setProductSource("catalog");
    }
  }, [isOpen, method, businessId, agencyName, invoice]);

  useEffect(() => {
    if (method === "goods") {
      const sum = goodsItems.reduce((acc, it) => acc + (it.totalValue || 0), 0);
      setAmount(sum.toString());
    }
  }, [goodsItems, method]);

  const handleAddGoodsItem = () => {
    if (!addProductId) {
      toast.error(`Please select a ${agencyName} product`);
      return;
    }
    if (addQuantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (addUnitPrice < 0) {
      toast.error("Unit price cannot be negative");
      return;
    }

    const currentList = productSource === "invoiced" ? purchasedProducts : catalogProducts;
    const selectedProd =
      currentList.find((p) => p.id === addProductId) ||
      catalogProducts.find((p) => p.id === addProductId) ||
      purchasedProducts.find((p) => p.id === addProductId);

    const loc = locations.find((l) => l.id === addLocationId) || locations[0];

    const newItem: GoodsSettlementItem = {
      id: `goods_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: "own_product",
      isCustomerPurchased: addIsCustomerPurchased,
      productId: addProductId,
      productName: selectedProd?.name || `${agencyName} Product`,
      sku: selectedProd?.sku || "",
      companyCode: selectedProd?.companyCode || selectedProd?.company_code || "",
      invoiceNo: addInvoiceNo.trim() || invoice?.invoiceNo || undefined,
      manualInvoiceNo: addManualInvoiceNo.trim() || undefined,
      returnType: addReturnType,
      locationId: loc?.id || "0b68fd7b-6a40-496f-9279-0a003c26b211",
      locationName: loc?.name || "Main Warehouse",
      quantity: addQuantity,
      unitPrice: addUnitPrice,
      totalValue: Math.round(addQuantity * addUnitPrice * 100) / 100,
    };

    setGoodsItems((prev) => [...prev, newItem]);
    toast.success(`Added ${newItem.productName} (${formatCurrency(newItem.totalValue)})`);

    setAddProductId("");
    setAddQuantity(1);
    setAddUnitPrice(0);
    setAddInvoiceNo("");
    setAddManualInvoiceNo("");
  };

  const handleRemoveGoodsItem = (id: string) => {
    setGoodsItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleOpenEditItem = (item: GoodsSettlementItem) => {
    setEditingItem(item);
    setEditProductId(item.productId);
    setEditQuantity(item.quantity);
    setEditUnitPrice(item.unitPrice);
    setEditReturnType(item.returnType);
    setEditLocationId(item.locationId);
    setEditInvoiceNo(item.invoiceNo || "");
    setEditManualInvoiceNo(item.manualInvoiceNo || "");
  };

  const handleSaveEditItem = () => {
    if (!editingItem) return;
    if (editQuantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (editUnitPrice < 0) {
      toast.error("Unit price cannot be negative");
      return;
    }

    const selectedProd =
      catalogProducts.find((p) => p.id === editProductId) ||
      purchasedProducts.find((p) => p.id === editProductId);

    const loc =
      locations.find((l) => l.id === editLocationId) ||
      locations.find((l) => l.id === editingItem.locationId) ||
      locations[0];

    setGoodsItems((prev) =>
      prev.map((it) => {
        if (it.id !== editingItem.id) return it;
        return {
          ...it,
          productId: editProductId || it.productId,
          productName: selectedProd?.name || it.productName,
          sku: selectedProd?.sku || it.sku,
          quantity: editQuantity,
          unitPrice: editUnitPrice,
          totalValue: Math.round(editQuantity * editUnitPrice * 100) / 100,
          invoiceNo: editInvoiceNo.trim() || undefined,
          manualInvoiceNo: editManualInvoiceNo.trim() || undefined,
          returnType: editReturnType,
          locationId: loc?.id || editingItem.locationId,
          locationName: loc?.name || editingItem.locationName,
        };
      })
    );

    toast.success("Updated settlement item");
    setEditingItem(null);
  };

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (method === "goods" && goodsItems.length === 0) {
      toast.error("Please add at least one returned product item to settle this payment");
      return;
    }
    if (Number(amount) > invoice.dueAmount) {
      toast.error(`Amount exceeds due balance (LKR ${invoice.dueAmount})`);
      return;
    }
    if ((method === "cash" || method === "bank") && !depositAccountId) {
      toast.error("Please select a deposit account");
      return;
    }
    if (method === "cheque" && (!chequeNo || !chequeDate)) {
      toast.error("Cheque number and date are required");
      return;
    }

    setLoading(true);

    try {
      const goodsSummaryStr =
        method === "goods"
          ? goodsItems.map((it) => `${it.productName} (${it.quantity} @ ${it.unitPrice})`).join(", ")
          : undefined;

      const payload = {
        orderId: invoice.orderId,
        amount: Number(amount),
        date: date,
        method: method,
        notes: notes,
        depositAccountId:
          method === "cash" || method === "bank" ? depositAccountId : null,
        chequeNo: method === "cheque" ? chequeNo : null,
        chequeDate: method === "cheque" ? chequeDate : null,
        receiptNumber: receiptNumber || undefined,
        receiptBookId: receiptBookId || undefined,
        goodsItems: method === "goods" ? goodsItems : undefined,
        goodsSummary: goodsSummaryStr,
      };

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Payment failed");
      }

      toast.success("Payment recorded successfully!");
      onPaymentSuccess();
      setIsOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  const isGoods = method === "goods";
  const currentAddProductList =
    productSource === "invoiced" && purchasedProducts.length > 0 ? purchasedProducts : catalogProducts;
  const selectedAddProdObj =
    currentAddProductList.find((p) => p.id === addProductId) ||
    catalogProducts.find((p) => p.id === addProductId);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className={cn("transition-all duration-200", isGoods ? "max-w-4xl" : "max-w-md")}>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-4">
              <div>
                Invoice: <span className="font-mono font-semibold text-gray-900">{invoice.invoiceNo}</span>
              </div>
              <div>
                Customer: <span className="font-medium text-gray-900">{invoice.customerName}</span>
              </div>
              <div>
                Due Balance: <span className="font-bold text-red-600 font-mono">LKR {invoice.dueAmount?.toLocaleString()}</span>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-3.5 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <div className="flex items-center">
                        <Banknote className="w-3.5 h-3.5 mr-2 text-emerald-600" /> Cash
                      </div>
                    </SelectItem>
                    <SelectItem value="cheque">
                      <div className="flex items-center">
                        <CreditCard className="w-3.5 h-3.5 mr-2 text-indigo-600" /> Cheque
                      </div>
                    </SelectItem>
                    <SelectItem value="bank">
                      <div className="flex items-center">
                        <Building2 className="w-3.5 h-3.5 mr-2 text-blue-600" /> Bank Transfer
                      </div>
                    </SelectItem>
                    <SelectItem value="goods">
                      <div className="flex items-center font-medium text-purple-900">
                        <Package className="w-3.5 h-3.5 mr-2 text-purple-600" /> Goods Settlement
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Amount (LKR) * {isGoods && <span className="text-purple-600 font-normal">(Auto-calculated)</span>}
                </Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  readOnly={isGoods}
                  max={invoice.dueAmount}
                  className={cn("h-9 font-mono font-medium", isGoods && "bg-purple-50/50 cursor-not-allowed text-purple-900")}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Payment Date</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            {!isGoods && (
              <ReceiptNumberInput
                value={receiptNumber}
                onChange={(val, bookId) => {
                  setReceiptNumber(val);
                  setReceiptBookId(bookId);
                }}
                businessId={businessId}
              />
            )}

            {method === "cheque" && (
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-md border text-xs">
                <div className="space-y-1.5">
                  <Label className="text-xs">Cheque No *</Label>
                  <Input
                    className="h-8"
                    placeholder="xxxxxx"
                    value={chequeNo}
                    onChange={(e) => setChequeNo(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cheque Date *</Label>
                  <Input
                    type="date"
                    className="h-8"
                    value={chequeDate}
                    onChange={(e) => setChequeDate(e.target.value)}
                  />
                </div>
              </div>
            )}

            {(method === "cash" || method === "bank") && (
              <div className="space-y-1.5">
                <Label className="text-xs">Deposit To Account *</Label>
                <Select
                  value={depositAccountId}
                  onValueChange={setDepositAccountId}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc: any) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name} ({acc.account_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isGoods && (
              <div className="space-y-3 pt-2 border-t border-purple-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-purple-600" />
                    <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wide">
                      Select Returned {agencyName} Products ({goodsItems.length})
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 bg-purple-100/70 p-1 rounded-md text-xs self-start sm:self-auto">
                    <Button
                      type="button"
                      size="sm"
                      variant={productSource === "invoiced" ? "default" : "ghost"}
                      className={cn(
                        "h-6 text-[11px] px-2.5 rounded",
                        productSource === "invoiced" ? "bg-purple-600 text-white" : "text-purple-800 hover:bg-purple-200/50"
                      )}
                      onClick={() => {
                        setProductSource("invoiced");
                        setAddProductId("");
                        setAddUnitPrice(0);
                        setAddIsCustomerPurchased(true);
                      }}
                    >
                      <ReceiptText className="w-3 h-3 mr-1" /> Customer Invoiced ({purchasedProducts.length})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={productSource === "catalog" ? "default" : "ghost"}
                      className={cn(
                        "h-6 text-[11px] px-2.5 rounded",
                        productSource === "catalog" ? "bg-purple-600 text-white" : "text-purple-800 hover:bg-purple-200/50"
                      )}
                      onClick={() => {
                        setProductSource("catalog");
                        setAddProductId("");
                        setAddUnitPrice(0);
                        setAddIsCustomerPurchased(false);
                      }}
                    >
                      <Boxes className="w-3 h-3 mr-1" /> All {agencyName} Catalog ({catalogProducts.length})
                    </Button>
                  </div>
                </div>

                <div className="bg-purple-50/40 p-3 rounded-lg border border-purple-200/80 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[11px]">Product *</Label>
                      <Popover open={productSelectOpen} onOpenChange={setProductSelectOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal h-8 text-xs bg-white"
                          >
                            {selectedAddProdObj ? (
                              <span className="truncate">{selectedAddProdObj.name}</span>
                            ) : (
                              <span className="text-muted-foreground">Select {agencyName} Product</span>
                            )}
                            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-50 shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search product..." className="h-8 text-xs" />
                            <CommandList className="max-h-52">
                              <CommandEmpty>No products found.</CommandEmpty>
                              <CommandGroup heading={productSource === "invoiced" ? "Customer Invoiced Products" : `${agencyName} Catalog`}>
                                {currentAddProductList.map((p) => (
                                  <CommandItem
                                    key={p.id}
                                    value={`${p.name} ${p.sku} ${p.companyCode || ""}`}
                                    onSelect={() => {
                                      setAddProductId(p.id);
                                      const rate = p.latestUnitPrice ?? p.sellingPrice ?? 0;
                                      setAddUnitPrice(rate);
                                      const invRef = p.latestInvoiceNo || p.invoices?.[0]?.invoiceNo || invoice?.invoiceNo || "";
                                      setAddInvoiceNo(invRef);
                                      const manRef = p.latestManualInvoiceNo || p.invoices?.[0]?.manualInvoiceNo || "";
                                      setAddManualInvoiceNo(manRef);
                                      setAddIsCustomerPurchased(productSource === "invoiced");
                                      setProductSelectOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-3.5 w-3.5", addProductId === p.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex-1 text-xs">
                                      <div className="font-medium">{p.name}</div>
                                      <div className="text-[10px] text-muted-foreground">
                                        {p.sku} &bull; LKR {(p.sellingPrice || p.latestUnitPrice || 0).toLocaleString()}
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Qty *</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0.01"
                        className="h-8 text-xs bg-white"
                        value={addQuantity || ""}
                        onChange={(e) => setAddQuantity(parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Unit Rate (LKR) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-xs bg-white"
                        value={addUnitPrice || ""}
                        onChange={(e) => setAddUnitPrice(parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 w-full bg-purple-600 hover:bg-purple-700 text-white text-xs"
                        onClick={handleAddGoodsItem}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Return
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-purple-200 overflow-hidden bg-white shadow-sm">
                  {goodsItems.length === 0 ? (
                    <div className="p-5 text-center text-xs text-muted-foreground italic">
                      No returned goods items added yet. Select products above to calculate payment credit.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-purple-50/50">
                        <TableRow>
                          <TableHead className="text-xs font-semibold">Product</TableHead>
                          <TableHead className="text-xs font-semibold">Ref</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Quantity</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Rate (LKR)</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Credit Total</TableHead>
                          <TableHead className="text-xs font-semibold">Condition</TableHead>
                          <TableHead className="text-xs font-semibold text-center w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {goodsItems.map((item) => (
                          <TableRow key={item.id} className="hover:bg-purple-50/20 text-xs">
                            <TableCell className="py-2">
                              <div className="font-semibold text-gray-900">{item.productName}</div>
                              {item.sku && <div className="text-[10px] text-muted-foreground">{item.sku}</div>}
                            </TableCell>
                            <TableCell className="py-2">
                              {item.invoiceNo || item.manualInvoiceNo ? (
                                <div className="flex flex-col text-[11px]">
                                  {item.invoiceNo && <span className="font-medium text-emerald-700">{item.invoiceNo}</span>}
                                  {item.manualInvoiceNo && <span className="text-muted-foreground">Man: {item.manualInvoiceNo}</span>}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-right font-medium">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              {formatCurrency(item.unitPrice)}
                            </TableCell>
                            <TableCell className="py-2 text-right font-bold text-purple-900">
                              {formatCurrency(item.totalValue)}
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 py-0",
                                  item.returnType === "Damage" ? "border-red-300 text-red-700 bg-red-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"
                                )}
                              >
                                {item.returnType} Stock
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title="Edit Item Details"
                                  className="h-7 w-7 text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                                  onClick={() => handleOpenEditItem(item)}
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
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                placeholder="Remarks or reference details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={handleSubmit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Pencil className="w-4 h-4 text-purple-600" />
              Edit {editingItem?.productName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Change product, returned quantity, unit credit rate, bill reference, or condition.
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Product</Label>
                <Popover open={editProductSelectOpen} onOpenChange={setEditProductSelectOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between h-9 text-xs">
                      <span className="truncate">
                        {catalogProducts.find((p) => p.id === editProductId)?.name ||
                          purchasedProducts.find((p) => p.id === editProductId)?.name ||
                          editingItem.productName}
                      </span>
                      <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Change product..." className="h-8 text-xs" />
                      <CommandList className="max-h-52">
                        <CommandGroup heading="Available Products">
                          {catalogProducts.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.name} ${p.sku}`}
                              onSelect={() => {
                                setEditProductId(p.id);
                                if (editUnitPrice <= 0 && p.sellingPrice) {
                                  setEditUnitPrice(p.sellingPrice);
                                }
                                setEditProductSelectOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-3.5 w-3.5", editProductId === p.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex-1 text-xs">
                                <div className="font-medium">{p.name}</div>
                                <div className="text-[10px] text-muted-foreground">{p.sku}</div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

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
                    placeholder="e.g. SI-0102"
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

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-xs text-muted-foreground">
                  New Total: <span className="font-bold text-gray-900">{formatCurrency(editQuantity * editUnitPrice)}</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingItem(null)}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSaveEditItem}>
                    Save Item Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
