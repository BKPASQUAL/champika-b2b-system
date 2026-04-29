"use client";

import { SupplierPaymentsPage } from "@/app/dashboard/office/_components/SupplierPaymentsPage";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function WiremanSupplierPaymentsPage() {
  return (
    <SupplierPaymentsPage
      defaultBusinessId={BUSINESS_IDS.WIREMAN_AGENCY}
      routePrefix="/dashboard/office/wireman"
    />
  );
}
