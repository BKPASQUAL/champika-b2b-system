import { PurchaseEstimateCreate } from "@/components/purchase-estimates/PurchaseEstimateCreate";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export const metadata = {
  title: "New Purchase Estimate | Admin",
};

export default function CreateAdminPurchaseEstimatePage() {
  return (
    <PurchaseEstimateCreate
      businessId={BUSINESS_IDS.CHAMPIKA_RETAIL}
      businessName="Champika Hardware"
      baseRoute="/dashboard/admin/purchase-estimates"
      themeColor="slate"
    />
  );
}
