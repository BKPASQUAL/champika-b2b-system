"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";
import { Loader2, Zap, Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getUserBusinessContext,
  verifyBusinessRouteAccess,
} from "@/app/middleware/businessAuth";
import { BUSINESS_IDS, getBusinessName } from "@/app/config/business-constants";

export default function StorefrontOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string>("BK Wiring Kade");
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<"admin" | "office">("office");

  useEffect(() => {
    const checkAccess = () => {
      const user = getUserBusinessContext();

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserRole(user.role === "admin" ? "admin" : "office");

      const { canAccess, redirectTo } = verifyBusinessRouteAccess(
        user,
        BUSINESS_IDS.CHAMPIKA_ONLINE
      );

      if (!canAccess && redirectTo) {
        router.replace(redirectTo);
        return;
      }

      setBusinessName(
        user.businessName || getBusinessName(BUSINESS_IDS.CHAMPIKA_ONLINE) || "BK Wiring Kade"
      );
      setIsAuthorized(true);
      setIsLoading(false);
    };

    checkAccess();
  }, [router]);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-amber-600 mb-2" />
        <p className="text-sm text-muted-foreground font-medium">
          Verifying BK Wiring Kade Access...
        </p>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <AppSidebar role={userRole} isStorefront={true} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white border-b flex items-center px-4 shrink-0 z-30 justify-between">
          <div className="flex items-center">
            <MobileNav role={userRole} isStorefront={true} />
            <span className="ml-3 font-bold text-gray-800 flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-600 fill-amber-500" />
              BK Wiring Kade
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => window.open("/", "_blank")}
          >
            <Globe className="h-3.5 w-3.5 text-emerald-600" />
            Store
          </Button>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 bg-white border-b items-center justify-between px-8 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <Zap className="h-4 w-4 text-amber-600 fill-amber-500" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">{businessName}</h1>
              <p className="text-xs text-gray-500">Office Portal — Online Operations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs h-9"
              onClick={() => window.open("/", "_blank")}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              Visit Storefront
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Button>
            <div className="h-8 w-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold text-xs ring-1 ring-amber-300">
              BK
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
