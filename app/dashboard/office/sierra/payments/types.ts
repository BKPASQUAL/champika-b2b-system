// app/dashboard/office/sierra/payments/types.ts

export type PaymentMethod = "cash" | "cheque" | "bank" | "credit";
export type ChequeStatus = "Pending" | "Cleared" | "Bounced" | "Returned" | "Deposited";

export interface Payment {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  // Cheque fields
  chequeNo?: string;
  chequeDate?: string;
  chequeStatus?: ChequeStatus;
  // Bank details (for cheque)
  bankName?: string;
  bankCode?: string;
  // Deposit account (for cash/bank)
  depositAccountName?: string;
  depositAccountType?: string;
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
