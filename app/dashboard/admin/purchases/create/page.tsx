"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, ArrowLeft, Save, PackageOpen } from "lucide-react";
import { PurchaseFormData, PaymentStatus, PurchaseItem } from "../types";

// Mock Data
const mockSuppliers = [
  { id: "S1", name: "Sierra Cables Ltd", phone: "+94 11 234 5678" },
  { id: "S2", name: "Lanka Builders Pvt Ltd", phone: "+94 77 123 4567" },
  { id: "S3", name: "Colombo Cement Corp", phone: "+94 33 222 3333" },
];

const mockProducts = [
  { id: "P1", name: "Copper Wire 2.5mm", mrp: 150, cost: 120 },
  { id: "P2", name: "PVC Pipe 4 inch", mrp: 800, cost: 650 },
  { id: "P3", name: "Cement 50kg", mrp: 2800, cost: 2600 },
];

export default function CreatePurchasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState<PurchaseFormData>({
    supplierId: "",
    supplierName: "",
    invoiceNo: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    billingDate: "",
    arrivalDate: "",
    status: "Ordered", // Default status, removed from UI
    paymentStatus: "Unpaid",
    items: [],
    totalAmount: 0,
  });

  // Local state for the "Add Item" row
  const [newItem, setNewItem] = useState<{
    productId: string;
    productName: string;
    quantity: number;
    mrp: number;
    unitCost: number;
    discount: number;
  }>({
    productId: "",
    productName: "",
    quantity: 1,
    mrp: 0,
    unitCost: 0,
    discount: 0,
  });

  // Handle Product Selection
  const handleProductSelect = (productId: string) => {
    const product = mockProducts.find((p) => p.id === productId);
    if (product) {
      setNewItem({
        ...newItem,
        productId: product.id,
        productName: product.name,
        mrp: product.mrp,
        unitCost: product.cost,
      });
    }
  };

  // Add Item to List
  const handleAddItem = () => {
    if (!newItem.productId) return;

    // Calculate Item Total: (Cost * Qty) - Discount%
    const baseCost = newItem.unitCost * newItem.quantity;
    const discountAmount = baseCost * (newItem.discount / 100);
    const totalCost = baseCost - discountAmount;

    const itemToAdd: PurchaseItem = {
      id: Date.now().toString(),
      ...newItem,
      totalCost: totalCost,
    };

    const updatedItems = [...formData.items, itemToAdd];
    updateFormData(updatedItems);

    // Reset Add Item Row
    setNewItem({
      productId: "",
      productName: "",
      quantity: 1,
      mrp: 0,
      unitCost: 0,
      discount: 0,
    });
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    updateFormData(updatedItems);
  };

  // Recalculate Totals
  const updateFormData = (items: PurchaseItem[]) => {
    const totalAmount = items.reduce((sum, item) => sum + item.totalCost, 0);
    setFormData({ ...formData, items, totalAmount });
  };

  // Handle Supplier Select
  const handleSupplierSelect = (supplierId: string) => {
    const supplier = mockSuppliers.find((s) => s.id === supplierId);
    setFormData({
      ...formData,
      supplierId: supplierId,
      supplierName: supplier?.name || "",
    });
  };

  const handleSave = async () => {
    if (!formData.supplierId) {
      alert("Please select a supplier");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      console.log("Saving Purchase:", formData);
      setLoading(false);
      router.push("/dashboard/admin/purchases");
    }, 1000);
  };

  // Calculate MRP Total for Summary
  const totalMRP = formData.items.reduce(
    (sum, item) => sum + item.mrp * item.quantity,
    0
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              New Purchase Order
            </h1>
            <p className="text-muted-foreground text-sm">
              Create a new purchase order from{" "}
              {formData.supplierName || "Supplier"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              "Saving..."
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" /> Save Purchase
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Inputs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Purchase Details Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Purchase Details</CardTitle>
              <CardDescription>
                Supplier and invoice information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Supplier */}
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select
                    value={formData.supplierId}
                    onValueChange={handleSupplierSelect}
                  >
                    <SelectTrigger className="bg-muted/30">
                      <SelectValue placeholder="Select Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockSuppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.supplierId && (
                    <p className="text-xs text-muted-foreground">
                      {
                        mockSuppliers.find((s) => s.id === formData.supplierId)
                          ?.phone
                      }
                    </p>
                  )}
                </div>

                {/* Purchase Date */}
                <div className="space-y-2">
                  <Label>Purchase Date</Label>
                  <Input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) =>
                      setFormData({ ...formData, purchaseDate: e.target.value })
                    }
                  />
                </div>

                {/* Invoice Number */}
                <div className="space-y-2">
                  <Label>Invoice Number</Label>
                  <Input
                    placeholder="Supplier's invoice/bill number"
                    value={formData.invoiceNo}
                    onChange={(e) =>
                      setFormData({ ...formData, invoiceNo: e.target.value })
                    }
                  />
                </div>

                {/* Payment Status */}
                <div className="space-y-2">
                  <Label>Payment Status</Label>
                  <Select
                    value={formData.paymentStatus}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        paymentStatus: v as PaymentStatus,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unpaid">Unpaid</SelectItem>
                      <SelectItem value="Partial">Partial</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Billing Date */}
                <div className="space-y-2">
                  <Label>Billing Date</Label>
                  <Input
                    type="date"
                    value={formData.billingDate}
                    onChange={(e) =>
                      setFormData({ ...formData, billingDate: e.target.value })
                    }
                  />
                </div>

                {/* Arrival Date */}
                <div className="space-y-2">
                  <Label>Arrival Date (Delivered)</Label>
                  <Input
                    type="date"
                    value={formData.arrivalDate}
                    onChange={(e) =>
                      setFormData({ ...formData, arrivalDate: e.target.value })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add Items Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Add Items</CardTitle>
              <CardDescription>
                Add products with cost price and discount
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-12 gap-4 items-end">
                <div className="col-span-4 space-y-2">
                  <Label>Product</Label>
                  <Select
                    value={newItem.productId}
                    onValueChange={handleProductSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newItem.quantity}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        quantity: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>MRP (LKR)</Label>
                  <Input
                    type="number"
                    value={newItem.mrp}
                    readOnly
                    className="bg-muted/50"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Cost Price</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newItem.unitCost}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        unitCost: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="col-span-1 space-y-2">
                  <Label>Disc %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={newItem.discount}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        discount: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    onClick={handleAddItem}
                    className="w-full h-10"
                    variant="default"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Items List */}
          <Card className="min-h-[300px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Purchase Items</CardTitle>
              <CardDescription>Items in this purchase order</CardDescription>
            </CardHeader>
            <CardContent>
              {formData.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border-2 border-dashed rounded-lg mt-2">
                  <PackageOpen className="w-10 h-10 mb-2 opacity-20" />
                  <p>No items added yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">MRP</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Disc</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.items.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.productName}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.mrp.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.unitCost.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-red-500">
                          {item.discount > 0 ? `${item.discount}%` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {item.totalCost.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleRemoveItem(idx)}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader className="bg-muted/20 pb-4">
              <CardTitle className="text-base">Purchase Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Supplier:</span>
                <span className="font-medium">
                  {formData.supplierName || "Not set"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date:</span>
                <span>{formData.purchaseDate}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice #:</span>
                <span>{formData.invoiceNo || "Not set"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment:</span>
                <span
                  className={
                    formData.paymentStatus === "Paid"
                      ? "text-green-600 font-medium"
                      : formData.paymentStatus === "Unpaid"
                      ? "text-red-600 font-medium"
                      : "text-amber-600 font-medium"
                  }
                >
                  {formData.paymentStatus}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items:</span>
                <span>{formData.items.length}</span>
              </div>

              <Separator />

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">MRP Value:</span>
                <span>LKR {totalMRP.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold text-lg">Total Cost:</span>
                <span className="font-bold text-2xl">
                  LKR {formData.totalAmount.toLocaleString()}
                </span>
              </div>

              <p className="text-xs text-muted-foreground pt-1">
                This is what you will pay to the supplier
              </p>

              <Button
                className="w-full mt-4 py-6 text-md"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? "Processing..." : "Create Purchase Order"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
