"use client";

import { SupplierPaymentsPage } from "@/app/dashboard/office/_components/SupplierPaymentsPage";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function OrangeSupplierPaymentsPage() {
  return (
    <SupplierPaymentsPage
      defaultBusinessId={BUSINESS_IDS.ORANGE_AGENCY}
      routePrefix="/dashboard/office/orange"
    />
  );
}
