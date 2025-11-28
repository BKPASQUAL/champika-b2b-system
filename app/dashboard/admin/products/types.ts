// app/dashboard/admin/products/types.ts

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  subCategory?: string;
  brand?: string;
  subBrand?: string;
  modelType?: string;
  sizeSpec?: string;
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
  images: string[];
  unitOfMeasure: string; // <--- ADDED
}

export type SortField =
  | "name"
  | "category"
  | "brand"
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
  subCategory: string;
  brand: string;
  subBrand: string;
  modelType: string;
  sizeSpec: string;
  supplier: string;
  stock: number;
  minStock: number;
  mrp: number;
  sellingPrice: number;
  costPrice: number;
  images: string[];
  unitOfMeasure: string; // <--- ADDED
}
