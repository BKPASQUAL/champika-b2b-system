// app/dashboard/admin/orders/[id]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  FileText,
  User,
  MapPin,
  Phone,
  Briefcase,
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
import { MOCK_ALL_ORDERS } from "../data";

// --- Mock Data Extension for View ---
const MOCK_CUSTOMERS_EXTENDED = [
  {
    id: "C1",
    name: "Saman Electronics",
    route: "Galle Town",
    phone: "077-1234567",
    repName: "Ajith Bandara",
  },
  {
    id: "C2",
    name: "City Hardware",
    route: "Matara Road",
    phone: "071-9876543",
    repName: "Chathura Perera",
  },
  {
    id: "C3",
    name: "Lanka Traders",
    route: "Ahangama",
    phone: "076-5554444",
    repName: "Dilshan Silva",
  },
];

export default function ViewOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Simulated Items Data (In a real app, this would be in the order object)
  const [orderItems, setOrderItems] = useState([
    {
      id: "1",
      sku: "SKU-001",
      name: "Copper Wire 2.5mm",
      unit: "m",
      price: 180,
      qty: 50,
      free: 0,
      disc: 0,
      total: 9000,
    },
    {
      id: "2",
      sku: "SKU-002",
      name: "PVC Pipe 4 inch",
      unit: "unit",
      price: 850,
      qty: 20,
      free: 2,
      disc: 5,
      total: 16150,
    },
  ]);

  useEffect(() => {
    // Simulate API Fetch
    setTimeout(() => {
      const foundOrder = MOCK_ALL_ORDERS.find((o) => o.id === orderId);
      if (foundOrder) {
        setOrder(foundOrder);
        // Find extended customer details based on name (Simulated join)
        const cust =
          MOCK_CUSTOMERS_EXTENDED.find(
            (c) => c.name === foundOrder.customerName
          ) || MOCK_CUSTOMERS_EXTENDED[0];
        setCustomerDetails(cust);
      }
      setLoading(false);
    }, 500);
  }, [orderId]);

  if (loading) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        Loading order details...
      </div>
    );
  }

  if (!order) {
    return <div className="p-10 text-center text-red-500">Order not found</div>;
  }

  // Calculations
  const subtotal = orderItems.reduce((acc, item) => acc + item.total, 0);
  const totalDiscount = 0; // Add logic if needed
  const grandTotal = subtotal - totalDiscount;

  return (
    <div className="space-y-4  mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              Order Details
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200"
              >
                {order.status}
              </Badge>
            </h1>
            <p className="text-muted-foreground text-sm">
              View details for order{" "}
              <span className="font-mono font-medium text-foreground">
                {order.orderId}
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          {/* Only show Process button if Pending */}
          {order.status === "Pending" && (
            <Button className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Approve & Process
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 ">
        {/* LEFT COLUMN: Details & Items */}
        <div className="lg:col-span-2 space-y-4">
          {/* 1. Customer & Billing Information (Read Only) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Invoice Details
              </CardTitle>
              <CardDescription>
                Customer and billing information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 ">
              {/* Row 1: Customer & Rep */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Customer
                  </Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{order.customerName}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Representative
                  </Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {customerDetails?.repName || order.salesRep}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 2: Route & Mobile (New Requested Fields) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Route / Area
                  </Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{customerDetails?.route}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Shop Mobile
                  </Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{customerDetails?.phone}</span>
                  </div>
                </div>
              </div>

              {/* Row 3: Invoice No & Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Order / Invoice No
                  </Label>
                  <Input
                    value={order.orderId}
                    disabled
                    className="bg-muted/30 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    Date
                  </Label>
                  <Input value={order.date} disabled className="bg-muted/30" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Order Items Table (Read Only) */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>Products included in this order</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto px-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead>Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="text-right">Unit</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right text-green-600">
                        Free
                      </TableHead>
                      <TableHead className="text-right">Disc %</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {item.sku}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.price.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.qty}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {item.free > 0 ? item.free : "-"}
                        </TableCell>
                        <TableCell className="text-right text-red-500">
                          {item.disc > 0 ? item.disc + "%" : "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          LKR {item.total.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status Section */}
              <div className="rounded-lg border p-4 bg-muted/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">
                    Payment Status
                  </span>
                  <Badge
                    variant={
                      order.paymentStatus === "Paid" ? "default" : "destructive"
                    }
                  >
                    {order.paymentStatus}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Order Status
                  </span>
                  <Badge
                    variant="secondary"
                    className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                  >
                    {order.status}
                  </Badge>
                </div>
              </div>

              {/* Totals Section */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Items</span>
                  <span className="font-medium">{orderItems.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Quantity</span>
                  <span className="font-medium">
                    {orderItems.reduce((a, b) => a + b.qty + b.free, 0)}
                  </span>
                </div>

                <Separator className="my-2" />

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>LKR {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Total Discount</span>
                  <span>- LKR {totalDiscount.toLocaleString()}</span>
                </div>

                <Separator className="my-2" />

                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold text-lg">Grand Total</span>
                  <span className="font-bold text-2xl text-primary">
                    LKR {grandTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <Button
                className="w-full h-12 text-lg"
                variant="outline"
                onClick={() => router.back()}
              >
                Back to Orders
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
