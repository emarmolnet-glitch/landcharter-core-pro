// netlify/functions/routing-truck.js
// Netlify Function Proxy para OpenRouteService HGV Routing
// Inyecta de forma segura process.env.ORS_API_KEY en la cabecera y protege la API key del frontend

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

async function fetchOsrmFallback(startLon, startLat, endLon, endLat) {
  const osrmEndpoints = [
    `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson&steps=true`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson&steps=true`
  ];

  for (const url of osrmEndpoints) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (res.ok) {
        const json = await res.json();
        const route = json?.routes?.[0];
        if (route?.geometry?.coordinates?.length) {
          return {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: route.geometry.coordinates
                },
                properties: {
                  summary: {
                    distance: route.distance,
                    duration: route.duration
                  },
                  segments: [
                    {
                      distance: route.distance,
                      duration: route.duration,
                      steps: route.legs?.[0]?.steps || []
                    }
                  ],
                  source: "OSRM-FALLBACK"
                }
              }
            ],
            routes: json.routes,
            fallbackApplied: true,
            ok: true
          };
        }
      }
    } catch (_) {}
  }
  return null;
}

export default async function handler(req, context) {
  const isLambda = !req || typeof req.json !== "function";
  const method = isLambda ? (req?.httpMethod || "GET") : req.method;

  if (method === "OPTIONS") {
    if (isLambda) {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const sendJson = (data, status = 200) => {
    if (isLambda) {
      return {
        statusCode: status,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(data),
      };
    }
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  };

  let body = {};
  if (isLambda) {
    if (req?.body) {
      try {
        body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      } catch (_) {
        body = {};
      }
    } else if (req?.queryStringParameters) {
      body = req.queryStringParameters;
    }
  } else {
    if (method === "POST") {
      try {
        body = await req.json();
      } catch (_) {
        body = {};
      }
    } else if (method === "GET") {
      try {
        const url = new URL(req.url);
        const coordsParam = url.searchParams.get("coordinates") || url.searchParams.get("coords");
        if (coordsParam) {
          body.coordinates = JSON.parse(coordsParam);
        } else {
          const start = url.searchParams.get("start");
          const end = url.searchParams.get("end");
          if (start && end) {
            body.coordinates = [
              start.split(",").map(Number),
              end.split(",").map(Number)
            ];
          }
        }
      } catch (_) {}
    }
  }

  let coordinates = body.coordinates;
  if (!coordinates && body.origLon !== undefined && body.origLat !== undefined && body.destLon !== undefined && body.destLat !== undefined) {
    coordinates = [
      [Number(body.origLon), Number(body.origLat)],
      [Number(body.destLon), Number(body.destLat)]
    ];
  } else if (!coordinates && body.start && body.end && Array.isArray(body.start) && Array.isArray(body.end)) {
    coordinates = [body.start, body.end];
  }

  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
    return sendJson({ error: "Missing or invalid coordinates. Expected [[lon, lat], [lon, lat]]" }, 400);
  }

  const startLon = coordinates[0][0];
  const startLat = coordinates[0][1];
  const endLon = coordinates[1][0];
  const endLat = coordinates[1][1];

  const apiKey = process.env.ORS_API_KEY || process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) {
    const fallbackData = await fetchOsrmFallback(startLon, startLat, endLon, endLat);
    if (fallbackData) {
      return sendJson(fallbackData, 200);
    }
    return sendJson({ ok: false, fallbackRequired: true, error: "ORS_API_KEY not configured and OSRM unavailable" }, 200);
  }

  const orsPayload = {
    coordinates,
    ...(body.radiuses && Array.isArray(body.radiuses) ? { radiuses: body.radiuses } : { radiuses: [5000, 5000] }),
    ...(body.extra_info && Array.isArray(body.extra_info) ? { extra_info: body.extra_info } : {}),
    ...(body.preference ? { preference: body.preference } : {}),
    ...(body.options ? { options: body.options } : {})
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const orsRes = await fetch("https://api.openrouteservice.org/v2/directions/driving-hgv/geojson", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey
      },
      body: JSON.stringify(orsPayload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (orsRes.ok) {
      const data = await orsRes.json();
      const coords = data?.features?.[0]?.geometry?.coordinates;
      if (coords && coords.length > 0) {
        return sendJson(data, 200);
      }
    }

    // ORS falló o no tiene cobertura en la zona (ej. Sétif -> Bejaia) -> Fallback transparente a OSRM
    const fallbackData = await fetchOsrmFallback(startLon, startLat, endLon, endLat);
    if (fallbackData) {
      return sendJson(fallbackData, 200);
    }
    return sendJson({ ok: false, fallbackRequired: true, orsStatus: orsRes.status }, 200);
  } catch (err) {
    clearTimeout(timeoutId);
    const fallbackData = await fetchOsrmFallback(startLon, startLat, endLon, endLat);
    if (fallbackData) {
      return sendJson(fallbackData, 200);
    }
    return sendJson({
      ok: false,
      fallbackRequired: true,
      error: "Error forwarding request to OpenRouteService",
      details: err?.message || String(err)
    }, 200);
  }
}

export { handler };
