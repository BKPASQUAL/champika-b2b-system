"use client";

import { createContext, useContext, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GridSkeleton } from "./Skeletons";

/**
 * In-page navigation for the shop listing (categories, type/brand chips, sort, clear).
 * The page stays where it is: only the product grid in the middle turns into
 * placeholder cards until the new list arrives.
 */
type Nav = { go: (href: string) => void; pending: boolean };
const NavContext = createContext<Nav | null>(null);

export function ListingNavProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (href: string) => {
    start(() => router.push(href, { scroll: false }));
  };
  return <NavContext.Provider value={{ go, pending }}>{children}</NavContext.Provider>;
}

export function NavLink({
  href,
  className,
  children,
  ...rest
}: { href: string; className?: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  const nav = useContext(NavContext);
  return (
    <Link
      {...rest}
      href={href}
      scroll={false}
      className={`relative ${className || ""}`}
      onClick={(e) => {
        // Let new-tab / modified clicks behave like a normal link.
        if (!nav || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        nav.go(href);
      }}
    >
      {children}
    </Link>
  );
}

/** The product area: placeholder cards while a new list is loading. */
export function ListingResults({ children }: { children: React.ReactNode }) {
  const nav = useContext(NavContext);
  if (nav?.pending)
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading products…</span>
        <GridSkeleton count={8} />
      </div>
    );
  return <>{children}</>;
}
