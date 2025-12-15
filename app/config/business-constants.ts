// app/config/business-constants.ts
/**
 * Business Constants
 * Centralized business identifiers for consistent reference across the application
 */

export const BUSINESS_IDS = {
  ORANGE_AGENCY: "50a514e1-ee70-4e6d-a698-1630d8ed04e2",
  CHAMPIKA_RETAIL: "a3ca43f3-06d4-4871-852c-3a40cfdbf023",
  CHAMPIKA_DISTRIBUTION: "e770d62c-d4bd-4bbc-ba9e-ccb07d7aa9bb",
} as const;

export const BUSINESS_NAMES = {
  [BUSINESS_IDS.ORANGE_AGENCY]: "Orange Agency",
  [BUSINESS_IDS.CHAMPIKA_RETAIL]: "Champika Hardware - Retail",
  [BUSINESS_IDS.CHAMPIKA_DISTRIBUTION]: "Champika Hardware - Distribution",
} as const;

export const BUSINESS_ROUTES = {
  [BUSINESS_IDS.ORANGE_AGENCY]: "/dashboard/office/orange",
  [BUSINESS_IDS.CHAMPIKA_RETAIL]: "/dashboard/office/retail",
  [BUSINESS_IDS.CHAMPIKA_DISTRIBUTION]: "/dashboard/office/distribution",
} as const;

export const BUSINESS_THEMES = {
  [BUSINESS_IDS.ORANGE_AGENCY]: {
    primary: "orange",
    bgClass: "bg-orange-100",
    textClass: "text-orange-600",
    borderClass: "border-orange-600",
  },
  [BUSINESS_IDS.CHAMPIKA_RETAIL]: {
    primary: "green",
    bgClass: "bg-green-100",
    textClass: "text-green-600",
    borderClass: "border-green-600",
  },
  [BUSINESS_IDS.CHAMPIKA_DISTRIBUTION]: {
    primary: "blue",
    bgClass: "bg-blue-100",
    textClass: "text-blue-600",
    borderClass: "border-blue-600",
  },
} as const;

/**
 * Get business route by business ID
 */
export function getBusinessRoute(businessId: string | null): string {
  if (!businessId) return "/dashboard/office";
  return (
    BUSINESS_ROUTES[businessId as keyof typeof BUSINESS_ROUTES] ||
    "/dashboard/office"
  );
}

/**
 * Check if business ID is valid
 */
export function isValidBusinessId(businessId: string | null): boolean {
  if (!businessId) return false;
  return Object.values(BUSINESS_IDS).includes(businessId as any);
}

/**
 * Get business name by ID
 */
export function getBusinessName(businessId: string | null): string {
  if (!businessId) return "Unknown Business";
  return (
    BUSINESS_NAMES[businessId as keyof typeof BUSINESS_NAMES] ||
    "Unknown Business"
  );
}
