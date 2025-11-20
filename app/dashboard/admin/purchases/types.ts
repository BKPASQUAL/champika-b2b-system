// app/dashboard/admin/purchases/types.ts

export type PurchaseStatus = "Ordered" | "Received" | "Cancelled";
export type PaymentStatus = "Paid" | "Unpaid" | "Partial";

export interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface Purchase {
  id: string;
  purchaseId: string; // PO Number
  supplierId: string;
  supplierName: string;
  invoiceNo?: string; // External Bill Number
  date: string;
  status: PurchaseStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  paidAmount: number;
  items: PurchaseItem[]; // Bill details
}

export type SortField =
  | "date"
  | "supplierName"
  | "totalAmount"
  | "status"
  | "paymentStatus";

export type SortOrder = "asc" | "desc";

export interface PurchaseFormData {
  supplierName: string;
  invoiceNo: string;
  date: string;
  status: PurchaseStatus;
  paymentStatus: PaymentStatus;
  items: PurchaseItem[];
  totalAmount: number; // Calculated from items
}