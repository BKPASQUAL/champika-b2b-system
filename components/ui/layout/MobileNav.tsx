"use client";

import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet"; // Added SheetTitle for accessibility
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { roleNavItems, UserRole } from "@/app/config/nav-config";

interface MobileNavProps {
  role: UserRole;
}

export function MobileNav({ role }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navSections = roleNavItems[role];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Hamburger Menu Button - Only visible on Mobile */}
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          {" "}
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>

      {/* The Sliding Drawer Content */}
      <SheetContent side="left" className="p-0 w-72">
        <div className="border-b p-4 bg-gray-50">
          <SheetTitle className="text-lg font-bold text-blue-700">
            Champika HW
          </SheetTitle>
          <p className="text-xs text-gray-500 uppercase font-bold mt-1">
            {role} Portal
          </p>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 h-full">
          {navSections.map((section, idx) => (
            <div key={idx} className="mb-4">
              {section.title && (
                <h4 className="px-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {section.title}
                </h4>
              )}

              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)} // Close drawer on click
                    >
                      <span
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
