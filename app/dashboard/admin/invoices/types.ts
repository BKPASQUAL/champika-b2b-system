// app/dashboard/admin/invoices/types.ts

export type PaymentStatus = "Paid" | "Unpaid" | "Partial" | "Overdue";

export interface Invoice {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string;
  customerName: string;
  salesRepName: string; // Field for Representative Name
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
  | "salesRepName" 
  | "totalAmount" 
  | "paidAmount" 
  | "dueAmount" 
  | "status";

export type SortOrder = "asc" | "desc";