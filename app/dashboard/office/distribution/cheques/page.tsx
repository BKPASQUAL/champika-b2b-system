"use client";

import { Warehouse } from "lucide-react";
import { ChequeManagementPage } from "../../_components/ChequeManagementPage";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function DistributionChequeManagementPage() {
  return (
    <ChequeManagementPage
      defaultBusinessId={BUSINESS_IDS.CHAMPIKA_DISTRIBUTION}
      portalName="Champika Distribution"
      themeColor="blue"
      Icon={Warehouse}
    />
  );
}
