import type { Metadata } from "next";
import { CartView } from "../_components/CartView";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default function CartPage() {
  return <CartView />;
}
