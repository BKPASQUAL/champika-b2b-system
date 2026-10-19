import { use } from "react";
import { PurchaseEstimateCreate } from "@/components/purchase-estimates/PurchaseEstimateCreate";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export const metadata = {
  title: "Edit Purchase Estimate | Admin",
};

export default function EditAdminPurchaseEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <PurchaseEstimateCreate
      estimateId={id}
      businessId={BUSINESS_IDS.CHAMPIKA_RETAIL}
      businessName="Champika Hardware"
      baseRoute="/dashboard/admin/purchase-estimates"
      themeColor="slate"
    />
  );
}
