import type { Config } from "@netlify/functions";

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_DATA_BRIDGE_ORIGIN = "https://calm-shortbread-55bcfc.netlify.app";
const headers = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
};

function readEnvironmentValue(...names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function getDataBridgeOrigin() {
  return readEnvironmentValue(
    "DATA_BRIDGE_API_URL",
    "DATA_BRIDGE_URL",
    "VITE_DATA_BRIDGE_API_URL",
    "VITE_DATA_BRIDGE_URL",
  ) || DEFAULT_DATA_BRIDGE_ORIGIN;
}

function createUpstreamHeaders() {
  const upstreamHeaders = new Headers({ Accept: "application/json" });
  const apiSecret = readEnvironmentValue("DATA_BRIDGE_API_SECRET", "VITE_DATA_BRIDGE_API_SECRET");
  const apiKey = readEnvironmentValue("DATA_BRIDGE_API_KEY", "VITE_DATA_BRIDGE_API_KEY");
  if (apiSecret) upstreamHeaders.set("authorization", `Bearer ${apiSecret}`);
  if (apiKey) upstreamHeaders.set("x-api-key", apiKey);
  return upstreamHeaders;
}

function positiveMarketPrice(value: unknown) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export default async function handler(req: Request) {
  if (req.method !== "GET") {
    return Response.json({ success: false, error: "Method not allowed" }, { status: 405, headers });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL("/api/get-market-data", `${getDataBridgeOrigin().replace(/\/+$/, "")}/`);
  } catch {
    return Response.json({ success: false, error: "Data Bridge target is not configured" }, { status: 503, headers });
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      headers: createUpstreamHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await upstreamResponse.json().catch(() => null);
    if (!upstreamResponse.ok) {
      return Response.json({ success: false, error: "Data Bridge market data unavailable" }, {
        status: upstreamResponse.status,
        headers,
      });
    }

    const record = payload?.data && typeof payload.data === "object" ? payload.data : payload;
    const vlsfo = positiveMarketPrice(record?.vlsfo);
    const hsfo = positiveMarketPrice(record?.hsfo);
    const mgo = positiveMarketPrice(record?.mgo) ?? 750;
    const dieselPrice = positiveMarketPrice(record?.dieselPrice ?? record?.averageFuelPrice) ?? 1.48;
    const tollCostPerKm = positiveMarketPrice(record?.tollCostPerKm) ?? 0.22;
    const fixedDailyCost = positiveMarketPrice(record?.fixedDailyCost) ?? 350.0;
    const dailyPerDiem = positiveMarketPrice(record?.dailyPerDiem) ?? 65.0;

    const safeRecord = {
      ...(typeof record === 'object' && record ? record : {}),
      success: true,
      dieselPrice,
      averageFuelPrice: dieselPrice,
      tollCostPerKm,
      fixedDailyCost,
      dailyPerDiem,
      vlsfo: vlsfo ?? 600,
      hsfo: hsfo ?? 480,
      ifo380: hsfo ?? 480,
      mgo: mgo ?? 750,
      bunkerPrices: {
        vlsfo: vlsfo ?? 600,
        hsfo: hsfo ?? 480,
        ifo380: hsfo ?? 480,
        mgo: mgo ?? 750,
        dieselPrice,
      },
      timestamp: new Date().toISOString(),
      source: 'DataBridge-LandTransport-SSOT',
    };

    return Response.json(safeRecord, { headers });
  } catch (error) {
    console.warn('[get-market-data] Falling back to standard road transport and fuel benchmarks:', error);
    return Response.json({
      success: true,
      dieselPrice: 1.48,
      averageFuelPrice: 1.48,
      tollCostPerKm: 0.22,
      fixedDailyCost: 350.0,
      dailyPerDiem: 65.0,
      vlsfo: 600,
      hsfo: 480,
      ifo380: 480,
      mgo: 750,
      bunkerPrices: {
        vlsfo: 600,
        hsfo: 480,
        ifo380: 480,
        mgo: 750,
        dieselPrice: 1.48,
      },
      timestamp: new Date().toISOString(),
      source: 'DataBridge-LandTransport-Fallback',
    }, {
      status: 200,
      headers,
    });
  }
}

export const config: Config = {
  path: "/api/get-market-data",
};
