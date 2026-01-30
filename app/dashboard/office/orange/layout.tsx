"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";
import { Globe } from "lucide-react";
import {
  getUserBusinessContext,
  verifyBusinessRouteAccess,
} from "@/app/middleware/businessAuth";
import {
  BUSINESS_IDS,
  getBusinessName,
  INTERNAL_CUSTOMERS,
} from "@/app/config/business-constants";

export default function OrangeAgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const hasRunBilling = useRef(false);

  useEffect(() => {
    // 1. Get User Context
    const user = getUserBusinessContext();

    // 2. If no user, redirect to login
    if (!user) {
      router.push("/login");
      return;
    }

    // 3. Verify access to Orange Agency
    const { canAccess, redirectTo } = verifyBusinessRouteAccess(
      user,
      BUSINESS_IDS.ORANGE_AGENCY,
    );

    if (!canAccess && redirectTo) {
      router.push(redirectTo);
      return;
    }

    // 4. Success - User has access
    setBusinessName(
      user.businessName || getBusinessName(BUSINESS_IDS.ORANGE_AGENCY),
    );
    setIsAuthorized(true);

    // --- ✅ AUTO-GENERATE BILLS (Run Once) ---
    const runAutoBilling = async () => {
      if (hasRunBilling.current) return;
      hasRunBilling.current = true;

      try {
        const res = await fetch("/api/customers");
        if (res.ok) {
          const allCustomers = await res.json();
          // Filter to find Retail & Distribution
          const internalBranches = allCustomers.filter((c: any) =>
            INTERNAL_CUSTOMERS.includes(c.shopName),
          );

          for (const branch of internalBranches) {
            // Call Orange specific billing endpoint
            await fetch("/api/orange/inter-branch/bill", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerId: branch.id,
                customerName: branch.shopName,
              }),
            });
          }
          console.log("Orange Agency auto-billing check completed.");
        }
      } catch (error) {
        console.error("Orange auto-billing failed:", error);
      }
    };

    if (canAccess) {
      runAutoBilling();
    }
  }, [router]);

  // Loading Screen
  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Verifying agency access...</p>
        </div>
      </div>
    );
  }

  // Main Layout
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar with Agency Navigation */}
      <AppSidebar role="office" isOrange={true} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden h-14 bg-white border-b flex items-center px-4 sticky top-0 z-30">
          <MobileNav role="office" isOrange={true} />
          <span className="ml-4 font-bold text-gray-700">Agency Portal</span>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex h-14 bg-white border-b items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Globe className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">
                {businessName}
              </h1>
              <p className="text-xs text-gray-500">Office Portal - Agency</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-xs">
              OA
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
