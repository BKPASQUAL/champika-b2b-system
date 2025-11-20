// app/dashboard/admin/purchases/types.ts

export type PurchaseStatus = "Ordered" | "Received" | "Cancelled";
export type PaymentStatus = "Paid" | "Unpaid" | "Partial";

export interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  mrp: number; // Added MRP
  unitCost: number;
  discount: number; // Added Discount %
  totalCost: number;
}

export interface Purchase {
  id: string;
  purchaseId: string; // PO Number
  supplierId: string;
  supplierName: string;
  invoiceNo?: string; // External Bill Number

  // Date Fields
  purchaseDate: string;
  billingDate?: string;
  arrivalDate?: string;

  status: PurchaseStatus;
  paymentStatus: PaymentStatus;

  totalAmount: number;
  paidAmount: number;
  items: PurchaseItem[];
}

export type SortField =
  | "purchaseDate"
  | "supplierName"
  | "totalAmount"
  | "status"
  | "paymentStatus";

export type SortOrder = "asc" | "desc";

export interface PurchaseFormData {
  supplierId: string;
  supplierName: string;
  invoiceNo: string;

  purchaseDate: string;
  billingDate: string;
  arrivalDate: string;

  status: PurchaseStatus;
  paymentStatus: PaymentStatus;

  items: PurchaseItem[];
  totalAmount: number;
}
