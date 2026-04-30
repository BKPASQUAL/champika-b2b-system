"use client";

import { Mountain } from "lucide-react";
import { ChequeReportPage } from "../../../_components/ChequeReportPage";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function SierraChequeReportPage() {
  return (
    <ChequeReportPage
      defaultBusinessId={BUSINESS_IDS.SIERRA_AGENCY}
      portalName="Sierra Agency"
      themeColor="purple"
      Icon={Mountain}
    />
  );
}
