// app/dashboard/office/distribution/products/types.ts

export interface Product {
  id: string;
  sku: string;
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
  discountPercent: number;
  totalValue: number;
  totalCost: number;
  profitMargin: number;
  images: string[];
  unitOfMeasure: string;
  commissionType?: string;
  commissionValue?: number;
  isActive: boolean;
  companyCode?: string; // Added companyCode
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
  | "isActive"
  | "companyCode"; // Added to sort fields

export type SortOrder = "asc" | "desc";

export interface ProductFormData {
  sku: string;
  name: string;
  companyCode: string; // Added companyCode
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
