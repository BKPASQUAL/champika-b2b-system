"use client";

import { createContext, useContext, type ReactNode } from "react";
import { BUSINESS_IDS } from "@/app/config/business-constants";

/**
 * Where the shared quotation pages run. Retail is the default; the BK Wiring
 * website portal re-uses the same pages with its own business, header and
 * invoice flow (see app/dashboard/office/website/office-quotations).
 */
export type QuotationPortal = {
  businessId: string;
  /** Route of the quotation list, e.g. /dashboard/office/retail/quotations */
  basePath: string;
  /** Print header (key of DIVISIONS in invoice-html). */
  division: "retail" | "website";
  /** Page that shows an invoice created from a quotation. */
  invoicePath: (invoiceId: string) => string;
  /** "walkin" = open Retail's walk-in sale; "api" = convert straight to an invoice. */
  convertMode: "walkin" | "api";
  title: string;
  subtitle: string;
  /** Show a "+ New customer" button on create / edit. */
  allowNewCustomer: boolean;
};

export const RETAIL_QUOTATION_PORTAL: QuotationPortal = {
  businessId: BUSINESS_IDS.CHAMPIKA_RETAIL,
  basePath: "/dashboard/office/retail/quotations",
  division: "retail",
  invoicePath: (id) => `/dashboard/office/retail/invoices/${id}`,
  convertMode: "walkin",
  title: "Quotations",
  subtitle: "Create and manage retail quotations — convert to invoice when ready.",
  allowNewCustomer: false,
};

export const WEBSITE_QUOTATION_PORTAL: QuotationPortal = {
  businessId: BUSINESS_IDS.WEBSITE,
  basePath: "/dashboard/office/website/office-quotations",
  division: "website",
  invoicePath: (id) => `/dashboard/office/website/office-invoices/${id}`,
  convertMode: "api",
  title: "BK Wiring Quotations",
  subtitle: "Quotations with the BK Wiring header — convert to a BK Wiring invoice when the customer confirms.",
  allowNewCustomer: true,
};

const Ctx = createContext<QuotationPortal>(RETAIL_QUOTATION_PORTAL);

export function QuotationPortalProvider({ value, children }: { value: QuotationPortal; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useQuotationPortal = () => useContext(Ctx);
