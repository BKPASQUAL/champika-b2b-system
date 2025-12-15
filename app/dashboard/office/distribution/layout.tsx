// app/dashboard/office/distribution/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";
import { Warehouse } from "lucide-react";
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

  useEffect(() => {
    // 1. Get User Context
    const user = getUserBusinessContext();

    // 2. If no user, redirect to login
    if (!user) {
      router.push("/login");
      return;
    }

    // 3. Verify access to Distribution Business
    const { canAccess, redirectTo } = verifyBusinessRouteAccess(
      user,
      BUSINESS_IDS.CHAMPIKA_DISTRIBUTION
    );

    if (!canAccess && redirectTo) {
      router.push(redirectTo);
      return;
    }

    // 4. Success - User has access
    setBusinessName(
      user.businessName || getBusinessName(BUSINESS_IDS.CHAMPIKA_DISTRIBUTION)
    );
    setIsAuthorized(true);
  }, [router]);

  // Loading Screen
  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Verifying distribution access...</p>
        </div>
      </div>
    );
  }

  // Main Layout
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar with Distribution Navigation */}
      <AppSidebar role="office" isDistribution={true} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden h-14 bg-white border-b flex items-center px-4 sticky top-0 z-30">
          <MobileNav role="office" isDistribution={true} />
          <span className="ml-4 font-bold text-gray-700">Distribution</span>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex h-14 bg-white border-b items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Warehouse className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">
                {businessName}
              </h1>
              <p className="text-xs text-gray-500">
                Office Portal - Distribution
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
              DS
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
