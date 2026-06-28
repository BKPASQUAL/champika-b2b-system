"use client";

import dynamic from "next/dynamic";
import { Customer } from "../types";

// Leaflet must be loaded client-side only
const MapInner = dynamic(() => import("./CustomerMapInner"), { ssr: false });

interface Props {
  customers: Customer[];
}

export function CustomerMap({ customers }: Props) {
  const withCoords = customers.filter(
    (c) => c.latitude != null && c.longitude != null
  );

  return (
    <div className="relative w-full rounded-md overflow-hidden border bg-slate-50" style={{ height: 520 }}>
      {withCoords.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
          <span className="text-4xl">📍</span>
          <p className="text-sm font-medium">No customers with location data</p>
          <p className="text-xs">Add latitude & longitude to customers to see them on the map</p>
        </div>
      ) : (
        <MapInner customers={withCoords} />
      )}
    </div>
  );
}
