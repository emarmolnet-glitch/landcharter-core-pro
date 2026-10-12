import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = resolve(process.cwd());

test('1. Bifurcación del Motor de Ruta: ROAD usa OpenRouteService HGV y RAIL usa motores ferroviarios open-source con Proxy Backend', async () => {
  const indexHtml = await readFile(resolve(rootDir, 'index.html'), 'utf8');

  // a) Detección de modo y variable isRailRouting en index.html
  assert.match(indexHtml, /const currentGlobalMode = \(typeof window !== ['"]undefined['"] && window\.globalTransportMode\)/);
  assert.match(indexHtml, /const isRailRouting = \(currentGlobalMode === ['"]RAIL['"]\)/);

  // b) Cuando isRailRouting es true, bypass de OpenRouteService HGV e invocación del proxy backend
  assert.match(indexHtml, /if \(isRailRouting\) \{/);
  assert.match(indexHtml, /Modo RAIL activado: consultando proxy backend \(\/api\/get-rail-route\)/);
  assert.match(indexHtml, /\/api\/get-rail-route/);
  assert.match(indexHtml, /routeSource = feat\.properties\?\.source \|\| ['"]PROXY-NETLIFY-RAIL['"]/);

  // c) Cuando no es RAIL (es ROAD), se ejecuta OpenRouteService HGV como intento 1
  assert.match(indexHtml, /\} else \{[\s\S]*MODO ROAD: Mantener OpenRouteService HGV/);
  assert.match(indexHtml, /https:\/\/api\.openrouteservice\.org\/v2\/directions\/driving-hgv\/geojson/);
  assert.match(indexHtml, /radiuses:\s*\[5000,\s*5000\]/);
  assert.match(indexHtml, /extra_info:\s*\[["']tollways["']\]/);

  // d) Peajes exentos en modo ferrocarril (0 € peajes para trenes)
  assert.match(indexHtml, /let tollEstimationMode = isRailRouting \? ['"]rail_exempt['"] : ['"]detected['"]/);
  assert.match(indexHtml, /if \(isRailRouting\) \{\s*totalTollsCost = 0;\s*\}/);
});

test('2. Netlify Function Proxy get-rail-route.js: soporte GET/POST, CORS abierto y Fallback ORS HGV', async () => {
  const proxySource = await readFile(resolve(rootDir, 'netlify/functions/get-rail-route.js'), 'utf8');

  // a) Cabeceras CORS abiertas
  assert.match(proxySource, /"Access-Control-Allow-Origin":\s*"\*"/);
  assert.match(proxySource, /req\.method === "OPTIONS"/);

  // b) Soporte GET y POST con coordenadas
  assert.match(proxySource, /req\.method === "GET"/);
  assert.match(proxySource, /req\.method === "POST"/);
  assert.match(proxySource, /polLat.*polLng/);

  // c) Integración de motores open-source (routing.openstreetmap.de y BRouter Rail)
  assert.match(proxySource, /routing\.openstreetmap\.de\/routed-train\/route\/v1\/train/);
  assert.match(proxySource, /brouter\.de\/brouter\?lonlats=.*profile=rail/);

  // d) Fallback Estético con OpenRouteService HGV para obtener Polyline de trazado continuo
  assert.match(proxySource, /fetchOrsHgvPolylineFallback/);
  assert.match(proxySource, /api\.openrouteservice\.org\/v2\/directions\/driving-hgv\/geojson/);
  assert.match(proxySource, /usedPolylineFallback/);
  assert.match(proxySource, /ORS-HGV-FALLBACK-POLYLINE/);

  // e) Protección de distancia teórica de tren (ignorando distancia de carretera de ORS)
  assert.match(proxySource, /theoreticalRailMeters/);
});

test('3. Adaptación del Renderizado del Mapa en LazyGlobeMap.tsx: Agnóstico a GeoJSON y estilado ferroviario diferenciado', async () => {
  const lazyGlobeSource = await readFile(resolve(rootDir, 'src/components/LazyGlobeMap.tsx'), 'utf8');

  // a) Exportación de parser agnóstico de GeoJSON a pares [lat, lon]
  assert.match(lazyGlobeSource, /export function parseGeoJsonOrCoords\(data: any\)/);
  assert.match(lazyGlobeSource, /feat\?\.geometry/);
  assert.match(lazyGlobeSource, /coords\.map\(\(c: any\) => \[c\[1\],\s*c\[0\]\]\)/);

  // b) Interface GlobeMapProps soporta routeGeoJson e isRail
  assert.match(lazyGlobeSource, /routeGeoJson\?: any;/);
  assert.match(lazyGlobeSource, /isRail\?: boolean;/);

  // c) Detección de modo tren a partir de globalTransportMode y State
  assert.match(lazyGlobeSource, /currentMode === ['"]RAIL['"]/);
  assert.match(lazyGlobeSource, /window\.addEventListener\(['"]globaltransportmodechange['"]/);
  assert.match(lazyGlobeSource, /window\.addEventListener\(['"]transport-mode-changed['"]/);

  // d) Escucha de eventos tanto para carretera (osrm:route-updated) como ferrocarril (rail:route-updated)
  assert.match(lazyGlobeSource, /window\.addEventListener\(['"]osrm:route-updated['"]/);
  assert.match(lazyGlobeSource, /window\.addEventListener\(['"]rail:route-updated['"]/);

  // e) Estilos visuales de vía de tren diferenciados (línea punteada oscura y balasto/cama)
  assert.match(lazyGlobeSource, /className:\s*['"]leaflet-rail-bed['"]/);
  assert.match(lazyGlobeSource, /className:\s*['"]leaflet-rail-route-highlight['"]/);
  assert.match(lazyGlobeSource, /color:\s*['"]#1e293b['"]/);
  assert.match(lazyGlobeSource, /dashArray:\s*['"]10, 10['"]/);
  assert.match(lazyGlobeSource, /color:\s*['"]#64748b['"]/); // Balasto / cama de vía
  assert.match(lazyGlobeSource, /container\.classList\.add\(['"]train-mode['"]\)/);
});

test('4. Verificación Funcional del Proxy Backend: Ejecución en Node de get-rail-route handler', async () => {
  const proxySource = await readFile(resolve(rootDir, 'netlify/functions/get-rail-route.js'), 'utf8');
  
  // Compilar handler para prueba unitaria
  const wrapped = proxySource
    .replace('export default async function handler(req)', 'async function handler(req)')
    + '\nreturn handler(req);';
  const executeHandler = new Function('req', wrapped);

  // a) Preflight OPTIONS devuelve 204 y cabecera Access-Control-Allow-Origin
  const optReq = new Request('http://localhost/api/get-rail-route', { method: 'OPTIONS' });
  const optRes = await executeHandler(optReq);
  assert.equal(optRes.status, 204);
  assert.equal(optRes.headers.get('Access-Control-Allow-Origin'), '*');

  // b) POST con origen Madrid Atocha y destino Barcelona Sants
  const postReq = new Request('http://localhost/api/get-rail-route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      polLat: 40.4065,
      polLng: -3.6905,
      podLat: 41.3790,
      podLng: 2.1400
    })
  });
  const postRes = await executeHandler(postReq);
  assert.equal(postRes.status, 200);

  const json = await postRes.json();
  assert.equal(json.type, 'FeatureCollection');
  assert.ok(json.features && json.features.length > 0);

  const feat = json.features[0];
  assert.equal(feat.properties.isRail, true);
  assert.equal(feat.properties.transportMode, 'RAIL');
  assert.ok(feat.properties.distanceKm > 400 && feat.properties.distanceKm < 800, `Distancia en rango ferroviario: ${feat.properties.distanceKm} km`);
  assert.ok(feat.geometry.coordinates.length > 50, 'Geometría contiene coordenadas trazadas');
  assert.equal(feat.properties.style.dashArray, '10, 10');
});
