import { use } from "react";
import { PurchaseEstimateCreate } from "@/components/purchase-estimates/PurchaseEstimateCreate";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

export const metadata = {
  title: "Edit Purchase Estimate | Sierra Agency",
};

export default function EditSierraPurchaseEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <PurchaseEstimateCreate
      estimateId={id}
      businessId={BUSINESS_IDS.SIERRA_AGENCY}
      businessName={BUSINESS_NAMES[BUSINESS_IDS.SIERRA_AGENCY]}
      baseRoute="/dashboard/office/sierra/purchase-estimates"
      supplierFilterKeyword="sierra"
      themeColor="blue"
    />
  );
}
