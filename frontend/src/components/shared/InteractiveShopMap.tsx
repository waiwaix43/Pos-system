"use client";

import { useEffect, useRef } from "react";
import { LocateFixed } from "lucide-react";

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
      
      const mapOptions = editable ? {} : {
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false
      };

      const map = leaflet.map(containerRef.current, mapOptions).setView(initialCenter, hasLocation ? 16 : 6);
      
      if (!editable && (map as any).tap) {
        (map as any).tap.disable();
      }

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

  const handleCenterToPin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (mapRef.current && hasLocation) {
      mapRef.current.setView([latitude as number, longitude as number], Math.max(mapRef.current.getZoom(), 16));
    }
  };

  return (
    <div className="relative h-[280px] w-full group">
      <div 
        ref={containerRef} 
        className="h-full w-full z-0" 
        style={{ cursor: editable ? 'pointer' : 'default' }}
        aria-label={editable ? "คลิกแผนที่เพื่อเลือกตำแหน่งร้าน" : "แผนที่ตั้งร้าน"} 
      />
      {hasLocation && (
        <button
          type="button"
          onClick={handleCenterToPin}
          className="absolute bottom-4 right-4 z-[400] bg-white text-[#7a5c4e] p-2.5 rounded-xl shadow-md hover:bg-gray-50 border border-gray-200 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#7a5c4e]"
          title="กลับไปยังตำแหน่งหมุด"
        >
          <LocateFixed className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
