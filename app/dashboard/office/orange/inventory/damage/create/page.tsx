"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  ArrowLeft,
  Loader2,
  Plus,
  X,
  Package,
  MapPin,
  ClipboardList,
  AlertTriangle,
  Search,
  Truck,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { BUSINESS_IDS } from "@/app/config/business-constants";

interface Location {
  id: string;
  name: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  available_quantity: number;
  unit: string;
}

interface DamageItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  availableQuantity: number;
  unit: string;
  damageType: "Location" | "Transport";
}

export default function CreateOrangeDamageReportPage() {
  const router = useRouter();

  // --- State ---
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [reason, setReason] = useState("");

  const [sourceProducts, setSourceProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [damageType, setDamageType] = useState<"Location" | "Transport">(
    "Location"
  );

  const [damageItems, setDamageItems] = useState<DamageItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // --- Effects ---
  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (selectedLocationId) {
      fetchLocationStock();
    } else {
      setSourceProducts([]);
      setDamageItems([]);
      setSelectedProductId("");
    }
  }, [selectedLocationId]);

  // --- Fetch Data ---
  const fetchLocations = async () => {
    try {
      // Pass businessId to filter: Orange Agency Locations
      const res = await fetch(
        `/api/settings/locations?businessId=${BUSINESS_IDS.ORANGE_AGENCY}`
      );
      if (!res.ok) throw new Error("Failed to load locations");
      const data = await res.json();
      setLocations(data);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocationStock = async () => {
    setStockLoading(true);
    try {
      const res = await fetch(`/api/inventory/${selectedLocationId}`);
      if (!res.ok) throw new Error("Failed to load stock data");
      const data = await res.json();

      const products = data.stocks.map((stock: any) => ({
        id: stock.id,
        sku: stock.sku,
        name: stock.name,
        available_quantity: stock.quantity,
        unit: stock.unit_of_measure || "Units",
      }));

      setSourceProducts(products);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setStockLoading(false);
    }
  };

  // --- Handlers ---
  const handleAddProduct = () => {
    if (!selectedProductId) return toast.error("Please select a product");
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0)
      return toast.error("Please enter a valid quantity");

    const product = sourceProducts.find((p) => p.id === selectedProductId);
    if (!product) return;

    if (qty > product.available_quantity) {
      return toast.error(
        `Max available is ${product.available_quantity} ${product.unit}`
      );
    }

    const existingIndex = damageItems.findIndex(
      (item) =>
        item.productId === selectedProductId && item.damageType === damageType
    );

    if (existingIndex >= 0) {
      const updatedItems = [...damageItems];
      updatedItems[existingIndex].quantity = qty;
      setDamageItems(updatedItems);
      toast.success("Quantity updated");
    } else {
      setDamageItems([
        ...damageItems,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: qty,
          availableQuantity: product.available_quantity,
          unit: product.unit,
          damageType: damageType,
        },
      ]);
      toast.success("Added to damage list");
    }
    setSelectedProductId("");
    setQuantity("");
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...damageItems];
    newItems.splice(index, 1);
    setDamageItems(newItems);
  };

  const handleSubmit = async () => {
    if (!selectedLocationId) return toast.error("Select a location");
    if (damageItems.length === 0) return toast.error("Add items to report");

    setSubmitting(true);
    try {
      const payload = {
        locationId: selectedLocationId,
        // Send the ORANGE_AGENCY Business ID
        businessId: BUSINESS_IDS.ORANGE_AGENCY,
        items: damageItems,
        reason: reason || "Internal Damage Report",
      };

      const res = await fetch("/api/inventory/damage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to submit damage report");

      toast.success("Damage report processed successfully");
      router.push("/dashboard/office/orange/inventory/damage");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProduct = sourceProducts.find(
    (p) => p.id === selectedProductId
  );

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin h-8 w-8 text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 h-8 w-8 text-muted-foreground"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-orange-950">
              Report New Damage (Orange)
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 ml-8">
            Mark inventory as damaged in Orange Agency locations.
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={handleSubmit}
          disabled={
            submitting || !selectedLocationId || damageItems.length === 0
          }
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <AlertTriangle className="mr-2 h-4 w-4" />
          )}
          Confirm Damages
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Inputs */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="w-4 h-4 text-orange-600" /> Location &
                Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select
                    value={selectedLocationId}
                    onValueChange={setSelectedLocationId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Location" />
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
                <div className="space-y-2">
                  <Label>Reference Note</Label>
                  <Input
                    placeholder="e.g. Warehouse Leak, Truck Accident"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={
              !selectedLocationId ? "opacity-60 pointer-events-none" : ""
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="w-4 h-4 text-orange-600" /> Select Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stockLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading
                  stock...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-5 space-y-2">
                      <Label>Product (Good Stock)</Label>
                      <Select
                        value={selectedProductId}
                        onValueChange={setSelectedProductId}
                      >
                        <SelectTrigger className="w-full">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Search className="w-4 h-4" />
                            <SelectValue placeholder="Search product..." />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {sourceProducts.length === 0 ? (
                            <div className="p-2 text-sm text-center">
                              No Stock
                            </div>
                          ) : (
                            sourceProducts.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                <div className="flex justify-between w-full gap-4">
                                  <span>{p.name}</span>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {p.available_quantity} {p.unit}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-3 space-y-2">
                      <Label>Damage Type</Label>
                      <Select
                        value={damageType}
                        onValueChange={(v: any) => setDamageType(v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Location">
                            <div className="flex items-center gap-2">
                              <Warehouse className="w-3 h-3" /> Location
                            </div>
                          </SelectItem>
                          <SelectItem value="Transport">
                            <div className="flex items-center gap-2">
                              <Truck className="w-3 h-3" /> Transport
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-3 space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-1">
                      <Button
                        onClick={handleAddProduct}
                        disabled={!selectedProductId || !quantity}
                        className="w-full bg-orange-600 hover:bg-orange-700"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: List */}
        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="w-4 h-4 text-orange-600" /> Damage
                  List
                </CardTitle>
                {damageItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive"
                    onClick={() => setDamageItems([])}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden min-h-[300px]">
              {damageItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <AlertTriangle className="w-10 h-10 opacity-20 mb-2" />
                  <p>No damages added</p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="pl-4">Item</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {damageItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="pl-4 py-3">
                            <div className="font-medium text-sm">
                              {item.productName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.sku}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                item.damageType === "Transport"
                                  ? "text-orange-600 border-orange-200 bg-orange-50"
                                  : "text-red-600 border-red-200 bg-red-50"
                              }
                            >
                              {item.damageType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="pr-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveItem(idx)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <div className="p-4 border-t bg-muted/20 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Total Damaged Units</span>
              <span className="font-bold text-lg text-red-600">
                {damageItems.reduce((acc, i) => acc + i.quantity, 0)}
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
