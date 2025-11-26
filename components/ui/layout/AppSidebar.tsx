"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, Package } from "lucide-react";
import { roleNavItems, UserRole } from "@/app/config/nav-config";
import { useState, useEffect } from "react";

interface AppSidebarProps {
  role: UserRole;
}

export function AppSidebar({ role }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navSections = roleNavItems[role];

  // --- STATE FOR USER INFO ---
  const [user, setUser] = useState({
    name: "Loading...",
    email: "",
    initials: "..",
  });

  useEffect(() => {
    // Load user data from localStorage when component mounts
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("currentUser");
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
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
        <Package className="h-6 w-6 text-primary shrink-0" />
        <span className="ml-2 text-lg font-semibold truncate">Champika HW</span>
      </div>

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
                          "w-full justify-start gap-3 h-7 px-3",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate text-sm">{item.name}</span>
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* User Profile & Logout - Fixed Bottom */}
      <div className="border-t p-4 shrink-0 bg-card">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0">
            <span className="text-sm font-medium">{user.initials}</span>
          </div>
          <div className="flex-1 overflow-hidden min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-sm h-9"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4 mr-2 shrink-0" />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </div>
  );
}
