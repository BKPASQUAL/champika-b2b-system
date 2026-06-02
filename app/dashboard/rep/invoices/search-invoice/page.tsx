"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { InvoiceSearchBar } from "@/components/ui/InvoiceSearchBar";

export default function RepSearchInvoicePage() {
  const router = useRouter();
  const [repId] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("currentUser");
      if (stored) {
        try { return JSON.parse(stored).id as string; } catch { return ""; }
      }
    }
    return "";
  });

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
        repId={repId}
        portalInvoicePath="/dashboard/rep/invoices"
      />
    </div>
  );
}
