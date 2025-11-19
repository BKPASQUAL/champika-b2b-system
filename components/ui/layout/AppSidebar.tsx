"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { roleNavItems, UserRole } from "@/app/config/nav-config";

interface AppSidebarProps {
  role: UserRole; // Pass the role here
}

export function AppSidebar({ role }: AppSidebarProps) {
  const pathname = usePathname();
  const navItems = roleNavItems[role];

  return (
    <div className="pb-12 w-64 border-r min-h-screen bg-background">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight text-blue-600">
            Champika HW
          </h2>
          <p className="px-4 text-xs text-muted-foreground uppercase tracking-wider font-bold mb-4">
            {role.toUpperCase()} PANEL
          </p>

          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-2",
                      isActive && "bg-slate-100 text-blue-700 font-semibold"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 w-full px-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
