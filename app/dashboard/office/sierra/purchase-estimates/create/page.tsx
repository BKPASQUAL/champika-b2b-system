import { PurchaseEstimateCreate } from "@/components/purchase-estimates/PurchaseEstimateCreate";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

export const metadata = {
  title: "New Purchase Estimate | Sierra Agency",
};

export default function CreateSierraPurchaseEstimatePage() {
  return (
    <PurchaseEstimateCreate
      businessId={BUSINESS_IDS.SIERRA_AGENCY}
      businessName={BUSINESS_NAMES[BUSINESS_IDS.SIERRA_AGENCY]}
      baseRoute="/dashboard/office/sierra/purchase-estimates"
      supplierFilterKeyword="sierra"
      themeColor="blue"
    />
  );
}
