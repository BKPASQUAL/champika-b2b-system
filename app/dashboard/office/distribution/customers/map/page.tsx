// app/dashboard/office/distribution/customers/map/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Map } from "lucide-react";
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import dynamic from "next/dynamic";

const CustomerMap = dynamic(() => import("@/components/CustomerMap"), {
  ssr: false,
});

interface Customer {
  id: string;
  customerId: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  route: string;
  status: string;
  creditLimit: number;
  outstandingBalance: number;
  lastOrderDate: string;
  latitude?: number | null;
  longitude?: number | null;
}

function MapContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const distributionBusinessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/customers?businessId=${distributionBusinessId}`);
        if (!res.ok) throw new Error("Failed to load customers");

        const data = await res.json();
        setCustomers(data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load customer locations");
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [distributionBusinessId]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-32 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Loading Shop Coordinates...</p>
      </div>
    );
  }

  const shopsWithLocation = customers.filter(c => c.latitude !== null && c.longitude !== null);
  const focusedShop = customers.find(c => c.id === focusId);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/dashboard/office/distribution/customers")}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-blue-900 flex items-center gap-2">
              <Map className="h-6 w-6 text-blue-600" /> {focusedShop ? focusedShop.shopName : "Distribution Shops Map"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {focusedShop
                ? `Showing location details for ${focusedShop.shopName} (${focusedShop.route || 'General'})`
                : `Displaying ${shopsWithLocation.length} of ${customers.length} registered distribution shops`}
            </p>
          </div>
        </div>
        <Button onClick={() => router.push("/dashboard/office/distribution/customers")} variant="outline" className="text-xs">
          View List
        </Button>
      </div>

      <div className="flex-1 min-h-0 bg-slate-50 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
        <CustomerMap
          customers={customers}
          focusedCustomerId={focusId}
          height="calc(100vh - 200px)"
        />
      </div>
    </div>
  );
}

export default function DistributionCustomersMapPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col justify-center items-center py-32 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Loading Map...</p>
      </div>
    }>
      <MapContent />
    </Suspense>
  );
}
