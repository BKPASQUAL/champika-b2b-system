"use client";

import { Store } from "lucide-react";
import { ChequeReportPage } from "../../../_components/ChequeReportPage";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function OrangeChequeReportPage() {
  return (
    <ChequeReportPage
      defaultBusinessId={BUSINESS_IDS.ORANGE_AGENCY}
      portalName="Orange Agency"
      themeColor="orange"
      Icon={Store}
    />
  );
}
