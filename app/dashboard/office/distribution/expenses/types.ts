export type ExpenseCategory =
  | "Fuel"
  | "Maintenance"
  | "Services"
  | "Delivery"
  | "Lunch"
  | "Breakfast"
  | "Dinner"
  | "Guest"
  | "Foods"
  | "Other";

export interface Expense {
  id: string;
  expenseDate: string;
  businessName?: string; // For display
  businessId?: string;
  category: string;
  description?: string;
  loadRef?: string; // Display string for load (e.g. "LOAD-123")
  loadId?: string;
  referenceNo?: string;
  paymentMethod: string;
  amount: number;
  created_at?: string;
}

export interface ExpenseFormData {
  description: string;
  amount: string | number;
  category: ExpenseCategory;
  expenseDate: string;
  paymentMethod: string;
  referenceNo: string;
  loadId: string;
  businessId: string;
}
