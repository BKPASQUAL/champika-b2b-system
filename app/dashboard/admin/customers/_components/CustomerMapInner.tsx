"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Customer } from "../types";

// Fix Leaflet's broken default icon paths in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function routeColor(route: string) {
  const palette = [
    "#2563eb", "#16a34a", "#dc2626", "#9333ea",
    "#ea580c", "#0891b2", "#65a30d", "#db2777",
  ];
  let hash = 0;
  for (let i = 0; i < route.length; i++) hash = route.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function makeIcon(route: string) {
  const color = routeColor(route);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
}

interface Props {
  customers: Customer[];
}

export default function CustomerMapInner({ customers }: Props) {
  const center: [number, number] = [
    customers.reduce((s, c) => s + (c.latitude ?? 0), 0) / customers.length,
    customers.reduce((s, c) => s + (c.longitude ?? 0), 0) / customers.length,
  ];

  return (
    <MapContainer
      center={center}
      zoom={11}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {customers.map((c) => (
        <Marker
          key={c.id}
          position={[c.latitude!, c.longitude!]}
          icon={makeIcon(c.route)}
        >
          <Popup minWidth={180}>
            <div className="text-sm space-y-1">
              <p className="font-bold text-slate-900">{c.shopName}</p>
              <p className="text-slate-600">{c.ownerName}</p>
              <p className="text-xs text-slate-500">{c.address}</p>
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded"
                  style={{
                    background: routeColor(c.route) + "22",
                    color: routeColor(c.route),
                  }}
                >
                  {c.route}
                </span>
                {(c.outstandingBalance ?? 0) > 0 && (
                  <span className="text-xs text-red-600 font-semibold">
                    Due: LKR {c.outstandingBalance.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
