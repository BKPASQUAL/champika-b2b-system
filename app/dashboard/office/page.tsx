// app/dashboard/office/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getUserBusinessContext,
  getUserBusinessRoute,
} from "@/app/middleware/businessAuth";

export default function OfficeDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Get user context
    const user = getUserBusinessContext();

    // If no user, redirect to login
    if (!user) {
      router.push("/login");
      return;
    }

    // If not office staff, redirect to appropriate dashboard
    if (user.role !== "office") {
      const route = getUserBusinessRoute(user);
      router.push(route);
      return;
    }

    // Get business-specific route for office staff
    const businessRoute = getUserBusinessRoute(user);
    router.push(businessRoute);
  }, [router]);

  // Loading screen while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Redirecting to your office...</p>
      </div>
    </div>
  );
}
