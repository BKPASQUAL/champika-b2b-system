"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, ArrowRightLeft, Check } from "lucide-react";
import { getUserBusinessContext } from "@/app/middleware/businessAuth";
import {
  BUSINESS_NAMES,
  BUSINESS_ROUTES,
  BUSINESS_IDS,
} from "@/app/config/business-constants";

// Colour tokens per business so the switcher feels branded
const BUSINESS_COLORS: Record<
  string,
  { dot: string; badge: string; text: string }
> = {
  [BUSINESS_IDS.ORANGE_AGENCY]: {
    dot: "bg-orange-500",
    badge: "bg-orange-100 text-orange-700",
    text: "text-orange-700",
  },
  [BUSINESS_IDS.CHAMPIKA_RETAIL]: {
    dot: "bg-green-500",
    badge: "bg-green-100 text-green-700",
    text: "text-green-700",
  },
  [BUSINESS_IDS.CHAMPIKA_DISTRIBUTION]: {
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700",
    text: "text-blue-700",
  },
  [BUSINESS_IDS.WIREMAN_AGENCY]: {
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-700",
    text: "text-red-700",
  },
  [BUSINESS_IDS.SIERRA_AGENCY]: {
    dot: "bg-purple-500",
    badge: "bg-purple-100 text-purple-700",
    text: "text-purple-700",
  },
};

const DEFAULT_COLOR = {
  dot: "bg-gray-400",
  badge: "bg-gray-100 text-gray-700",
  text: "text-gray-700",
};

export function BusinessSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [accessibleIds, setAccessibleIds] = useState<string[]>([]);

  useEffect(() => {
    const user = getUserBusinessContext();
    if (user?.role === "office" && user.accessibleBusinessIds?.length > 1) {
      setAccessibleIds(user.accessibleBusinessIds);
    }
  }, []);

  // Don't render if the user only has one business
  if (accessibleIds.length <= 1) return null;

  // Determine which portal is currently active from the URL
  const activeId =
    Object.entries(BUSINESS_ROUTES).find(([, route]) =>
      pathname.startsWith(route)
    )?.[0] ?? null;

  const activeName = activeId
    ? BUSINESS_NAMES[activeId as keyof typeof BUSINESS_NAMES]
    : "Portal";
  const activeColor = activeId
    ? (BUSINESS_COLORS[activeId] ?? DEFAULT_COLOR)
    : DEFAULT_COLOR;

  const handleSwitch = (businessId: string) => {
    if (businessId === activeId) return;
    const route = BUSINESS_ROUTES[businessId as keyof typeof BUSINESS_ROUTES];
    if (route) router.push(route);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 pl-2 pr-2 text-xs border-border hover:bg-muted"
        >
          <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span
            className={`max-w-[120px] truncate font-medium ${activeColor.text}`}
          >
            {activeName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Switch portal
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {accessibleIds.map((id) => {
          const name = BUSINESS_NAMES[id as keyof typeof BUSINESS_NAMES] ?? id;
          const color = BUSINESS_COLORS[id] ?? DEFAULT_COLOR;
          const isActive = id === activeId;

          return (
            <DropdownMenuItem
              key={id}
              onClick={() => handleSwitch(id)}
              className={`flex items-center gap-2.5 cursor-pointer ${
                isActive ? "bg-muted font-medium" : ""
              }`}
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${color.dot}`} />
              <span className="flex-1 text-sm truncate">{name}</span>
              {isActive && (
                <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
