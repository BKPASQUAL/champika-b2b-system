// app/dashboard/office/sierra/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";
import { Loader2, Mountain } from "lucide-react";
import {
  getUserBusinessContext,
  verifyBusinessRouteAccess,
} from "@/app/middleware/businessAuth";
import { BUSINESS_IDS, getBusinessName } from "@/app/config/business-constants";

export default function SierraOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAccess = () => {
      const user = getUserBusinessContext();

      if (!user) {
        router.replace("/login");
        return;
      }

      // Allow admin or Sierra Agency users
      const isAdmin = user.role === "admin";
      const isSierraUser =
        user.role === "office" && user.businessId === BUSINESS_IDS.SIERRA_AGENCY;

      if (!isAdmin && !isSierraUser) {
        const { redirectTo } = verifyBusinessRouteAccess(user, BUSINESS_IDS.SIERRA_AGENCY);
        router.replace(redirectTo || "/dashboard/office");
        return;
      }

      setBusinessName(user.businessName || "Sierra Agency");
      setIsAuthorized(true);
      setIsLoading(false);
    };

    checkAccess();
  }, [router]);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-purple-600 mb-2" />
        <p className="text-sm text-muted-foreground font-medium">
          Verifying Sierra Access...
        </p>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <AppSidebar role="office" isSierra={true} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white border-b flex items-center px-4 flex-shrink-0 z-30">
          <MobileNav role="office" isSierra={true} />
          <span className="ml-4 font-bold text-gray-700">Sierra Agency</span>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 bg-white border-b items-center justify-between px-8 flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Mountain className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">{businessName}</h1>
              <p className="text-xs text-gray-500">Office Portal — Sierra Agency</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-xs">
              SA
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
