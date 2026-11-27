"use client";

import { createContext, useContext, type ReactNode } from "react";
import { WEB_SITE_BUSINESS, WEB_SITE_PORTAL, type WebSite } from "@/app/config/business-constants";

/**
 * Which online shop this staff portal manages. The same portal pages serve
 * BK Wiring (/dashboard/office/website) and Champika (/dashboard/office/champika-website);
 * the layout wraps them in <WebPortalProvider site=…>.
 *
 * Components read it with useWebPortal() (links, titles, business id).
 * webApi() (./_components/api.ts) sends portalSite() with every request.
 */

/** Shop of the portal open in this browser tab, from its address (for plain helpers like webApi). */
export function portalSite(): WebSite {
  return typeof window !== "undefined" && window.location.pathname.startsWith(WEB_SITE_PORTAL.champika) ? "champika" : "bk";
}

const Ctx = createContext<WebSite>("bk");

export function WebPortalProvider({ site, children }: { site: WebSite; children: ReactNode }) {
  return <Ctx.Provider value={site}>{children}</Ctx.Provider>;
}

/** Details of the shop this portal manages. */
export function useWebPortal() {
  const site = useContext(Ctx);
  const champika = site === "champika";
  return {
    site,
    /** Portal root path, e.g. "/dashboard/office/champika-website". */
    base: WEB_SITE_PORTAL[site],
    businessId: WEB_SITE_BUSINESS[site],
    /** Short shop name for headings, e.g. "Champika" / "BK Wiring". */
    shopName: champika ? "Champika" : "BK Wiring",
    /** Full portal title. */
    title: champika ? "Champika Website" : "BK Wiring Website",
    /** Public shop link on the B2B domain. */
    shopPath: champika ? "/champika" : "/shop",
    /** Print header key (DIVISIONS in app/lib/invoice-html.ts). */
    division: (champika ? "online" : "website") as "online" | "website",
  };
}
