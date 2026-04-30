"use client";

import { Warehouse } from "lucide-react";
import { ChequeReportPage } from "../../../_components/ChequeReportPage";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function DistributionChequeReportPage() {
  return (
    <ChequeReportPage
      defaultBusinessId={BUSINESS_IDS.CHAMPIKA_DISTRIBUTION}
      portalName="Champika Distribution"
      themeColor="blue"
      Icon={Warehouse}
    />
  );
}
