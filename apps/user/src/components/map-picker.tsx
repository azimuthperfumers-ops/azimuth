"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2, Minimize2, LocateFixed } from "lucide-react";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
const INDIA_ZOOM = 5;
const PIN_ZOOM = 15;

interface Props {
  lat?: number | null;
  lng?: number | null;
  pincode?: string;
  onChange: (lat: number, lng: number) => void;
}

export default function MapPicker({ lat, lng, pincode, onChange }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [locating, setLocating] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  function placeMarker(map: L.Map, pLat: number, pLng: number) {
    if (markerRef.current) {
      markerRef.current.setLatLng([pLat, pLng]);
    } else {
      const m = L.marker([pLat, pLng], { icon: markerIcon, draggable: true }).addTo(map);
      m.on("dragend", () => {
        const pos = m.getLatLng();
        onChangeRef.current(pos.lat, pos.lng);
      });
      markerRef.current = m;
    }
  }

  function requestGPS(map: L.Map) {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const gLat = pos.coords.latitude;
        const gLng = pos.coords.longitude;
        map.flyTo([gLat, gLng], PIN_ZOOM, { animate: true, duration: 1 });
        placeMarker(map, gLat, gLng);
        onChangeRef.current(gLat, gLng);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // Init map once — auto-GPS if no prior coords
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: lat != null && lng != null ? [lat, lng] : INDIA_CENTER,
      zoom: lat != null && lng != null ? PIN_ZOOM : INDIA_ZOOM,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    if (lat != null && lng != null) {
      placeMarker(map, lat, lng);
    }

    map.on("click", (e) => {
      placeMarker(map, e.latlng.lat, e.latlng.lng);
      onChangeRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    if (lat == null || lng == null) {
      requestGPS(map);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fullscreen toggle using native browser API on the wrapper div
  function toggleFullscreen() {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen().catch(() => null);
    } else {
      document.exitFullscreen().catch(() => null);
    }
  }

  // Track fullscreen state and invalidate map size so tiles fill the viewport
  useEffect(() => {
    function onFullscreenChange() {
      const isFull = !!document.fullscreenElement;
      setFullscreen(isFull);
      // Leaflet needs a tick to see the new container dimensions
      setTimeout(() => mapRef.current?.invalidateSize(), 50);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Pan to pincode area on 6-digit entry
  useEffect(() => {
    if (!pincode || pincode.length !== 6 || !mapRef.current) return;
    let cancelled = false;
    fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=IN&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } },
    )
      .then((r) => r.json())
      .then((results: { lat: string; lon: string }[]) => {
        if (cancelled || !results[0] || !mapRef.current) return;
        mapRef.current.flyTo(
          [parseFloat(results[0].lat), parseFloat(results[0].lon)],
          PIN_ZOOM,
          { animate: true, duration: 1 },
        );
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [pincode]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {locating ? "Detecting your location…" : "Pin your exact location"}
        </p>
        <button
          type="button"
          onClick={() => mapRef.current && requestGPS(mapRef.current)}
          disabled={locating}
          className="text-[11px] font-semibold underline underline-offset-2 text-foreground hover:opacity-70 disabled:opacity-40"
        >
          {locating ? "Locating…" : "Use GPS"}
        </button>
      </div>

      {/* wrapper is the fullscreen root so controls stay inside */}
      <div
        ref={wrapperRef}
        className="relative border border-border"
        style={fullscreen ? { width: "100vw", height: "100vh" } : {}}
      >
        {/* map tile area */}
        <div
          ref={containerRef}
          className="w-full"
          style={{ height: fullscreen ? "100%" : "13rem", zIndex: 0 }}
        />

        {/* overlay buttons — top-right corner of map */}
        <div className="absolute top-2 right-2 z-[400] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={toggleFullscreen}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="flex items-center justify-center w-8 h-8 bg-white/90 border border-border shadow-sm hover:bg-white transition-colors"
          >
            {fullscreen
              ? <Minimize2 className="size-3.5 text-foreground" />
              : <Maximize2 className="size-3.5 text-foreground" />
            }
          </button>
          <button
            type="button"
            onClick={() => mapRef.current && requestGPS(mapRef.current)}
            disabled={locating}
            title="Detect my location"
            className="flex items-center justify-center w-8 h-8 bg-white/90 border border-border shadow-sm hover:bg-white transition-colors disabled:opacity-40"
          >
            <LocateFixed className={`size-3.5 text-foreground ${locating ? "animate-pulse" : ""}`} />
          </button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
        GPS is a rough start — drag the pin or click the map to mark your exact gate / building.
      </p>
      {lat != null && lng != null && (
        <p className="text-[10px] text-muted-foreground/40 font-mono">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </p>
      )}
    </div>
  );
}
