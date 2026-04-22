"use client";

import { ChequeCalendarView } from "@/components/cheque-calendar";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

export default function OrangeChequeCalendarPage() {
  return (
    <ChequeCalendarView
      businessId={BUSINESS_IDS.ORANGE_AGENCY}
      portalName={BUSINESS_NAMES[BUSINESS_IDS.ORANGE_AGENCY]}
    />
  );
}
