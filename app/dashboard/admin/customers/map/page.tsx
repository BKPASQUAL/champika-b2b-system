"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCachedFetch } from "@/hooks/useCachedFetch";
import { Customer } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CustomerMapInner = dynamic(
  () => import("../_components/CustomerMapInner"),
  { ssr: false }
);

export default function CustomerMapPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");

  const { data: customers = [], loading } = useCachedFetch<Customer[]>(
    "/api/customers",
    [],
    () => toast.error("Failed to load customers")
  );

  const routes = useMemo(
    () => ["all", ...Array.from(new Set(customers.map((c) => c.route))).sort()],
    [customers]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return customers.filter((c) => {
      const matchSearch =
        !q ||
        c.shopName.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q) ||
        c.route.toLowerCase().includes(q);
      const matchRoute = routeFilter === "all" || c.route === routeFilter;
      return matchSearch && matchRoute;
    });
  }, [customers, searchQuery, routeFilter]);

  const withCoords = useMemo(
    () => filtered.filter((c) => c.latitude != null && c.longitude != null),
    [filtered]
  );

  return (
    <div className="-m-4 md:-m-8 flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b z-10 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/admin/customers")}
          className="gap-1.5 text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="w-px h-5 bg-slate-200" />
        <h1 className="font-semibold text-slate-800 text-sm">Customer Map</h1>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search shop, owner, route..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm bg-slate-50 border-slate-200"
          />
        </div>
        <Select value={routeFilter} onValueChange={setRouteFilter}>
          <SelectTrigger className="w-36 h-8 text-sm bg-slate-50 border-slate-200">
            <SelectValue placeholder="All Routes" />
          </SelectTrigger>
          <SelectContent>
            {routes.map((r) => (
              <SelectItem key={r} value={r}>
                {r === "all" ? "All Routes" : r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {withCoords.length} of {filtered.length} customers on map
        </span>
      </div>

      {/* Map area */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full bg-slate-50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : withCoords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full bg-slate-50 gap-3">
            <span className="text-5xl">📍</span>
            <p className="text-sm font-medium text-slate-700">No customers with location data</p>
            <p className="text-xs text-muted-foreground">
              Add latitude & longitude to customers to see them here
            </p>
          </div>
        ) : (
          <CustomerMapInner customers={withCoords} />
        )}
      </div>
    </div>
  );
}
