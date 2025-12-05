// app/dashboard/admin/customers/types.ts

export type CustomerStatus = "Active" | "Inactive" | "Blocked";

export interface Customer {
  id: string;
  customerId: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  route: string;
  status: CustomerStatus;
  creditLimit: number;
  outstandingBalance: number;
  lastOrderDate: string;
  totalOrders: number;
  businessId?: string; // For editing
  businessName?: string; // For display in table
}

export type SortField =
  | "shopName"
  | "ownerName"
  | "route"
  | "status"
  | "outstandingBalance"
  | "lastOrderDate"
  | "businessName"; // Allow sorting by business

export type SortOrder = "asc" | "desc";

export interface CustomerFormData {
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  route: string;
  status: CustomerStatus;
  creditLimit: number;
  businessId: string;
}
