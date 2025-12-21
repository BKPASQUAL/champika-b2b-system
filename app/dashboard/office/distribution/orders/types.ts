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
  invoiceNo?: string; // Added to fix 'Property invoiceNo does not exist'
  date: string;
  customerName: string;
  shopName: string;
  salesRep: string;
  itemCount: number;
  totalAmount: number;
  status: OrderStatus;
}

export type SortField =
  | "date"
  | "orderId"
  | "invoiceNo" // Added to fix 'Argument of type "invoiceNo" is not assignable'
  | "customerName"
  | "totalAmount"
  | "status";

export type SortOrder = "asc" | "desc";