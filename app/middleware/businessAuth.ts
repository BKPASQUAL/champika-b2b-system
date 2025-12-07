// middleware/businessAuth.ts
/**
 * Business-Aware Authentication Middleware
 * Provides utilities for filtering navigation and validating business access
 */

import { UserRole } from "@/app/config/nav-config";

export interface UserBusinessContext {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  businessId: string | null;
  businessName: string | null;
  initials: string;
}

/**
 * Check if user has access to a specific business
 */
export function hasBusinessAccess(
  user: UserBusinessContext,
  requiredBusinessId?: string
): boolean {
  // Admin and super_admin have access to all businesses
  if (user.role === "admin") {
    return true;
  }

  // If no specific business is required, allow access
  if (!requiredBusinessId) {
    return true;
  }

  // Check if user's business matches required business
  return user.businessId === requiredBusinessId;
}

/**
 * Check if user can access retail business features
 */
export function canAccessRetailBusiness(user: UserBusinessContext): boolean {
  // Only office staff can access retail business
  if (user.role !== "office") {
    return false;
  }

  // Check if user is assigned to retail business
  // You can either check by business name or ID
  const hasRetailBusiness =
    user.businessName?.toLowerCase().includes("retail") ||
    user.businessName?.toLowerCase().includes("champika hardware");

  return hasRetailBusiness ?? false;
}

/**
 * Get user business context from localStorage
 */
export function getUserBusinessContext(): UserBusinessContext | null {
  if (typeof window === "undefined") return null;

  try {
    const storedUser = localStorage.getItem("currentUser");
    if (!storedUser) return null;

    return JSON.parse(storedUser) as UserBusinessContext;
  } catch (error) {
    console.error("Failed to parse user business context:", error);
    return null;
  }
}

/**
 * Filter navigation items based on business access
 */
export function filterNavByBusiness<T extends { businessRequired?: string }>(
  items: T[],
  user: UserBusinessContext
): T[] {
  return items.filter((item) => {
    if (!item.businessRequired) return true;
    return hasBusinessAccess(user, item.businessRequired);
  });
}
