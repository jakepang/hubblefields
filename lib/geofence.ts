import { SITE_ADDRESS, SITE_CENTER, SITE_LABEL, isInsideSite, sitePublicConfig, siteRadiusM } from "@/lib/site";

export { distanceMeters } from "@/lib/geofence-math";

export function geofenceConfig() {
  return {
    center: { lat: SITE_CENTER.lat, lng: SITE_CENTER.lng },
    radiusM: siteRadiusM(),
    strict: process.env.GEOFENCE_STRICT === "true",
    label: SITE_LABEL,
    address: SITE_ADDRESS,
  };
}

export type LocationCheck = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  distanceM: number;
  inside: boolean;
  label: string;
  radiusM: number;
  address: string;
};

export function checkLocation(latitude: number, longitude: number, accuracyM?: number | null): LocationCheck {
  const config = geofenceConfig();
  const result = isInsideSite(latitude, longitude);
  return {
    latitude,
    longitude,
    accuracyM: accuracyM ?? null,
    distanceM: result.distanceM,
    inside: result.inside,
    label: config.label,
    radiusM: config.radiusM,
    address: config.address,
  };
}

export function publicGeofence() {
  return sitePublicConfig();
}
