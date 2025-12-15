// app/middleware/businessAuth.ts
/**
 * Business-Aware Authentication Middleware
 * Provides utilities for filtering navigation and validating business access
 */

import { UserRole } from "@/app/config/nav-config";
import {
  BUSINESS_IDS,
  getBusinessRoute,
} from "@/app/config/business-constants";

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
  // Admin has access to all businesses
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
 * Check if user can access Orange Agency
 */
export function canAccessOrangeAgency(user: UserBusinessContext): boolean {
  if (user.role !== "office") {
    return false;
  }
  return user.businessId === BUSINESS_IDS.ORANGE_AGENCY;
}

/**
 * Check if user can access retail business
 */
export function canAccessRetailBusiness(user: UserBusinessContext): boolean {
  if (user.role !== "office") {
    return false;
  }
  return user.businessId === BUSINESS_IDS.CHAMPIKA_RETAIL;
}

/**
 * Check if user can access distribution business
 */
export function canAccessDistributionBusiness(
  user: UserBusinessContext
): boolean {
  if (user.role !== "office") {
    return false;
  }
  return user.businessId === BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;
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
 * Get the appropriate dashboard route for a user based on their business
 */
export function getUserBusinessRoute(user: UserBusinessContext): string {
  // Admin can go to admin dashboard
  if (user.role === "admin") {
    return "/dashboard/admin";
  }

  // Office staff get routed to their business-specific layout
  if (user.role === "office" && user.businessId) {
    return getBusinessRoute(user.businessId);
  }

  // Sales reps
  if (user.role === "rep") {
    return "/dashboard/rep";
  }

  // Delivery drivers
  if (user.role === "delivery") {
    return "/dashboard/delivery";
  }

  // Default fallback
  return "/dashboard/office";
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

/**
 * Verify user can access a specific business route
 */
export function verifyBusinessRouteAccess(
  user: UserBusinessContext,
  businessId: string
): { canAccess: boolean; redirectTo: string | null } {
  // Admin can access everything
  if (user.role === "admin") {
    return { canAccess: true, redirectTo: null };
  }

  // Office staff can only access their assigned business
  if (user.role === "office") {
    if (user.businessId === businessId) {
      return { canAccess: true, redirectTo: null };
    } else {
      // Redirect to their actual business
      return {
        canAccess: false,
        redirectTo: getUserBusinessRoute(user),
      };
    }
  }

  // Other roles can't access office business routes
  return {
    canAccess: false,
    redirectTo: getUserBusinessRoute(user),
  };
}
