import { use } from "react";
import { PurchaseEstimateDetail } from "@/components/purchase-estimates/PurchaseEstimateDetail";

export const metadata = {
  title: "Purchase Estimate Details | Admin",
};

export default function AdminPurchaseEstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <PurchaseEstimateDetail
      id={id}
      baseRoute="/dashboard/admin/purchase-estimates"
      businessName="Champika Hardware"
      themeColor="slate"
    />
  );
}
