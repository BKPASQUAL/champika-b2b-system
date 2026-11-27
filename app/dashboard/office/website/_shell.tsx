"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";
import { Loader2, ShoppingBag } from "lucide-react";
import { getUserBusinessContext, verifyBusinessRouteAccess } from "@/app/middleware/businessAuth";
import { WEB_SITE_BUSINESS, type WebSite } from "@/app/config/business-constants";
import { WebPortalProvider } from "./_site";

/**
 * Staff portal frame for one online shop. BK Wiring (website/layout.tsx) and
 * Champika (champika-website/layout.tsx) share every page; only the shop differs.
 */
export function WebsitePortalShell({ site, children }: { site: WebSite; children: React.ReactNode }) {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [initials, setInitials] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const champika = site === "champika";
  const title = champika ? "Champika Website" : "BK Wiring Website";
  const tint = champika ? "bg-rose-100 text-rose-600" : "bg-teal-100 text-teal-600";

  useEffect(() => {
    const user = getUserBusinessContext();
    if (!user) {
      router.replace("/login");
      return;
    }
    const { canAccess, redirectTo } = verifyBusinessRouteAccess(user, WEB_SITE_BUSINESS[site]);
    if (!canAccess && redirectTo) {
      router.replace(redirectTo);
      return;
    }
    setUserName(user.name || "");
    setInitials(user.initials || "W");
    setIsAuthorized(true);
  }, [router, site]);

  if (!isAuthorized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className={`h-10 w-10 animate-spin mb-2 ${champika ? "text-rose-600" : "text-teal-600"}`} />
        <p className="text-sm text-muted-foreground font-medium">Verifying Website Access...</p>
      </div>
    );
  }

  return (
    <WebPortalProvider site={site}>
      <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
        <AppSidebar role="office" isWebsite webSite={site} />

        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Mobile Header */}
          <header className="lg:hidden h-16 bg-white border-b flex items-center px-4 shrink-0 z-30">
            <MobileNav role="office" isWebsite webSite={site} />
            <span className="ml-4 font-bold text-gray-700">{title}</span>
          </header>

          {/* Desktop Header */}
          <header className="hidden lg:flex h-16 bg-white border-b items-center justify-between px-8 shrink-0 z-10">
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tint}`}>
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
                <p className="text-xs text-gray-500">
                  Office Portal — {champika ? "Online Wholesale Shop" : "Online Shop"} {userName && `· ${userName}`}
                </p>
              </div>
            </div>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${tint}`}>{initials}</div>
          </header>

          <div className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</div>
        </main>
      </div>
    </WebPortalProvider>
  );
}
