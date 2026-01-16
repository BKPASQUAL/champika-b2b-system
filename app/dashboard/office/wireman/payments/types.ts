// app/dashboard/office/wireman/payments/types.ts

export type PaymentMethod = "Cash" | "Cheque" | "Bank Transfer" | "Online";
export type ChequeStatus = "Pending" | "Cleared" | "Bounced" | "Returned";

export interface Payment {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  chequeNo?: string;
  chequeDate?: string;
  chequeStatus?: ChequeStatus;
  collectedBy: string;
  notes?: string;
}

export type SortField =
  | "date"
  | "amount"
  | "customerName"
  | "method"
  | "chequeStatus";

export type SortOrder = "asc" | "desc";