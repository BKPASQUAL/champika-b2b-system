export interface Expense {
  id: string;
  description?: string;
  amount: number;
  category: string;
  expenseDate: string;
  paymentMethod: string;
  referenceNo?: string;
  loadId?: string;
  loadRef?: string;
  businessId?: string; // ✅ NEW
  businessName?: string; // ✅ NEW
}

export type ExpenseCategory =
  | "Labor"
  | "Salaries"
  | "Bank Interest"
  | "Rent"
  | "Electricity & Utilities"
  | "Fuel"
  | "Maintenance"
  | "Services"
  | "Delivery"
  | "Food & Meals"
  | "Office & Admin"
  | "Lunch"
  | "Breakfast"
  | "Dinner"
  | "Guest"
  | "Foods"
  | "Other";

export interface ExpenseFormData {
  description?: string;
  amount: number | string;
  category: ExpenseCategory;
  expenseDate: string;
  paymentMethod: string;
  referenceNo: string;
  loadId?: string;
  businessId?: string; // ✅ NEW
}
