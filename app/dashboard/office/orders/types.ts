export type OrderStatus =
  | "Pending"
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
