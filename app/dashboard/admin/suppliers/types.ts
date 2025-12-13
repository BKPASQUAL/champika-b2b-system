// app/dashboard/admin/suppliers/types.ts

export type SupplierStatus = "Active" | "Inactive" | "Pending";

export interface Supplier {
  id: string;
  supplierId: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  status: SupplierStatus;

  // ✅ Added Business Fields
  businessId?: string | null;
  businessName?: string | null;

  lastOrderDate: string;
  totalOrders: number;
  totalOrderValue: number;
  duePayment: number;
}

export type SortField =
  | "name"
  | "contactPerson"
  | "category"
  | "status"
  | "lastOrderDate"
  | "totalOrderValue"
  | "duePayment"
  | "businessName"; // Added for sorting

export type SortOrder = "asc" | "desc";

export interface SupplierFormData {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  status: SupplierStatus;
  duePayment: number;

  // ✅ Added Business ID for Form
  businessId?: string;
}
