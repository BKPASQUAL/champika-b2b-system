"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { InvoiceSearchBar } from "@/components/ui/InvoiceSearchBar";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export default function WiremanSearchInvoicePage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Search Invoice</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Find a customer bill by invoice number
          </p>
        </div>
      </div>

      <InvoiceSearchBar
        businessId={BUSINESS_IDS.WIREMAN_AGENCY}
        portalInvoicePath="/dashboard/office/wireman/invoices"
      />
    </div>
  );
}
