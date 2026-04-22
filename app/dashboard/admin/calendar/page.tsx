"use client";

// Admin cheque calendar — reuses the shared ChequeCalendarView component
import { ChequeCalendarView } from "@/components/cheque-calendar";

export default function AdminChequeCalendarPage() {
  return <ChequeCalendarView businessId="" portalName="All Businesses" />;
}
