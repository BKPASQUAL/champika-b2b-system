// app/dashboard/office/distribution/orders/types.ts

export type OrderStatus =
  | "Pending"
  | "Processing"
  | "Checking"
  | "Loading"
  | "In Transit"
  | "Delivered"
  | "Completed"
  | "Cancelled";

export interface Order {
  id: string;
  orderId: string;
  invoiceNo?: string;
  invoiceId?: string;
  date: string;
  customerName: string;
  shopName: string;
  salesRep: string;
  route: string;
  itemCount: number;
  totalAmount: number;
  status: OrderStatus;
  lockedBy?: string | null;
  lockedAt?: string | null;
}

export type SortField =
  | "date"
  | "orderId"
  | "invoiceNo" // Added to fix 'Argument of type "invoiceNo" is not assignable'
  | "customerName"
  | "totalAmount"
  | "status";

export type SortOrder = "asc" | "desc";