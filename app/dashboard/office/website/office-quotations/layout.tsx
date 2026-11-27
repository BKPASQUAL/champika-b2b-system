"use client";

import {
  CHAMPIKA_WEB_QUOTATION_PORTAL,
  QuotationPortalProvider,
  WEBSITE_QUOTATION_PORTAL,
} from "@/app/dashboard/office/retail/quotations/_portal";
import { useWebPortal } from "@/app/dashboard/office/website/_site";

/**
 * Shop quotations: the Retail quotation pages with the shop's business and header
 * (BK Wiring header for BK; the Champika "Online Wholesale" header for Champika).
 */
export default function WebsiteOfficeQuotationsLayout({ children }: { children: React.ReactNode }) {
  const { site } = useWebPortal();
  const portal = site === "champika" ? CHAMPIKA_WEB_QUOTATION_PORTAL : WEBSITE_QUOTATION_PORTAL;
  return <QuotationPortalProvider value={portal}>{children}</QuotationPortalProvider>;
}
