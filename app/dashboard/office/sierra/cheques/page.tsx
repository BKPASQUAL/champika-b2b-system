"use client";

import { Mountain } from "lucide-react";
import { ChequeManagementPage } from "../../_components/ChequeManagementPage";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function SierraChequeManagementPage() {
  return (
    <ChequeManagementPage
      defaultBusinessId={BUSINESS_IDS.SIERRA_AGENCY}
      portalName="Sierra Agency"
      themeColor="purple"
      Icon={Mountain}
    />
  );
}
