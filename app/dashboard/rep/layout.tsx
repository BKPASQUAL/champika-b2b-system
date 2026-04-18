"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/app/config/nav-config";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import { Loader2 } from "lucide-react";

export default function RepDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const user = getUserBusinessContext();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "rep") {
      router.replace("/login");
      return;
    }
    setIsAuthorized(true);
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground font-medium">
          Verifying access...
        </p>
      </div>
    );
  }

  const userRole: UserRole = "rep";

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <AppSidebar role={userRole} />

      {/* Main Content Wrapper */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Header (Visible only on small screens) */}
        <header className="lg:hidden h-16 bg-white border-b flex items-center px-4 shrink-0 z-30">
          <MobileNav role={userRole} />
          <span className="ml-4 font-bold text-gray-700">Champika HW</span>
        </header>

        {/* Desktop Header (Visible only on large screens) */}
        <header className="hidden lg:flex h-16 bg-white border-b items-center justify-between px-8 shrink-0 z-10">
          <h1 className="text-sm font-semibold text-gray-500">
            Sales Representative Portal
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-700">
                  Ajith Bandara
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                  Sales Rep
                </p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-xs border border-green-200">
                RP
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
