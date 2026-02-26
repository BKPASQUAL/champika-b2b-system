// components/ui/layout/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, Package, Store, Warehouse, Globe, Zap } from "lucide-react"; // ✅ Added Zap icon
import { roleNavItems, UserRole } from "@/app/config/nav-config";
import { retailOfficeNavItems } from "@/app/config/retail-nav-config";
import { distributionNavItems } from "@/app/config/distribution-nav-config";
import { orangeOfficeNavItems } from "@/app/config/orange-nav-config";
import { wiremanOfficeNavItems } from "@/app/config/wireman-nav-config"; // ✅ Imported
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface AppSidebarProps {
  role: UserRole;
  isRetail?: boolean;
  isDistribution?: boolean;
  isOrange?: boolean;
  isWireman?: boolean; // ✅ Added Prop
}

export function AppSidebar({
  role,
  isRetail = false,
  isDistribution = false,
  isOrange = false,
  isWireman = false, // ✅ Added Default
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // --- NAVIGATION SELECTION LOGIC ---
  let navSections;
  if (isWireman) {
    navSections = wiremanOfficeNavItems; // ✅ Added Logic
  } else if (isOrange) {
    navSections = orangeOfficeNavItems;
  } else if (isRetail) {
    navSections = retailOfficeNavItems;
  } else if (isDistribution) {
    navSections = distributionNavItems;
  } else {
    navSections = roleNavItems[role];
  }
  // ----------------------------------

  const [user, setUser] = useState({
    name: "Loading...",
    email: "",
    initials: "..",
    businessName: null as string | null,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("currentUser");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setUser({
            name: parsed.name || "User",
            email: parsed.email || "",
            initials: parsed.initials || "U",
            businessName: parsed.businessName || null,
          });
        } catch (e) {
          console.error("Failed to parse user data");
        }
      }
    }
  }, []);

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    localStorage.removeItem("currentUser");
    setTimeout(() => {
      router.push("/login");
      setIsLoggingOut(false);
    }, 1000);
  };

  return (
    <div className="hidden lg:flex w-64 border-r bg-card h-screen sticky top-0 flex-col shadow-sm z-40">
      {/* Logo Header */}
      <div className="h-16 flex items-center border-b px-6 shrink-0">
        {isWireman ? (
          <>
            <Zap className="h-6 w-6 text-red-600 shrink-0" />{" "}
            {/* ✅ Wireman Logo */}
            <span className="ml-2 text-lg font-semibold truncate">
              Wireman Portal
            </span>
          </>
        ) : isOrange ? (
          <>
            <Globe className="h-6 w-6 text-orange-600 shrink-0" />
            <span className="ml-2 text-lg font-semibold truncate">
              Agency Portal
            </span>
          </>
        ) : isRetail ? (
          <>
            <Store className="h-6 w-6 text-green-600 shrink-0" />
            <span className="ml-2 text-lg font-semibold truncate">
              Retail Portal
            </span>
          </>
        ) : isDistribution ? (
          <>
            <Warehouse className="h-6 w-6 text-blue-600 shrink-0" />
            <span className="ml-2 text-lg font-semibold truncate">
              Distribution
            </span>
          </>
        ) : (
          <>
            <img src="/logo.svg" alt="Finora Farm Logo" className="h-8 w-8 shrink-0 rounded-md" />
            <span className="ml-2 text-lg font-bold text-blue-800 tracking-tight truncate">
              Finora Farm
            </span>
          </>
        )}
      </div>

      {/* Business Badge */}
      {user.businessName && (
        <div className="px-4 pt-4 pb-2">
          <Badge
            variant="secondary"
            className={cn(
              "w-full justify-center",
              isWireman && "bg-red-100 text-red-700 border-red-200", // ✅ Red Theme
              isOrange && "bg-orange-100 text-orange-700 border-orange-200",
              isRetail && "bg-green-100 text-green-700 border-green-200",
              isDistribution && "bg-blue-100 text-blue-700 border-blue-200"
            )}
          >
            {isWireman && <Zap className="h-3 w-3 mr-1" />}
            {isOrange && <Globe className="h-3 w-3 mr-1" />}
            {isRetail && <Store className="h-3 w-3 mr-1" />}
            {isDistribution && <Warehouse className="h-3 w-3 mr-1" />}
            {user.businessName}
          </Badge>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {navSections.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              {section.title && (
                <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </h3>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-start gap-3 h-10 px-3",
                          isActive
                            ? isWireman // ✅ Active State for Wireman
                              ? "bg-red-100 text-red-700 hover:bg-red-200"
                              : isOrange
                              ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                              : isRetail
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : isDistribution
                              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "hover:bg-accent"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* User Profile Footer */}
      <div className="border-t p-4 shrink-0">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs",
              isWireman && "bg-red-100 text-red-700", // ✅ User Initials Theme
              isOrange && "bg-orange-100 text-orange-700",
              isRetail && "bg-green-100 text-green-700",
              isDistribution && "bg-blue-100 text-blue-700",
              !isOrange &&
                !isRetail &&
                !isDistribution &&
                !isWireman &&
                "bg-primary/10 text-primary"
            )}
          >
            {user.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={cn(
            "w-full justify-start gap-2",
            isWireman && "hover:bg-red-50 hover:text-red-600", // ✅ Logout Hover Theme
            isOrange && "hover:bg-orange-50 hover:text-orange-600",
            isRetail && "hover:bg-green-50 hover:text-green-600",
            isDistribution && "hover:bg-blue-50 hover:text-blue-600"
          )}
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </div>
  );
}
