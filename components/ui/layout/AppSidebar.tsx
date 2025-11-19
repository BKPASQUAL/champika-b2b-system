"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { roleNavItems, UserRole } from "@/app/config/nav-config";

interface AppSidebarProps {
  role: UserRole;
}

export function AppSidebar({ role }: AppSidebarProps) {
  const pathname = usePathname();
  const navSections = roleNavItems[role];

  return (
    <div className="hidden lg:flex w-60 border-r bg-white h-screen sticky top-0 flex-col shadow-sm z-40 font-sans">
      {" "}
      <div className="h-12 flex items-center px-3 border-b bg-white flex-shrink-0">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-bold tracking-tight text-blue-700">
            CHAMPIKA HW
          </h2>
          <span className="text-[10px] text-gray-400 font-medium uppercase">
            {role}
          </span>
        </div>
      </div>
      {/* DENSE NAVIGATION LIST */}
      {/* reduced padding (py-2) and gaps */}
      <div className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin scrollbar-thumb-gray-100">
        {navSections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="mb-2">
            {" "}
            {/* Minimal gap between sections */}
            {/* Section Title - Very Small */}
            {section.title && (
              <h4 className="px-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 mt-1">
                {section.title}
              </h4>
            )}
            {/* Items with 0.5px gap */}
            <div className="space-y-[1px]">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link key={item.href} href={item.href} className="block">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full justify-start gap-2 h-7 px-2", // Reduced height to h-7 (28px)
                        isActive
                          ? "bg-blue-50 text-blue-700 font-semibold shadow-sm border border-blue-100"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5",
                          isActive ? "text-blue-600" : "text-gray-400"
                        )}
                      />
                      <span className="text-xs">{item.name}</span>
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* COMPACT FOOTER */}
      <div className="p-2 border-t bg-gray-50 flex-shrink-0">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Sign Out</span>
        </Button>
      </div>
    </div>
  );
}
