"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  FileText,
  User,
  MapPin,
  Phone,
  Briefcase,
  Loader2,
  XCircle,
  Edit,
  Save,
  X,
  Calendar,
  Hash,
  CreditCard,
  Plus,
  Search,
  Package,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  stock: number;
}

interface OrderItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  qty: number;
  free: number;
  total: number;
  productId?: string;
}

export default function ViewOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);

  // Dialog States
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);

  // Products for adding
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemFree, setNewItemFree] = useState(0);

  // --- 1. Fetch Order Data ---
  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/${id}`);

      if (!res.ok) throw new Error("Failed to load order");

      const data = await res.json();
      setOrder(data);
      setItems(data.items);
    } catch (error) {
      console.error(error);
      toast.error("Could not fetch order details");
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Fetch Products for Adding ---
  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error(error);
      toast.error("Could not load products");
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  // --- 3. Editing Logic ---
  const handleItemChange = (itemId: string, field: string, value: string) => {
    const numValue = parseFloat(value) || 0;

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: numValue };
          updatedItem.total = updatedItem.price * updatedItem.qty;
          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
  };

  const handleAddNewItem = () => {
    if (!selectedProduct) {
      toast.error("Please select a product");
      return;
    }

    // Check if product already exists in items
    const exists = items.find((item) => item.productId === selectedProduct.id);
    if (exists) {
      toast.error("This product is already in the order");
      return;
    }

    const newItem: OrderItem = {
      id: `temp-${Date.now()}`, // Temporary ID
      sku: selectedProduct.sku,
      name: selectedProduct.name,
      unit: selectedProduct.unit,
      price: selectedProduct.price,
      qty: newItemQty,
      free: newItemFree,
      total: selectedProduct.price * newItemQty,
      productId: selectedProduct.id,
    };

    setItems([...items, newItem]);
    toast.success(`Added ${selectedProduct.name} to order`);

    // Reset dialog
    setShowAddItemDialog(false);
    setSelectedProduct(null);
    setNewItemQty(1);
    setNewItemFree(0);
    setSearchQuery("");
  };

  const saveChanges = async () => {
    if (!order) return;
    setProcessing(true);

    const newTotalAmount = items.reduce(
      (acc, item) => acc + (item.total || 0),
      0
    );

    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_items",
          items: items,
          totalAmount: newTotalAmount,
        }),
      });

      if (!res.ok) throw new Error("Failed to update order");

      toast.success("Order updated successfully!");
      setIsEditing(false);
      fetchOrderDetails(); // Refresh
    } catch (error) {
      toast.error("Failed to save changes");
    } finally {
      setProcessing(false);
    }
  };

  // --- 4. Action Buttons Logic ---
  const executeApprove = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Processing" }),
      });

      if (!res.ok) throw new Error("Failed to approve order");

      toast.success("Order Approved! Moved to Processing.");
      router.push("/dashboard/admin/orders/pending");
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setProcessing(false);
      setShowApproveDialog(false);
    }
  };

  const executeReject = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Cancelled" }),
      });

      if (!res.ok) throw new Error("Failed to cancel order");

      toast.success("Order Cancelled.");
      router.push("/dashboard/admin/orders");
    } catch (error) {
      toast.error("Failed to cancel order");
    } finally {
      setProcessing(false);
      setShowRejectDialog(false);
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return <div className="p-10 text-center text-red-500">Order not found</div>;
  }

  const subtotal = items.reduce((acc, item) => acc + (item.total || 0), 0);
  const grandTotal = subtotal;

  return (
    <div className="space-y-6 mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-9 w-9"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {isEditing ? "Edit Order" : "Order Details"}
              </h1>
              <Badge
                variant={order.status === "Pending" ? "secondary" : "outline"}
                className="font-medium"
              >
                {order.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Order #{order.orderId} •{" "}
              {new Date(order.date).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  fetchOrderDetails(); // Reset changes
                }}
                disabled={processing}
              >
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveChanges}
                disabled={processing}
                className="bg-green-600 hover:bg-green-700"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4 mr-2" /> Print
              </Button>

              {order.status === "Pending" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800"
                  >
                    <Edit className="w-4 h-4 mr-2" /> Edit Order
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={processing}
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setShowApproveDialog(true)}
                    disabled={processing}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN: Details & Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Invoice Info Card */}
          <Card>
            <CardHeader className="">
              <CardTitle className="text-lg">
                Invoice & Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Invoice Number Highlight */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 p-4 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <div>
                    <Label className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
                      Invoice Number
                    </Label>
                    <div className="text-2xl font-bold text-blue-900 mt-1 font-mono">
                      {order.invoiceNo || "N/A"}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-xs text-muted-foreground">
                      Order ID:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {order.orderId}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Payment:{" "}
                      <Badge
                        variant={
                          order.paymentStatus === "Paid"
                            ? "default"
                            : "destructive"
                        }
                        className="ml-1 text-[10px] h-5"
                      >
                        {order.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer & Sales Info Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-semibold uppercase">
                    Customer
                  </Label>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="font-semibold">
                          {order.customer?.shopName || "Unknown"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.customer?.name}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {order.customer?.phone || "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-semibold uppercase">
                    Sales Rep
                  </Label>
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{order.salesRep}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Items Table */}
          <Card>
            <CardHeader className="">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Order Items</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {isEditing
                      ? "Modify quantities or add new items"
                      : `${items.length} items in this order`}
                  </CardDescription>
                </div>
                {isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowAddItemDialog(true);
                      fetchProducts();
                    }}
                    className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Items
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[100px]">SKU</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right w-[80px]">
                        Unit
                      </TableHead>
                      <TableHead className="text-right w-[100px]">
                        Price
                      </TableHead>
                      <TableHead className="text-right w-[100px]">
                        Qty
                      </TableHead>
                      <TableHead className="text-right w-[80px] text-green-600">
                        Free
                      </TableHead>
                      <TableHead className="text-right w-[120px]">
                        Total
                      </TableHead>
                      {isEditing && (
                        <TableHead className="w-[60px]"></TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={isEditing ? 8 : 7}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No items in this order
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {item.sku}
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.name}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {item.unit}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                className="w-20 text-right h-8 ml-auto text-sm"
                                value={item.price}
                                onChange={(e) =>
                                  handleItemChange(
                                    item.id,
                                    "price",
                                    e.target.value
                                  )
                                }
                              />
                            ) : (
                              <span className="text-sm">
                                {item.price.toLocaleString()}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                className="w-16 text-right h-8 ml-auto text-sm font-medium"
                                value={item.qty}
                                onChange={(e) =>
                                  handleItemChange(
                                    item.id,
                                    "qty",
                                    e.target.value
                                  )
                                }
                              />
                            ) : (
                              <span className="font-medium">{item.qty}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {isEditing ? (
                              <Input
                                type="number"
                                className="w-16 text-right h-8 ml-auto text-sm border-green-200 focus:border-green-500"
                                value={item.free}
                                onChange={(e) =>
                                  handleItemChange(
                                    item.id,
                                    "free",
                                    e.target.value
                                  )
                                }
                              />
                            ) : item.free > 0 ? (
                              <span className="font-medium">{item.free}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            LKR {item.total.toLocaleString()}
                          </TableCell>
                          {isEditing && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRemoveItem(item.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Items</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Units</span>
                  <span className="font-medium">
                    {items.reduce(
                      (a, b) =>
                        a + (Number(b.qty) || 0) + (Number(b.free) || 0),
                      0
                    )}
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    LKR {subtotal.toLocaleString()}
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold">Grand Total</span>
                  <span className="font-bold text-2xl text-primary">
                    LKR {grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {!isEditing && (
                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Back to Orders
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Add Product to Order
            </DialogTitle>
            <DialogDescription>
              Search and select a product to add to this order
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Products List */}
            <div className="flex-1 overflow-y-auto border rounded-lg">
              {loadingProducts ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No products found</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedProduct?.id === product.id
                          ? "bg-blue-50 border-l-4 border-blue-500"
                          : ""
                      }`}
                      onClick={() => setSelectedProduct(product)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-mono text-muted-foreground">
                              {product.sku}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] h-5"
                            >
                              {product.unit}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Stock: {product.stock}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">
                            LKR {product.price.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity Inputs */}
            {selectedProduct && (
              <Card className="border-2 border-blue-200 bg-blue-50/50">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-semibold text-blue-900">
                        Selected Product
                      </Label>
                      <div className="font-medium">{selectedProduct.name}</div>
                      <div className="text-sm text-muted-foreground">
                        LKR {selectedProduct.price.toLocaleString()} /{" "}
                        {selectedProduct.unit}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="qty" className="text-xs">
                          Quantity <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="qty"
                          type="number"
                          min="1"
                          value={newItemQty}
                          onChange={(e) =>
                            setNewItemQty(Number(e.target.value))
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="free"
                          className="text-xs text-green-600"
                        >
                          Free Items
                        </Label>
                        <Input
                          id="free"
                          type="number"
                          min="0"
                          value={newItemFree}
                          onChange={(e) =>
                            setNewItemFree(Number(e.target.value))
                          }
                          className="mt-1 border-green-200 focus:border-green-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm font-medium">Item Total:</span>
                      <span className="text-lg font-bold text-blue-900">
                        LKR{" "}
                        {(selectedProduct.price * newItemQty).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddItemDialog(false);
                setSelectedProduct(null);
                setSearchQuery("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddNewItem}
              disabled={!selectedProduct || newItemQty < 1}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add to Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Order</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm approval of order #{order.orderId}? This will move it to{" "}
              <strong>Processing</strong> status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeApprove}
              className="bg-green-600 hover:bg-green-700"
            >
              Approve Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject order #{order.orderId}? This will
              mark it as <strong>Cancelled</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeReject}
              className="bg-red-600 hover:bg-red-700"
            >
              Reject Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
