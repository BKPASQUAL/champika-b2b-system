export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  expenseDate: string;
  paymentMethod: string;
  referenceNo?: string;
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
  description: string;
  amount: number | string;
  category: ExpenseCategory;
  expenseDate: string;
  paymentMethod: string;
  referenceNo: string;
}
