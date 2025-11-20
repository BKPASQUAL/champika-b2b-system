"use client";

import React, { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// UI Components
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import {
  Supplier,
  SortField,
  SortOrder,
  SupplierStatus,
  SupplierFormData,
} from "./types";
import { SupplierStats } from "./_components/SupplierStats";
import { SupplierHeader } from "./_components/SupplierHeader";
import { SupplierFilters } from "./_components/SupplierFilters";
import { SupplierTable } from "./_components/SupplierTable";
import { SupplierDialogs } from "./_components/SupplierDialogs";

// Mock Data
const initialMockSuppliers: Supplier[] = [
  {
    id: "SUP-001",
    supplierId: "S-1001",
    name: "Lanka Builders Pvt Ltd",
    contactPerson: "Kamal Perera",
    email: "kamal@lankabuilders.lk",
    phone: "077 123 4567",
    address: "No. 45, High Level Rd, Nugegoda",
    category: "Construction",
    status: "Active",
    lastOrderDate: "2023-10-25",
    totalOrders: 12,
    totalOrderValue: 1540000,
    duePayment: 250000,
  },
  {
    id: "SUP-002",
    supplierId: "S-1002",
    name: "Colombo Cement Corp",
    contactPerson: "Nimal Silva",
    email: "sales@colombocement.com",
    phone: "011 234 5678",
    address: "Industrial Zone, Peliyagoda",
    category: "Construction",
    status: "Active",
    lastOrderDate: "2023-10-20",
    totalOrders: 45,
    totalOrderValue: 8900000,
    duePayment: 1200000,
  },
  {
    id: "SUP-003",
    supplierId: "S-1003",
    name: "Ruhuna Hardware Suppliers",
    contactPerson: "Sunil Das",
    email: "info@ruhunahw.lk",
    phone: "071 987 6543",
    address: "Matara Road, Galle",
    category: "Hardware",
    status: "Inactive",
    lastOrderDate: "2023-09-15",
    totalOrders: 5,
    totalOrderValue: 320000,
    duePayment: 0,
  },
  {
    id: "SUP-004",
    supplierId: "S-1004",
    name: "Global Paints & Coatings",
    contactPerson: "Sarah Jones",
    email: "s.jones@globalpaints.lk",
    phone: "076 555 4444",
    address: "Union Place, Colombo 02",
    category: "Paints",
    status: "Pending",
    lastOrderDate: "-",
    totalOrders: 0,
    totalOrderValue: 0,
    duePayment: 0,
  },
  {
    id: "SUP-005",
    supplierId: "S-1005",
    name: "S-Lon Lanka",
    contactPerson: "Mahesh Kumara",
    email: "orders@slon.lk",
    phone: "011 456 7890",
    address: "Rathemalana Industrial Estate",
    category: "Plumbing",
    status: "Active",
    lastOrderDate: "2023-10-28",
    totalOrders: 28,
    totalOrderValue: 2150000,
    duePayment: 450000,
  },
  {
    id: "SUP-006",
    supplierId: "S-1006",
    name: "Orange Electric",
    contactPerson: "Duminda Rajapakshe",
    email: "duminda@orange.lk",
    phone: "077 788 9900",
    address: "Maharagama",
    category: "Electrical",
    status: "Active",
    lastOrderDate: "2023-10-22",
    totalOrders: 34,
    totalOrderValue: 3400000,
    duePayment: 820000,
  },
  {
    id: "SUP-007",
    supplierId: "S-1007",
    name: "Kelani Cables PLC",
    contactPerson: "Anura Bandara",
    email: "anura@kelanicables.com",
    phone: "011 290 4567",
    address: "Kelaniya",
    category: "Electrical",
    status: "Active",
    lastOrderDate: "2023-10-18",
    totalOrders: 18,
    totalOrderValue: 1200000,
    duePayment: 150000,
  },
  {
    id: "SUP-008",
    supplierId: "S-1008",
    name: "Tokyo Cement",
    contactPerson: "Sales Desk",
    email: "orders@tokyocement.lk",
    phone: "011 250 6789",
    address: "Colombo 03",
    category: "Construction",
    status: "Active",
    lastOrderDate: "2023-10-27",
    totalOrders: 60,
    totalOrderValue: 12500000,
    duePayment: 2100000,
  },
];

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialMockSuppliers);
  const [loading, setLoading] = useState(false);

  // Filters & Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // Dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null
  );

  // Form Data
  const [formData, setFormData] = useState<SupplierFormData>({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    category: "",
    status: "Active",
    duePayment: 0,
  });

  // Alerts
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // --- Logic ---
  const categories = ["all", ...new Set(suppliers.map((s) => s.category))];

  const filteredSuppliers = suppliers.filter((supplier) => {
    const matchesSearch =
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.contactPerson
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      supplier.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || supplier.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" || supplier.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];
    if (typeof aValue === "string") {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedSuppliers.length / itemsPerPage);
  const paginatedSuppliers = sortedSuppliers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(
    () => setCurrentPage(1),
    [searchQuery, categoryFilter, statusFilter]
  );

  // --- Actions ---
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleSaveSupplier = () => {
    if (!formData.name || !formData.contactPerson) {
      alert("Required fields missing");
      return;
    }

    if (selectedSupplier) {
      setSuppliers(
        suppliers.map((s) =>
          s.id === selectedSupplier.id ? { ...s, ...formData } : s
        )
      );
      setSuccessMessage("Supplier updated!");
    } else {
      setSuppliers([
        ...suppliers,
        {
          id: `SUP-${Date.now()}`,
          supplierId: `S-${suppliers.length + 1000}`,
          ...formData,
          lastOrderDate: "-",
          totalOrders: 0,
          totalOrderValue: 0,
        },
      ]);
      setSuccessMessage("Supplier added!");
    }
    setShowSuccessAlert(true);
    setIsAddDialogOpen(false);
    resetForm();
    setTimeout(() => setShowSuccessAlert(false), 3000);
  };

  const handleDeleteConfirm = () => {
    if (!selectedSupplier) return;
    setSuppliers(suppliers.filter((s) => s.id !== selectedSupplier.id));
    setSuccessMessage("Supplier deleted!");
    setShowSuccessAlert(true);
    setIsDeleteDialogOpen(false);
    setSelectedSupplier(null);
    setTimeout(() => setShowSuccessAlert(false), 3000);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      category: "",
      status: "Active",
      duePayment: 0,
    });
    setSelectedSupplier(null);
  };

  // --- Reports ---
  const generateExcel = () => {
    if (sortedSuppliers.length === 0) {
      alert("No data to export");
      return;
    }
    const excelData = sortedSuppliers.map((s) => ({
      ID: s.supplierId,
      Name: s.name,
      Category: s.category,
      Contact: s.contactPerson,
      Phone: s.phone,
      Status: s.status,
      "Due Payment": s.duePayment,
    }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
    XLSX.writeFile(
      wb,
      `Suppliers_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const generatePDF = () => {
    if (sortedSuppliers.length === 0) {
      alert("No data to export");
      return;
    }
    const doc = new jsPDF();
    doc.text("Suppliers Report", 14, 15);
    autoTable(doc, {
      head: [["ID", "Name", "Contact", "Phone", "Status", "Due"]],
      body: sortedSuppliers.map((s) => [
        s.supplierId,
        s.name,
        s.contactPerson,
        s.phone,
        s.status,
        s.duePayment.toLocaleString(),
      ]),
      startY: 20,
    });
    doc.save(`Suppliers_${new Date().toISOString().split("T")[0]}.pdf`);
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

      {/* Header Section */}
      <SupplierHeader
        onAddClick={() => {
          resetForm();
          setIsAddDialogOpen(true);
        }}
        onExportExcel={generateExcel}
        onExportPDF={generatePDF}
      />

      {/* Stats Section */}
      <SupplierStats suppliers={suppliers} />

      {/* Combined Card for Filters & Table */}
      <Card>
        <CardHeader>
          <SupplierFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            categories={categories}
          />
        </CardHeader>
        <CardContent>
          <SupplierTable
            suppliers={paginatedSuppliers}
            loading={loading}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            onEdit={(s) => {
              setFormData(s);
              setSelectedSupplier(s);
              setIsAddDialogOpen(true);
            }}
            onDelete={(s) => {
              setSelectedSupplier(s);
              setIsDeleteDialogOpen(true);
            }}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      <SupplierDialogs
        isAddDialogOpen={isAddDialogOpen}
        setIsAddDialogOpen={setIsAddDialogOpen}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSaveSupplier}
        selectedSupplier={selectedSupplier}
        isDeleteDialogOpen={isDeleteDialogOpen}
        setIsDeleteDialogOpen={setIsDeleteDialogOpen}
        onDeleteConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
