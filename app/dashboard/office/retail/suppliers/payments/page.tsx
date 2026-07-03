"use client";

import { SupplierPaymentsPage } from "@/app/dashboard/office/_components/SupplierPaymentsPage";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function RetailSupplierPaymentsPage() {
  return (
    <SupplierPaymentsPage
      defaultBusinessId={BUSINESS_IDS.CHAMPIKA_RETAIL}
      routePrefix="/dashboard/office/retail"
    />
  );
}
