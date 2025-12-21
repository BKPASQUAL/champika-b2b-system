"use client";

import React, { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

// Constants
import { BUSINESS_IDS } from "@/app/config/business-constants";

// UI Components
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { Supplier, SortField, SortOrder, SupplierFormData } from "./types";
import { SupplierHeader } from "./_components/SupplierHeader";
import { SupplierStats } from "./_components/SupplierStats";
import { SupplierFilters } from "./_components/SupplierFilters";
import { SupplierTable } from "./_components/SupplierTable";
import { SupplierDialogs } from "./_components/SupplierDialogs";


export default function DistributionSuppliersPage() {
  // Constants
  const CURRENT_BUSINESS_ID = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<
    { id: string; name: string }[]
  >([]);
  // We don't need to fetch business options since this page is specific to one business
  const [loading, setLoading] = useState(true);

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
    businessId: CURRENT_BUSINESS_ID, // ✅ Auto-set Business ID
  });

  // --- 1. Fetch Suppliers ---
  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/suppliers");
      if (!response.ok) throw new Error("Failed to fetch suppliers");
      const data = await response.json();

      // ✅ Filter for Distribution Business Only
      const distributionSuppliers = data.filter(
        (s: Supplier) => s.businessId === CURRENT_BUSINESS_ID
      );

      setSuppliers(distributionSuppliers);
    } catch (error) {
      toast.error("Error loading suppliers");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [CURRENT_BUSINESS_ID]);

  // --- 2. Fetch Categories ---
  const fetchData = useCallback(async () => {
    try {
      const catRes = await fetch("/api/settings/categories?type=supplier");
      if (catRes.ok) setCategoryOptions(await catRes.json());
    } catch (error) {
      console.error("Failed to fetch settings data", error);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
    fetchData();
  }, [fetchSuppliers, fetchData]);

  // --- Logic ---
  const availableCategories = [
    "all",
    ...new Set(suppliers.map((s) => s.category || "Uncategorized")),
  ];

  const filteredSuppliers = suppliers.filter((supplier) => {
    const matchesSearch =
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.contactPerson
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (supplier.email &&
        supplier.email.toLowerCase().includes(searchQuery.toLowerCase()));
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

  const handleSaveSupplier = async () => {
    if (!formData.name || !formData.contactPerson || !formData.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Ensure business ID is set before saving
    const payload = { ...formData, businessId: CURRENT_BUSINESS_ID };

    try {
      if (selectedSupplier) {
        // UPDATE
        const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update supplier");
        toast.success("Supplier updated successfully!");
      } else {
        // CREATE
        const res = await fetch("/api/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create supplier");
        toast.success("Supplier created successfully!");
      }

      setIsAddDialogOpen(false);
      resetForm();
      fetchSuppliers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSupplier) return;
    try {
      const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete supplier");

      toast.success("Supplier deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedSupplier(null);
      fetchSuppliers();
    } catch (error: any) {
      toast.error(error.message);
    }
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
      businessId: CURRENT_BUSINESS_ID, // Ensure reset keeps the business ID
    });
    setSelectedSupplier(null);
  };

  // --- Reports ---
  const generateExcel = () => {
    if (sortedSuppliers.length === 0) {
      toast.error("No data to export");
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
      `Distribution_Suppliers_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const generatePDF = () => {
    if (sortedSuppliers.length === 0) {
      toast.error("No data to export");
      return;
    }
    const doc = new jsPDF();
    doc.text("Champika Hardware - Distribution Suppliers", 14, 15);
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
    doc.save(
      `Distribution_Suppliers_${new Date().toISOString().split("T")[0]}.pdf`
    );
  };

  return (
    <div className="space-y-6">
      <SupplierHeader
        onAddClick={() => {
          resetForm();
          setIsAddDialogOpen(true);
        }}
        onExportExcel={generateExcel}
        onExportPDF={generatePDF}
      />

      <SupplierStats suppliers={suppliers} />

      <Card>
        <CardHeader>
          <SupplierFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            categories={availableCategories}
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
              setFormData({
                name: s.name,
                contactPerson: s.contactPerson,
                email: s.email,
                phone: s.phone,
                address: s.address,
                category: s.category,
                status: s.status,
                duePayment: s.duePayment,
                businessId: CURRENT_BUSINESS_ID,
              });
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
        categoryOptions={categoryOptions}
        // Pass empty business options to hide selector or handle inside dialog if needed
        businessOptions={[]}
        isDeleteDialogOpen={isDeleteDialogOpen}
        setIsDeleteDialogOpen={setIsDeleteDialogOpen}
        onDeleteConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
