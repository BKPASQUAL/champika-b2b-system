import { use } from "react";
import { PurchaseEstimateCreate } from "@/components/purchase-estimates/PurchaseEstimateCreate";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

export const metadata = {
  title: "Edit Purchase Estimate | Wireman Agency",
};

export default function EditWiremanPurchaseEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <PurchaseEstimateCreate
      estimateId={id}
      businessId={BUSINESS_IDS.WIREMAN_AGENCY}
      businessName={BUSINESS_NAMES[BUSINESS_IDS.WIREMAN_AGENCY]}
      baseRoute="/dashboard/office/wireman/purchase-estimates"
      supplierFilterKeyword="wireman"
      themeColor="slate"
    />
  );
}
