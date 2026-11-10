import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getShopBase } from "@/lib/shop-data";
import { ensureWebCustomer } from "@/lib/web-auth";
import { JobQuoteForm } from "./JobQuoteForm";

export const metadata: Metadata = {
  title: "Get a quotation for your house",
  description: "Send a photo of your electrician's item list, or tell us about your house wiring job, and get one complete price list with our best discount.",
};

/** /quote = describe the house · /quote?mode=list = send a photo of a paper item list. */
export default async function QuotePage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const [base, customer, sp] = await Promise.all([getShopBase(), ensureWebCustomer().catch(() => null), searchParams]);
  const mode = sp.mode === "list" ? "list" : "house";
  const self = mode === "list" ? "/quote?mode=list" : "/quote";
  if (!customer) redirect(`${base}/login?next=${encodeURIComponent(self)}&mode=signup`);
  return <JobQuoteForm initialMode={mode} />;
}
