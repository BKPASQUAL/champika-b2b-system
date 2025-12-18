"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import React from "react";

export function Breadcrumbs() {
  const pathname = usePathname();

  // 1. Define segments you want to HIDE from the view
  //    e.g. "dashboard" and "admin" will be removed, showing only "Inventory > Returns"
  const hiddenSegments = ["dashboard", "admin", "office", "rep"];

  // 2. Split path into segments
  const segments = pathname.split("/").filter((path) => path);

  // 3. Create an array of breadcrumb objects with correct URLs BEFORE filtering
  const breadcrumbItems = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    return {
      segment,
      href,
      label: segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    };
  });

  // 4. Filter out the hidden segments for display
  const visibleItems = breadcrumbItems.filter(
    (item) => !hiddenSegments.includes(item.segment.toLowerCase())
  );

  if (visibleItems.length === 0) return null;

  return (
    <nav className="flex items-center text-sm text-gray-500">
      {/* Optional: Home Icon (points to root dashboard) */}
      <Link
        href="/dashboard/admin"
        className="flex items-center hover:text-gray-900 transition-colors mr-2"
        title="Home"
      >
        <Home className="w-4 h-4" />
      </Link>

      {visibleItems.map((item, index) => {
        const isLast = index === visibleItems.length - 1;

        return (
          <React.Fragment key={item.href}>
            <ChevronRight className="w-4 h-4 mx-1 text-gray-300" />
            {isLast ? (
              <span className="font-semibold text-gray-900 ml-1">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-gray-900 transition-colors ml-1"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
