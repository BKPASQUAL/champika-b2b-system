import { PurchaseEstimateList } from "@/components/purchase-estimates/PurchaseEstimateList";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

export const metadata = {
  title: "Purchase Estimates | Sierra Agency",
};

export default function SierraPurchaseEstimatesPage() {
  return (
    <PurchaseEstimateList
      businessId={BUSINESS_IDS.SIERRA_AGENCY}
      businessName={BUSINESS_NAMES[BUSINESS_IDS.SIERRA_AGENCY]}
      baseRoute="/dashboard/office/sierra/purchase-estimates"
      themeColor="blue"
    />
  );
}
