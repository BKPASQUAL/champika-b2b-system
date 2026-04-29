"use client";

import { SupplierPaymentsPage } from "@/app/dashboard/office/_components/SupplierPaymentsPage";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function SierraSupplierPaymentsPage() {
  return (
    <SupplierPaymentsPage
      defaultBusinessId={BUSINESS_IDS.SIERRA_AGENCY}
      routePrefix="/dashboard/office/sierra"
    />
  );
}
