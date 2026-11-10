"use client";

import { useShop } from "./ShopContext";

/**
 * Translated text for components that can't use hooks (server components):
 * <Tr k="Ask for price" /> or <Tr k="Save {amount}" vars={{ amount: "Rs 140" }} />.
 */
export function Tr({ k, vars }: { k: string; vars?: Record<string, string | number> }) {
  return <>{useShop().t(k, vars)}</>;
}
