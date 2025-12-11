// components/ui/layout/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, Package, Store, Globe } from "lucide-react";
import { roleNavItems, UserRole } from "@/app/config/nav-config";
import { retailOfficeNavItems } from "@/app/config/retail-nav-config";
import { orangeOfficeNavItems } from "@/app/config/orange-nav-config";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface AppSidebarProps {
  role: UserRole;
  isRetail?: boolean; // Flag to show retail navigation
  isOrange?: boolean; // Flag to show orange agency navigation
}

export function AppSidebar({
  role,
  isRetail = false,
  isOrange = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine which navigation to show
  let navSections;
  if (isOrange) {
    navSections = orangeOfficeNavItems;
  } else if (isRetail) {
    navSections = retailOfficeNavItems;
  } else {
    navSections = roleNavItems[role];
  }

  // --- STATE FOR USER INFO ---
  const [user, setUser] = useState({
    name: "Loading...",
    email: "",
    initials: "..",
    businessName: null as string | null,
  });

  useEffect(() => {
    // Load user data from localStorage when component mounts
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
  // ---------------------------

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    // Clear user data on logout
    localStorage.removeItem("currentUser");

    // Simulate logout delay
    setTimeout(() => {
      router.push("/login");
      setIsLoggingOut(false);
    }, 1000);
  };

  return (
    <div className="hidden lg:flex w-64 border-r bg-card h-screen sticky top-0 flex-col shadow-sm z-40">
      {/* Logo Header */}
      <div className="h-16 flex items-center border-b px-6 shrink-0">
        {isOrange ? (
          <>
            <Globe className="h-6 w-6 text-orange-600 shrink-0" />
            <span className="ml-2 text-lg font-semibold truncate">
              Orange Agency
            </span>
          </>
        ) : isRetail ? (
          <>
            <Store className="h-6 w-6 text-green-600 shrink-0" />
            <span className="ml-2 text-lg font-semibold truncate">
              Retail Portal
            </span>
          </>
        ) : (
          <>
            <Package className="h-6 w-6 text-primary shrink-0" />
            <span className="ml-2 text-lg font-semibold truncate">
              Champika HW
            </span>
          </>
        )}
      </div>

      {/* Business Badge (if applicable) */}
      {user.businessName && (
        <div className="px-4 py-3 border-b bg-muted/30">
          <Badge variant="secondary" className="w-full justify-center">
            {isOrange ? (
              <Globe className="h-3 w-3 mr-1" />
            ) : (
              <Store className="h-3 w-3 mr-1" />
            )}
            {user.businessName}
          </Badge>
        </div>
      )}

      {/* Navigation - Scrollable */}
      <nav className="flex-1 overflow-y-auto px-4 py-2">
        <div className="space-y-3">
          {navSections.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              {/* Section Title */}
              {section.title && (
                <h3 className="mb-1 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </h3>
              )}

              {/* Section Items */}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link key={item.href} href={item.href} className="block">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-start gap-3 h-9 px-3 text-sm",
                          isActive
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                            : "hover:bg-accent hover:text-accent-foreground"
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

      {/* User Profile & Logout - Sticky at Bottom */}
      <div className="border-t p-4 space-y-3 shrink-0">
        {/* User Info */}
        <div className="flex items-center gap-3 px-2">
          <div className="h-9 w-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
            {user.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </div>
  );
}
