import { PurchaseEstimateList } from "@/components/purchase-estimates/PurchaseEstimateList";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

export const metadata = {
  title: "Purchase Estimates | Wireman Agency",
};

export default function WiremanPurchaseEstimatesPage() {
  return (
    <PurchaseEstimateList
      businessId={BUSINESS_IDS.WIREMAN_AGENCY}
      businessName={BUSINESS_NAMES[BUSINESS_IDS.WIREMAN_AGENCY]}
      baseRoute="/dashboard/office/wireman/purchase-estimates"
      themeColor="slate"
    />
  );
}
