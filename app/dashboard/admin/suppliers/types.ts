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
  | "duePayment";

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
}