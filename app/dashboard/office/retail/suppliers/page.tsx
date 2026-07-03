"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BUSINESS_IDS, BUSINESS_NAMES, BUSINESS_THEMES } from "@/app/config/business-constants";
import { SupplierStats } from "@/app/dashboard/admin/suppliers/_components/SupplierStats";
import { SupplierHeader } from "@/app/dashboard/admin/suppliers/_components/SupplierHeader";
import { SupplierFilters } from "@/app/dashboard/admin/suppliers/_components/SupplierFilters";
import { SupplierDialogs } from "@/app/dashboard/admin/suppliers/_components/SupplierDialogs";
import { Supplier, SortField, SortOrder, SupplierFormData } from "@/app/dashboard/admin/suppliers/types";
import { SupplierTable } from "./_components/SupplierTable";

export default function RetailSuppliersPage() {
  const CURRENT_BUSINESS_ID = BUSINESS_IDS.CHAMPIKA_RETAIL;
  const businessName = BUSINESS_NAMES[CURRENT_BUSINESS_ID];
  const theme = BUSINESS_THEMES[CURRENT_BUSINESS_ID];

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState<SupplierFormData>({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    category: "",
    status: "Active",
    duePayment: 0,
    businessId: CURRENT_BUSINESS_ID,
  });

  const { data: rawSuppliers = [], loading, refetch: fetchSuppliers } =
    useCachedFetch<Supplier[]>(`/api/suppliers?businessId=${CURRENT_BUSINESS_ID}`, [], () =>
      toast.error("Error loading suppliers")
    );

  const { data: categoryOptions = [] } = useCachedFetch<{ id: string; name: string }[]>(
    "/api/settings/categories?type=supplier", []
  );

  const suppliers = useMemo(
    () => rawSuppliers.filter((s: any) => s.businessId === CURRENT_BUSINESS_ID),
    [rawSuppliers]
  );

  const availableCategories = ["all", ...new Set(suppliers.map((s) => s.category || "Uncategorized"))];

  const filteredSuppliers = suppliers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === "all" || s.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];
    if (typeof aVal === "string") { aVal = aVal.toLowerCase(); bVal = bVal.toLowerCase(); }
    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedSuppliers.length / itemsPerPage);
  const paginatedSuppliers = sortedSuppliers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => setCurrentPage(1), [searchQuery, categoryFilter, statusFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortOrder("asc"); }
  };

  const handleSaveSupplier = async () => {
    if (!formData.name) { toast.error("Please enter a company name"); return; }
    try {
      if (selectedSupplier) {
        const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Failed to update supplier");
        toast.success("Supplier updated successfully!");
      } else {
        const res = await fetch("/api/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, businessId: CURRENT_BUSINESS_ID }),
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
      const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, { method: "DELETE" });
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
    setFormData({ name: "", contactPerson: "", email: "", phone: "", address: "", category: "", status: "Active", duePayment: 0, businessId: CURRENT_BUSINESS_ID });
    setSelectedSupplier(null);
  };

  const generateExcel = () => {
    if (sortedSuppliers.length === 0) { toast.error("No data to export"); return; }
    const ws = XLSX.utils.json_to_sheet(sortedSuppliers.map((s) => ({
      ID: s.supplierId, Name: s.name, Category: s.category, Contact: s.contactPerson, Phone: s.phone, Status: s.status, "Due Payment": s.duePayment,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
    XLSX.writeFile(wb, `${businessName}_Suppliers.xlsx`);
  };

  const generatePDF = () => {
    if (sortedSuppliers.length === 0) { toast.error("No data to export"); return; }
    const doc = new jsPDF();
    doc.text(`${businessName} - Suppliers`, 14, 15);
    autoTable(doc, {
      head: [["ID", "Name", "Contact", "Phone", "Status", "Due"]],
      body: sortedSuppliers.map((s) => [s.supplierId, s.name, s.contactPerson, s.phone, s.status, s.duePayment.toLocaleString()]),
      startY: 20,
    });
    doc.save(`${businessName}_Suppliers.pdf`);
  };

  return (
    <div className="space-y-6">
      <Card className={`border-l-4 ${theme.borderClass}`}>
        <CardHeader className="pb-2">
          <CardTitle className={`text-lg font-bold flex items-center gap-2 ${theme.textClass}`}>
            <Building2 className="w-5 h-5" /> {businessName}
          </CardTitle>
          <CardDescription>Managing suppliers for Champika Hardware retail operations.</CardDescription>
        </CardHeader>
      </Card>

      <SupplierHeader
        onAddClick={() => { resetForm(); setIsAddDialogOpen(true); }}
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
              setFormData({ name: s.name, contactPerson: s.contactPerson, email: s.email, phone: s.phone, address: s.address, category: s.category, status: s.status, duePayment: s.duePayment, businessId: CURRENT_BUSINESS_ID });
              setSelectedSupplier(s);
              setIsAddDialogOpen(true);
            }}
            onDelete={(s) => { setSelectedSupplier(s); setIsDeleteDialogOpen(true); }}
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
        businessOptions={[]}
        isDeleteDialogOpen={isDeleteDialogOpen}
        setIsDeleteDialogOpen={setIsDeleteDialogOpen}
        onDeleteConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
