// components/CustomerMap.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Compass } from "lucide-react";

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
  ignition?: boolean;
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
  focusedStop?: { latitude: number; longitude: number } | null;
}

export default function CustomerMap({
  customers,
  focusedCustomerId = null,
  height = "450px",
  vehicles = [],
  focusedVehicleId = null,
  historyRoute = [],
  focusedStop = null,
}: CustomerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const hasInitialFitBoundsRef = useRef(false);
  const lastFocusedCustomerIdRef = useRef<string | null>(null);
  const lastFocusedVehicleIdRef = useRef<string | null>(null);
  const lastHistoryRouteRef = useRef<string>("");

  // Map Layer selection
  const [mapLayerType, setMapLayerType] = useState<"streets" | "satellite" | "hybrid">("streets");
  const tileLayerRef = useRef<any>(null);

  // Playback control states
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const replayMarkerRef = useRef<any>(null);

  // Reset playback if route changes
  useEffect(() => {
    setIsReplaying(false);
    setReplayIndex(0);
  }, [historyRoute]);

  // 1. Load Leaflet CDN Assets
  useEffect(() => {
    if (typeof window === "undefined") return;

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

      tileLayerRef.current = L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
        attribution: "&copy; Google Maps",
      }).addTo(mapInstanceRef.current);

      markersGroupRef.current = L.featureGroup().addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;

    // Clear previous markers
    markersGroup.clearLayers();

    // SVG Marker templates
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

    const getTruckColor = (v: Vehicle, isFocused: boolean) => {
      if (isFocused) return "#ef4444";
      if (!v.location) return "#6b7280";
      
      const isEngineOn = v.location.ignition === true;
      const isMoving = v.location.speed > 2;
      
      if (isEngineOn) {
        return isMoving ? "#10b981" : "#f59e0b";
      }
      return "#3b82f6";
    };

    const blueIcon = createSvgIcon("#2563eb");
    const redIcon = createSvgIcon("#dc2626");
    
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

      const isEngineOn = v.location!.ignition === true;
      const isMoving = v.location!.speed > 2;
      
      let statusText = "Parked (Engine Off)";
      let statusColor = "#4b5563";
      if (isEngineOn) {
        if (isMoving) {
          statusText = "Moving";
          statusColor = "#10b981";
        } else {
          statusText = "Idling (Engine On)";
          statusColor = "#d97706";
        }
      }

      const truckColor = getTruckColor(v, isFocused);
      const truckIcon = createTruckIcon(truckColor);

      const marker = L.marker([lat, lng], {
        icon: truckIcon,
      });

      const popupHtml = `
        <div style="font-family: inherit; font-size: 13px; line-height: 1.4; color: #1f2937; padding: 4px; min-width: 180px;">
          <h4 style="font-size: 14px; font-weight: 700; color: #1e3a8a; margin: 0 0 6px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
            🚚 ${v.vehicleNumber}
          </h4>
          <p style="margin: 3px 0;"><b>Driver:</b> ${v.driverName || "Unassigned"}</p>
          <p style="margin: 3px 0;"><b>Engine Status:</b> <span style="font-weight: bold; color: ${statusColor};">${statusText}</span></p>
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

      marker.bindTooltip(`<div style="background-color: ${truckColor}; color: white; font-weight: 800; padding: 2px 6px; border-radius: 3px; font-size: 10px; border: 1px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">${v.vehicleNumber}</div>`, {
        permanent: true,
        direction: "top",
        offset: [0, -18],
        className: "bg-transparent border-none shadow-none p-0 pointer-events-none",
      });

      marker.addTo(markersGroup);

      if (isFocused) {
        focusedMarker = marker;
      }
    });

    // Draw history route polyline if provided
    if (historyRoute && historyRoute.length > 0) {
      // Draw driving line path with dynamic color segments (red for speeding > 60 km/h)
      for (let i = 0; i < historyRoute.length - 1; i++) {
        const pt1 = historyRoute[i];
        const pt2 = historyRoute[i + 1];
        if (pt1.latitude && pt1.longitude && pt2.latitude && pt2.longitude) {
          const isSpeeding = pt1.speed > 60 || pt2.speed > 60;
          L.polyline([[pt1.latitude, pt1.longitude], [pt2.latitude, pt2.longitude]], {
            color: isSpeeding ? "#ef4444" : "#f97316",
            weight: 6,
            opacity: 0.95,
          }).addTo(markersGroup);
        }
      }

      // Draw START marker pin
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

      // Draw END marker pin
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

      // Detect and draw stops
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

    const routeSerialized = historyRoute && historyRoute.length > 0 
      ? `${historyRoute.length}-${historyRoute[0].updated_at}-${historyRoute[historyRoute.length - 1].updated_at}`
      : "";
    const routeChanged = routeSerialized !== lastHistoryRouteRef.current;

    if (historyRoute && historyRoute.length > 0 && routeChanged) {
      const routeBounds = L.latLngBounds(historyRoute.map(pt => [pt.latitude, pt.longitude]));
      if (routeBounds.isValid()) {
        map.fitBounds(routeBounds, { padding: [50, 50] });
      }
      lastHistoryRouteRef.current = routeSerialized;
    } else if (focusedMarker && focusChanged) {
      setTimeout(() => {
        focusedMarker.openPopup();
        map.setView(focusedMarker.getLatLng(), 14);
      }, 100);
      lastFocusedCustomerIdRef.current = focusedCustomerId;
      lastFocusedVehicleIdRef.current = focusedVehicleId;
    } else if (!hasInitialFitBoundsRef.current && markersGroup.getBounds().isValid() && !focusedVehicleId && !focusedCustomerId) {
      map.fitBounds(markersGroup.getBounds(), { padding: [40, 40] });
      hasInitialFitBoundsRef.current = true;
    }

  }, [leafletLoaded, customers, focusedCustomerId, vehicles, focusedVehicleId, historyRoute]);

  // Center/zoom on stop location when selected from sidebar
  useEffect(() => {
    if (leafletLoaded && mapInstanceRef.current && focusedStop) {
      const L = (window as any).L;
      if (L) {
        mapInstanceRef.current.setView([focusedStop.latitude, focusedStop.longitude], 16);
      }
    }
  }, [leafletLoaded, focusedStop]);

  // Playback engine loop Effect
  useEffect(() => {
    if (!isReplaying || historyRoute.length === 0) {
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current);
      }
      return;
    }

    const intervalTime = Math.max(20, Math.min(500, 300 / replaySpeed));

    replayIntervalRef.current = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= historyRoute.length - 1) {
          setIsReplaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalTime);

    return () => {
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current);
      }
    };
  }, [isReplaying, replaySpeed, historyRoute]);

  // Update replaying marker on map
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current || !historyRoute || historyRoute.length === 0) {
      if (replayMarkerRef.current) {
        replayMarkerRef.current.remove();
        replayMarkerRef.current = null;
      }
      return;
    }

    const L = (window as any).L;
    if (!L) return;

    const pt = historyRoute[replayIndex];
    if (!pt || !pt.latitude || !pt.longitude) return;

    const heading = pt.heading || 0;
    // Rotate directly since SVG car icon points North (Up) by default
    const rotation = heading;

    const replayIcon = L.divIcon({
      html: `
        <div style="transform: rotate(${rotation}deg); transition: transform 0.15s ease-out; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;">
          <!-- SVG Top View Covered Lorry/Truck facing North (Up) -->
          <svg viewBox="0 0 24 24" fill="#2563eb" style="width: 38px; height: 38px; filter: drop-shadow(0px 2.5px 4.5px rgba(0,0,0,0.45));">
            <!-- Cabin -->
            <path d="M7 2c-1.1 0-2 .9-2 2v6h14V4c0-1.1-.9-2-2-2H7z" fill="#2563eb" />
            <!-- Windshield -->
            <path d="M8 3.5h8v2.5H8V3.5z" fill="#93c5fd" opacity="0.95" />
            <!-- Side Mirrors -->
            <rect x="4.2" y="5.2" width="0.8" height="2" rx="0.3" fill="#1e3a8a" />
            <rect x="19" y="5.2" width="0.8" height="2" rx="0.3" fill="#1e3a8a" />
            <!-- Covered Cargo Container Box -->
            <rect x="5" y="9" width="14" height="13" rx="1.2" fill="#1d4ed8" />
            <!-- Roof Ridges -->
            <rect x="7" y="10.2" width="1.2" height="10.5" fill="#3b82f6" opacity="0.75" />
            <rect x="11.4" y="10.2" width="1.2" height="10.5" fill="#3b82f6" opacity="0.75" />
            <rect x="15.8" y="10.2" width="1.2" height="10.5" fill="#3b82f6" opacity="0.75" />
          </svg>
        </div>
      `,
      className: "replay-car-navigation-icon",
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (!replayMarkerRef.current) {
      replayMarkerRef.current = L.marker([pt.latitude, pt.longitude], { icon: replayIcon }).addTo(mapInstanceRef.current);
    } else {
      replayMarkerRef.current.setLatLng([pt.latitude, pt.longitude]);
      replayMarkerRef.current.setIcon(replayIcon);
    }

    // Follow the vehicle by panning map automatically
    mapInstanceRef.current.panTo([pt.latitude, pt.longitude]);

  }, [leafletLoaded, historyRoute, replayIndex]);

  // Change Google Maps tile type dynamically
  useEffect(() => {
    if (leafletLoaded && mapInstanceRef.current && tileLayerRef.current) {
      const L = (window as any).L;
      if (L) {
        let lyrs = "m";
        if (mapLayerType === "satellite") lyrs = "s";
        if (mapLayerType === "hybrid") lyrs = "y";

        tileLayerRef.current.setUrl(`https://{s}.google.com/vt/lyrs=${lyrs}&x={x}&y={y}&z={z}`);
      }
    }
  }, [leafletLoaded, mapLayerType]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (replayIntervalRef.current) {
        clearInterval(replayIntervalRef.current);
      }
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
    <div className="w-full rounded-lg border border-slate-200 shadow-inner overflow-hidden relative group/map flex flex-col justify-end" style={{ height }}>
      <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />

      {/* Floating Map Type Selector */}
      <div className="absolute top-4 right-4 z-[999] bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-lg shadow-md p-1 flex gap-1 text-[10px] font-bold text-slate-600 transition-opacity">
        {(["streets", "satellite", "hybrid"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setMapLayerType(type)}
            className={`px-2.5 py-1.5 rounded transition-all capitalize ${
              mapLayerType === type 
                ? "bg-blue-600 text-white shadow-sm" 
                : "hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {type === "streets" ? "Google Map" : type === "hybrid" ? "Hybrid" : "Satellite"}
          </button>
        ))}
      </div>

      {/* Floating Replay Controls HUD */}
      {historyRoute && historyRoute.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 z-[999] bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-xl shadow-lg p-3.5 flex flex-col md:flex-row items-center gap-4 transition-all">
          
          {/* Telemetry info HUD */}
          <div className="flex items-center gap-3 shrink-0 text-slate-800 text-[11px] font-bold border-b md:border-b-0 md:border-r border-slate-200/85 pb-2 md:pb-0 md:pr-4 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-medium">🕒 Time:</span>
              <span className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                {new Date(historyRoute[replayIndex]?.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-medium">⚡ Speed:</span>
              <span className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                {historyRoute[replayIndex]?.speed.toFixed(0)} <span className="text-[9px] text-slate-500 font-normal">km/h</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-medium">🧭 Course:</span>
              <span className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                {historyRoute[replayIndex]?.heading}°
                <Compass className="w-3 h-3 text-slate-500" style={{ transform: `rotate(${historyRoute[replayIndex]?.heading}deg)`, transition: 'transform 0.15s ease-out' }} />
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-medium">🔑 Engine:</span>
              <span className={`font-mono px-1.5 py-0.5 rounded text-[10px] font-bold ${
                historyRoute[replayIndex]?.ignition 
                  ? "bg-green-50 text-green-700 border border-green-200/40" 
                  : "bg-slate-100 text-slate-600 border border-slate-200/40"
              }`}>
                {historyRoute[replayIndex]?.ignition ? "ON" : "OFF"}
              </span>
            </div>
          </div>

          {/* Media Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {isReplaying ? (
              <button 
                onClick={() => setIsReplaying(false)} 
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold p-2.5 rounded-lg shadow-sm hover:scale-105 transition-transform"
                title="Pause Replay"
              >
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              </button>
            ) : (
              <button 
                onClick={() => {
                  if (replayIndex >= historyRoute.length - 1) {
                    setReplayIndex(0);
                  }
                  setIsReplaying(true);
                }} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2.5 rounded-lg shadow-sm hover:scale-105 transition-transform"
                title="Play Replay"
              >
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </button>
            )}

            <button 
              onClick={() => {
                setIsReplaying(false);
                setReplayIndex(0);
              }} 
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold p-2.5 rounded-lg shadow-sm"
              title="Stop & Reset"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
            </button>
          </div>

          {/* Progress Slider */}
          <div className="flex-1 w-full flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-mono">0%</span>
            <input 
              type="range"
              min="0"
              max={historyRoute.length - 1}
              value={replayIndex}
              onChange={(e) => {
                setIsReplaying(false);
                setReplayIndex(parseInt(e.target.value));
              }}
              className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 outline-none"
            />
            <span className="text-[10px] text-slate-400 font-mono">
              {Math.round((replayIndex / (historyRoute.length - 1)) * 100)}%
            </span>
          </div>

          {/* Replay speed */}
          <div className="flex items-center gap-1 shrink-0 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600">
            {[1, 5, 10, 50].map((spd) => (
              <button
                key={spd}
                onClick={() => setReplaySpeed(spd)}
                className={`px-2 py-1 rounded transition-colors ${
                  replaySpeed === spd ? "bg-white text-blue-900 shadow-sm border border-slate-200/50" : "hover:text-slate-900"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
