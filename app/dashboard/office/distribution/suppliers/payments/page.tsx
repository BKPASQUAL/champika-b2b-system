"use client";

import { SupplierPaymentsPage } from "@/app/dashboard/office/_components/SupplierPaymentsPage";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function DistributionSupplierPaymentsPage() {
  return (
    <SupplierPaymentsPage
      defaultBusinessId={BUSINESS_IDS.CHAMPIKA_DISTRIBUTION}
      routePrefix="/dashboard/office/distribution"
    />
  );
}
