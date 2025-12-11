export type PaymentStatus = "Paid" | "Unpaid" | "Partial" | "Overdue";

export type OrderStatus =
  | "Pending"
  | "Processing"
  | "Checking"
  | "Loading"
  | "In Transit"
  | "Delivered"
  | "Cancelled"
  | "Completed";

export interface Invoice {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string;
  customerName: string;
  salesRepName: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: PaymentStatus;
  orderStatus: OrderStatus;
  itemsCount: number;
}

export type SortField =
  | "date"
  | "invoiceNo"
  | "customerName"
  | "salesRepName"
  | "totalAmount"
  | "paidAmount"
  | "dueAmount"
  | "status"
  | "orderStatus";

export type SortOrder = "asc" | "desc";
