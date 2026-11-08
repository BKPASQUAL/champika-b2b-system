import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getShopBase } from "@/lib/shop-data";
import { getWebCustomer } from "@/lib/web-auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string; error?: string; mode?: string }> };

const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/account");

export default async function LoginPage({ searchParams }: Props) {
  const [sp, base, customer] = await Promise.all([searchParams, getShopBase(), getWebCustomer().catch(() => null)]);
  const next = safeNext(sp.next);
  if (customer) redirect(`${base}${next}`);
  return <LoginForm next={next} initialError={sp.error || null} initialMode={sp.mode === "signup" ? "signup" : "login"} />;
}
