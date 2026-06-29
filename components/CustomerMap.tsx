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

interface StopEvent {
  latitude: number;
  longitude: number;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}

function detectStops(points: VehicleLocation[]): StopEvent[] {
  const stops: StopEvent[] = [];
  
  if (points.length === 0) return stops;
  
  // If there is only 1 point and it is stationary, treat it as a stop
  if (points.length === 1 && points[0].speed < 2) {
    stops.push({
      latitude: points[0].latitude,
      longitude: points[0].longitude,
      startTime: new Date(points[0].updated_at),
      endTime: new Date(points[0].updated_at),
      durationMinutes: 0,
    });
    return stops;
  }

  let stationarySegment: VehicleLocation[] = [];

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const isStationary = pt.speed < 2;

    if (isStationary) {
      stationarySegment.push(pt);
    } else {
      if (stationarySegment.length > 0) {
        const first = stationarySegment[0];
        const last = stationarySegment[stationarySegment.length - 1];
        const durationMs = new Date(last.updated_at).getTime() - new Date(first.updated_at).getTime();
        
        if (durationMs >= 3 * 60 * 1000) { // 3 minutes threshold
          stops.push({
            latitude: first.latitude,
            longitude: first.longitude,
            startTime: new Date(first.updated_at),
            endTime: new Date(last.updated_at),
            durationMinutes: Math.round(durationMs / (60 * 1000)),
          });
        }
        stationarySegment = [];
      }
    }
  }

  // Handle final segment if it was stationary at the end of the day
  if (stationarySegment.length > 0) {
    const first = stationarySegment[0];
    const last = stationarySegment[stationarySegment.length - 1];
    const durationMs = new Date(last.updated_at).getTime() - new Date(first.updated_at).getTime();
    
    if (durationMs >= 3 * 60 * 1000) {
      stops.push({
        latitude: first.latitude,
        longitude: first.longitude,
        startTime: new Date(first.updated_at),
        endTime: new Date(last.updated_at),
        durationMinutes: Math.round(durationMs / (60 * 1000)),
      });
    }
  }

  return stops;
}

interface CustomerMapProps {
  customers: Customer[];
  focusedCustomerId?: string | null;
  height?: string;
  vehicles?: Vehicle[];
  focusedVehicleId?: string | null;
  historyRoute?: VehicleLocation[];
}

export default function CustomerMap({
  customers,
  focusedCustomerId = null,
  height = "450px",
  vehicles = [],
  focusedVehicleId = null,
  historyRoute = [],
}: CustomerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const hasInitialFitBoundsRef = useRef(false);
  const lastFocusedCustomerIdRef = useRef<string | null>(null);
  const lastFocusedVehicleIdRef = useRef<string | null>(null);

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

    const createTruckIcon = (color: string) => {
      return L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" class="w-9 h-9 drop-shadow-md border-2 border-white rounded-full bg-white/90 p-1"><path d="M19 13v-2.268a2 2 0 0 0-.829-1.63L15 7.158V6a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1.17a3 3 0 0 0 5.66 0H14.17a3 3 0 0 0 5.66 0H21a1 1 0 0 0 1-1v-3h-3zm-11 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" /></svg>`,
        className: "custom-map-truck-icon",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });
    };

    const blueIcon = createSvgIcon("#2563eb");
    const redIcon = createSvgIcon("#dc2626");
    const truckIcon = createTruckIcon("#3b82f6");
    const activeTruckIcon = createTruckIcon("#ef4444");
    
    const stopIcon = L.divIcon({
      html: `<div style="height: 24px; width: 24px; border-radius: 50%; background-color: #ef4444; border: 2px solid white; color: white; font-size: 11px; font-weight: 900; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-family: sans-serif; cursor: pointer;">P</div>`,
      className: "history-stop-icon",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    });

    let focusedMarker: any = null;

    // Draw shop locations
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

    // Draw active delivery trucks
    const vehiclesWithCoordinates = vehicles.filter(
      (v) => v.location && v.location.latitude !== null && v.location.longitude !== null
    );

    vehiclesWithCoordinates.forEach((v) => {
      const lat = v.location!.latitude;
      const lng = v.location!.longitude;
      const isFocused = focusedVehicleId === v.id;

      const marker = L.marker([lat, lng], {
        icon: isFocused ? activeTruckIcon : truckIcon,
      });

      const popupHtml = `
        <div style="font-family: inherit; font-size: 13px; line-height: 1.4; color: #1f2937; padding: 4px; min-width: 180px;">
          <h4 style="font-size: 14px; font-weight: 700; color: #1e3a8a; margin: 0 0 6px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
            🚚 ${v.vehicleNumber}
          </h4>
          <p style="margin: 3px 0;"><b>Driver:</b> ${v.driverName || "Unassigned"}</p>
          <p style="margin: 3px 0;"><b>Speed:</b> ${v.location!.speed.toFixed(0)} km/h</p>
          <p style="margin: 3px 0;"><b>IMEI:</b> ${v.deviceId || "N/A"}</p>
          <p style="margin: 3px 0; font-size: 10px; color: #6b7280;">
            <b>Last Signal:</b> ${new Date(v.location!.updated_at).toLocaleTimeString()}
          </p>
          <div style="margin-top: 10px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" 
               target="_blank" 
               rel="noopener noreferrer" 
               style="display: block; width: 100%; text-align: center; background-color: #2563eb; color: white; font-weight: 600; padding: 6px 0; border-radius: 4px; text-decoration: none; font-size: 12px;">
              Get Route to Truck
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      // Show vehicle plate permanently on top of the truck pin
      marker.bindTooltip(v.vehicleNumber, {
        permanent: true,
        direction: "top",
        offset: [0, -18],
        className: "bg-blue-600 border border-blue-700 text-white font-extrabold px-1.5 py-0.5 rounded shadow-md text-[10px] whitespace-nowrap pointer-events-none",
      });

      marker.addTo(markersGroup);

      if (isFocused) {
        focusedMarker = marker;
      }
    });

    // Draw history route polyline if provided
    if (historyRoute && historyRoute.length > 0) {
      const latlngs = historyRoute
        .filter((pt) => pt.latitude && pt.longitude)
        .map((pt) => [pt.latitude, pt.longitude] as [number, number]);
      
      // Draw driving line path with a clear solid orange line
      L.polyline(latlngs, {
        color: "#f97316", // Orange
        weight: 6,
        opacity: 0.9,
      }).addTo(markersGroup);

      // Draw START marker pin (using inline styles to bypass Tailwind processing inside Leaflet)
      const startPt = historyRoute[0];
      const startMarker = L.marker([startPt.latitude, startPt.longitude], {
        icon: L.divIcon({
          html: `<div style="height: 20px; width: 45px; border-radius: 4px; background-color: #10b981; border: 1px solid white; color: white; font-size: 9px; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.25);">START</div>`,
          className: "history-start-marker",
          iconSize: [45, 20],
          iconAnchor: [22, 10],
        }),
      });
      startMarker.bindPopup(`<b>Route Start:</b> ${new Date(startPt.updated_at).toLocaleTimeString()}`);
      startMarker.addTo(markersGroup);

      // Draw END marker pin (using inline styles)
      const endPt = historyRoute[historyRoute.length - 1];
      const endMarker = L.marker([endPt.latitude, endPt.longitude], {
        icon: L.divIcon({
          html: `<div style="height: 20px; width: 45px; border-radius: 4px; background-color: #ef4444; border: 1px solid white; color: white; font-size: 9px; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.25);">END</div>`,
          className: "history-end-marker",
          iconSize: [45, 20],
          iconAnchor: [22, 10],
        }),
      });
      endMarker.bindPopup(`<b>Route End:</b> ${new Date(endPt.updated_at).toLocaleTimeString()}`);
      endMarker.addTo(markersGroup);

      // Detect and draw stops (parking segments where speed < 2 km/h for >= 3 minutes)
      const stops = detectStops(historyRoute);
      stops.forEach((stop) => {
        const stopMarker = L.marker([stop.latitude, stop.longitude], {
          icon: stopIcon,
        });
        
        const durationText = stop.durationMinutes === 0 
          ? "Stationary/Parked" 
          : `${stop.durationMinutes} mins`;

        const stopPopupHtml = `
          <div style="font-family: inherit; font-size: 13px; line-height: 1.4; color: #1f2937; padding: 4px; min-width: 160px;">
            <h4 style="font-size: 14px; font-weight: 700; color: #ef4444; margin: 0 0 6px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; display: flex; align-items: center; gap: 4px;">
              🅿️ Parking Stop
            </h4>
            <p style="margin: 3px 0;"><b>Duration:</b> ${durationText}</p>
            <p style="margin: 3px 0;"><b>Arrived:</b> ${stop.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p style="margin: 3px 0;"><b>Departed:</b> ${stop.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        `;
        stopMarker.bindPopup(stopPopupHtml);
        stopMarker.addTo(markersGroup);
      });
    }

    // Handle view adjustment
    const focusChanged = 
      focusedCustomerId !== lastFocusedCustomerIdRef.current || 
      focusedVehicleId !== lastFocusedVehicleIdRef.current;

    if (historyRoute && historyRoute.length > 0) {
      // Prioritize route bounds if history route is active
      const routeBounds = L.latLngBounds(historyRoute.map(pt => [pt.latitude, pt.longitude]));
      if (routeBounds.isValid()) {
        map.fitBounds(routeBounds, { padding: [50, 50] });
      }
    } else if (focusedMarker && focusChanged) {
      setTimeout(() => {
        focusedMarker.openPopup();
        map.setView(focusedMarker.getLatLng(), 14);
      }, 100);
      lastFocusedCustomerIdRef.current = focusedCustomerId;
      lastFocusedVehicleIdRef.current = focusedVehicleId;
    } else if (!hasInitialFitBoundsRef.current && markersGroup.getBounds().isValid()) {
      map.fitBounds(markersGroup.getBounds(), { padding: [40, 40] });
      hasInitialFitBoundsRef.current = true;
    }

  }, [leafletLoaded, customers, focusedCustomerId, vehicles, focusedVehicleId, historyRoute]);

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
