"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/app/config/nav-config";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";
import { Loader2 } from "lucide-react";
import {
  getUserBusinessContext,
  getUserBusinessRoute,
} from "@/app/middleware/businessAuth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAccess = () => {
      // 1. Get current user from local storage
      const user = getUserBusinessContext();

      // 2. If no user found, redirect to login
      if (!user) {
        router.replace("/login");
        return;
      }

      // 3. Strict Admin Check
      if (user.role !== "admin") {
        // User is logged in but NOT an admin.
        // Redirect them to their appropriate dashboard based on their role/business.
        const correctRoute = getUserBusinessRoute(user);
        router.replace(correctRoute);
        return;
      }

      // 4. Access Granted
      setIsAuthorized(true);
      setIsLoading(false);
    };

    checkAccess();
  }, [router]);

  // Show loading spinner while verifying permissions
  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground font-medium">
          Verifying Admin Access...
        </p>
      </div>
    );
  }

  // If check finished but not authorized (should have redirected), render nothing
  if (!isAuthorized) {
    return null;
  }

  // Access verified: Render the Admin Layout
  const userRole: UserRole = "admin";

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar - Hidden on Mobile, Visible on Desktop */}
      <AppSidebar role={userRole} />

      {/* Main Content Wrapper */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Header - Only visible on Mobile */}
        <header className="lg:hidden h-16 bg-white border-b flex items-center px-4 flex-shrink-0 z-30">
          <MobileNav role={userRole} />
          <span className="ml-4 font-bold text-gray-700">Champika HW</span>
        </header>

        {/* Desktop Header - Fixed at top */}
        <header className="hidden lg:flex h-16 bg-white border-b items-center justify-between px-8 flex-shrink-0 z-10">
          {/* Replaced Static "Overview" with Dynamic Breadcrumbs */}
          <Breadcrumbs />

          <div className="flex items-center gap-4">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
              AD
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
