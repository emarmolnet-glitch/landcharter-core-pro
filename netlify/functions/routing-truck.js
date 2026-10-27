// netlify/functions/routing-truck.js
// Netlify Function Proxy para OpenRouteService HGV Routing
// Inyecta de forma segura process.env.ORS_API_KEY en la cabecera y protege la API key del frontend

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

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

  const apiKey = process.env.ORS_API_KEY || process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) {
    return sendJson({ error: "ORS_API_KEY environment variable is not configured" }, 500);
  }

  const orsPayload = {
    coordinates,
    ...(body.radiuses && Array.isArray(body.radiuses) ? { radiuses: body.radiuses } : { radiuses: [5000, 5000] }),
    ...(body.extra_info && Array.isArray(body.extra_info) ? { extra_info: body.extra_info } : {}),
    ...(body.preference ? { preference: body.preference } : {}),
    ...(body.options ? { options: body.options } : {})
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

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

    const data = await orsRes.json();
    return sendJson(data, orsRes.status);
  } catch (err) {
    clearTimeout(timeoutId);
    return sendJson({
      error: "Error forwarding request to OpenRouteService",
      details: err?.message || String(err)
    }, 502);
  }
}

export { handler };
