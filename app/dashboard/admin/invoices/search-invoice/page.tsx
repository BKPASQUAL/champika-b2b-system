"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { InvoiceSearchBar } from "@/components/ui/InvoiceSearchBar";

export default function AdminSearchInvoicePage() {
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
            Find any customer bill by invoice number
          </p>
        </div>
      </div>

      <InvoiceSearchBar portalInvoicePath="/dashboard/admin/invoices" />
    </div>
  );
}
