// app/dashboard/office/wireman/invoices/types.ts

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
  // ✅ ENSURE THIS EXACT FIELD IS HERE
  manualInvoiceNo?: string | null;
  date: string;
  customerId: string;
  customerName: string;
  salesRepName: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: PaymentStatus;
  orderStatus: OrderStatus;
  itemsCount?: number;
  businessId?: string;
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
