/**
 * Business Constants
 * Centralized business identifiers for consistent reference across the application
 */

export const BUSINESS_IDS = {
  ORANGE_AGENCY: "50a514e1-ee70-4e6d-a698-1630d8ed04e2",
  CHAMPIKA_RETAIL: "a3ca43f3-06d4-4871-852c-3a40cfdbf023",
  CHAMPIKA_DISTRIBUTION: "e770d62c-d4bd-4bbc-ba9e-ccb07d7aa9bb",
  WIREMAN_AGENCY: "094b649e-be59-4e2b-b709-7e36ad1ef280",
  SIERRA_AGENCY: "41b55e39-2edb-43ac-9877-dabd23902335",
  WEBSITE: "e7825b22-fa7a-4a82-bbe9-f0ad89386e2f", // BK Wiring online shop
} as const;

export const BUSINESS_NAMES = {
  [BUSINESS_IDS.ORANGE_AGENCY]: "Orange Agency",
  [BUSINESS_IDS.CHAMPIKA_RETAIL]: "Champika Hardware - Retail",
  [BUSINESS_IDS.CHAMPIKA_DISTRIBUTION]: "Champika Hardware - Distribution",
  [BUSINESS_IDS.WIREMAN_AGENCY]: "Wireman Agency",
  [BUSINESS_IDS.SIERRA_AGENCY]: "Sierra Agency",
  [BUSINESS_IDS.WEBSITE]: "BK Wiring Website",
} as const;

// ✅ ADDED: Internal Customer Names for Pinning
export const INTERNAL_CUSTOMERS = [
  "Champika Hardware - Retail",
  "Champika Hardware - Distribution",
  "Champika Hardware - Website",
];

export const BUSINESS_ROUTES = {
  [BUSINESS_IDS.ORANGE_AGENCY]: "/dashboard/office/orange",
  [BUSINESS_IDS.CHAMPIKA_RETAIL]: "/dashboard/office/retail",
  [BUSINESS_IDS.CHAMPIKA_DISTRIBUTION]: "/dashboard/office/distribution",
  [BUSINESS_IDS.WIREMAN_AGENCY]: "/dashboard/office/wireman",
  [BUSINESS_IDS.SIERRA_AGENCY]: "/dashboard/office/sierra",
  [BUSINESS_IDS.WEBSITE]: "/dashboard/office/website",
} as const;

export const BUSINESS_PO_PREFIXES: Record<string, string> = {
  [BUSINESS_IDS.ORANGE_AGENCY]: "O",
  [BUSINESS_IDS.CHAMPIKA_RETAIL]: "R",
  [BUSINESS_IDS.CHAMPIKA_DISTRIBUTION]: "D",
  [BUSINESS_IDS.WIREMAN_AGENCY]: "W",
  [BUSINESS_IDS.SIERRA_AGENCY]: "S",
  [BUSINESS_IDS.WEBSITE]: "WB",
};

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
  [BUSINESS_IDS.WIREMAN_AGENCY]: {
    primary: "red",
    bgClass: "bg-red-100",
    textClass: "text-red-600",
    borderClass: "border-red-600",
  },
  [BUSINESS_IDS.SIERRA_AGENCY]: {
    primary: "purple",
    bgClass: "bg-purple-100",
    textClass: "text-purple-600",
    borderClass: "border-purple-600",
  },
  [BUSINESS_IDS.WEBSITE]: {
    primary: "teal",
    bgClass: "bg-teal-100",
    textClass: "text-teal-600",
    borderClass: "border-teal-600",
  },
} as const;

/** Hostnames that serve the public online shop (rewritten to /shop). */
export const SHOP_HOSTS = ["bkwiringbadukade.lk", "www.bkwiringbadukade.lk"];

/**
 * Agency reps (Orange / Sierra) only see their own agency's products.
 * Returns the supplier-name keyword for the agency, or null for everyone else.
 */
export function getAgencySupplierKeyword(businessId?: string | null): string | null {
  if (businessId === BUSINESS_IDS.ORANGE_AGENCY) return "orange";
  if (businessId === BUSINESS_IDS.SIERRA_AGENCY) return "sierra";
  return null;
}

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
