import { PurchaseEstimateList } from "@/components/purchase-estimates/PurchaseEstimateList";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

export const metadata = {
  title: "Purchase Estimates | Orange Agency",
};

export default function OrangePurchaseEstimatesPage() {
  return (
    <PurchaseEstimateList
      businessId={BUSINESS_IDS.ORANGE_AGENCY}
      businessName={BUSINESS_NAMES[BUSINESS_IDS.ORANGE_AGENCY]}
      baseRoute="/dashboard/office/orange/purchase-estimates"
      themeColor="orange"
    />
  );
}
