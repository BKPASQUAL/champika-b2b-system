// components/ui/layout/MobileNav.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Store, Package, Warehouse, Globe, Zap, Mountain, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { roleNavItems, UserRole } from "@/app/config/nav-config";
import { retailOfficeNavItems } from "@/app/config/retail-nav-config";
import { distributionNavItems } from "@/app/config/distribution-nav-config";
import { orangeOfficeNavItems } from "@/app/config/orange-nav-config";
import { wiremanOfficeNavItems } from "@/app/config/wireman-nav-config";
import { sierraOfficeNavItems } from "@/app/config/sierra-nav-config";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

interface MobileNavProps {
  role: UserRole;
  isRetail?: boolean;
  isDistribution?: boolean;
  isOrange?: boolean;
  isWireman?: boolean;
  isSierra?: boolean;
}

export function MobileNav({
  role,
  isRetail = false,
  isDistribution = false,
  isOrange = false,
  isWireman = false,
  isSierra = false,
}: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Determine which navigation to show
  let navSections;
  if (isWireman) {
    navSections = wiremanOfficeNavItems;
  } else if (isSierra) {
    navSections = sierraOfficeNavItems;
  } else if (isOrange) {
    navSections = orangeOfficeNavItems;
  } else if (isRetail) {
    navSections = retailOfficeNavItems;
  } else if (isDistribution) {
    navSections = distributionNavItems;
  } else {
    navSections = roleNavItems[role];
  }

  // --- USER INFO ---
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
      setIsOpen(false);
    }, 1000);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      {/* 
        ✅ Changed: Added flex flex-col here to allow flex-1 on nav to scroll properly,
        preventing nav items from being cut off. 
      */}
      <SheetContent side="left" className="w-72 p-0 flex flex-col h-full">
        <SheetTitle className="sr-only">Mobile Navigation Menu</SheetTitle>

        {/* Logo Header */}
        <div className="h-16 flex items-center border-b px-6 shrink-0">
          {isWireman ? (
            <>
              <Zap className="h-6 w-6 text-red-600 shrink-0" />
              <span className="ml-2 text-lg font-semibold truncate">Wireman Portal</span>
            </>
          ) : isSierra ? (
            <>
              <Mountain className="h-6 w-6 text-purple-600 shrink-0" />
              <span className="ml-2 text-lg font-semibold truncate">Sierra Agency</span>
            </>
          ) : isOrange ? (
            <>
              <Globe className="h-6 w-6 text-orange-600 shrink-0" />
              <span className="ml-2 text-lg font-semibold truncate">Agency Portal</span>
            </>
          ) : isRetail ? (
            <>
              <Store className="h-6 w-6 text-green-600 shrink-0" />
              <span className="ml-2 text-lg font-semibold truncate">Retail Portal</span>
            </>
          ) : isDistribution ? (
            <>
              <Warehouse className="h-6 w-6 text-blue-600 shrink-0" />
              <span className="ml-2 text-lg font-semibold truncate">Distribution</span>
            </>
          ) : (
            <>
              <img src="/logo.svg" alt="Finora Farm Logo" className="h-8 w-8 shrink-0 rounded-md" />
              <span className="ml-2 text-lg font-bold text-blue-800 tracking-tight truncate">Finora Farm</span>
            </>
          )}
        </div>



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
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className="block"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "w-full justify-start gap-3 h-10 px-3",
                            isActive
                              ? isWireman
                                ? "bg-red-100 text-red-700 hover:bg-red-200"
                                : isSierra
                                ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
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
        <div className="border-t p-4 shrink-0 mt-auto bg-background">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div
              className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs",
                isWireman && "bg-red-100 text-red-700",
                isSierra && "bg-purple-100 text-purple-700",
                isOrange && "bg-orange-100 text-orange-700",
                isRetail && "bg-green-100 text-green-700",
                isDistribution && "bg-blue-100 text-blue-700",
                !isOrange && !isRetail && !isDistribution && !isWireman && !isSierra && "bg-primary/10 text-primary"
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
              isWireman && "hover:bg-red-50 hover:text-red-600",
              isSierra && "hover:bg-purple-50 hover:text-purple-600",
              isOrange && "hover:bg-orange-50 hover:text-orange-600",
              isRetail && "hover:bg-green-50 hover:text-green-600",
              isDistribution && "hover:bg-blue-50 hover:text-blue-600"
            )}
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? "Logging out..." : "Logout"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
