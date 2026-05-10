// app/dashboard/admin/orders/types.ts

export type OrderStatus =
  | "Pending"
  | "Approved"
  | "Processing"
  | "Checking"
  | "Loading"
  | "In Transit"
  | "Delivered"
  | "Cancelled"
  | "Completed";

export type PaymentStatus = "Paid" | "Unpaid" | "Partial";

export interface Order {
  id: string;
  orderId: string;
  invoiceNo?: string;
  invoiceId?: string;
  customerName: string;
  shopName: string;
  date: string;
  totalAmount: number;
  itemCount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  salesRep: string;
  lockedBy?: string | null;
  lockedAt?: string | null;
}

export type SortField =
  | "date"
  | "orderId"
  | "invoiceNo" // Added sort field
  | "customerName"
  | "totalAmount"
  | "status";

export type SortOrder = "asc" | "desc";
