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
  | "customerName"
  | "totalAmount"
  | "status";
export type SortOrder = "asc" | "desc";
