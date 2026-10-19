import { use } from "react";
import { PurchaseEstimateDetail } from "@/components/purchase-estimates/PurchaseEstimateDetail";
import { BUSINESS_NAMES, BUSINESS_IDS } from "@/app/config/business-constants";

export const metadata = {
  title: "Purchase Estimate Details | Wireman Agency",
};

export default function WiremanPurchaseEstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <PurchaseEstimateDetail
      id={id}
      baseRoute="/dashboard/office/wireman/purchase-estimates"
      businessName={BUSINESS_NAMES[BUSINESS_IDS.WIREMAN_AGENCY]}
      themeColor="slate"
    />
  );
}
