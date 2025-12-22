"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  Check,
  ChevronsUpDown,
  ShoppingBag,
  History,
  FileText,
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

// --- Types ---
interface Business {
  id: string;
  name: string;
}
interface Customer {
  id: string;
  shopName: string;
  businessId: string;
}
interface Location {
  id: string;
  name: string;
  business_id: string | null;
}
interface Invoice {
  id: string;
  invoiceNo: string;
  date: string;
  amount: number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  totalPurchased: number;
  sellingPrice: number;
}

interface ReturnItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  returnType: "Good" | "Damage";
  reason: string;
}

export default function CreateReturnPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);

  // --- Data State ---
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // --- Form State ---
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState<string>("all");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  // Popover States
  const [businessOpen, setBusinessOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  // --- Item Entry State ---
  const [currentItem, setCurrentItem] = useState<{
    productId: string;
    quantity: number;
    returnType: "Good" | "Damage";
    reason: string;
  }>({
    productId: "",
    quantity: 1,
    returnType: "Good",
    reason: "",
  });

  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

  // --- 1. Fetch Businesses ---
  useEffect(() => {
    const fetchInitData = async () => {
      try {
        const busRes = await fetch("/api/settings/business");
        if (busRes.ok) setBusinesses(await busRes.json());
      } catch (error) {
        toast.error("Failed to load businesses");
      } finally {
        setInitLoading(false);
      }
    };
    fetchInitData();
  }, []);

  // --- 2. Fetch Customers & Locations ---
  useEffect(() => {
    const fetchBusinessScopedData = async () => {
      if (!selectedBusinessId) {
        setCustomers([]);
        setLocations([]);
        return;
      }
      setLoading(true);
      try {
        const custRes = await fetch(
          `/api/customers?businessId=${selectedBusinessId}`
        );
        setCustomers(await custRes.json());

        const locRes = await fetch("/api/settings/locations");
        const locData = await locRes.json();
        setLocations(
          locData.filter(
            (l: any) =>
              l.business_id === selectedBusinessId || l.business_id === null
          )
        );

        setSelectedCustomerId("");
        setSelectedLocationId("");
        setSelectedInvoiceNo("all");
        setInvoices([]);
        setProducts([]);
      } catch (error) {
        toast.error("Failed to load business data");
      } finally {
        setLoading(false);
      }
    };
    fetchBusinessScopedData();
  }, [selectedBusinessId]);

  // --- 3. Fetch Invoices ---
  useEffect(() => {
    const fetchInvoices = async () => {
      if (!selectedCustomerId) {
        setInvoices([]);
        setSelectedInvoiceNo("all");
        return;
      }
      try {
        const res = await fetch(
          `/api/customers/${selectedCustomerId}/invoices`
        );
        if (res.ok) setInvoices(await res.json());
      } catch (error) {
        console.error("Failed to fetch invoices");
      }
    };
    fetchInvoices();
  }, [selectedCustomerId]);

  // --- 4. Fetch Products ---
  useEffect(() => {
    const fetchCustomerProducts = async () => {
      if (!selectedCustomerId) {
        setProducts([]);
        return;
      }

      setProductsLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedInvoiceNo && selectedInvoiceNo !== "all") {
          params.append("invoiceNo", selectedInvoiceNo);
        }

        const res = await fetch(
          `/api/customers/${selectedCustomerId}/purchased-products?${params.toString()}`
        );
        if (!res.ok) throw new Error("Failed to load products");
        const data = await res.json();
        setProducts(data);

        if (
          currentItem.productId &&
          !data.find((p: any) => p.id === currentItem.productId)
        ) {
          setCurrentItem((prev) => ({ ...prev, productId: "" }));
        }
      } catch (error) {
        toast.error("Error loading product history");
      } finally {
        setProductsLoading(false);
      }
    };

    fetchCustomerProducts();
  }, [selectedCustomerId, selectedInvoiceNo]);

  // --- Handlers ---
  const handleAddItem = () => {
    if (!currentItem.productId) return toast.error("Select a product");
    if (currentItem.quantity <= 0)
      return toast.error("Quantity must be greater than 0");

    const product = products.find((p) => p.id === currentItem.productId);
    if (!product) return;

    if (currentItem.quantity > product.totalPurchased) {
      toast.warning(
        `Note: Returning ${currentItem.quantity}, but invoice record shows ${product.totalPurchased}.`
      );
    }

    const newItem: ReturnItem = {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: currentItem.quantity,
      returnType: currentItem.returnType,
      reason: currentItem.reason,
    };

    setReturnItems([...returnItems, newItem]);
    setCurrentItem({
      productId: "",
      quantity: 1,
      returnType: "Good",
      reason: "",
    });
  };

  const handleRemoveItem = (id: string) => {
    setReturnItems(returnItems.filter((item) => item.id !== id));
  };

  const handleProcessReturn = async () => {
    if (!selectedBusinessId || !selectedCustomerId || !selectedLocationId) {
      return toast.error("Please select Business, Customer, and Location");
    }
    if (returnItems.length === 0) return toast.error("No items to return");

    setLoading(true);
    let successCount = 0;

    try {
      const promises = returnItems.map((item) => {
        // Prepare Payload
        const payload: any = {
          business_id: selectedBusinessId,
          customer_id: selectedCustomerId,
          location_id: selectedLocationId,
          product_id: item.productId,
          quantity: item.quantity,
          return_type: item.returnType,
          reason: item.reason,
        };

        // Explicitly send invoice_no if selected
        if (selectedInvoiceNo && selectedInvoiceNo !== "all") {
          payload.invoice_no = selectedInvoiceNo;
          // Also append to reason for visibility
          payload.reason = `[${selectedInvoiceNo}] ${item.reason || ""}`.trim();
        }

        return fetch("/api/inventory/returns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then((res) => {
          if (res.ok) successCount++;
          return res;
        });
      });

      await Promise.all(promises);
      toast.success(`Processed ${successCount} returns`);
      router.push("/dashboard/admin/inventory/returns");
    } catch (error) {
      toast.error("Error processing returns");
    } finally {
      setLoading(false);
    }
  };

  if (initLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto ">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Create New Return
          </h1>
          <p className="text-muted-foreground mt-1">
            Select customer and add items to return.
          </p>
        </div>
        <Button
          onClick={handleProcessReturn}
          disabled={loading || returnItems.length === 0}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Process Return
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT: Inputs */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Return Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Business Entity <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={businessOpen} onOpenChange={setBusinessOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {selectedBusinessId
                          ? businesses.find((b) => b.id === selectedBusinessId)
                              ?.name
                          : "Select Business"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Search business..." />
                        <CommandList>
                          <CommandEmpty>No business found.</CommandEmpty>
                          <CommandGroup>
                            {businesses.map((b) => (
                              <CommandItem
                                key={b.id}
                                value={b.name}
                                onSelect={() => {
                                  setSelectedBusinessId(b.id);
                                  setSelectedCustomerId("");
                                  setBusinessOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedBusinessId === b.id
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {b.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>
                    Customer <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                        disabled={!selectedBusinessId}
                      >
                        {selectedCustomerId
                          ? customers.find((c) => c.id === selectedCustomerId)
                              ?.shopName
                          : "Select Customer"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Search customer..." />
                        <CommandList>
                          <CommandEmpty>No customer found.</CommandEmpty>
                          <CommandGroup>
                            {customers.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.shopName}
                                onSelect={() => {
                                  setSelectedCustomerId(c.id);
                                  setSelectedInvoiceNo("all");
                                  setCustomerOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCustomerId === c.id
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {c.shopName}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Filter by Invoice</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      (Optional)
                    </span>
                  </Label>
                  <Popover open={invoiceOpen} onOpenChange={setInvoiceOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                        disabled={!selectedCustomerId}
                      >
                        {selectedInvoiceNo === "all"
                          ? "All Purchased Items"
                          : invoices.find(
                              (i) => i.invoiceNo === selectedInvoiceNo
                            )?.invoiceNo || selectedInvoiceNo}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Search invoice #" />
                        <CommandList>
                          <CommandEmpty>No invoices found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="all"
                              onSelect={() => {
                                setSelectedInvoiceNo("all");
                                setInvoiceOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedInvoiceNo === "all"
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              All Purchased Items
                            </CommandItem>
                            {invoices.map((inv) => (
                              <CommandItem
                                key={inv.id}
                                value={inv.invoiceNo}
                                onSelect={() => {
                                  setSelectedInvoiceNo(inv.invoiceNo);
                                  setInvoiceOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedInvoiceNo === inv.invoiceNo
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{inv.invoiceNo}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(inv.date).toLocaleDateString()}
                                  </span>
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
                  <Label>
                    Return Location <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={selectedLocationId}
                    onValueChange={setSelectedLocationId}
                    disabled={!selectedBusinessId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Add Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Purchased Item
                  {productsLoading && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                </Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-auto py-3"
                      disabled={
                        !selectedCustomerId ||
                        productsLoading ||
                        products.length === 0
                      }
                    >
                      {currentItem.productId ? (
                        <div className="flex flex-col items-start text-left">
                          <span className="font-medium">
                            {
                              products.find(
                                (p) => p.id === currentItem.productId
                              )?.name
                            }
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Purchased:{" "}
                            {
                              products.find(
                                (p) => p.id === currentItem.productId
                              )?.totalPurchased
                            }{" "}
                            units
                          </span>
                        </div>
                      ) : selectedCustomerId ? (
                        products.length === 0 && !productsLoading ? (
                          "No items found for this selection"
                        ) : (
                          "Select Purchased Item"
                        )
                      ) : (
                        "Select Customer First"
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search purchased items..." />
                      <CommandList>
                        <CommandEmpty>No item found.</CommandEmpty>
                        <CommandGroup
                          heading={
                            selectedInvoiceNo !== "all"
                              ? `Invoice ${selectedInvoiceNo} Items`
                              : "All History"
                          }
                        >
                          {products.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.name}
                              onSelect={() => {
                                setCurrentItem({
                                  ...currentItem,
                                  productId: p.id,
                                });
                                setProductOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  currentItem.productId === p.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col w-full">
                                <div className="flex justify-between items-center w-full">
                                  <span className="font-medium">{p.name}</span>
                                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                                    Qty: {p.totalPurchased}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center w-full mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    {p.sku}
                                  </span>
                                  <span className="text-xs text-green-600 font-medium">
                                    LKR {p.sellingPrice.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedCustomerId && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    {selectedInvoiceNo !== "all" ? (
                      <FileText className="h-3 w-3" />
                    ) : (
                      <History className="h-3 w-3" />
                    )}
                    {selectedInvoiceNo !== "all"
                      ? `Showing items from invoice ${selectedInvoiceNo}`
                      : "Showing all items previously bought by this customer."}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={currentItem.returnType}
                    onValueChange={(v: "Good" | "Damage") =>
                      setCurrentItem({ ...currentItem, returnType: v })
                    }
                  >
                    <SelectTrigger
                      className={
                        currentItem.returnType === "Damage"
                          ? "text-red-600 border-red-200"
                          : "text-green-600 border-green-200"
                      }
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good">Good Stock</SelectItem>
                      <SelectItem value="Damage">Damage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Return Qty</Label>
                  <Input
                    type="number"
                    min="1"
                    value={currentItem.quantity}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        quantity: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input
                    placeholder="Optional"
                    value={currentItem.reason}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, reason: e.target.value })
                    }
                  />
                </div>
              </div>
              <Button
                onClick={handleAddItem}
                className="w-full"
                disabled={!currentItem.productId}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Item
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Return List</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground py-6"
                      >
                        No items added.
                      </TableCell>
                    </TableRow>
                  ) : (
                    returnItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.sku}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "px-2 py-1 rounded-full text-xs font-medium",
                              item.returnType === "Good"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            )}
                          >
                            {item.returnType}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.reason || "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
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

        {/* RIGHT: Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Business:</span>
                  <span className="font-medium">
                    {businesses.find((b) => b.id === selectedBusinessId)
                      ?.name || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">
                    {customers.find((c) => c.id === selectedCustomerId)
                      ?.shopName || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location:</span>
                  <span className="font-medium">
                    {locations.find((l) => l.id === selectedLocationId)?.name ||
                      "-"}
                  </span>
                </div>
                {selectedInvoiceNo !== "all" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice:</span>
                    <span className="font-medium text-blue-600">
                      {selectedInvoiceNo}
                    </span>
                  </div>
                )}
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between font-medium">
                  <span>Total Items:</span>
                  <span>{returnItems.length}</span>
                </div>
              </div>
              <Button
                className="w-full mt-4"
                size="lg"
                onClick={handleProcessReturn}
                disabled={loading || returnItems.length === 0}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{" "}
                Confirm & Process
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
