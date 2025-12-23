// app/dashboard/office/distribution/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"; // Added Breadcrumbs
import { Loader2 } from "lucide-react"; // Added modern loader
import {
  getUserBusinessContext,
  verifyBusinessRouteAccess,
} from "@/app/middleware/businessAuth";
import { BUSINESS_IDS, getBusinessName } from "@/app/config/business-constants";

export default function DistributionOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Added generic loading state

  useEffect(() => {
    const checkAccess = () => {
      // 1. Get User Context
      const user = getUserBusinessContext();

      // 2. If no user, redirect to login
      if (!user) {
        router.replace("/login");
        return;
      }

      // 3. Verify access to Distribution Business
      const { canAccess, redirectTo } = verifyBusinessRouteAccess(
        user,
        BUSINESS_IDS.CHAMPIKA_DISTRIBUTION
      );

      if (!canAccess && redirectTo) {
        router.replace(redirectTo);
        return;
      }

      // 4. Success - User has access
      setBusinessName(
        user.businessName || getBusinessName(BUSINESS_IDS.CHAMPIKA_DISTRIBUTION)
      );
      setIsAuthorized(true);
      setIsLoading(false);
    };

    checkAccess();
  }, [router]);

  // Loading Screen (Matches Admin Design)
  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground font-medium">
          Verifying Distribution Access...
        </p>
      </div>
    );
  }

  // If check finished but not authorized (should have redirected), render nothing
  if (!isAuthorized) {
    return null;
  }

  // Main Layout
  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <AppSidebar role="office" isDistribution={true} />

      {/* Main Content Wrapper */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Header - Only visible on Mobile */}
        <header className="lg:hidden h-16 bg-white border-b flex items-center px-4 flex-shrink-0 z-30">
          <MobileNav role="office" isDistribution={true} />
          <span className="ml-4 font-bold text-gray-700">Distribution</span>
        </header>

        {/* Desktop Header - Fixed at top */}
        <header className="hidden lg:flex h-16 bg-white border-b items-center justify-between px-8 flex-shrink-0 z-10">
          {/* Dynamic Breadcrumbs */}
          <Breadcrumbs />

          <div className="flex items-center gap-4">
            {/* Initials / Profile Badge */}
            <div
              className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs"
              title={businessName}
            >
              DS
            </div>
          </div>
        </header>

        {/* Page Content - Scrollable Area */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
