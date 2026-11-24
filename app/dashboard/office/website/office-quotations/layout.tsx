"use client";

import {
  QuotationPortalProvider,
  WEBSITE_QUOTATION_PORTAL,
} from "@/app/dashboard/office/retail/quotations/_portal";

/** BK Wiring quotations: the Retail quotation pages with the website business + BK Wiring header. */
export default function WebsiteOfficeQuotationsLayout({ children }: { children: React.ReactNode }) {
  return <QuotationPortalProvider value={WEBSITE_QUOTATION_PORTAL}>{children}</QuotationPortalProvider>;
}
