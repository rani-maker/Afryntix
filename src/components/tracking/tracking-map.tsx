"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

type LatLng = [number, number];

const KNOWN_CITIES: Record<string, LatLng> = {
  // Chine
  guangzhou: [23.1291, 113.2644],
  canton: [23.1291, 113.2644],
  shenzhen: [22.5431, 114.0579],
  shanghai: [31.2304, 121.4737],
  beijing: [39.9042, 116.4074],
  yiwu: [29.3055, 120.0747],
  hongkong: [22.3193, 114.1694],
  "hong kong": [22.3193, 114.1694],
  ningbo: [29.8683, 121.544],
  qingdao: [36.0671, 120.3826],
  // Afrique de l'Ouest
  abidjan: [5.36, -4.0083],
  dakar: [14.7167, -17.4677],
  lagos: [6.5244, 3.3792],
  accra: [5.6037, -0.187],
  cotonou: [6.3654, 2.4183],
  lome: [6.1228, 1.2256],
  bamako: [12.6392, -8.0029],
  conakry: [9.6412, -13.5784],
  niamey: [13.5117, 2.1251],
  ouagadougou: [12.3714, -1.5197],
  nouakchott: [18.0735, -15.9582],
  freetown: [8.4657, -13.2317],
  monrovia: [6.3008, -10.7972],
  banjul: [13.4549, -16.579],
  praia: [14.9333, -23.5133],
  bissau: [11.8636, -15.5977],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function findCoords(city?: string | null): LatLng | null {
  if (!city) return null;
  const key = normalize(city);
  if (KNOWN_CITIES[key]) return KNOWN_CITIES[key];
  for (const k of Object.keys(KNOWN_CITIES)) {
    if (key.includes(k) || k.includes(key)) return KNOWN_CITIES[k];
  }
  return null;
}

type Status =
  | "REGISTERED"
  | "RECEIVED_CHINA"
  | "IN_TRANSIT"
  | "ARRIVED_DESTINATION"
  | "CUSTOMS_CLEARANCE"
  | "AVAILABLE_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

type TransportMode =
  | "AIR_EXPRESS"
  | "AIR_NORMAL"
  | "SEA_LCL"
  | "SEA_FCL"
  | "VEHICLE"
  | "BTP_EQUIPMENT"
  | "STORAGE";

function currentIconSVG(mode: TransportMode, status: Status): string {
  const stroke = "#0a1620";
  const common = `viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
  // Le statut prend le pas sur le mode pour les phases « colis » et « livraison »
  if (status === "REGISTERED" || status === "RECEIVED_CHINA") {
    return `<svg ${common}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
  }
  if (status === "AVAILABLE_FOR_DELIVERY") {
    return `<svg ${common}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;
  }
  switch (mode) {
    case "AIR_EXPRESS":
    case "AIR_NORMAL":
      return `<svg ${common}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`;
    case "SEA_LCL":
    case "SEA_FCL":
      return `<svg ${common}><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.4 13 12 4 4.6 13"/><path d="M12 4v9"/><path d="M3 13h18"/></svg>`;
    case "VEHICLE":
    case "BTP_EQUIPMENT":
      return `<svg ${common}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;
    case "STORAGE":
      return `<svg ${common}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`;
    default:
      return "";
  }
}

function progressFor(status: Status): number {
  switch (status) {
    case "REGISTERED":
      return 0.02;
    case "RECEIVED_CHINA":
      return 0.05;
    case "IN_TRANSIT":
      return 0.5;
    case "ARRIVED_DESTINATION":
      return 0.95;
    case "CUSTOMS_CLEARANCE":
      return 0.97;
    case "AVAILABLE_FOR_DELIVERY":
      return 1;
    case "DELIVERED":
      return 1;
    default:
      return 0;
  }
}

function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function TrackingMap({
  originCity,
  destinationCity,
  destinationCountry,
  status,
  mode,
  trackingNumber,
}: {
  originCity?: string | null;
  destinationCity?: string | null;
  destinationCountry?: string | null;
  status: Status;
  mode: TransportMode;
  trackingNumber: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);

  const origin = findCoords(originCity) ?? KNOWN_CITIES.guangzhou;
  const destination =
    findCoords(destinationCity) ?? findCoords(destinationCountry) ?? KNOWN_CITIES.abidjan;
  const progress = progressFor(status);
  const current = interpolate(origin, destination, progress);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      // CSS pour leaflet (chargée côté client uniquement)
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.crossOrigin = "";
        link.integrity =
          "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
        document.head.appendChild(link);
      }

      if (cancelled || !containerRef.current) return;
      // Ne pas réinitialiser si déjà créée
      if (mapRef.current) return;

      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 18,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: "abcd",
        },
      ).addTo(map);

      const accent = "#00e2b1";

      // Origine
      const originIcon = L.divIcon({
        className: "afryntix-marker",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#0ea5a3;box-shadow:0 0 0 4px rgba(14,165,163,0.25);border:2px solid #fff"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker(origin, { icon: originIcon })
        .addTo(map)
        .bindPopup(
          `<strong>Origine</strong><br/>${originCity ?? "Guangzhou"}, Chine`,
        );

      // Destination
      const destIcon = L.divIcon({
        className: "afryntix-marker",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#a78bfa;box-shadow:0 0 0 4px rgba(167,139,250,0.25);border:2px solid #fff"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker(destination, { icon: destIcon })
        .addTo(map)
        .bindPopup(
          `<strong>Destination</strong><br/>${
            destinationCity ?? destinationCountry ?? "—"
          }`,
        );

      // Tracé arc origine → destination (ligne pointillée)
      L.polyline([origin, destination], {
        color: accent,
        weight: 2,
        opacity: 0.65,
        dashArray: "6 6",
      }).addTo(map);

      // Position actuelle (pulse + icône selon mode/statut)
      const isAtDestination = progress >= 1;
      const iconSvg = currentIconSVG(mode, status);
      const pulseHTML = `
        <div style="position:relative;width:32px;height:32px;">
          <span style="position:absolute;inset:0;border-radius:50%;background:${accent};opacity:0.32;animation:afryntixPulse 1.8s ease-out infinite"></span>
          <span style="position:absolute;inset:6px;border-radius:50%;background:${accent};border:2px solid #ffffff;box-shadow:0 0 0 1px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center">${iconSvg}</span>
        </div>`;
      const currentIcon = L.divIcon({
        className: "afryntix-marker-current",
        html: pulseHTML,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(current, { icon: currentIcon }).addTo(map);
      marker.bindPopup(
        `<strong>${trackingNumber}</strong><br/>${
          isAtDestination ? "Arrivé à destination" : "En route"
        }`,
      );
      markerRef.current = marker;

      // Cadrer la carte sur l'ensemble
      const bounds = L.latLngBounds([origin, destination, current]);
      map.fitBounds(bounds, { padding: [40, 40] });

      // Réajuster lors d'un redimensionnement
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(containerRef.current);
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [
    origin[0],
    origin[1],
    destination[0],
    destination[1],
    current[0],
    current[1],
    progress,
    trackingNumber,
    originCity,
    destinationCity,
    destinationCountry,
    mode,
    status,
  ]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-[360px] w-full rounded-xl overflow-hidden border bg-slate-900"
        aria-label="Carte de localisation du colis"
      />
      <div className="absolute top-3 right-3 z-[400] flex flex-wrap items-center gap-2 rounded-full bg-black/65 backdrop-blur px-3 py-1.5 text-[11px] text-white shadow-lg">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-teal-400" />
          Origine
        </span>
        <span className="opacity-30">•</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-400" />
          Destination
        </span>
        <span className="opacity-30">•</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" />
          Position
        </span>
      </div>
    </div>
  );
}
