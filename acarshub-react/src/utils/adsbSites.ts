import type { Decoders } from "../types";

export interface AdsbSite {
  name: string;
  lat: number;
  lon: number;
}

/**
 * Resolve the receiver sites displayed by the map.
 *
 * New multi-site payloads take priority. Older backends still work through
 * the legacy lat/lon fields. A user station override replaces the primary
 * site while preserving additional configured receivers.
 */
export function resolveAdsbSites(
  adsb: Decoders["adsb"] | undefined,
  overrideLat: number,
  overrideLon: number,
): AdsbSite[] {
  const sites =
    adsb?.sites?.filter(
      (site) =>
        site.name.trim().length > 0 &&
        Number.isFinite(site.lat) &&
        Number.isFinite(site.lon) &&
        Math.abs(site.lat) <= 90 &&
        Math.abs(site.lon) <= 180 &&
        !(site.lat === 0 && site.lon === 0),
    ) ?? [];

  const resolved =
    sites.length > 0
      ? sites.map((site) => ({ ...site }))
      : adsb && !(adsb.lat === 0 && adsb.lon === 0)
        ? [{ name: "Ground Station", lat: adsb.lat, lon: adsb.lon }]
        : [];

  if (!(overrideLat === 0 && overrideLon === 0)) {
    const primaryName = resolved[0]?.name ?? "Ground Station";
    const override = {
      name: primaryName,
      lat: overrideLat,
      lon: overrideLon,
    };
    return resolved.length > 0 ? [override, ...resolved.slice(1)] : [override];
  }

  return resolved;
}
