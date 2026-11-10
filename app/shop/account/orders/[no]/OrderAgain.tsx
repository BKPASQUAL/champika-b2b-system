"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useShop } from "../../../_components/ShopContext";

/** Puts every item of a past order back in the cart (same quantities) and opens the cart. */
export function OrderAgain({ items }: { items: { id: string; qty: number }[] }) {
  const { addMany, href, t } = useShop();
  const router = useRouter();
  if (!items.length) return null;
  return (
    <button
      type="button"
      onClick={() => {
        addMany(items);
        toast.success(t("Items added to your cart"));
        router.push(href("/cart"));
      }}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-(--s-accent) px-5 text-[15px] font-bold text-white transition hover:bg-(--s-accent-hover)"
    >
      <RotateCcw className="h-4 w-4" /> {t("Order again")}
    </button>
  );
}
