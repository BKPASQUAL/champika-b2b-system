// components/ui/layout/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, Store, Warehouse, Globe, Zap, Mountain, ChevronDown, Check, LayoutDashboard } from "lucide-react";
import { roleNavItems, UserRole } from "@/app/config/nav-config";
import { retailOfficeNavItems } from "@/app/config/retail-nav-config";
import { distributionNavItems } from "@/app/config/distribution-nav-config";
import { orangeOfficeNavItems } from "@/app/config/orange-nav-config";
import { wiremanOfficeNavItems } from "@/app/config/wireman-nav-config";
import { sierraOfficeNavItems } from "@/app/config/sierra-nav-config";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BUSINESS_IDS,
  BUSINESS_NAMES,
  BUSINESS_ROUTES,
} from "@/app/config/business-constants";

interface AppSidebarProps {
  role: UserRole;
  isRetail?: boolean;
  isDistribution?: boolean;
  isOrange?: boolean;
  isWireman?: boolean;
  isSierra?: boolean;
}

export function AppSidebar({
  role,
  isRetail = false,
  isDistribution = false,
  isOrange = false,
  isWireman = false,
  isSierra = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // --- NAVIGATION SELECTION LOGIC ---
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
  // ----------------------------------

  const [user, setUser] = useState({
    name: "Loading...",
    email: "",
    initials: "..",
    role: "" as string,
    businessName: null as string | null,
    accessibleBusinessIds: [] as string[],
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
            role: parsed.role || "",
            businessName: parsed.businessName || null,
            accessibleBusinessIds: parsed.accessibleBusinessIds ?? [],
          });
        } catch (e) {
          console.error("Failed to parse user data");
        }
      }
    }
  }, []);

  const isAdmin = user.role === "admin";

  // Determine which business ID corresponds to the current portal
  const currentBusinessId = isOrange
    ? BUSINESS_IDS.ORANGE_AGENCY
    : isRetail
    ? BUSINESS_IDS.CHAMPIKA_RETAIL
    : isDistribution
    ? BUSINESS_IDS.CHAMPIKA_DISTRIBUTION
    : isWireman
    ? BUSINESS_IDS.WIREMAN_AGENCY
    : isSierra
    ? BUSINESS_IDS.SIERRA_AGENCY
    : null;

  const isOfficePortal = isOrange || isRetail || isDistribution || isWireman || isSierra;

  // Admins see all portals; office users see their assigned portals (2+)
  const switcherIds = isAdmin
    ? Object.values(BUSINESS_IDS)
    : user.accessibleBusinessIds;

  // Show switcher for admins everywhere, and for office users with 2+ businesses
  const canSwitch = isAdmin || (isOfficePortal && switcherIds.length > 1);

  const handlePortalSwitch = (businessId: string) => {
    if (businessId === currentBusinessId) return;
    const route = BUSINESS_ROUTES[businessId as keyof typeof BUSINESS_ROUTES];
    if (route) router.push(route);
  };

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // continue regardless
    }
    localStorage.removeItem("currentUser");
    sessionStorage.clear();
    router.push("/login");
  };

  return (
    <div className="hidden lg:flex w-64 border-r bg-card h-screen sticky top-0 flex-col shadow-sm z-40">
      {/* Logo Header / Portal Switcher */}
      <div className="h-16 flex items-center border-b px-4 shrink-0">
        {canSwitch ? (
          /* ── Multi-business dropdown trigger ── */
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 w-full rounded-lg px-2 py-2 hover:bg-accent transition-colors text-left group cursor-pointer">
                {/* Icon */}
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
                  isWireman ? "bg-red-100" :
                  isSierra ? "bg-purple-100" :
                  isOrange ? "bg-orange-100" :
                  isRetail ? "bg-green-100" :
                  isDistribution ? "bg-blue-100" :
                  "bg-white ring-1 ring-border"
                )}>
                  {isWireman ? <Zap className="h-4 w-4 text-red-600" /> :
                   isSierra ? <Mountain className="h-4 w-4 text-purple-600" /> :
                   isOrange ? <Globe className="h-4 w-4 text-orange-600" /> :
                   isRetail ? <Store className="h-4 w-4 text-green-600" /> :
                   isDistribution ? <Warehouse className="h-4 w-4 text-blue-600" /> :
                   <img src="/icons/icon-512x512.png" alt="Champika" className="h-full w-full object-cover" />}
                </div>
                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate leading-tight">
                    {isWireman ? "Wireman Agency" :
                     isSierra ? "Sierra Agency" :
                     isOrange ? "Orange Agency" :
                     isRetail ? "Champika Retail" :
                     isDistribution ? "Distribution" :
                     "Admin Dashboard"}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Switch portal
                  </p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-data-[state=open]:rotate-180 transition-transform" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent side="bottom" align="start" className="w-56">
              {/* Admin dashboard entry */}
              {isAdmin && (
                <>
                  <DropdownMenuItem
                    onClick={() => !isOfficePortal ? undefined : router.push("/dashboard/admin")}
                    className={cn(
                      "flex items-center gap-2.5 select-none",
                      !isOfficePortal
                        ? "bg-muted font-medium pointer-events-none cursor-default"
                        : "cursor-pointer"
                    )}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0 bg-gray-800" />
                    <span className="flex-1 text-sm truncate font-medium">Admin Dashboard</span>
                    {!isOfficePortal && <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {switcherIds.map((id) => {
                const name = BUSINESS_NAMES[id as keyof typeof BUSINESS_NAMES] ?? id;
                const isActive = id === currentBusinessId;

                const dotClass =
                  id === BUSINESS_IDS.ORANGE_AGENCY ? "bg-orange-500" :
                  id === BUSINESS_IDS.CHAMPIKA_RETAIL ? "bg-green-500" :
                  id === BUSINESS_IDS.CHAMPIKA_DISTRIBUTION ? "bg-blue-500" :
                  id === BUSINESS_IDS.WIREMAN_AGENCY ? "bg-red-500" :
                  id === BUSINESS_IDS.SIERRA_AGENCY ? "bg-purple-500" :
                  "bg-gray-400";

                return (
                  <DropdownMenuItem
                    key={id}
                    onClick={() => handlePortalSwitch(id)}
                    className={cn(
                      "flex items-center gap-2.5 cursor-pointer select-none",
                      isActive && "bg-muted font-medium pointer-events-none cursor-default"
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full shrink-0", dotClass)} />
                    <span className="flex-1 text-sm truncate">{name}</span>
                    {isActive && <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </DropdownMenuItem>
                );
              })}

              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
                {isAdmin ? "All portals (admin)" : `${switcherIds.length} portals assigned`}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

        ) : isWireman ? (
          <div className="flex items-center gap-2 px-2">
            <Zap className="h-6 w-6 text-red-600 shrink-0" />
            <span className="text-lg font-semibold truncate">Wireman Portal</span>
          </div>
        ) : isSierra ? (
          <div className="flex items-center gap-2 px-2">
            <Mountain className="h-6 w-6 text-purple-600 shrink-0" />
            <span className="text-lg font-semibold truncate">Sierra Agency</span>
          </div>
        ) : isOrange ? (
          <div className="flex items-center gap-2 px-2">
            <Globe className="h-6 w-6 text-orange-600 shrink-0" />
            <span className="text-lg font-semibold truncate">Agency Portal</span>
          </div>
        ) : isRetail ? (
          <div className="flex items-center gap-2 px-2">
            <Store className="h-6 w-6 text-green-600 shrink-0" />
            <span className="text-lg font-semibold truncate">Retail Portal</span>
          </div>
        ) : isDistribution ? (
          <div className="flex items-center gap-2 px-2">
            <Warehouse className="h-6 w-6 text-blue-600 shrink-0" />
            <span className="text-lg font-semibold truncate">Distribution</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2">
            <img src="/logo.svg" alt="Logo" className="h-8 w-8 shrink-0 rounded-md" />
            <span className="text-lg font-bold text-blue-800 tracking-tight truncate">
              Champika HW
            </span>
          </div>
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
                    <Link key={item.href} href={item.href}>
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
      <div className="border-t p-4 shrink-0">
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
          onClick={() => setShowLogoutDialog(true)}
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

      {/* Logout confirmation dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out? You will need to sign in again to access the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isLoggingOut ? (
                <span className="flex items-center gap-2">
                  <LogOut className="h-4 w-4 animate-pulse" />
                  Logging out...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Yes, Logout
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
