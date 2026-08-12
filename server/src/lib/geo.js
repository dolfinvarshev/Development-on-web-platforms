// [B3] Geospatial helpers for the incident engine.

const EARTH_RADIUS_M = 6371000;
// Metres per degree of latitude (nearly constant); longitude shrinks by cos(lat).
const M_PER_DEG = 111320;

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in metres between two WGS84 points (standard haversine). */
export function haversineM(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Random point uniformly distributed inside a disk of maxRadiusM around (lat, lng).
 * sqrt on the radius keeps the distribution uniform by area (plain r would cluster
 * points at the centre). `rand` is injectable for deterministic tests.
 */
export function scatterAround(lat, lng, maxRadiusM, rand = Math.random) {
  const r = maxRadiusM * Math.sqrt(rand());
  const theta = 2 * Math.PI * rand();
  const dLat = (r * Math.cos(theta)) / M_PER_DEG;
  const dLng = (r * Math.sin(theta)) / (M_PER_DEG * Math.cos(toRad(lat)));
  return { lat: lat + dLat, lng: lng + dLng };
}
