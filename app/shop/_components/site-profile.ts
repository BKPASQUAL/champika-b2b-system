import "server-only";
import type { WebSite } from "@/app/config/business-constants";

/**
 * SERVER ONLY: the layout hands the current shop's profile to the browser
 * (ShopProvider), so a shop's pages never carry the other shop's words.
 *
 * Everything that differs between the two public shops, in one place.
 * The shops must never mention each other: BK Wiring text, domain, logo and
 * delivery area must not appear on the Champika shop, and the other way round.
 * Store name / phone / address come from Shop Settings (per shop); these are
 * the fixed words around them.
 */
export type SiteProfile = {
  site: WebSite;
  /** Name used when Shop Settings has none. */
  defaultName: string;
  /** Domain shown in printed quotes and share text ("" = none known yet). */
  domainLabel: string;
  /** Where we deliver, used in sentences: "in the Galle area" / "island-wide". */
  deliveryWhere: string;
  /** Short delivery badge, e.g. "Galle area delivery". */
  deliveryBadge: string;
  /** Longer delivery line for feature lists. */
  deliveryLine: string;
  /** Cart note: before / bold / after. */
  cartNote: [string, string, string];
  /** Added after "free delivery" in the cart hint, e.g. " in Galle". */
  freeDeliveryWhere: string;
  /** Printed quotation wording. */
  pdf: { area: string; title: string; line: string; sentence: string; footer: string };
  /** Home page title after the store name. */
  titleSuffix: string;
  /** Default meta description. */
  metaDescription: string;
  /** Browser bar colour. */
  themeColor: string;
  /** Browser-only names (kept as they were for BK so carts / settings survive). */
  cartKey: string;
  themeCookie: string;
  langCookie: string;
};

const champikaDomain = (() => {
  try {
    const u = process.env.NEXT_PUBLIC_CHAMPIKA_SHOP_URL;
    return u ? new URL(u).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
})();

export const SITE_PROFILES: Record<WebSite, SiteProfile> = {
  bk: {
    site: "bk",
    defaultName: "BK Wiring",
    domainLabel: "bkwiringbadukade.lk",
    deliveryWhere: "in the Galle area",
    deliveryBadge: "Galle area delivery",
    deliveryLine: "Fast doorstep delivery across Galle & suburbs",
    cartNote: ["Doorstep delivery is currently available across the ", "Galle area", "."],
    freeDeliveryWhere: " in Galle",
    pdf: {
      area: "Galle Area",
      title: "Galle Area Doorstep Delivery",
      line: "Fast dispatch across Galle & suburbs",
      sentence: "Doorstep delivery is available across the Galle area",
      footer: "Galle Area Delivery",
    },
    titleSuffix: "House Wiring Accessories Online",
    metaDescription:
      "Buy cables, wires, switches, sockets, breakers and distribution boards online. Genuine brands, discount prices and fast delivery in the Galle area.",
    themeColor: "#0a0a0a",
    cartKey: "bkw_cart_v1",
    themeCookie: "bkw_theme",
    langCookie: "bkw_lang",
  },
  champika: {
    site: "champika",
    defaultName: "Champika Hardware & Distribution",
    domainLabel: champikaDomain,
    deliveryWhere: "island-wide",
    deliveryBadge: "Island-wide delivery",
    deliveryLine: "Delivered to your shop or site on our own lorry routes",
    cartNote: ["Delivered ", "island-wide", " — shops on our lorry routes get it on the next route day."],
    freeDeliveryWhere: "",
    pdf: {
      area: "Island-wide",
      title: "Island-wide Delivery",
      line: "Delivered on our own lorry routes",
      sentence: "Delivery is available island-wide",
      footer: "Island-wide Delivery",
    },
    titleSuffix: "Wholesale Hardware Online",
    metaDescription:
      "Wholesale hardware for shops and contractors: wires, switches, lighting, plumbing, paints and tools at distributor prices, with carton rates and island-wide delivery.",
    themeColor: "#0F1E33",
    cartKey: "chd_cart_v1",
    themeCookie: "chd_theme",
    langCookie: "chd_lang",
  },
};

export const siteProfile = (site: WebSite): SiteProfile => SITE_PROFILES[site] ?? SITE_PROFILES.bk;
