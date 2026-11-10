export type Resolved = {
  mrp: number;
  price: number;
  discountPct: number;
  source: string;
  clampedToCost: boolean;
};

export type VariantMain = {
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  supplierName: string | null;
  subBrand?: string | null;
  subCategory?: string | null;
  productFamily?: string | null;
  unit?: string | null;
  mrp: number;
  costPrice: number;
  stock: number;
};

export type WebVariant = {
  id: string;
  options: Record<string, string>;
  label: string;
  productId: string;
  qtyMultiplier: number;
  mrp: number | null;
  webPrice: number | null;
  tradePrice: number | null;
  imageUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
  main: VariantMain;
  unitCost: number;
  normalPrice: Resolved;
  tradePriceResolved: Resolved;
};

export type WebProduct = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  specs: { label: string; value: string }[];
  webCategoryId: string | null;
  webCategoryName: string | null;
  extraCategoryIds: string[];
  tags: string[];
  brandText: string | null;
  webBrandId: string | null;
  webBrandName: string | null;
  webSubCategoryId: string | null;
  webSubCategoryName: string | null;
  webFamilyId: string | null;
  webFamilyName: string | null;
  webSubBrandId: string | null;
  webSubBrandName: string | null;
  webSupplierId: string | null;
  webSupplierName: string | null;
  images: string[];
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  orderType?: "normal" | "special" | "cut";
  leadTime?: string | null;
  options: { name: string; values: string[] }[];
  variants: WebVariant[];
  summary: {
    variantCount: number;
    availableCount: number;
    price: { min: number; max: number };
    tradePrice: { min: number; max: number };
    minMarginPct: number;
    belowCostWarning: boolean;
    zeroStockCount: number;
  };
};

export type WebCategory = { id: string; name: string; parentId: string | null };

export type WebBrand = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  logoUrl: string | null;
  description: string | null;
  sortOrder: number;
  isFeatured: boolean;
  isActive: boolean;
  productCount: number;
};

export const sourceLabel: Record<string, string> = {
  override: "manual",
  web_brand: "brand rule",
  web_category: "web cat. rule",
  category: "category rule",
  brand: "B2B brand rule",
  mrp: "MRP",
};

export type WebFamily = {
  id: string;
  name: string;
  slug: string;
  webCategoryId: string | null;
  webCategoryName: string | null;
  imageUrl?: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
};

export type WebSupplier = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  productCount: number;
};
