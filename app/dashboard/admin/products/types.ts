// app/dashboard/admin/products/types.ts

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  supplier: string;
  stock: number;
  minStock: number;
  mrp: number;
  sellingPrice: number;
  costPrice: number;
  discountPercent: number;
  totalValue: number;
  totalCost: number;
  profitMargin: number;
}

export type SortField =
  | "name"
  | "category"
  | "supplier"
  | "stock"
  | "costPrice"
  | "sellingPrice"
  | "mrp"
  | "totalCost";

export type SortOrder = "asc" | "desc";

export interface ProductFormData {
  name: string;
  category: string;
  supplier: string;
  stock: number;
  minStock: number;
  mrp: number;
  sellingPrice: number;
  costPrice: number;
}