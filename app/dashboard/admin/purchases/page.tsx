// app/dashboard/admin/purchases/page.tsx
"use client";

import React, { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle2, X } from "lucide-react";
import { PurchaseHeader } from "./_components/PurchaseHeader";
import { PurchaseStats } from "./_components/PurchaseStats";
import { PurchaseFilters } from "./_components/PurchaseFilters";
import { PurchaseTable } from "./_components/PurchaseTable";
import { PurchaseDialogs } from "./_components/PurchaseDialogs";
import { Purchase, PurchaseFormData, SortField, SortOrder } from "./types";

const mockPurchases: Purchase[] = [
  {
    id: "1",
    purchaseId: "PO-1001",
    supplierId: "S1",
    supplierName: "Lanka Builders Pvt Ltd",
    invoiceNo: "INV-2023-001",
    date: "2023-11-01",
    status: "Received",
    paymentStatus: "Paid",
    totalAmount: 450000,
    paidAmount: 450000, // Fully Paid
    items: [],
  },
  {
    id: "2",
    purchaseId: "PO-1002",
    supplierId: "S2",
    supplierName: "Colombo Cement Corp",
    invoiceNo: "CCC-882",
    date: "2023-11-05",
    status: "Ordered",
    paymentStatus: "Unpaid",
    totalAmount: 1200000,
    paidAmount: 0, // Unpaid
    items: [],
  },
  {
    id: "3",
    purchaseId: "PO-1003",
    supplierId: "S3",
    supplierName: "Tokyo Cement",
    invoiceNo: "-",
    date: "2023-11-10",
    status: "Ordered",
    paymentStatus: "Partial",
    totalAmount: 850000,
    paidAmount: 400000, // Partially Paid
    items: [],
  },
];

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>(mockPurchases);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog States
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(
    null
  );
  const [formData, setFormData] = useState<PurchaseFormData>({
    supplierName: "",
    invoiceNo: "",
    date: new Date().toISOString().split("T")[0],
    status: "Ordered",
    paymentStatus: "Unpaid",
    items: [],
    totalAmount: 0,
  });

  // Success Alert
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      p.purchaseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.invoiceNo &&
        p.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedPurchases = [...filteredPurchases].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    // Handle potentially undefined values for safety
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const handleSave = () => {
    if (!formData.supplierName) return alert("Supplier name is required");

    if (selectedPurchase) {
      // Update logic
      setPurchases(
        purchases.map((p) =>
          p.id === selectedPurchase.id ? { ...p, ...formData } : p
        )
      );
      setSuccessMessage("Purchase updated successfully");
    } else {
      // Create logic
      const newPurchase: Purchase = {
        id: Date.now().toString(),
        purchaseId: `PO-${1000 + purchases.length + 1}`,
        supplierId: "TEMP",
        paidAmount: 0,
        ...formData,
      };
      setPurchases([newPurchase, ...purchases]);
      setSuccessMessage("Purchase order created");
    }
    setIsAddDialogOpen(false);
    setShowSuccessAlert(true);
    setTimeout(() => setShowSuccessAlert(false), 3000);
  };

  const handleDelete = () => {
    if (selectedPurchase) {
      setPurchases(purchases.filter((p) => p.id !== selectedPurchase.id));
      setIsDeleteDialogOpen(false);
      setSuccessMessage("Purchase deleted");
      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {showSuccessAlert && (
        <div className="fixed top-4 right-4 z-50 w-96 animate-in slide-in-from-right">
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success!</AlertTitle>
            <AlertDescription className="text-green-700">
              {successMessage}
            </AlertDescription>
            <button
              onClick={() => setShowSuccessAlert(false)}
              className="absolute top-2 right-2 p-1 hover:bg-green-100 rounded"
            >
              <X className="h-4 w-4 text-green-600" />
            </button>
          </Alert>
        </div>
      )}

      <PurchaseHeader
        onAddClick={() => {
          setFormData({
            supplierName: "",
            invoiceNo: "",
            date: new Date().toISOString().split("T")[0],
            status: "Ordered",
            paymentStatus: "Unpaid",
            items: [],
            totalAmount: 0,
          });
          setSelectedPurchase(null);
          setIsAddDialogOpen(true);
        }}
        onExportExcel={() => {}}
        onExportPDF={() => {}}
      />

      <PurchaseStats purchases={purchases} />

      <Card>
        <CardHeader>
          <PurchaseFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        </CardHeader>
        <CardContent>
          <PurchaseTable
            purchases={sortedPurchases}
            loading={loading}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            onEdit={(p) => {
              setSelectedPurchase(p);
              setFormData({
                supplierName: p.supplierName,
                invoiceNo: p.invoiceNo || "",
                date: p.date,
                status: p.status,
                paymentStatus: p.paymentStatus,
                items: p.items,
                totalAmount: p.totalAmount,
              });
              setIsAddDialogOpen(true);
            }}
            onDelete={(p) => {
              setSelectedPurchase(p);
              setIsDeleteDialogOpen(true);
            }}
            currentPage={currentPage}
            totalPages={1}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      <PurchaseDialogs
        isAddDialogOpen={isAddDialogOpen}
        setIsAddDialogOpen={setIsAddDialogOpen}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSave}
        selectedPurchase={selectedPurchase}
        isDeleteDialogOpen={isDeleteDialogOpen}
        setIsDeleteDialogOpen={setIsDeleteDialogOpen}
        onDeleteConfirm={handleDelete}
      />
    </div>
  );
}
