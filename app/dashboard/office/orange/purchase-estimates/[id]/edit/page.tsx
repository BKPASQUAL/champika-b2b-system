import { use } from "react";
import { PurchaseEstimateCreate } from "@/components/purchase-estimates/PurchaseEstimateCreate";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

export const metadata = {
  title: "Edit Purchase Estimate | Orange Agency",
};

export default function EditOrangePurchaseEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <PurchaseEstimateCreate
      estimateId={id}
      businessId={BUSINESS_IDS.ORANGE_AGENCY}
      businessName={BUSINESS_NAMES[BUSINESS_IDS.ORANGE_AGENCY]}
      baseRoute="/dashboard/office/orange/purchase-estimates"
      supplierFilterKeyword="orange"
      themeColor="orange"
    />
  );
}
