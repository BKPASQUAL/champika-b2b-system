import { PurchaseEstimateList } from "@/components/purchase-estimates/PurchaseEstimateList";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

export const metadata = {
  title: "Purchase Estimates | Admin Dashboard",
};

export default function AdminPurchaseEstimatesPage() {
  return (
    <PurchaseEstimateList
      businessId={BUSINESS_IDS.CHAMPIKA_RETAIL}
      businessName="Champika Hardware"
      baseRoute="/dashboard/admin/purchase-estimates"
      themeColor="slate"
    />
  );
}
