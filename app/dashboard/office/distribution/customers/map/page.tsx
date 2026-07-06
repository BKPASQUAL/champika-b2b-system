// app/dashboard/office/distribution/customers/map/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Map, History, Play, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { createClient } from "@supabase/supabase-js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  const loadIdParam = searchParams.get("loadId");
  const historyParam = searchParams.get("history");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNamesAlways, setShowNamesAlways] = useState(true);
  const distributionBusinessId = BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  // History states
  const [historyMode, setHistoryMode] = useState(false);
  const [selectedHistoryVehicleId, setSelectedHistoryVehicleId] = useState<string>("");
  const [historyDate, setHistoryDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [historyRoute, setHistoryRoute] = useState<VehicleLocation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Trip selection states
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [loadingTrips, setLoadingTrips] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [custRes, vehRes] = await Promise.all([
          fetch(`/api/customers?businessId=${distributionBusinessId}`),
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

    fetchData();
  }, [distributionBusinessId]);

  // Subscribe to real-time updates for vehicle coordinates
  useEffect(() => {
    const channel = supabase
      .channel("live-fleet-updates")
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

  // Helper to normalize lorry numbers (e.g. "CBD-2564" or "CBD 2564" -> "cbd2564")
  const normalizePlate = (str: string) => (str || "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();

  // Fetch loading sheets list when history mode is active or loadId is passed
  useEffect(() => {
    if (!historyMode && !loadIdParam) return;
    const fetchTrips = async () => {
      try {
        setLoadingTrips(true);
        const res = await fetch("/api/orders/loading/history");
        if (res.ok) {
          const data = await res.json();
          setTrips(data);
        }
      } catch (err) {
        console.error("Failed to fetch history trips:", err);
      } finally {
        setLoadingTrips(false);
      }
    };
    fetchTrips();
  }, [historyMode, loadIdParam]);

  // Handle URL query parameter loadId tracking automatically
  useEffect(() => {
    if (!loadIdParam || vehicles.length === 0 || trips.length === 0) return;
    
    const targetTrip = trips.find(t => t.id === loadIdParam);
    if (!targetTrip) return;
    
    setHistoryMode(true);
    if (targetTrip.loadingDate) {
      setHistoryDate(targetTrip.loadingDate);
    }
    
    const matchingVehicle = vehicles.find(
      (v) => normalizePlate(v.vehicleNumber) === normalizePlate(targetTrip.lorryNumber)
    );
    if (matchingVehicle) {
      setSelectedHistoryVehicleId(matchingVehicle.id);
    }
    
    setSelectedTripId(targetTrip.id);
  }, [loadIdParam, vehicles, trips]);

  // Compute filtered trips for vehicle on the selected date
  const selectedVehicleObj = vehicles.find(v => v.id === selectedHistoryVehicleId);
  const vehiclePlate = selectedVehicleObj?.vehicleNumber || "";
  const filteredTrips = trips.filter(t => {
    if (t.loadingDate !== historyDate) return false;
    if (vehiclePlate && t.lorryNumber) {
      return normalizePlate(t.lorryNumber) === normalizePlate(vehiclePlate);
    }
    return true;
  });

  const fetchHistoryRoute = async (overrideVehicleId?: string) => {
    const vehicleId = overrideVehicleId || selectedHistoryVehicleId;
    if (!vehicleId) {
      toast.error("Please select a vehicle first.");
      return;
    }
    try {
      setLoadingHistory(true);
      
      const activeTrip = selectedTripId && selectedTripId !== "full-day"
        ? trips.find(t => t.id === selectedTripId)
        : null;

      let start = "";
      let end = "";

      if (activeTrip) {
        const tripStart = activeTrip.dispatchedAt || activeTrip.createdAt;
        if (!tripStart) {
          toast.error("Trip dispatch time not recorded.");
          setLoadingHistory(false);
          return;
        }
        start = new Date(tripStart).toISOString();
        if (activeTrip.status === "Completed" && activeTrip.completedAt) {
          end = new Date(activeTrip.completedAt).toISOString();
        } else {
          // If still In Transit, track live until now
          end = new Date().toISOString();
        }
      } else {
        const startObj = new Date(`${historyDate}T00:00:00`);
        const endObj = new Date(`${historyDate}T23:59:59.999`);
        start = isNaN(startObj.getTime()) ? `${historyDate}T00:00:00.000Z` : startObj.toISOString();
        end = isNaN(endObj.getTime()) ? `${historyDate}T23:59:59.999Z` : endObj.toISOString();
      }

      console.log(`[Route Query] Fetching route: start="${start}", end="${end}"`);
      const res = await fetch(`/api/vehicles/${vehicleId}/history?start=${start}&end=${end}`);
      if (!res.ok) throw new Error("Failed to load historical route");

      const data = await res.json();
      setHistoryRoute(data);
      if (data.length === 0) {
        toast.info("No GPS coordinates recorded for this vehicle during the selected timeframe.");
      } else {
        toast.success(`Loaded ${data.length} route coordinates.`);
      }
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to load history route.");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Automatically trigger history mode and load route if history=true and focusVehicle is present
  useEffect(() => {
    if (!loading && historyParam === "true" && focusVehicleId && vehicles.length > 0) {
      const match = vehicles.find(v => v.id === focusVehicleId);
      if (match) {
        setHistoryMode(true);
        setSelectedHistoryVehicleId(focusVehicleId);
        fetchHistoryRoute(focusVehicleId);
      }
    }
  }, [loading, historyParam, focusVehicleId, vehicles]);

  const shopsWithLocation = customers.filter(c => c.latitude !== null && c.longitude !== null);
  const focusedShop = customers.find(c => c.id === focusId);
  const focusedVehicle = vehicles.find(v => v.id === focusVehicleId);
  const activeHistoryVehicle = vehicles.find(v => v.id === selectedHistoryVehicleId);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
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
              <Map className="h-6 w-6 text-blue-600" />{" "}
              {historyMode
                ? `Route History: ${activeHistoryVehicle?.vehicleNumber || "Select Truck"}`
                : focusedShop
                ? focusedShop.shopName
                : focusedVehicle
                ? `Vehicle ${focusedVehicle.vehicleNumber}`
                : "Distribution Shops Map"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {historyMode
                ? `Viewing driving route path logs for ${activeHistoryVehicle?.vehicleNumber || 'the selected truck'} on ${historyDate}`
                : focusedShop
                ? `Showing location details for ${focusedShop.shopName} (${focusedShop.route || 'General'})`
                : focusedVehicle
                ? `Tracking vehicle driver: ${focusedVehicle.driverName || 'Unassigned'} — Speed: ${focusedVehicle.location?.speed?.toFixed(0) || '0'} km/h`
                : `Displaying ${shopsWithLocation.length} shops and ${vehicles.filter(v => v.location).length} active delivery trucks`}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setShowNamesAlways(!showNamesAlways)}
            variant="outline"
            className={`text-xs gap-1.5 transition-all ${
              showNamesAlways 
                ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800" 
                : "text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {showNamesAlways ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Names: Always Show</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Names: Show on Hover</span>
              </>
            )}
          </Button>

          {!historyMode ? (
            <>
              <Button
                onClick={() => setHistoryMode(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs"
              >
                <History className="w-4 h-4 mr-2" /> Route History
              </Button>
              <Button onClick={() => router.push("/dashboard/office/distribution/vehicles")} variant="outline" className="text-xs">
                Manage Fleet
              </Button>
              <Button onClick={() => router.push("/dashboard/office/distribution/customers")} variant="outline" className="text-xs">
                View List
              </Button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <Select
                value={selectedHistoryVehicleId}
                onValueChange={(val) => {
                  setSelectedHistoryVehicleId(val);
                  setHistoryRoute([]);
                  setSelectedTripId("");
                }}
              >
                <SelectTrigger className="w-40 h-8 text-xs bg-white">
                  <SelectValue placeholder="Select Vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.vehicleNumber} ({v.driverName || "Driver"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={historyDate}
                onChange={(e) => {
                  setHistoryDate(e.target.value);
                  setHistoryRoute([]);
                  setSelectedTripId("");
                }}
                className="w-36 h-8 text-xs bg-white"
              />

              {/* Trip selector dropdown */}
              {selectedHistoryVehicleId && filteredTrips.length > 0 && (
                <Select
                  value={selectedTripId || "full-day"}
                  onValueChange={(val) => {
                    setSelectedTripId(val);
                    setHistoryRoute([]);
                  }}
                >
                  <SelectTrigger className="w-44 h-8 text-xs bg-white border-blue-200">
                    <SelectValue placeholder="Full Day (No Trip)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-day">Full Day (No Trip)</SelectItem>
                    {filteredTrips.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.loadId} ({t.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                size="sm"
                onClick={() => fetchHistoryRoute()}
                disabled={loadingHistory || !selectedHistoryVehicleId}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loadingHistory ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 mr-1" />
                )}
                Load Route
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setHistoryMode(false);
                  setHistoryRoute([]);
                  setSelectedHistoryVehicleId("");
                  setSelectedTripId("");
                }}
                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-slate-50 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
        <CustomerMap
          customers={customers}
          focusedCustomerId={focusId}
          height="calc(100vh - 220px)"
          vehicles={vehicles}
          focusedVehicleId={focusVehicleId}
          historyRoute={historyRoute}
          showNamesAlways={showNamesAlways}
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
