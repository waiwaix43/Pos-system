"use client";

import { useEffect, useRef } from "react";

interface InteractiveShopMapProps {
  latitude?: number;
  longitude?: number;
  editable: boolean;
  onLocationChange: (latitude: number, longitude: number) => void;
}

const DEFAULT_CENTER: [number, number] = [13.7563, 100.5018];

const createShopMarker = (leaflet: any, position: [number, number]) => leaflet.marker(position, {
  icon: leaflet.divIcon({
    className: "shop-map-marker-icon",
    html: '<span class="shop-map-pin"></span>',
    iconSize: [30, 42],
    iconAnchor: [15, 42]
  })
});

export default function InteractiveShopMap({ latitude, longitude, editable, onLocationChange }: InteractiveShopMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;

  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);

  useEffect(() => {
    let cancelled = false;

    const initializeMap = async () => {
      const leaflet = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      leafletRef.current = leaflet;
      const initialCenter: [number, number] = hasLocation ? [latitude as number, longitude as number] : DEFAULT_CENTER;
      const map = leaflet.map(containerRef.current).setView(initialCenter, hasLocation ? 16 : 6);
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);
      if (hasLocation) {
        markerRef.current = createShopMarker(leaflet, initialCenter).addTo(map);
      }

      map.on("click", (event: any) => {
        if (editable) onLocationChangeRef.current(event.latlng.lat, event.latlng.lng);
      });
      mapRef.current = map;
    };

    initializeMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [editable]);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet || !hasLocation) return;

    const position: [number, number] = [latitude as number, longitude as number];
    if (!markerRef.current) {
      markerRef.current = createShopMarker(leaflet, position).addTo(map);
    } else {
      markerRef.current.setLatLng(position);
    }
    map.setView(position, Math.max(map.getZoom(), 16));
  }, [hasLocation, latitude, longitude]);

  return <div ref={containerRef} className="h-[280px] w-full" aria-label={editable ? "คลิกแผนที่เพื่อเลือกตำแหน่งร้าน" : "แผนที่ตั้งร้าน"} />;
}
