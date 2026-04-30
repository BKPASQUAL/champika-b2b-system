"use client";

import { CreditCard } from "lucide-react";
import { ChequeReportPage } from "@/app/dashboard/office/_components/ChequeReportPage";

export default function AdminChequeReportPage() {
  return (
    <ChequeReportPage
      portalName="Admin — All Portals"
      themeColor="gray"
      Icon={CreditCard}
    />
  );
}
