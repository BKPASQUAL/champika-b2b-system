import { use } from "react";
import { PurchaseEstimateDetail } from "@/components/purchase-estimates/PurchaseEstimateDetail";
import { BUSINESS_NAMES, BUSINESS_IDS } from "@/app/config/business-constants";

export const metadata = {
  title: "Purchase Estimate Details | Orange Agency",
};

export default function OrangePurchaseEstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <PurchaseEstimateDetail
      id={id}
      baseRoute="/dashboard/office/orange/purchase-estimates"
      businessName={BUSINESS_NAMES[BUSINESS_IDS.ORANGE_AGENCY]}
      themeColor="orange"
    />
  );
}
