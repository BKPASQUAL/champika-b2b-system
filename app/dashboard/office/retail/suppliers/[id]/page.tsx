"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft, Building2, Phone, Mail, MapPin, Calendar, Loader2,
  Package, CreditCard, FileText, Eye, ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

export default function RetailSupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const supplierId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  useEffect(() => {
    if (!supplierId) return;
    const load = async () => {
      try {
        const [supRes, purRes, payRes] = await Promise.all([
          fetch(`/api/suppliers/${supplierId}`),
          fetch(`/api/purchases?supplierId=${supplierId}`),
          fetch(`/api/suppliers/payments?supplierId=${supplierId}`),
        ]);

        if (supRes.ok) setSupplier(await supRes.json());
        else { toast.error("Supplier not found"); router.push("/dashboard/office/retail/suppliers"); return; }

        if (purRes.ok) setPurchases(await purRes.json());
        if (payRes.ok) setPayments(await payRes.json());
      } catch {
        toast.error("Failed to load supplier details");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [supplierId, router]);

  if (loading) return (
    <div className="flex justify-center items-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-green-600" />
    </div>
  );

  if (!supplier) return null;

  const totalPurchased = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
  const totalPaid = purchases.reduce((s, p) => s + (p.paidAmount || 0), 0);
  const totalDue = totalPurchased - totalPaid;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => router.push("/dashboard/office/retail/suppliers")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-green-900">{supplier.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">{supplier.supplierId}</p>
        </div>
        <Badge className={supplier.status === "Active" ? "bg-green-100 text-green-700 border-green-200 ml-auto" : "ml-auto"}>
          {supplier.status}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Purchased", value: `LKR ${totalPurchased.toLocaleString()}`, icon: ShoppingCart, color: "text-green-600" },
          { label: "Total Paid", value: `LKR ${totalPaid.toLocaleString()}`, icon: CreditCard, color: "text-blue-600" },
          { label: "Balance Due", value: `LKR ${totalDue.toLocaleString()}`, icon: FileText, color: totalDue > 0 ? "text-red-600" : "text-green-600" },
          { label: "Total Bills", value: purchases.length.toString(), icon: Package, color: "text-purple-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
              <p className={`text-lg font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Supplier Info */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Supplier Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-green-100 text-green-700 text-lg font-bold">
                  {supplier.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{supplier.name}</p>
                <p className="text-sm text-muted-foreground">{supplier.category}</p>
              </div>
            </div>
            {supplier.contactPerson && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span>{supplier.contactPerson}</span>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{supplier.phone}</span>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{supplier.email}</span>
              </div>
            )}
            {supplier.address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span>{supplier.address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs: Purchases & Payments */}
        <div className="md:col-span-2">
          <Tabs defaultValue="purchases">
            <TabsList className="mb-4">
              <TabsTrigger value="purchases">Purchases ({purchases.length})</TabsTrigger>
              <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="purchases">
              <Card>
                <CardContent className="pt-4 pb-0">
                  <div className="flex justify-end mb-3">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => router.push(`/dashboard/office/retail/purchases/create?supplierId=${supplierId}`)}
                    >
                      New Purchase
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-green-50/50">
                        <TableHead>Date</TableHead>
                        <TableHead>PO No.</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Due</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No purchases yet</TableCell>
                        </TableRow>
                      ) : (
                        purchases.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                {new Date(p.purchaseDate).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{p.purchaseId}</TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                p.paymentStatus === "Paid" ? "bg-green-100 text-green-700"
                                  : p.paymentStatus === "Unpaid" ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}>{p.paymentStatus}</span>
                            </TableCell>
                            <TableCell className="text-right font-medium">LKR {(p.totalAmount || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-semibold text-red-600">
                              {(p.totalAmount - p.paidAmount) > 0 ? `LKR ${(p.totalAmount - p.paidAmount).toLocaleString()}` : "—"}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push(`/dashboard/office/retail/purchases/${p.id}`)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments">
              <Card>
                <CardContent className="pt-4 pb-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-green-50/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Payment No.</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No payments yet</TableCell>
                        </TableRow>
                      ) : (
                        payments.map((pay) => (
                          <TableRow key={pay.id}>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                {new Date(pay.paymentDate).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{pay.paymentNumber}</TableCell>
                            <TableCell><Badge variant="outline">{pay.paymentMethod}</Badge></TableCell>
                            <TableCell className="text-right font-semibold text-green-700">LKR {(pay.amount || 0).toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
