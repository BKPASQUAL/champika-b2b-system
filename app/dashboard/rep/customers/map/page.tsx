// app/dashboard/rep/customers/map/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Map } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import dynamic from "next/dynamic";

const CustomerMap = dynamic(() => import("@/components/CustomerMap"), {
  ssr: false,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

interface VehicleLocation {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  battery_level: number | null;
  updated_at: string;
}

interface Vehicle {
  id: string;
  vehicleNumber: string;
  driverName: string | null;
  deviceId: string | null;
  status: string;
  location: VehicleLocation | null;
}

function MapContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
  const focusVehicleId = searchParams.get("focusVehicle");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyData = async () => {
      try {
        setLoading(true);
        const storedUser = localStorage.getItem("currentUser");
        if (!storedUser) {
          toast.error("User session not found. Please login again.");
          return;
        }

        const userObj = JSON.parse(storedUser);
        let rid = userObj.id;

        if (!rid) {
          const userRes = await fetch("/api/users");
          const users = await userRes.json();
          const me = users.find((u: any) => u.email === userObj.email);
          if (me) {
            rid = me.id;
          }
        }

        if (!rid) {
          toast.error("Could not identify sales representative account.");
          return;
        }

        const [custRes, vehRes] = await Promise.all([
          fetch(`/api/customers?repId=${rid}`),
          fetch("/api/vehicles"),
        ]);

        if (!custRes.ok) throw new Error("Failed to load customers");
        if (!vehRes.ok) throw new Error("Failed to load fleet");

        const custData = await custRes.json();
        const vehData = await vehRes.json();

        setCustomers(custData);
        setVehicles(vehData);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load map data");
      } finally {
        setLoading(false);
      }
    };

    fetchMyData();
  }, []);

  // Subscribe to real-time coordinates
  useEffect(() => {
    const channel = supabase
      .channel("rep-fleet-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vehicle_locations" },
        (payload) => {
          const newLoc = payload.new as VehicleLocation & { vehicle_id: string };
          setVehicles((prev) =>
            prev.map((v) =>
              v.id === newLoc.vehicle_id
                ? { ...v, location: newLoc }
                : v
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
  const focusedVehicle = vehicles.find(v => v.id === focusVehicleId);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/dashboard/rep/customers")}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-blue-900">
              <Map className="h-6 w-6 text-blue-600" />{" "}
              {focusedShop ? focusedShop.shopName : focusedVehicle ? `Vehicle ${focusedVehicle.vehicleNumber}` : "Shops Location Map"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {focusedShop
                ? `Showing location details for ${focusedShop.shopName} (${focusedShop.route || 'General'})`
                : focusedVehicle
                ? `Tracking vehicle: ${focusedVehicle.vehicleNumber} — Speed: ${focusedVehicle.location?.speed?.toFixed(0) || '0'} km/h`
                : `Displaying ${shopsWithLocation.length} of ${customers.length} registered shops`}
            </p>
          </div>
        </div>
        <Button onClick={() => router.push("/dashboard/rep/customers")} variant="outline" className="text-xs">
          View List
        </Button>
      </div>

      <div className="flex-1 min-h-0 bg-slate-50 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
        <CustomerMap
          customers={customers}
          focusedCustomerId={focusId}
          height="calc(100vh - 200px)"
          vehicles={vehicles}
          focusedVehicleId={focusVehicleId}
        />
      </div>
    </div>
  );
}

export default function RepCustomersMapPage() {
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
