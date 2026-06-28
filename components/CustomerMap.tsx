// components/CustomerMap.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface Customer {
  id: string;
  shopName: string;
  ownerName?: string;
  phone?: string;
  route?: string;
  outstandingBalance?: number;
  latitude?: number | null;
  longitude?: number | null;
}

interface CustomerMapProps {
  customers: Customer[];
  focusedCustomerId?: string | null;
  height?: string;
}

export default function CustomerMap({
  customers,
  focusedCustomerId = null,
  height = "450px",
}: CustomerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);

  // 1. Load Leaflet CDN Assets
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if Leaflet script already exists
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    const cssId = "leaflet-cdn-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }

    const scriptId = "leaflet-cdn-js";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.crossOrigin = "";
      script.async = true;
      script.onload = () => {
        setLeafletLoaded(true);
      };
      script.onerror = () => {
        setMapError("Failed to load map library (Leaflet CDN). Please check connection.");
      };
      document.body.appendChild(script);
    } else {
      // Script is loading or loaded
      const checkInterval = setInterval(() => {
        if ((window as any).L) {
          setLeafletLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }
  }, []);

  // 2. Initialize and Update Map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Filter customers with valid coordinates
    const customersWithCoordinates = customers.filter(
      (c) => c.latitude !== null && c.latitude !== undefined && c.longitude !== null && c.longitude !== undefined
    );

    // Initial map setup
    if (!mapInstanceRef.current) {
      const initialCenter = [7.8731, 80.7718]; // Sri Lanka center
      const initialZoom = 8;

      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
      }).setView(initialCenter, initialZoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapInstanceRef.current);

      markersGroupRef.current = L.featureGroup().addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;

    // Clear previous markers
    markersGroup.clearLayers();

    // SVG Marker templates (custom inline SVG icons so we don't depend on CDN image loading)
    const createSvgIcon = (color: string) => {
      return L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" class="w-8 h-8 drop-shadow-md"><path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" /></svg>`,
        className: "custom-map-marker-icon",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });
    };

    const blueIcon = createSvgIcon("#2563eb");
    const redIcon = createSvgIcon("#dc2626");

    let focusedMarker: any = null;

    customersWithCoordinates.forEach((customer) => {
      const lat = customer.latitude as number;
      const lng = customer.longitude as number;
      const isFocused = focusedCustomerId === customer.id;

      const marker = L.marker([lat, lng], {
        icon: isFocused ? redIcon : blueIcon,
      });

      const popupHtml = `
        <div style="font-family: inherit; font-size: 13px; line-height: 1.4; color: #1f2937; padding: 4px; min-width: 180px;">
          <h4 style="font-size: 14px; font-weight: 700; color: #1e3a8a; margin: 0 0 6px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
            ${customer.shopName}
          </h4>
          <p style="margin: 3px 0;"><b>Owner:</b> ${customer.ownerName || "N/A"}</p>
          <p style="margin: 3px 0;"><b>Phone:</b> ${customer.phone || "N/A"}</p>
          <p style="margin: 3px 0;"><b>Route:</b> ${customer.route || "General"}</p>
          <p style="margin: 3px 0; font-weight: 600; color: ${
            (customer.outstandingBalance || 0) > 0 ? "#dc2626" : "#4b5563"
          };">
            <b>Outstanding:</b> LKR ${(customer.outstandingBalance || 0).toLocaleString()}
          </p>
          <div style="margin-top: 10px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" 
               target="_blank" 
               rel="noopener noreferrer" 
               style="display: block; width: 100%; text-align: center; background-color: #2563eb; color: white; font-weight: 600; padding: 6px 0; border-radius: 4px; text-decoration: none; font-size: 12px; transition: background-color 0.2s;">
              Get Directions
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      
      // Show shop name permanently on top of the marker pin
      marker.bindTooltip(customer.shopName, {
        permanent: true,
        direction: "top",
        offset: [0, -32],
        className: "bg-white/95 border border-blue-200 text-blue-900 font-bold px-1.5 py-0.5 rounded shadow-md text-[10px] whitespace-nowrap pointer-events-none",
      });

      marker.addTo(markersGroup);

      if (isFocused) {
        focusedMarker = marker;
      }
    });

    // Handle view adjustment
    if (focusedMarker) {
      setTimeout(() => {
        focusedMarker.openPopup();
        map.setView(focusedMarker.getLatLng(), 14);
      }, 100);
    } else if (customersWithCoordinates.length > 0) {
      map.fitBounds(markersGroup.getBounds(), { padding: [40, 40] });
    }

  }, [leafletLoaded, customers, focusedCustomerId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (mapError) {
    return (
      <div className="w-full flex items-center justify-center bg-red-50 border border-red-200 rounded-lg p-6 text-red-600" style={{ height }}>
        <p className="text-sm font-medium">{mapError}</p>
      </div>
    );
  }

  if (!leafletLoaded) {
    return (
      <div className="w-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-lg p-6" style={{ height }}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
        <p className="text-sm text-slate-500 font-medium">Loading Map Assets...</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-slate-200 shadow-inner overflow-hidden">
      <div ref={mapContainerRef} style={{ width: "100%", height, zIndex: 1 }} />
    </div>
  );
}
