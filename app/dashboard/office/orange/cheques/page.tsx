"use client";

import { Store } from "lucide-react";
import { ChequeManagementPage } from "../../_components/ChequeManagementPage";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function OrangeChequeManagementPage() {
  return (
    <ChequeManagementPage
      defaultBusinessId={BUSINESS_IDS.ORANGE_AGENCY}
      portalName="Orange Agency"
      themeColor="orange"
      Icon={Store}
    />
  );
}
