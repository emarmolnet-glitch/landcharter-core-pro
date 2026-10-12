// netlify/functions/get-rail-route.js
// Netlify Function Proxy para Motor de Enrutamiento Ferroviario (Trazado Terrestre Protegido + Fallback ORS HGV)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const ORS_API_KEY = process.env.ORS_API_KEY || process.env.OPENROUTESERVICE_API_KEY || "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImZiMzUxZDEyZmE2YzQ5ODk4MWE0NzA2Y2Y4YjEyZjQwIiwiaCI6Im11cm11cjY0In0=";

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
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: `data=${encodeURIComponent(q)}`,
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
 * Motor Terrestre Principal (OpenRouteService HGV):
 * Obtiene la Polyline geográfica de carreteras/puentes/costas para garantizar que
 * el trazado se mantenga siempre sobre tierra firme, usando puentes y bordeando la costa
 * en lugar de cruzar mares o golfos con interpolaciones ciegas.
 */
export async function fetchOrsHgvPolyline(lon1, lat1, lon2, lat2, timeoutMs = 8000) {
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
      const rawSteps = feat?.properties?.segments?.[0]?.steps || [];
      if (coords && coords.length > 0) {
        return {
          coordinates: coords,
          rawSteps,
          source: "ORS-HGV-FALLBACK-POLYLINE"
        };
      }
    }
  } catch (_) {}
  return null;
}

export async function fetchOrsHgvPolylineFallback(lon1, lat1, lon2, lat2, timeoutMs = 8000) {
  return fetchOrsHgvPolyline(lon1, lat1, lon2, lat2, timeoutMs);
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

  // 1. Ruteo Terrestre (Fallback ORS Camuflado):
  // Fuerza el uso del motor de carreteras (OpenRouteService HGV) como método principal
  // para obtener las coordenadas geográficas de la Polyline. Esto garantiza que la ruta
  // trazada respete la tierra firme, use puentes y bordee la costa en lugar de cruzar mares.
  let finalCoordinates = null;
  let finalDistanceMeters = theoreticalRailMeters;
  let routeSource = "ORS-HGV-FALLBACK-POLYLINE";
  let usedFallback = true;

  const orsResult = await fetchOrsHgvPolyline(polLng, polLat, podLng, podLat);
  if (orsResult && orsResult.coordinates?.length > 0) {
    finalCoordinates = orsResult.coordinates;
    // Protección de Datos: El proxy devuelve esta polilínea con source: "ORS-HGV-FALLBACK-POLYLINE",
    // pero sobrescribiendo la distancia real de ORS con la distancia ferroviaria teórica (theoreticalRailMeters)
    // para no corromper la lógica financiera del frontend.
    finalDistanceMeters = theoreticalRailMeters;
    routeSource = "ORS-HGV-FALLBACK-POLYLINE";
    usedFallback = true;
  } else {
    // 2. Redundancia de motores secundarios si ORS no está accesible (ej. timeout o desconexión)
    let altResult = await fetchOsmTrain(polLng, polLat, podLng, podLat);
    if (!altResult) {
      altResult = await fetchBRouterRail(polLng, polLat, podLng, podLat);
    }
    if (!altResult) {
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
          altResult = {
            coordinates: [
              [polLng, polLat],
              ...snappedBrouter.coordinates,
              [podLng, podLat]
            ],
            trackMeters: snappedBrouter.trackMeters || theoreticalRailMeters,
            source: "BROUTER-RAIL-SNAPPED"
          };
        }
      } catch (_) {}
    }

    if (altResult && altResult.coordinates?.length > 0) {
      finalCoordinates = altResult.coordinates;
      finalDistanceMeters = theoreticalRailMeters;
      routeSource = altResult.source || "RAIL-SECONDARY-ROUTING";
    } else {
      // Failsafe mínimo geodésico
      finalCoordinates = [
        [polLng, polLat],
        [podLng, podLat]
      ];
      finalDistanceMeters = theoreticalRailMeters;
      routeSource = "RAIL-GEODESIC-FAILSAFE";
    }
  }

  const distanceKm = Math.round((finalDistanceMeters / 1000) * 10) / 10;
  const durationSeconds = Math.round((distanceKm / 65) * 3600); // 65 km/h velocidad media de tren de mercancías

  // Extracción de Nodos Ferroviarios de Paso (Checkpoints) a lo largo del recorrido
  const checkpoints = [];
  if (finalCoordinates && finalCoordinates.length > 0) {
    const totalPoints = finalCoordinates.length;
    const numCheckpoints = Math.min(8, Math.max(3, Math.round(distanceKm / 80)));
    for (let i = 0; i < numCheckpoints; i++) {
      const progressRatio = i / (numCheckpoints - 1);
      const coordIndex = Math.min(totalPoints - 1, Math.round(progressRatio * (totalPoints - 1)));
      const pt = finalCoordinates[coordIndex];
      const progressPct = Math.round(progressRatio * 100);
      let nodeName = `Nodo Ferroviario km ${Math.round(distanceKm * progressRatio)}`;
      if (i === 0) {
        nodeName = "Terminal Origen (Carga / Enganche)";
      } else if (i === numCheckpoints - 1) {
        nodeName = "Terminal Destino (Descarga / Maniobra)";
      } else if (orsResult?.rawSteps && orsResult.rawSteps.length > 0) {
        // Encontrar paso de ORS más cercano a este waypoint index
        const matchedStep = orsResult.rawSteps.find(s => {
          const wp = s.way_points;
          return wp && coordIndex >= wp[0] && coordIndex <= wp[1] && s.name && s.name !== "-";
        });
        if (matchedStep && matchedStep.name) {
          nodeName = matchedStep.name;
        }
      }
      checkpoints.push({
        index: i + 1,
        name: nodeName,
        coordinates: pt,
        progress: progressPct,
        progressPct
      });
    }
  }

  const steps = checkpoints.length > 0
    ? checkpoints.map(cp => ({
        name: cp.name,
        coordinates: cp.coordinates,
        progress: cp.progress,
        distance: Math.round(finalDistanceMeters * (cp.progress / 100)),
        duration: Math.round(durationSeconds * (cp.progress / 100))
      }))
    : [
        {
          name: "Terminal Ferroviaria Origen (Carga / Enganche)",
          distance: 0,
          duration: 0,
          progress: 0
        },
        {
          name: "Corredor Ferroviario Terrestre (Trazado costero protegido)",
          distance: finalDistanceMeters,
          duration: durationSeconds,
          progress: 50
        },
        {
          name: "Terminal Ferroviaria Destino (Descarga / Maniobra)",
          distance: finalDistanceMeters,
          duration: durationSeconds,
          progress: 100
        }
      ];

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
          checkpoints,
          style: {
            color: "#1e293b",
            dashArray: "10, 15",
            weight: 4,
            opacity: 0.95,
            bedColor: "#64748b",
            bedWeight: 6
          }
        }
      }
    ],
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
            steps
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
      routeSource,
      checkpoints
    }
  };

  return jsonResponse(geojson, 200);
}
