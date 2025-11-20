// app/dashboard/admin/orders/types.ts

export type OrderStatus =
  | "Pending"
  | "Processing"
  | "Checking"
  | "Loading"
  | "Delivered"
  | "Cancelled";

export type PaymentStatus = "Paid" | "Unpaid" | "Partial";

export interface Order {
  id: string;
  orderId: string; // e.g., ORD-2024-001
  customerName: string;
  shopName: string;
  date: string;
  totalAmount: number;
  itemCount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  salesRep: string;
}

export type SortField =
  | "date"
  | "orderId"
  | "customerName"
  | "totalAmount"
  | "status";

export type SortOrder = "asc" | "desc";
