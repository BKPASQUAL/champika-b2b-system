"use client";

import { ChequeCalendarView } from "@/components/cheque-calendar";
import { BUSINESS_IDS, BUSINESS_NAMES } from "@/app/config/business-constants";

export default function WiremanChequeCalendarPage() {
  return (
    <ChequeCalendarView
      businessId={BUSINESS_IDS.WIREMAN_AGENCY}
      portalName={BUSINESS_NAMES[BUSINESS_IDS.WIREMAN_AGENCY]}
    />
  );
}
