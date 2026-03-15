"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Loader2,
  FileText,
  Send,
  Printer,
  Eye,
  ChevronRight,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function WiremanSupplierDamagePage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Data State
  const [supplier, setSupplier] = useState<any>(null);
  const [warehouseItems, setWarehouseItems] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState("to_return");

  // Selection for Warehouse Items
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Dialog States
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);
  const [isViewBatchDialogOpen, setIsViewBatchDialogOpen] = useState(false);

  // Business Loss State
  const [isLossDialogOpen, setIsLossDialogOpen] = useState(false);
  const [lossReason, setLossReason] = useState("");

  // Active Batch for Claim/View
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  // Financial State
  const [unpaidPurchases, setUnpaidPurchases] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [negotiatedAmount, setNegotiatedAmount] = useState<number>(0);
  const [approvalNote, setApprovalNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const rawId = params?.id;
  const supplierId = Array.isArray(rawId) ? rawId[0] : rawId;

  useEffect(() => {
    if (supplierId) fetchData();
  }, [supplierId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // ✅ Added businessId to ensure damage records are for Wireman
      const res = await fetch(
        `/api/suppliers/${supplierId}/damage?businessId=${BUSINESS_IDS.WIREMAN_AGENCY}`,
      );
      if (!res.ok) throw new Error("Failed to load data");
      const json = await res.json();
      setSupplier(json.supplier);
      setWarehouseItems(json.warehouseItems || []);
      setBatches(json.batches || []);
      setSelectedItemIds([]);
    } catch (error) {
      toast.error("Error loading damage data");
    } finally {
      setLoading(false);
    }
  };

  const fetchUnpaidPurchases = async () => {
    try {
      // ✅ Added businessId to ensure unpaid purchases are Wireman's
      const res = await fetch(
        `/api/suppliers/${supplierId}?businessId=${BUSINESS_IDS.WIREMAN_AGENCY}`,
      );
      if (res.ok) {
        const json = await res.json();
        setUnpaidPurchases(
          json.purchases.filter((p: any) => p.payment_status !== "Paid"),
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center h-96 items-center">
        <Loader2 className="animate-spin text-red-600" />
      </div>
    );
  if (!supplier) return <div className="p-8">Supplier not found.</div>;

  // Filter Logic
  const pendingBatches = batches.filter((b) => b.status === "Pending Credit");
  const historyBatches = batches.filter((b) => b.status === "Completed");

  // SEND ITEMS Handlers
  const handleSendStock = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/suppliers/return-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: selectedItemIds, supplierId }),
      });

      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      toast.success(`Items Sent! Batch #${data.batchNumber} created.`);
      setIsSendDialogOpen(false);
      fetchData();
      setActiveTab("pending_credit");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Mark as Loss Handler
  const handleMarkAsLoss = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/suppliers/mark-loss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: selectedItemIds, reason: lossReason }),
      });

      if (!res.ok) throw new Error("Failed to mark as loss");

      toast.success("Items marked as Business Loss");
      setIsLossDialogOpen(false);
      setLossReason("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // CLAIM Handlers
  const openClaimDialog = (batch: any) => {
    setSelectedBatch(batch);
    fetchUnpaidPurchases();
    setAllocations({});
    setNegotiatedAmount(Number(batch.total_value));
    setApprovalNote("");
    setIsClaimDialogOpen(true);
  };

  const submitClaim = async () => {
    const totalAllocated = Object.values(allocations).reduce(
      (a, b) => a + b,
      0,
    );
    const loss = Number(selectedBatch.total_value) - negotiatedAmount;

    if (totalAllocated === 0 && negotiatedAmount > 0)
      return toast.error("Please allocate the credit.");
    if (loss > 0 && !approvalNote)
      return toast.error("Approver note required for loss.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/suppliers/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          batchId: selectedBatch.id,
          negotiatedAmount,
          approvalNote,
          allocations: Object.entries(allocations).map(
            ([purchaseId, amount]) => ({ purchaseId, amount }),
          ),
        }),
      });

      if (!res.ok) throw new Error("Failed");

      toast.success("Claim processed!");
      setIsClaimDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAllocate = (purchaseId: string, dueAmount: number) => {
    const currentAllocated = Object.values(allocations).reduce(
      (a, b) => a + b,
      0,
    );
    const currentBillAlloc = allocations[purchaseId] || 0;
    const available = negotiatedAmount - (currentAllocated - currentBillAlloc);

    if (allocations[purchaseId]) {
      const newAlloc = { ...allocations };
      delete newAlloc[purchaseId];
      setAllocations(newAlloc);
      return;
    }
    if (available <= 0) return toast.error("No credit remaining");
    setAllocations({
      ...allocations,
      [purchaseId]: Math.min(available, dueAmount),
    });
  };

  // PDF Generation
  const generateReturnNote = (batch: any) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`RETURN NOTE: ${supplier.name}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Gate Pass #: ${batch.batch_number}`, 14, 30);
    doc.text(
      `Date: ${format(new Date(batch.created_at), "yyyy-MM-dd")}`,
      14,
      36,
    );

    const tableData = batch.items.map((item: any, i: number) => [
      i + 1,
      item.products?.name,
      item.products?.sku,
      item.quantity,
      item.reason || "-",
    ]);
    autoTable(doc, {
      startY: 45,
      head: [["#", "Product", "SKU", "Qty", "Reason"]],
      body: tableData,
    });
    doc.save(`Wireman_ReturnNote_${batch.batch_number}.pdf`);
  };

  // Render Helpers
  const renderItemTable = () => (
    <div className="border rounded-md mt-4">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[50px]">
              <Checkbox
                checked={
                  selectedItemIds.length === warehouseItems.length &&
                  warehouseItems.length > 0
                }
                onCheckedChange={(c) =>
                  setSelectedItemIds(c ? warehouseItems.map((i) => i.id) : [])
                }
              />
            </TableHead>
            <TableHead>Ref #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {warehouseItems.map((item: any) => {
            const val =
              (Number(item.quantity) || 0) *
              (Number(item.products?.cost_price) || 0);
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedItemIds.includes(item.id)}
                    onCheckedChange={(c) =>
                      c
                        ? setSelectedItemIds([...selectedItemIds, item.id])
                        : setSelectedItemIds(
                            selectedItemIds.filter((id) => id !== item.id),
                          )
                    }
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {item.return_number}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(item.created_at), "MMM d")}
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">
                    {item.products?.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.products?.sku}
                  </div>
                </TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">
                  Rs. {val.toLocaleString()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const renderBatchTable = (batchList: any[], isHistory = false) => (
    <div className="space-y-4 mt-4">
      {batchList.map((batch: any) => (
        <Card key={batch.id} className="overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-muted/20">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-lg">{batch.batch_number}</h4>
                <div className="text-xs text-muted-foreground flex gap-3">
                  <span>{format(new Date(batch.created_at), "PPP p")}</span>
                  <span>•</span>
                  <span>{batch.items?.length} Items</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">
                Rs. {Number(batch.total_value).toLocaleString()}
              </div>
              <Badge
                variant={isHistory ? "outline" : "default"}
                className={
                  isHistory ? "text-green-600 border-green-200" : "bg-blue-600"
                }
              >
                {batch.status}
              </Badge>
            </div>
          </div>
          <div className="bg-white p-3 border-t flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => generateReturnNote(batch)}
            >
              <Printer className="w-4 h-4 mr-2" /> Note
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedBatch(batch);
                setIsViewBatchDialogOpen(true);
              }}
            >
              <Eye className="w-4 h-4 mr-2" /> Items
            </Button>
            {!isHistory && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => openClaimDialog(batch)}
              >
                Process Credit <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </Card>
      ))}
      {batchList.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          No records found.
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {/* ✅ Navigation Back to Wireman Supplier Details */}
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-red-950">
            {supplier.name} - Returns
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage warehouse returns, gate passes, and credit claims for Wireman
            Agency.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="to_return">
            Warehouse ({warehouseItems.length})
          </TabsTrigger>
          <TabsTrigger value="pending_credit">
            Pending ({pendingBatches.length})
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="to_return">
          <div className="flex justify-between items-center my-4">
            <div className="text-sm text-muted-foreground">
              Select items to generate a Return Note/Gate Pass.
            </div>
            {selectedItemIds.length > 0 && (
              <div className="flex gap-2">
                {/* --- MARK AS LOSS BUTTON --- */}
                <Button
                  variant="destructive"
                  onClick={() => setIsLossDialogOpen(true)}
                >
                  <XCircle className="w-4 h-4 mr-2" /> Mark as Loss
                </Button>
                {/* --------------------------- */}
                <Button onClick={() => setIsSendDialogOpen(true)}>
                  <Send className="w-4 h-4 mr-2" /> Send Selected (
                  {selectedItemIds.length})
                </Button>
              </div>
            )}
          </div>
          {renderItemTable()}
        </TabsContent>

        <TabsContent value="pending_credit">
          {renderBatchTable(pendingBatches)}
        </TabsContent>

        <TabsContent value="history">
          {renderBatchTable(historyBatches, true)}
        </TabsContent>
      </Tabs>

      {/* DIALOGS (Send, Loss, View, Claim) */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Return Note</DialogTitle>
          </DialogHeader>
          <p>
            This will group {selectedItemIds.length} items into a Gate
            Pass/Return Note and deduct them from stock.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSendDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSendStock} disabled={submitting}>
              Confirm Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLossDialogOpen} onOpenChange={setIsLossDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">
              Confirm Business Loss
            </DialogTitle>
            <CardDescription>
              These items will NOT be returned to the supplier. They will be
              removed from stock as a company loss.
            </CardDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="font-medium">
              Selected Items: {selectedItemIds.length}
            </div>
            <div className="space-y-2">
              <Label>Reason for Loss (Optional)</Label>
              <Input
                placeholder="e.g., Expired, Damaged in Store, Theft"
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsLossDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleMarkAsLoss}
              disabled={submitting}
            >
              Confirm Loss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isViewBatchDialogOpen}
        onOpenChange={setIsViewBatchDialogOpen}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Return Note: {selectedBatch?.batch_number}
            </DialogTitle>
            <CardDescription>
              Total Value: Rs.{" "}
              {Number(selectedBatch?.total_value).toLocaleString()}
            </CardDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedBatch?.items?.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.products?.name}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {item.products?.sku}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right text-xs">
                    {item.reason}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <Dialog open={isClaimDialogOpen} onOpenChange={setIsClaimDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Process Credit for {selectedBatch?.batch_number}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-4 p-4 border rounded bg-slate-50">
            <div>
              <Label>Book Value</Label>
              <div className="text-xl font-bold">
                Rs. {Number(selectedBatch?.total_value).toLocaleString()}
              </div>
            </div>
            <div>
              <Label>Negotiated Value</Label>
              <Input
                type="number"
                value={negotiatedAmount}
                onChange={(e) => setNegotiatedAmount(Number(e.target.value))}
                className="font-bold border-green-400"
              />
            </div>
            <div>
              <Label>Loss</Label>
              <div
                className={`text-xl font-bold ${
                  Number(selectedBatch?.total_value) - negotiatedAmount > 0
                    ? "text-red-600"
                    : "text-gray-400"
                }`}
              >
                Rs.{" "}
                {(
                  Number(selectedBatch?.total_value) - negotiatedAmount
                ).toLocaleString()}
              </div>
            </div>
            <div className="col-span-3">
              <Label>Note</Label>
              <Input
                placeholder="Approval note..."
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 border rounded p-2 max-h-48 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unpaidPurchases.map((po) => {
                  const due = Number(po.total_amount) - Number(po.paid_amount);
                  return (
                    <TableRow key={po.id}>
                      <TableCell>{po.purchase_id}</TableCell>
                      <TableCell className="text-right">
                        Rs. {due.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Checkbox
                          checked={!!allocations[po.id]}
                          onCheckedChange={() => handleAllocate(po.id, due)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={submitClaim} disabled={submitting}>
              Process Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
