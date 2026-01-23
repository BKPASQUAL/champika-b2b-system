"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Package,
  AlertTriangle,
  BarChart3,
  Tag,
  Loader2,
  Building2,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function WiremanProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);

  const id = Array.isArray(params?.id) ? params?.id[0] : params?.id;

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        setLoading(true);
        // ✅ Pass BUSINESS_ID to ensure we get Wireman context stats
        const res = await fetch(
          `/api/products/${id}?businessId=${BUSINESS_IDS.WIREMAN_AGENCY}`
        );
        
        if (res.status === 404) {
          toast.error("Product not found or not available for Wireman");
          router.push("/dashboard/office/wireman/products");
          return;
        }
        
        if (!res.ok) throw new Error("Failed to load product");
        const data = await res.json();
        setProduct(data);
      } catch (error) {
        console.error(error);
        toast.error("Error loading product details");
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-red-950">
              {product.name}
              {product.isActive ? (
                <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
              ) : (
                <Badge variant="destructive">Inactive</Badge>
              )}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="font-mono">{product.sku}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" /> {product.category}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-red-700 font-medium">
                <Building2 className="w-3 h-3" /> {product.supplier}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Stats & Pricing */}
        <div className="space-y-6">
          <Card className="border-t-4 border-t-red-600 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Inventory Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-900">Available Stock</span>
                </div>
                <span className="text-2xl font-bold text-green-700">
                  {product.stock} <span className="text-sm font-normal text-muted-foreground">{product.unitOfMeasure}</span>
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-900">Damaged Stock</span>
                </div>
                <span className="text-2xl font-bold text-red-700">
                  {product.damagedStock} <span className="text-sm font-normal text-muted-foreground">{product.unitOfMeasure}</span>
                </span>
              </div>

              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Min Stock Level:</span>
                <span className="font-medium">{product.minStock}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pricing & Value</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Selling Price</span>
                <span className="text-lg font-bold">LKR {product.sellingPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Cost Price</span>
                <span className="font-medium">LKR {product.costPrice.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center pt-2">
                <span className="text-muted-foreground">Total Stock Value</span>
                <span className="text-lg font-bold text-red-700">
                  LKR {(product.stock * product.sellingPrice).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Location Breakdown */}
        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-red-600" /> Location Breakdown
              </CardTitle>
              <CardDescription>
                Stock levels across Wireman locations and Main Warehouse.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Good Stock</TableHead>
                    <TableHead className="text-right text-red-600">Damaged</TableHead>
                    <TableHead className="text-right">Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.stocks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        No stock records found for this product.
                      </TableCell>
                    </TableRow>
                  ) : (
                    product.stocks.map((stock: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="font-medium">{stock.locationName}</div>
                          {stock.isMainWarehouse && (
                            <Badge variant="outline" className="text-xs mt-1 border-blue-200 text-blue-700 bg-blue-50">
                              Central Warehouse
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-700">
                          {stock.quantity}
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {stock.damaged > 0 ? stock.damaged : "-"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {stock.lastUpdated ? (
                            <div className="flex items-center justify-end gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(stock.lastUpdated), "MMM d, yyyy")}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}