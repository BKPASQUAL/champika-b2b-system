"use client";

import { ChequeCalendarView } from "@/components/cheque-calendar";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

export default function DistributionChequeCalendarPage() {
  return (
    <ChequeCalendarView
      businessId={BUSINESS_IDS.CHAMPIKA_DISTRIBUTION}
      portalName={BUSINESS_NAMES[BUSINESS_IDS.CHAMPIKA_DISTRIBUTION]}
    />
  );
}
