"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";
import { Zap } from "lucide-react";
import {
  getUserBusinessContext,
  verifyBusinessRouteAccess,
} from "@/app/middleware/businessAuth";
import {
  BUSINESS_IDS,
  getBusinessName,
  INTERNAL_CUSTOMERS,
} from "@/app/config/business-constants";

export default function WiremanAgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  // ✅ FIX: Ref to track if we already ran billing this session
  const hasRunBilling = useRef(false);

  useEffect(() => {
    const user = getUserBusinessContext();

    if (!user) {
      router.push("/login");
      return;
    }

    const { canAccess, redirectTo } = verifyBusinessRouteAccess(
      user,
      BUSINESS_IDS.WIREMAN_AGENCY,
    );

    if (!canAccess && redirectTo) {
      router.push(redirectTo);
      return;
    }

    setBusinessName(
      user.businessName || getBusinessName(BUSINESS_IDS.WIREMAN_AGENCY),
    );
    setIsAuthorized(true);

    // --- ✅ AUTO-GENERATE BILLS (Run Once) ---
    const runAutoBilling = async () => {
      // Prevent running if already ran
      if (hasRunBilling.current) return;
      hasRunBilling.current = true;

      try {
        const res = await fetch("/api/customers");
        if (res.ok) {
          const allCustomers = await res.json();
          const internalBranches = allCustomers.filter((c: any) =>
            INTERNAL_CUSTOMERS.includes(c.shopName),
          );

          for (const branch of internalBranches) {
            await fetch("/api/wireman/inter-branch/bill", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerId: branch.id,
                customerName: branch.shopName,
              }),
            });
          }
          console.log("Auto-billing check completed.");
        }
      } catch (error) {
        console.error("Auto-billing failed:", error);
      }
    };

    if (canAccess) {
      runAutoBilling();
    }
    // -----------------------------------------------------
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Verifying Wireman access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AppSidebar role="office" isWireman={true} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden h-14 bg-white border-b flex items-center px-4 sticky top-0 z-30">
          <MobileNav role="office" isWireman={true} />
          <span className="ml-4 font-bold text-gray-700">Wireman Portal</span>
        </header>

        <header className="hidden lg:flex h-14 bg-white border-b items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
              <Zap className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">
                {businessName}
              </h1>
              <p className="text-xs text-gray-500">Office Portal - Agency</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold text-xs">
              WA
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
