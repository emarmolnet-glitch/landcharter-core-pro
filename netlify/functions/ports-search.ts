import type { Config } from "@netlify/functions";
import { createResponseCacheHeaders, getOrSetCachedJson } from "./_shared/response-cache.js";

interface NominatimItem {
  place_id?: number | string;
  osm_id?: number | string;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: {
    country_code?: string;
    country?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
  };
}

export interface GeographicLocationRecord {
  uuid: string;
  portName: string;
  officialLabel: string;
  countryCode: string;
  countryName: string;
  unlocode: string;
  portType: string;
  latitude: number;
  longitude: number;
  maxOperationalDraftMeters: number | null;
  draftSourceField: string | null;
  source: string;
}

export async function searchNominatimLocations(query: string): Promise<GeographicLocationRecord[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(clean)}&format=json&addressdetails=1&limit=10`;
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "LandCharterCorePRO/1.0",
    },
  });

  if (!res.ok) {
    throw new Error(`Nominatim HTTP ${res.status}`);
  }

  const items = (await res.json()) as NominatimItem[];
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const placeName = item.name || item.display_name?.split(",")[0] || clean;
    return {
      uuid: String(item.osm_id || item.place_id || placeName),
      portName: placeName,
      officialLabel: item.display_name || placeName,
      countryCode: (item.address?.country_code || "").toUpperCase(),
      countryName: item.address?.country || "",
      unlocode: "",
      portType: "terrestrial",
      latitude: Number.isFinite(lat) ? lat : 0,
      longitude: Number.isFinite(lon) ? lon : 0,
      maxOperationalDraftMeters: null,
      draftSourceField: null,
      source: "Nominatim",
    };
  });
}

export default async function portsSearchHandler(request: Request) {
  if (request.method !== "GET") return Response.json({ error: "Método no permitido." }, { status: 405 });
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2) return Response.json({ ports: [] });

  try {
    const cached = await getOrSetCachedJson({
      namespace: "osm-geographic-search-v1",
      key: query.toLowerCase(),
      ttlMs: 7 * 24 * 60 * 60 * 1000,
      staleTtlMs: 30 * 24 * 60 * 60 * 1000,
      producer: () => searchNominatimLocations(query),
    });
    return Response.json({ ports: cached.value }, {
      headers: createResponseCacheHeaders(cached, 86_400, 604_800),
    });
  } catch (error) {
    console.error("[ports-search] Geographic lookup failed.", error instanceof Error ? error.message : String(error));
    return Response.json({ error: "No fue posible buscar puntos geográficos terrestres." }, { status: 500 });
  }
}

export const config: Config = {
  path: "/api/v1/ports/search",
};
