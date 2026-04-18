// components/ui/layout/MobileNav.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu, Store, Warehouse, Globe, Zap, Mountain,
  LogOut, ChevronDown, Check, LayoutDashboard, X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { roleNavItems, UserRole } from "@/app/config/nav-config";
import { retailOfficeNavItems } from "@/app/config/retail-nav-config";
import { distributionNavItems } from "@/app/config/distribution-nav-config";
import { orangeOfficeNavItems } from "@/app/config/orange-nav-config";
import { wiremanOfficeNavItems } from "@/app/config/wireman-nav-config";
import { sierraOfficeNavItems } from "@/app/config/sierra-nav-config";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from "@/components/ui/sheet";
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
import { BUSINESS_IDS, BUSINESS_NAMES, BUSINESS_ROUTES } from "@/app/config/business-constants";


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

  let navSections;
  if (isWireman)           navSections = wiremanOfficeNavItems;
  else if (isSierra)       navSections = sierraOfficeNavItems;
  else if (isOrange)       navSections = orangeOfficeNavItems;
  else if (isRetail)       navSections = retailOfficeNavItems;
  else if (isDistribution) navSections = distributionNavItems;
  else                     navSections = roleNavItems[role];

  const [user, setUser] = useState({
    name: "Loading...", email: "", initials: "..",
    role: "" as string,
    accessibleBusinessIds: [] as string[],
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("currentUser");
      if (stored) {
        const p = JSON.parse(stored);
        setUser({
          name: p.name || "User",
          email: p.email || "",
          initials: p.initials || "U",
          role: p.role || "",
          accessibleBusinessIds: p.accessibleBusinessIds ?? [],
        });
      }
    } catch { /* ignore */ }
  }, []);

  const isAdmin = user.role === "admin";
  const isOfficePortal = isOrange || isRetail || isDistribution || isWireman || isSierra;

  const currentBusinessId = isOrange ? BUSINESS_IDS.ORANGE_AGENCY
    : isRetail       ? BUSINESS_IDS.CHAMPIKA_RETAIL
    : isDistribution ? BUSINESS_IDS.CHAMPIKA_DISTRIBUTION
    : isWireman      ? BUSINESS_IDS.WIREMAN_AGENCY
    : isSierra       ? BUSINESS_IDS.SIERRA_AGENCY
    : null;

  const switcherIds = isAdmin ? Object.values(BUSINESS_IDS) : user.accessibleBusinessIds;
  const canSwitch   = isAdmin || (isOfficePortal && switcherIds.length > 1);

  const CurrentIcon   = isWireman ? Zap : isSierra ? Mountain : isOrange ? Globe
    : isRetail ? Store : isDistribution ? Warehouse : LayoutDashboard;
  const currentLabel  = isWireman ? "Wireman Agency" : isSierra ? "Sierra Agency"
    : isOrange ? "Orange Agency" : isRetail ? "Champika Retail"
    : isDistribution ? "Distribution" : "Admin Dashboard";
  const currentIconBg = isWireman ? "bg-red-100" : isSierra ? "bg-purple-100"
    : isOrange ? "bg-orange-100" : isRetail ? "bg-green-100"
    : isDistribution ? "bg-blue-100" : "bg-gray-100";
  const currentIconColor = isWireman ? "text-red-600" : isSierra ? "text-purple-600"
    : isOrange ? "text-orange-600" : isRetail ? "text-green-600"
    : isDistribution ? "text-blue-600" : "text-gray-700";

  const handlePortalSwitch = (businessId: string) => {
    if (businessId === currentBusinessId) return;
    const route = BUSINESS_ROUTES[businessId as keyof typeof BUSINESS_ROUTES];
    if (route) { setIsOpen(false); router.push(route); }
  };

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    localStorage.removeItem("currentUser");
    sessionStorage.clear();
    setIsOpen(false);
    router.push("/login");
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>

        <SheetContent side="left" className="w-[280px] p-0 flex flex-col h-full" hideCloseButton>
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

          {/* ── Header ─────────────────────────────────────── */}
          <div className="h-16 flex items-center gap-3 border-b px-4 shrink-0">

            {canSwitch ? (
              /* Dropdown trigger */
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 flex-1 min-w-0 rounded-xl px-2 py-2 hover:bg-muted transition-colors cursor-pointer group text-left">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
                      isOfficePortal ? currentIconBg : "bg-white ring-1 ring-border"
                    )}>
                      {isOfficePortal
                        ? <CurrentIcon className={cn("h-4 w-4", currentIconColor)} />
                        : <img src="/icons/icon-512x512.png" alt="Champika" className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate leading-tight">{currentLabel}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">Switch portal</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 group-data-[state=open]:rotate-180 transition-transform" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent side="bottom" align="start" className="w-56">
                  {/* Admin dashboard entry */}
                  {isAdmin && (
                    <>
                      <DropdownMenuItem
                        onClick={() => { if (isOfficePortal) { setIsOpen(false); router.push("/dashboard/admin"); } }}
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
                      id === BUSINESS_IDS.ORANGE_AGENCY        ? "bg-orange-500" :
                      id === BUSINESS_IDS.CHAMPIKA_RETAIL       ? "bg-green-500"  :
                      id === BUSINESS_IDS.CHAMPIKA_DISTRIBUTION ? "bg-blue-500"   :
                      id === BUSINESS_IDS.WIREMAN_AGENCY        ? "bg-red-500"    :
                      id === BUSINESS_IDS.SIERRA_AGENCY         ? "bg-purple-500" :
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

            ) : (
              /* Static portal name */
              <div className="flex items-center gap-2.5 flex-1 min-w-0 px-2">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", currentIconBg)}>
                  <CurrentIcon className={cn("h-4 w-4", currentIconColor)} />
                </div>
                <span className="text-sm font-semibold truncate">{currentLabel}</span>
              </div>
            )}

            {/* Close button */}
            <SheetClose asChild>
              <button className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer shrink-0">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            </SheetClose>
          </div>

          {/* ── Navigation ─────────────────────────────────── */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-5">
              {navSections.map((section, sectionIdx) => (
                <div key={sectionIdx}>
                  {section.title && (
                    <p className="mb-1.5 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                      {section.title}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
                          <div className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                            isActive
                              ? isWireman      ? "bg-red-100    text-red-700"
                                : isSierra     ? "bg-purple-100 text-purple-700"
                                : isOrange     ? "bg-orange-100 text-orange-700"
                                : isRetail     ? "bg-green-100  text-green-700"
                                : isDistribution ? "bg-blue-100 text-blue-700"
                                : "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}>
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="text-sm font-medium truncate">{item.name}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          {/* ── User footer ─────────────────────────────────── */}
          <div className="border-t px-3 py-3 shrink-0">
            <div className="flex items-center gap-3 px-2 py-2 mb-1 rounded-xl">
              <div className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                isWireman      ? "bg-red-100    text-red-700"
                  : isSierra   ? "bg-purple-100 text-purple-700"
                  : isOrange   ? "bg-orange-100 text-orange-700"
                  : isRetail   ? "bg-green-100  text-green-700"
                  : isDistribution ? "bg-blue-100 text-blue-700"
                  : "bg-primary/10 text-primary"
              )}>
                {user.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>

            <button
              onClick={() => setShowLogoutDialog(true)}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {isLoggingOut ? "Logging out…" : "Logout"}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Logout dialog — outside Sheet */}
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
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoggingOut ? (
                <span className="flex items-center gap-2"><LogOut className="h-4 w-4 animate-pulse" /> Logging out…</span>
              ) : (
                <span className="flex items-center gap-2"><LogOut className="h-4 w-4" /> Yes, Logout</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
