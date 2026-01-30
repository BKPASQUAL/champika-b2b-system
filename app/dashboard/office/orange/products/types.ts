// app/dashboard/office/orange/products/types.ts

export interface Product {
  id: string;
  sku: string;
  companyCode?: string; // ✅ Added to match Wireman features
  name: string;
  category: string;
  subCategory?: string;
  brand?: string;
  subBrand?: string;
  modelType?: string;
  subModel?: string;
  sizeSpec?: string;
  supplier: string;
  stock: number;
  minStock: number;
  mrp: number;
  sellingPrice: number;
  costPrice: number;
  actualCostPrice?: number;
  discountPercent: number;
  totalValue: number;
  totalCost: number;
  profitMargin: number;
  images: string[];
  unitOfMeasure: string;
  commissionType?: string;
  commissionValue?: number;
  isActive: boolean;
  // ✅ Added Price History to fix the error
  priceHistory?: {
    date: string;
    costPrice: number;
    sellingPrice: number;
    mrp: number;
  }[];
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
  | "totalCost"
  | "commissionValue"
  | "isActive";

export type SortOrder = "asc" | "desc";

export interface ProductFormData {
  sku: string;
  companyCode: string; // ✅ Added
  name: string;
  category: string;
  subCategory: string;
  brand: string;
  subBrand: string;
  modelType: string;
  subModel: string;
  sizeSpec: string;
  supplier: string;
  stock: number | string;
  minStock: number | string;
  mrp: number | string;
  sellingPrice: number | string;
  costPrice: number | string;
  images: string[];
  unitOfMeasure: string;
  isActive: boolean;
}
