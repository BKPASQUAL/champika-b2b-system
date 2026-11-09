import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getShopBase } from "@/lib/shop-data";
import { ensureWebCustomer } from "@/lib/web-auth";
import { AccountNav } from "./AccountNav";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

/** Every /account page needs a logged-in customer. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const [base, customer] = await Promise.all([getShopBase(), ensureWebCustomer().catch(() => null)]);
  if (!customer) redirect(`${base}/login?next=${encodeURIComponent("/account")}`);

  return (
    <div className="mx-auto px-4 py-6 md:px-6 md:py-8 xl:px-10">
      <div className="mb-6 flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-(--s-accent) text-lg font-bold text-(--s-accent-ink)">
          {(customer.full_name || customer.email || "?").trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold md:text-2xl">Hi{customer.full_name ? `, ${customer.full_name.split(" ")[0]}` : ""}</h1>
          <p className="truncate text-sm text-(--s-muted)">{customer.email}</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr] xl:gap-8">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
