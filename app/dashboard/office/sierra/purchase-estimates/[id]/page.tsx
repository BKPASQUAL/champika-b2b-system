import { use } from "react";
import { PurchaseEstimateDetail } from "@/components/purchase-estimates/PurchaseEstimateDetail";
import { BUSINESS_NAMES, BUSINESS_IDS } from "@/app/config/business-constants";

export const metadata = {
  title: "Purchase Estimate Details | Sierra Agency",
};

export default function SierraPurchaseEstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <PurchaseEstimateDetail
      id={id}
      baseRoute="/dashboard/office/sierra/purchase-estimates"
      businessName={BUSINESS_NAMES[BUSINESS_IDS.SIERRA_AGENCY]}
      themeColor="blue"
    />
  );
}
