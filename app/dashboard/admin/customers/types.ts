// app/dashboard/admin/customers/types.ts

export type CustomerStatus = "Active" | "Inactive" | "Blocked";

export interface Customer {
  id: string;
  customerId: string; // e.g., CUS-1001
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  route: string; // e.g., "Galle Road", "Matara Town"
  status: CustomerStatus;
  creditLimit: number;
  outstandingBalance: number;
  lastOrderDate: string;
  totalOrders: number;
}

export type SortField =
  | "shopName"
  | "ownerName"
  | "route"
  | "status"
  | "outstandingBalance"
  | "lastOrderDate";

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
}
