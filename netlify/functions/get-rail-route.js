// netlify/functions/get-rail-route.js
// Netlify Function Proxy para Motor de Enrutamiento Ferroviario (Open-Source + Fallback ORS HGV)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImZiMzUxZDEyZmE2YzQ5ODk4MWE0NzA2Y2Y4YjEyZjQwIiwiaCI6Im11cm11cjY0In0=";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Snapping a la estación de tren más cercana usando Overpass API
 */
async function findNearestRailStation(lat, lon) {
  try {
    const q = `[out:json][timeout:5];node["railway"~"station|halt"](around:25000,${lat},${lon});out 3;`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "User-Agent": "LandCharterRailProxy/1.0",
        "Accept": "application/json"
      },
      body: "data=" + encodeURIComponent(q),
      signal: ctrl.signal
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const json = await res.json();
    let best = null;
    let minD = Infinity;
    for (const el of (json.elements || [])) {
      if (el.lat && el.lon) {
        const d = Math.hypot(el.lon - lon, el.lat - lat);
        if (d < minD) {
          minD = d;
          best = { lat: el.lat, lon: el.lon, name: el.tags?.name || "Estación" };
        }
      }
    }
    return best;
  } catch (_) {
    return null;
  }
}

/**
 * Consulta a motor BRouter Rail
 */
async function fetchBRouterRail(lon1, lat1, lon2, lat2, timeoutMs = 7000) {
  try {
    const url = `https://brouter.de/brouter?lonlats=${lon1},${lat1}|${lon2},${lat2}&profile=rail&format=geojson&alternativeidx=0`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "LandCharterRailProxy/1.0",
        "Accept": "application/json"
      },
      signal: ctrl.signal
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const json = await res.json();
    const feat = json?.features?.[0];
    const coords = feat?.geometry?.coordinates;
    if (coords && coords.length > 0) {
      const trackMeters = Number(feat?.properties?.["track-length"] || feat?.properties?.distance || 0);
      return {
        coordinates: coords,
        trackMeters,
        source: "BROUTER-RAIL"
      };
    }
  } catch (_) {}
  return null;
}

/**
 * Consulta a routing.openstreetmap.de con perfil train / rail
 */
async function fetchOsmTrain(lon1, lat1, lon2, lat2, timeoutMs = 6000) {
  const endpoints = [
    `https://routing.openstreetmap.de/routed-train/route/v1/train/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson&steps=true`,
    `https://routing.openstreetmap.de/routed-rail/route/v1/rail/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson&steps=true`
  ];
  for (const ep of endpoints) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(ep, {
        headers: { "User-Agent": "LandCharterRailProxy/1.0" },
        signal: ctrl.signal
      });
      clearTimeout(tid);
      if (res.ok) {
        const json = await res.json();
        const route = json?.routes?.[0];
        if (route?.geometry?.coordinates?.length > 0) {
          return {
            coordinates: route.geometry.coordinates,
            trackMeters: Number(route.distance) || 0,
            duration: Number(route.duration) || 0,
            source: "ROUTING-OPENSTREETMAP-TRAIN"
          };
        }
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Fallback estético con OpenRouteService HGV para obtener Polyline de alta definición si la API de trenes cae
 */
async function fetchOrsHgvPolylineFallback(lon1, lat1, lon2, lat2, timeoutMs = 8000) {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-hgv/geojson", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": ORS_API_KEY
      },
      body: JSON.stringify({
        coordinates: [[lon1, lat1], [lon2, lat2]],
        radiuses: [5000, 5000]
      }),
      signal: ctrl.signal
    });
    clearTimeout(tid);
    if (res.ok) {
      const json = await res.json();
      const feat = json?.features?.[0];
      const coords = feat?.geometry?.coordinates;
      if (coords && coords.length > 0) {
        return {
          coordinates: coords,
          source: "ORS-HGV-FALLBACK-POLYLINE"
        };
      }
    }
  } catch (_) {}
  return null;
}

export default async function handler(req) {
  // Manejo de preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  let polLat, polLng, podLat, podLng;

  if (req.method === "GET") {
    try {
      const url = new URL(req.url);
      polLat = parseFloat(url.searchParams.get("polLat") || url.searchParams.get("lat1") || url.searchParams.get("originLat"));
      polLng = parseFloat(url.searchParams.get("polLng") || url.searchParams.get("lon1") || url.searchParams.get("polLon") || url.searchParams.get("originLon"));
      podLat = parseFloat(url.searchParams.get("podLat") || url.searchParams.get("lat2") || url.searchParams.get("destLat"));
      podLng = parseFloat(url.searchParams.get("podLng") || url.searchParams.get("lon2") || url.searchParams.get("podLon") || url.searchParams.get("destLon"));
    } catch (e) {
      return jsonResponse({ ok: false, error: "Parámetros de URL inválidos" }, 400);
    }
  } else if (req.method === "POST") {
    try {
      const body = await req.json();
      polLat = parseFloat(body.polLat ?? body.lat1 ?? body.originLat ?? body.origin?.lat);
      polLng = parseFloat(body.polLng ?? body.polLon ?? body.lon1 ?? body.originLon ?? body.origin?.lon);
      podLat = parseFloat(body.podLat ?? body.lat2 ?? body.destLat ?? body.destination?.lat);
      podLng = parseFloat(body.podLng ?? body.podLon ?? body.lon2 ?? body.destLon ?? body.destination?.lon);
    } catch (e) {
      return jsonResponse({ ok: false, error: "JSON en cuerpo de solicitud inválido" }, 400);
    }
  } else {
    return jsonResponse({ ok: false, error: "Método no permitido. Usa GET o POST." }, 405);
  }

  if (!Number.isFinite(polLat) || !Number.isFinite(polLng) || !Number.isFinite(podLat) || !Number.isFinite(podLng)) {
    return jsonResponse({
      ok: false,
      error: "Coordenadas [polLat, polLng] y [podLat, podLng] requeridas y deben ser números finitos."
    }, 400);
  }

  const straightKm = calculateHaversineKm(polLat, polLng, podLat, podLng);
  // Estimación matemática geodésica ferroviaria (~1.25x sobre distancia en línea recta)
  const theoreticalRailKm = Math.round(straightKm * 1.25 * 10) / 10;
  const theoreticalRailMeters = theoreticalRailKm * 1000;

  // 1. Intento con perfil de tren en routing.openstreetmap.de
  let railResult = await fetchOsmTrain(polLng, polLat, podLng, podLat);

  // 2. Intento directo con BRouter Rail Profile
  if (!railResult) {
    railResult = await fetchBRouterRail(polLng, polLat, podLng, podLat);
  }

  // 3. Intento con Snapping a estaciones ferroviarias más cercanas + BRouter Rail
  if (!railResult) {
    try {
      const [snapOrig, snapDest] = await Promise.all([
        findNearestRailStation(polLat, polLng),
        findNearestRailStation(podLat, podLng)
      ]);

      const sLon1 = snapOrig ? snapOrig.lon : polLng;
      const sLat1 = snapOrig ? snapOrig.lat : polLat;
      const sLon2 = snapDest ? snapDest.lon : podLng;
      const sLat2 = snapDest ? snapDest.lat : podLat;

      const snappedBrouter = await fetchBRouterRail(sLon1, sLat1, sLon2, sLat2);
      if (snappedBrouter && snappedBrouter.coordinates?.length > 0) {
        const fullCoords = [
          [polLng, polLat],
          ...snappedBrouter.coordinates,
          [podLng, podLat]
        ];
        railResult = {
          coordinates: fullCoords,
          trackMeters: snappedBrouter.trackMeters || theoreticalRailMeters,
          source: "BROUTER-RAIL-SNAPPED"
        };
      }
    } catch (_) {}
  }

  // 4. Fallback Estético si las APIs públicas de trenes están caídas/timeout:
  // Usa OpenRouteService HGV exclusivamente para la Polyline (geometría),
  // pero forzando que la distancia real se mantenga con la lógica ferroviaria
  // e instruyendo al frontend a renderizar como tren (línea discontinua oscura).
  let usedFallback = false;
  let finalCoordinates = null;
  let finalDistanceMeters = theoreticalRailMeters;
  let routeSource = null;

  if (railResult && railResult.coordinates?.length > 0) {
    finalCoordinates = railResult.coordinates;
    finalDistanceMeters = railResult.trackMeters || theoreticalRailMeters;
    routeSource = railResult.source;
  } else {
    usedFallback = true;
    console.warn("[get-rail-route] Motores ferroviarios públicos no disponibles. Activando fallback estético ORS HGV para polyline.");
    const orsFallback = await fetchOrsHgvPolylineFallback(polLng, polLat, podLng, podLat);
    if (orsFallback && orsFallback.coordinates?.length > 0) {
      finalCoordinates = orsFallback.coordinates;
      routeSource = "ORS-HGV-FALLBACK-POLYLINE";
      // Preservamos la distancia teórica ferroviaria (ignorando los km de carretera de ORS para no corromper la lógica financiera)
      finalDistanceMeters = theoreticalRailMeters;
    } else {
      // Failsafe Geodésico si ORS tampoco responde
      const segments = 24;
      const interpolated = [];
      for (let s = 0; s <= segments; s++) {
        const f = s / segments;
        interpolated.push([
          polLng + (podLng - polLng) * f,
          polLat + (podLat - polLat) * f
        ]);
      }
      finalCoordinates = interpolated;
      routeSource = "RAIL-GEODESIC-FAILSAFE";
      finalDistanceMeters = theoreticalRailMeters;
    }
  }

  const distanceKm = Math.round((finalDistanceMeters / 1000) * 10) / 10;
  const durationSeconds = Math.round((distanceKm / 65) * 3600); // 65 km/h velocidad media de tren de mercancías

  // Construir respuesta GeoJSON estándar compatible con Leaflet y con el ecosistema de la app
  const geojson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: finalCoordinates
        },
        properties: {
          transportMode: "RAIL",
          isRail: true,
          distanceMeters: finalDistanceMeters,
          distanceKm: distanceKm,
          durationSeconds: durationSeconds,
          source: routeSource,
          usedPolylineFallback: usedFallback,
          style: {
            color: "#1e293b",
            dashArray: "10, 10",
            weight: 4,
            opacity: 0.95,
            bedColor: "#64748b",
            bedWeight: 6
          }
        }
      }
    ],
    // Compatibilidad adicional con formato de rutas OSRM para desacoplar el frontend
    routes: [
      {
        distance: finalDistanceMeters,
        duration: durationSeconds,
        geometry: {
          type: "LineString",
          coordinates: finalCoordinates
        },
        legs: [
          {
            steps: [
              {
                name: usedFallback ? "Corredor Férreo (Geometría trazada)" : "Red Ferroviaria / Rail Track Network",
                distance: finalDistanceMeters,
                duration: durationSeconds
              }
            ]
          }
        ]
      }
    ],
    metadata: {
      ok: true,
      polLat,
      polLng,
      podLat,
      podLng,
      distanceKm,
      isRail: true,
      routeSource
    }
  };

  return jsonResponse(geojson, 200);
}
