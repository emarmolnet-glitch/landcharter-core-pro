import type { Config, Context } from '@netlify/functions';

const responseHeaders = {
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=900',
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export const VEHICLE_TYPES = [
  { id: 'lona_estandar', name: 'Lona Estándar', payloadKg: 24000, consumptionPer100Km: 31.5, dailyOpex: 340 },
  { id: 'frigorifico', name: 'Frigorífico', payloadKg: 22000, consumptionPer100Km: 34.0, dailyOpex: 390 },
  { id: 'mega_lona', name: 'Mega Lona', payloadKg: 24000, consumptionPer100Km: 33.0, dailyOpex: 350 },
  { id: 'tren_carretera', name: 'Tren de Carretera', payloadKg: 44000, consumptionPer100Km: 42.0, dailyOpex: 450 },
  { id: 'tauliner', name: 'Trailer Tauliner (13.60m)', payloadKg: 24000, consumptionPer100Km: 31.5, dailyOpex: 340 },
  { id: 'frigo', name: 'Trailer Frigorífico', payloadKg: 22000, consumptionPer100Km: 34.0, dailyOpex: 390 },
  { id: 'cisterna', name: 'Cisterna Alimentaria / Química', payloadKg: 25000, consumptionPer100Km: 33.0, dailyOpex: 380 },
  { id: 'banera', name: 'Bañera Basculante (Granel)', payloadKg: 26000, consumptionPer100Km: 35.0, dailyOpex: 360 },
  { id: 'portacontenedor', name: 'Portacontenedor Multimodal', payloadKg: 26000, consumptionPer100Km: 32.0, dailyOpex: 330 },
  { id: 'rigido', name: 'Camión Rígido Pesado (3 Ejes)', payloadKg: 14000, consumptionPer100Km: 24.5, dailyOpex: 280 },
  { id: 'furgon', name: 'Furgoneta / Carrozado Ligero (3.5t)', payloadKg: 3500, consumptionPer100Km: 11.5, dailyOpex: 180 },
  { id: 'duo_trailer', name: 'Duo Trailer / Tren de Carretera', payloadKg: 44000, consumptionPer100Km: 42.0, dailyOpex: 450 },
];

export default async function apiLandDataHandler(request: Request, _context: Context) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  if (request.method !== 'GET') {
    return Response.json(
      { success: false, error: 'Método no permitido.' },
      { status: 405, headers: responseHeaders },
    );
  }

  // Precios de referencia de combustible terrestre europeo (€/litro)
  const dieselPrice = 1.48; // €/L Diésel A
  const adBluePrice = 0.72; // €/L AdBlue
  const averageFuelPrice = 1.48;
  const tollCostPerKm = 0.22; // €/km peajes promedio
  const fixedDailyCost = 350.0; // Coste fijo chófer + amortización
  const dailyPerDiem = 65.0; // Dietas y pernocta diaria

  return Response.json({
    success: true,
    currency: 'EUR',
    currencySymbol: '€',
    distanceUnit: 'km',
    dieselPrice,
    adBluePrice,
    averageFuelPrice,
    tollCostPerKm,
    fixedDailyCost,
    dailyPerDiem,
    vehicleTypes: VEHICLE_TYPES,
    timestamp: new Date().toISOString(),
    source: 'DataBridge-LandTransport-SSOT',
  }, { status: 200, headers: responseHeaders });
}

export const config: Config = {
  path: '/api-land-data',
};
