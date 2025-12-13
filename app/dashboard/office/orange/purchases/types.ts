export type PurchaseStatus = "Ordered" | "Received" | "Cancelled";
export type PaymentStatus = "Paid" | "Unpaid" | "Partial";

export interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  mrp: number;
  unitCost: number;
  discount: number;
  totalCost: number;
}

export interface Purchase {
  id: string;
  purchaseId: string;
  supplierId: string;
  supplierName: string;
  invoiceNo?: string;
  businessId?: string | null;
  businessName?: string | null;
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
  | "purchaseId"
  | "totalAmount"
  | "status"
  | "paymentStatus";

export type SortOrder = "asc" | "desc";
