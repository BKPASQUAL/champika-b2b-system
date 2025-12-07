// components/ui/layout/MobileNav.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Store, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { roleNavItems, UserRole } from "@/app/config/nav-config";
import { retailOfficeNavItems } from "@/app/config/retail-nav-config";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

interface MobileNavProps {
  role: UserRole;
  isRetail?: boolean;
}

export function MobileNav({ role, isRetail = false }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Determine which navigation to show
  const navSections = isRetail ? retailOfficeNavItems : roleNavItems[role];

  // --- USER INFO ---
  const [user, setUser] = useState({
    businessName: null as string | null,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("currentUser");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setUser({
            businessName: parsed.businessName || null,
          });
        } catch (e) {
          console.error("Failed to parse user data");
        }
      }
    }
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        {/* Logo Header */}
        <div className="h-16 flex items-center border-b px-6">
          {isRetail ? (
            <>
              <Store className="h-6 w-6 text-green-600 shrink-0" />
              <span className="ml-2 text-lg font-semibold">Retail Portal</span>
            </>
          ) : (
            <>
              <Package className="h-6 w-6 text-primary shrink-0" />
              <span className="ml-2 text-lg font-semibold">Champika HW</span>
            </>
          )}
        </div>

        {/* Business Badge */}
        {user.businessName && (
          <div className="px-4 py-3 border-b bg-muted/30">
            <Badge variant="secondary" className="w-full justify-center">
              <Store className="h-3 w-3 mr-1" />
              {user.businessName}
            </Badge>
          </div>
        )}

        {/* Navigation */}
        <nav className="px-4 py-4 overflow-y-auto h-[calc(100vh-64px)]">
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
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
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
      </SheetContent>
    </Sheet>
  );
}
