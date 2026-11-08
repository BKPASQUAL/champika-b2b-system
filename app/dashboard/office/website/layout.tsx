// app/dashboard/office/website/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";
import { Loader2, ShoppingBag } from "lucide-react";
import {
  getUserBusinessContext,
  verifyBusinessRouteAccess,
} from "@/app/middleware/businessAuth";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function WebsiteOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [initials, setInitials] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const user = getUserBusinessContext();
    if (!user) {
      router.replace("/login");
      return;
    }
    const { canAccess, redirectTo } = verifyBusinessRouteAccess(user, BUSINESS_IDS.WEBSITE);
    if (!canAccess && redirectTo) {
      router.replace(redirectTo);
      return;
    }
    setUserName(user.name || "");
    setInitials(user.initials || "W");
    setIsAuthorized(true);
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600 mb-2" />
        <p className="text-sm text-muted-foreground font-medium">Verifying Website Access...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
      <AppSidebar role="office" isWebsite />

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white border-b flex items-center px-4 shrink-0 z-30">
          <MobileNav role="office" isWebsite />
          <span className="ml-4 font-bold text-gray-700">BK Wiring Website</span>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 bg-white border-b items-center justify-between px-8 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-teal-100 rounded-lg flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-teal-600" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">BK Wiring Website</h1>
              <p className="text-xs text-gray-500">Office Portal — Online Shop {userName && `· ${userName}`}</p>
            </div>
          </div>
          <div className="h-8 w-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-bold text-xs">
            {initials}
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
