import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBankInfo, getShopBase } from "@/lib/shop-data";
import { ensureWebCustomer } from "@/lib/web-auth";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const [base, customer, bank] = await Promise.all([getShopBase(), ensureWebCustomer().catch(() => null), getBankInfo()]);
  if (!customer) redirect(`${base}/login?next=${encodeURIComponent("/checkout")}`);

  const a = (customer.default_address || {}) as Record<string, string>;
  return (
    <CheckoutForm
      defaults={{
        name: customer.full_name || "",
        phone: customer.phone || "",
        line1: a.line1 || "",
        line2: a.line2 || "",
        city: a.city || "",
        district: a.district || "",
      }}
      email={customer.email}
      bankReady={!!(bank.bank && bank.accountNo)}
    />
  );
}
