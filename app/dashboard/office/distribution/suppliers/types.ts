// app/dashboard/office/distribution/suppliers/types.ts

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

  // Business Fields
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
  | "businessName";

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
  businessId?: string;
}
