// app/dashboard/office/orange/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/ui/layout/AppSidebar";
import { MobileNav } from "@/components/ui/layout/MobileNav";
import { Globe } from "lucide-react";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";

export default function OrangeAgencyLayout({
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

    // 2. Safety Check: If no user, send to login
    if (!user) {
      router.push("/login");
      return;
    }

    // 3. Safety Check: If not office staff, send to main dashboard
    if (user.role !== "office") {
      router.push("/dashboard/office");
      return;
    }

    // 4. Check Business Name (SAFE MODE)
    // We use || "" to ensure we always have a string to check, preventing crashes
    const currentBusiness = (user.businessName || "").toLowerCase();
    const isAgency = currentBusiness.includes("orange agency");

    if (!isAgency) {
      console.log("Not Orange Agency, redirecting..."); // Debug log

      // Fallback redirection logic
      if (
        currentBusiness.includes("retail") ||
        currentBusiness.includes("champika hardware")
      ) {
        router.push("/dashboard/office/retail");
      } else {
        router.push("/dashboard/office");
      }
      return;
    }

    // 5. Success!
    setBusinessName(user.businessName || "Orange Agency");
    setIsAuthorized(true);
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
