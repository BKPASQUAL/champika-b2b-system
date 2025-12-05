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
  subModel?: string; // <--- ADD THIS
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
  unitOfMeasure: string;
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
  subModel: string; // <--- ADD THIS
  sizeSpec: string;
  supplier: string;
  // Updated to allow string (for empty state)
  stock: number | string;
  minStock: number | string;
  mrp: number | string;
  sellingPrice: number | string;
  costPrice: number | string;
  images: string[];
  unitOfMeasure: string;
}
