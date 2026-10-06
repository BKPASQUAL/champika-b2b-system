"use client";

import { Mountain } from "lucide-react";
import { ChequeSettlementReportPage } from "../../../_components/ChequeSettlementReportPage";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function SierraChequeSettlementReportPage() {
  return (
    <ChequeSettlementReportPage
      defaultBusinessId={BUSINESS_IDS.SIERRA_AGENCY}
      portalName="Sierra Agency"
      themeColor="purple"
      Icon={Mountain}
      managementHref="/dashboard/office/sierra/cheques"
      reportHref="/dashboard/office/sierra/cheques/report"
    />
  );
}
