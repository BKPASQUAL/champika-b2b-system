"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProductDialogs } from "../../products/_components/ProductDialogs";
import { ProductFormData } from "../../products/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  ShoppingCart,
  Calendar,
  Loader2,
  AlertCircle,
  X,
  PackageCheck,
  Archive,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SupplierDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // --- Filter State ---
  const [purchaseStart, setPurchaseStart] = useState("");
  const [purchaseEnd, setPurchaseEnd] = useState("");

  // --- Products State ---
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string; parent_id?: string }[]>([]);
  
  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
  const [productFormData, setProductFormData] = useState<ProductFormData>({
    sku: "",
    companyCode: "",
    name: "Orange ",
    category: "",
    subCategory: "",
    brand: "",
    subBrand: "",
    modelType: "",
    subModel: "",
    sizeSpec: "",
    supplier: "Orange (Orel Corporation)",
    stock: "",
    minStock: "",
    mrp: "",
    sellingPrice: "",
    costPrice: "",
    images: [],
    unitOfMeasure: "Pcs",
    isActive: true,
  });

  const rawId = params?.id;
  const supplierId = Array.isArray(rawId) ? rawId[0] : rawId;

  useEffect(() => {
    if (!supplierId) return;
    fetchSupplierDetails();
  }, [supplierId]);

  const fetchSupplierProducts = async (supplierName: string) => {
    try {
      setLoadingProducts(true);
      // Fetch products
      const res = await fetch("/api/products");
      if (res.ok) {
        const allProducts = await res.json();
        const filtered = allProducts.filter((p: any) => 
          p.supplier?.toLowerCase() === supplierName.toLowerCase() || 
          p.supplier?.toLowerCase().includes(supplierName.toLowerCase())
        );
        setSupplierProducts(filtered);
      }
      
      // Fetch categories
      const catRes = await fetch("/api/settings/categories?type=category");
      if (catRes.ok) {
        setCategories(await catRes.json());
      }
    } catch (err) {
      console.error("Failed to load products", err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchSupplierDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/suppliers/${supplierId}`);
      if (!res.ok) throw new Error("Failed to load supplier details");
      const jsonData = await res.json();
      setData(jsonData);

      if (jsonData.supplier?.name) {
         setProductFormData(prev => ({ ...prev, supplier: jsonData.supplier.name }));
         fetchSupplierProducts(jsonData.supplier.name);
      }
    } catch (error) {
      console.error(error);
      toast.error("Error loading supplier data");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!productFormData.name || !productFormData.category) {
      toast.error("Please fill required fields (Name, Category)");
      return;
    }

    const payload = {
      ...productFormData,
      stock: Number(productFormData.stock) || 0,
      minStock: Number(productFormData.minStock) || 0,
      mrp: Number(productFormData.mrp) || 0,
      sellingPrice: Number(productFormData.sellingPrice) || 0,
      costPrice: Number(productFormData.costPrice) || 0,
    };

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to create product");
      
      toast.success("Product created successfully!");
      setIsAddProductDialogOpen(false);
      
      // Reset form (keep supplier name)
      setProductFormData({
        sku: "",
        companyCode: "",
        name: "Orange ",
        category: "",
        subCategory: "",
        brand: "",
        subBrand: "",
        modelType: "",
        subModel: "",
        sizeSpec: "",
        supplier: data?.supplier?.name || "Orange (Orel Corporation)",
        stock: "",
        minStock: "",
        mrp: "",
        sellingPrice: "",
        costPrice: "",
        images: [],
        unitOfMeasure: "Pcs",
        isActive: true,
      });

      if (data?.supplier?.name) {
        fetchSupplierProducts(data.supplier.name);
      }
    } catch (error: any) {
      toast.error(error.message || "Operation failed");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || !data.supplier) {
    return <div className="p-8 text-center">Supplier not found.</div>;
  }

  const { supplier, stats, purchases, payments } = data;

  // --- Filter Logic ---
  const filteredPurchases = purchases.filter((po: any) => {
    if (!purchaseStart && !purchaseEnd) return true;
    const poDate = new Date(po.purchase_date);
    poDate.setHours(0, 0, 0, 0);

    const start = purchaseStart ? new Date(purchaseStart) : null;
    if (start) start.setHours(0, 0, 0, 0);

    const end = purchaseEnd ? new Date(purchaseEnd) : null;
    if (end) end.setHours(0, 0, 0, 0);

    if (start && poDate < start) return false;
    if (end && poDate > end) return false;
    return true;
  });

  const clearFilters = () => {
    setPurchaseStart("");
    setPurchaseEnd("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/office/orange/suppliers")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {supplier.name}
              <Badge
                variant={supplier.status === "Active" ? "default" : "secondary"}
                className={
                  supplier.status === "Active"
                    ? "bg-green-600 hover:bg-green-700"
                    : ""
                }
              >
                {supplier.status}
              </Badge>
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Building2 className="w-3 h-3" />
              Orange Agency Supplier
              <span className="text-gray-300">|</span>
              <span>{supplier.category || "General Supplier"}</span>
            </div>
          </div>
        </div>

        {/* ACTION BUTTON -> Points to Orange Route */}
        <Button
          variant="outline"
          className="text-red-600 border-red-200 hover:bg-red-50"
          onClick={() =>
            router.push(
              `/dashboard/office/orange/suppliers/${supplierId}/damage`
            )
          }
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          View Damage History
        </Button>
      </div>

      {/* Info & Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* 1. Contact Info */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="truncate">{supplier.contact_person || "-"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{supplier.phone || "-"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="truncate">{supplier.email || "-"}</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="truncate">{supplier.address || "-"}</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Total Payable */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Payable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Rs. {stats.totalPayable.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Outstanding Balance
            </p>
          </CardContent>
        </Card>

        {/* 3. Available Stock Value */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Available Stock Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2 text-green-600">
              <PackageCheck className="w-5 h-5" />
              Rs. {stats.availableStockValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Good Stock (at Cost)
            </p>
          </CardContent>
        </Card>

        {/* 4. Total Stock Value */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Stock Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2 text-blue-600">
              <Archive className="w-5 h-5" />
              Rs. {stats.totalStockValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Incl. Damaged ({stats.productCount} Items)
            </p>
          </CardContent>
        </Card>

        {/* 5. Total Purchased */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Purchased
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-muted-foreground" />
              Rs. {stats.totalPurchased.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.orderCount} Orders Lifetime
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="purchases" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
          <TabsTrigger value="purchases">Purchase History</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>

        {/* Purchases Tab */}
        <TabsContent value="purchases" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <CardTitle>Recent Purchases</CardTitle>

                {/* Date Filters */}
                <div className="flex flex-wrap items-end gap-2 bg-muted/20 p-2 rounded-md border">
                  <div className="grid gap-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      From
                    </Label>
                    <Input
                      type="date"
                      className="h-8 w-[130px] text-xs"
                      value={purchaseStart}
                      onChange={(e) => setPurchaseStart(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      To
                    </Label>
                    <Input
                      type="date"
                      className="h-8 w-[130px] text-xs"
                      value={purchaseEnd}
                      onChange={(e) => setPurchaseEnd(e.target.value)}
                    />
                  </div>
                  {(purchaseStart || purchaseEnd) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-8 px-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total (Rs)</TableHead>
                      <TableHead className="text-right">Paid (Rs)</TableHead>
                      <TableHead className="text-right">Balance (Rs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPurchases.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No purchases found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPurchases.map((po: any) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-medium">
                            {po.purchase_id}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(
                                new Date(po.purchase_date),
                                "MMM d, yyyy"
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                po.status === "Received"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-blue-50 text-blue-700"
                              }
                            >
                              {po.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {Number(po.total_amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {Number(po.paid_amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-medium">
                            {(
                              Number(po.total_amount) - Number(po.paid_amount)
                            ).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Ref / Cheque</TableHead>
                    <TableHead className="text-right">Amount (Rs)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No payments recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((pay: any) => (
                      <TableRow key={pay.id}>
                        <TableCell className="font-medium">
                          {pay.payment_number}
                        </TableCell>
                        <TableCell>
                          {format(new Date(pay.payment_date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="capitalize">
                          {pay.payment_method}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {pay.cheque_number
                            ? `Chq: ${pay.cheque_number}`
                            : pay.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {Number(pay.amount).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <CardTitle>Supplier Products</CardTitle>
                <Button
                  onClick={() => setIsAddProductDialogOpen(true)}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingProducts ? (
                <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Price (Rs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No products found for this supplier.
                        </TableCell>
                      </TableRow>
                    ) : (
                      supplierProducts.map((prod: any) => (
                        <TableRow key={prod.id}>
                          <TableCell className="font-medium">{prod.sku}</TableCell>
                          <TableCell>{prod.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{prod.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{prod.stock}</TableCell>
                          <TableCell className="text-right font-medium">{Number(prod.sellingPrice || prod.selling_price || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProductDialogs
        isAddDialogOpen={isAddProductDialogOpen}
        setIsAddDialogOpen={setIsAddProductDialogOpen}
        formData={productFormData}
        setFormData={setProductFormData}
        onSave={handleSaveProduct}
        selectedProduct={null}
        isDeleteDialogOpen={false}
        setIsDeleteDialogOpen={() => {}}
        onDeleteConfirm={() => {}}
        categories={categories}
      />
    </div>
  );
}
