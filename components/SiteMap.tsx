"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker, Circle, Polygon, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";

type Gps = { latitude: number; longitude: number; accuracyM?: number | null };
type Site = {
  latitude: number;
  longitude: number;
  radiusM: number;
  polygon?: Array<[number, number]>;
  label?: string;
};

type Props = {
  site: Site;
  user: Gps | null;
  className?: string;
  mode?: "dark" | "satellite";
};

export function SiteMap({ site, user, className, mode = "dark" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const accuracyRef = useRef<Circle | null>(null);
  const linkRef = useRef<Polyline | null>(null);
  const siteMarkerRef = useRef<Marker | null>(null);
  const fenceCircleRef = useRef<Circle | null>(null);
  const fencePolyRef = useRef<Polygon | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([site.latitude, site.longitude], 14);

      const tileUrl =
        mode === "satellite"
          ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

      L.tileLayer(tileUrl, {
        maxZoom: 19,
      }).addTo(map);

      if (site.polygon?.length) {
        fencePolyRef.current = L.polygon(
          site.polygon.map(([lat, lng]) => [lat, lng] as [number, number]),
          {
            color: "#4ea1ff",
            weight: 2,
            fillColor: "#2f7fd6",
            fillOpacity: mode === "satellite" ? 0.18 : 0.28,
          },
        ).addTo(map);
      }

      fenceCircleRef.current = L.circle([site.latitude, site.longitude], {
        radius: site.radiusM,
        color: "#4ea1ff",
        weight: 1,
        dashArray: "4 6",
        fillColor: "#2f7fd6",
        fillOpacity: site.polygon?.length ? 0 : mode === "satellite" ? 0.12 : 0.2,
      }).addTo(map);

      const siteIcon = L.divIcon({
        className: "site-map-marker",
        html: `<span class="site-pin" title="${site.label || "Site"}">🏛</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      siteMarkerRef.current = L.marker([site.latitude, site.longitude], { icon: siteIcon }).addTo(map);

      mapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
    }

    void setup();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      accuracyRef.current = null;
      linkRef.current = null;
      siteMarkerRef.current = null;
      fenceCircleRef.current = null;
      fencePolyRef.current = null;
    };
  }, [site.latitude, site.longitude, site.radiusM, site.label, site.polygon, mode]);

  useEffect(() => {
    let cancelled = false;

    async function syncUser() {
      const map = mapRef.current;
      if (!map || !user) return;
      const L = (await import("leaflet")).default;
      if (cancelled) return;

      const latLng: [number, number] = [user.latitude, user.longitude];
      const userIcon = L.divIcon({
        className: "site-map-marker",
        html: `<span class="user-dot"><i></i></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker(latLng, { icon: userIcon }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng(latLng);
      }

      if (user.accuracyM && user.accuracyM > 0) {
        if (!accuracyRef.current) {
          accuracyRef.current = L.circle(latLng, {
            radius: user.accuracyM,
            color: "#3b82f6",
            weight: 1,
            fillColor: "#3b82f6",
            fillOpacity: 0.12,
          }).addTo(map);
        } else {
          accuracyRef.current.setLatLng(latLng);
          accuracyRef.current.setRadius(user.accuracyM);
        }
      }

      if (!linkRef.current) {
        linkRef.current = L.polyline([[site.latitude, site.longitude], latLng], {
          color: "#60a5fa",
          weight: 2,
          opacity: 0.75,
        }).addTo(map);
      } else {
        linkRef.current.setLatLngs([[site.latitude, site.longitude], latLng]);
      }

      const bounds = L.latLngBounds([
        [site.latitude, site.longitude],
        latLng,
      ]);
      map.fitBounds(bounds.pad(0.35), { maxZoom: 16, animate: true });
    }

    void syncUser();
    return () => {
      cancelled = true;
    };
  }, [user, site.latitude, site.longitude]);

  return <div ref={containerRef} className={`site-map ${className || ""}`} />;
}
