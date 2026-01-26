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
  businessId?: string | null; // Optional now as we know context
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
  businessId: string; // Required for Wireman creation
}
