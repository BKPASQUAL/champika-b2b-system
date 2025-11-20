// app/dashboard/admin/invoices/types.ts

export type PaymentStatus = "Paid" | "Unpaid" | "Partial" | "Overdue";

export interface Invoice {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: PaymentStatus;
  itemsCount: number;
}

export type SortField = 
  | "date" 
  | "invoiceNo" 
  | "customerName" 
  | "totalAmount" 
  | "dueAmount" 
  | "status";

export type SortOrder = "asc" | "desc";