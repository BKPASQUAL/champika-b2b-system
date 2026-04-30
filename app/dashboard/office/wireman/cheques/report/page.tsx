"use client";

import { Zap } from "lucide-react";
import { ChequeReportPage } from "../../../_components/ChequeReportPage";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function WiremanChequeReportPage() {
  return (
    <ChequeReportPage
      defaultBusinessId={BUSINESS_IDS.WIREMAN_AGENCY}
      portalName="Wireman Agency"
      themeColor="red"
      Icon={Zap}
    />
  );
}
