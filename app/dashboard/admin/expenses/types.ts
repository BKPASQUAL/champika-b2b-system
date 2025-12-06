export interface Expense {
  id: string;
  description?: string; // Made optional
  amount: number;
  category: string;
  expenseDate: string;
  paymentMethod: string;
  referenceNo?: string;
  loadId?: string;
  loadRef?: string;
}

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

export interface ExpenseFormData {
  description?: string; // Made optional
  amount: number | string;
  category: ExpenseCategory;
  expenseDate: string;
  paymentMethod: string;
  referenceNo: string;
  loadId?: string;
}
