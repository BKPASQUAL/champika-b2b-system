"use client";

import { CreditCard } from "lucide-react";
import { ChequeManagementPage } from "@/app/dashboard/office/_components/ChequeManagementPage";

export default function AdminChequeManagementPage() {
  return (
    <ChequeManagementPage
      portalName="Admin — All Portals"
      themeColor="gray"
      Icon={CreditCard}
    />
  );
}
