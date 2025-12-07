// app/dashboard/office/retail/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";
import { Store } from "lucide-react";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

export default function RetailOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  useEffect(() => {
    // Check if user has access to retail business
    const user = getUserBusinessContext();

    if (!user) {
      router.push("/login");
      return;
    }

    // Verify user is office staff
    if (user.role !== "office") {
      router.push("/dashboard/office");
      return;
    }

    // Verify user is assigned to retail business
    const isRetail =
      user.businessName?.toLowerCase().includes("retail") ||
      user.businessName?.toLowerCase().includes("champika hardware");

    if (!isRetail) {
      router.push("/dashboard/office");
      return;
    }

    setBusinessName(user.businessName || "Retail Business");
    setIsAuthorized(true);
  }, [router]);

  // Show loading while checking authorization
  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Sidebar with Retail Navigation */}
      <AppSidebar role="office" isRetail={true} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden h-14 bg-white border-b flex items-center px-4 sticky top-0 z-30">
          <MobileNav role="office" isRetail={true} />
          <span className="ml-4 font-bold text-gray-700">Retail Portal</span>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex h-14 bg-white border-b items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Store className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">
                {businessName}
              </h1>
              <p className="text-xs text-gray-500">Office Portal - Retail</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
              RT
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
