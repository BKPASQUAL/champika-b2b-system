import type { Metadata } from "next";
import { CompareBrands } from "../../_components/CompareBrands";

export const metadata: Metadata = { title: "Compare brands", robots: { index: false } };

export default function CompareBrandsPage() {
  return <CompareBrands />;
}
