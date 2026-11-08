import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getShopBase } from "@/lib/shop-data";
import { ensureWebCustomer } from "@/lib/web-auth";
import { JobQuoteForm } from "./JobQuoteForm";

export const metadata: Metadata = {
  title: "Get a quotation for your house",
  description: "Tell us about your house wiring job and get one complete price list with our best discount.",
};

export default async function QuotePage() {
  const [base, customer] = await Promise.all([getShopBase(), ensureWebCustomer().catch(() => null)]);
  if (!customer) redirect(`${base}/login?next=${encodeURIComponent("/quote")}&mode=signup`);
  return <JobQuoteForm />;
}
