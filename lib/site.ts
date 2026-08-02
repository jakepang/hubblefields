import { distanceMeters } from "@/lib/geofence-math";

/**
 * Geofence modes (env `GEOFENCE_MODE`):
 * - `site` (default): tight project polygon (T5)
 * - `singapore`: whole Singapore — for dispersed small contractors
 * - `off`: GPS still recorded, always treated as inside
 */
export type GeofenceMode = "site" | "singapore" | "off";

export function geofenceMode(): GeofenceMode {
  const raw = (
    process.env.NEXT_PUBLIC_GEOFENCE_MODE ||
    process.env.GEOFENCE_MODE ||
    "site"
  )
    .toLowerCase()
    .trim();
  if (raw === "singapore" || raw === "sg" || raw === "nation") return "singapore";
  if (raw === "off" || raw === "none" || raw === "disabled") return "off";
  return "site";
}

/**
 * T5 Substructure site boundary from geojson.io (field-drawn polygon).
 * Stored as [lat, lng].
 */
export const T5_SITE_POLYGON: Array<[number, number]> = [
  [1.3282401, 103.9899226],
  [1.3253912, 103.9963153],
  [1.3157079, 103.9929287],
  [1.3187891, 103.9859808],
  [1.3233684, 103.987958],
];

/** Approximate Singapore bounding box (mainland + nearby islands). */
export const SINGAPORE_POLYGON: Array<[number, number]> = [
  [1.478, 103.605],
  [1.478, 104.095],
  [1.158, 104.095],
  [1.158, 103.605],
];

/** @deprecated Use activeSitePolygon() — kept for imports that expect SITE_POLYGON. */
export const SITE_POLYGON = T5_SITE_POLYGON;

function polygonCentroid(polygon: Array<[number, number]>) {
  const lat = polygon.reduce((sum, [y]) => sum + y, 0) / polygon.length;
  const lng = polygon.reduce((sum, [, x]) => sum + x, 0) / polygon.length;
  return { lat, lng };
}

const T5_CENTROID = polygonCentroid(T5_SITE_POLYGON);
const SG_CENTER = { lat: 1.3521, lng: 103.8198 };

export function activeSitePolygon(): Array<[number, number]> {
  const mode = geofenceMode();
  if (mode === "singapore") return SINGAPORE_POLYGON;
  if (mode === "off") return [];
  return T5_SITE_POLYGON;
}

export const SITE_CENTER = (() => {
  const mode = geofenceMode();
  if (mode === "singapore" || mode === "off") {
    return {
      lat: Number(process.env.GEOFENCE_LAT ?? String(SG_CENTER.lat)),
      lng: Number(process.env.GEOFENCE_LNG ?? String(SG_CENTER.lng)),
    };
  }
  return {
    lat: Number(process.env.GEOFENCE_LAT ?? String(T5_CENTROID.lat)),
    lng: Number(process.env.GEOFENCE_LNG ?? String(T5_CENTROID.lng)),
  };
})();

export const SITE_ADDRESS =
  process.env.GEOFENCE_ADDRESS ||
  (geofenceMode() === "singapore" || geofenceMode() === "off"
    ? "Singapore"
    : "10 Changi Coast Rd, Singapore 499732");

export const SITE_LABEL =
  process.env.GEOFENCE_LABEL ||
  (geofenceMode() === "singapore"
    ? "QI SHENG CONSTRUCTION PTE. LTD."
    : geofenceMode() === "off"
      ? "Open area"
      : "QI SHENG CONSTRUCTION PTE. LTD.");

export function siteRadiusM() {
  const mode = geofenceMode();
  const fallback = mode === "singapore" ? 40_000 : mode === "off" ? 1_000_000 : 250;
  const radiusM = Number(process.env.GEOFENCE_RADIUS_M ?? String(fallback));
  return Number.isFinite(radiusM) && radiusM > 0 ? radiusM : fallback;
}

/** Ray-casting point-in-polygon. */
export function pointInPolygon(point: { lat: number; lng: number }, polygon: Array<[number, number]>) {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function sitePublicConfig() {
  const mode = geofenceMode();
  return {
    mode,
    label: SITE_LABEL,
    address: SITE_ADDRESS,
    latitude: SITE_CENTER.lat,
    longitude: SITE_CENTER.lng,
    radiusM: siteRadiusM(),
    polygon: activeSitePolygon(),
    strict: process.env.GEOFENCE_STRICT === "true",
  };
}

export function isInsideSite(latitude: number, longitude: number) {
  const mode = geofenceMode();
  const point = { lat: latitude, lng: longitude };
  const distanceM = Math.round(distanceMeters(SITE_CENTER, point));

  if (mode === "off") {
    return { inside: true, inPolygon: true, inCircle: true, distanceM, mode };
  }

  const polygon = activeSitePolygon();
  const inPolygon = polygon.length >= 3 ? pointInPolygon(point, polygon) : false;
  const inCircle = distanceM <= siteRadiusM();
  return {
    inside: inPolygon || inCircle,
    inPolygon,
    inCircle,
    distanceM,
    mode,
  };
}
