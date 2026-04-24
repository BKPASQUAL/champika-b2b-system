"use client";

import { Zap } from "lucide-react";
import { ChequeManagementPage } from "../../_components/ChequeManagementPage";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function WiremanChequeManagementPage() {
  return (
    <ChequeManagementPage
      defaultBusinessId={BUSINESS_IDS.WIREMAN_AGENCY}
      portalName="Wireman Agency"
      themeColor="red"
      Icon={Zap}
    />
  );
}
