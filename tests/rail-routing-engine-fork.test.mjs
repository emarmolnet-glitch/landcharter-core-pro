import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = process.cwd();

test('1. Bifurcación del Motor de Ruta: ROAD usa OpenRouteService HGV y RAIL usa motores ferroviarios open-source con Proxy Backend', async () => {
  const indexHtmlSource = await readFile(resolve(rootDir, 'index.html'), 'utf8');

  // a) Presencia de endpoint del Proxy ferroviario en backend
  assert.match(indexHtmlSource, /railProxyEndpoint\s*=[\s\S]*?['"]\/api\/get-rail-route['"]/);

  // b) Invocación al Proxy ferroviario cuando isRailRouting es true
  assert.match(indexHtmlSource, /if\s*\(isRailRouting\)\s*\{[\s\S]*?fetch\(railProxyEndpoint/);

  // c) Preservación de llamada OSRM / OpenRouteService para camiones (ROAD)
  assert.match(indexHtmlSource, /https:\/\/api\.openrouteservice\.org\/v2\/directions\/driving-hgv\/geojson/);
});

test('2. Netlify Function Proxy get-rail-route.js: soporte GET/POST, CORS abierto, eliminación de interpolación ciega y ruteo terrestre ORS HGV', async () => {
  const proxySource = await readFile(resolve(rootDir, 'netlify/functions/get-rail-route.js'), 'utf8');

  // a) Cabeceras CORS abiertas para consumo frontend
  assert.match(proxySource, /"Access-Control-Allow-Origin":\s*"\*"/);
  assert.match(proxySource, /"Access-Control-Allow-Methods":\s*"GET, POST, OPTIONS"/);

  // b) Métodos GET y POST soportados con extracción de coordenadas
  assert.match(proxySource, /req\.method === "GET"/);
  assert.match(proxySource, /req\.method === "POST"/);
  assert.match(proxySource, /polLat.*polLng/);

  // c) Integración de motores open-source de respaldo (routing.openstreetmap.de y BRouter Rail)
  assert.match(proxySource, /routing\.openstreetmap\.de\/routed-train\/route\/v1\/train/);
  assert.match(proxySource, /brouter\.de\/brouter\?lonlats=.*profile=rail/);

  // d) Eliminación de fórmulas matemáticas que ondulan sobre el mar
  assert.doesNotMatch(proxySource, /generateRailTopographicCheckpoints/, 'Debe eliminar por completo generateRailTopographicCheckpoints');
  assert.doesNotMatch(proxySource, /RAIL-INTERPOLATED-CHECKPOINTS/, 'Debe eliminar el trazado ciego de checkpoints');

  // e) Fuerza el uso del motor de carreteras (OpenRouteService HGV) como método principal para obtener Polyline costera
  assert.match(proxySource, /driving-hgv\/geojson/, 'Debe consultar endpoint OpenRouteService HGV');
  assert.match(proxySource, /fetchOrsHgvPolyline/, 'Debe implementar fetchOrsHgvPolyline');
  assert.match(proxySource, /ORS-HGV-FALLBACK-POLYLINE/, 'Debe identificar el source como ORS-HGV-FALLBACK-POLYLINE');
  assert.match(proxySource, /dashArray:\s*['"]10, 15['"]/);

  // f) Protección de datos: distancia teórica de tren
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

  // e) Estilos visuales de vía de tren diferenciados (línea punteada dashArray '10, 15' y balasto/cama)
  assert.match(lazyGlobeSource, /className:\s*['"]leaflet-rail-bed['"]/);
  assert.match(lazyGlobeSource, /className:\s*['"]leaflet-rail-route-highlight['"]/);
  assert.match(lazyGlobeSource, /color:\s*['"]#1e293b['"]/);
  assert.match(lazyGlobeSource, /dashArray:\s*['"]10, 15['"]/);
  assert.match(lazyGlobeSource, /color:\s*['"]#64748b['"]/); // Balasto / cama de vía
  assert.match(lazyGlobeSource, /container\.classList\.add\(['"]train-mode['"]\)/);
});

test('4. Verificación Funcional del Proxy Backend: Ejecución en Node de get-rail-route handler', async () => {
  const proxySource = await readFile(resolve(rootDir, 'netlify/functions/get-rail-route.js'), 'utf8');
  
  // Compilar handler para prueba unitaria eliminando declaraciones export incompatibles con new Function
  const sanitizedSource = proxySource
    .replace('export default async function handler(req)', 'async function handler(req)')
    .replace(/export\s+(async\s+)?function\s+/g, '$1function ');
  const wrapped = sanitizedSource + '\nreturn handler(req);';
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
  assert.ok(feat.geometry.coordinates.length > 30, 'Geometría contiene coordenadas trazadas con curvas');
  assert.equal(feat.properties.style.dashArray, '10, 15');
});

test('5. Ruteo Terrestre con Fallback ORS Camuflado: garantiza polilínea costera sobre tierra firme y protege theoreticalRailMeters', async () => {
  const proxySource = await readFile(resolve(rootDir, 'netlify/functions/get-rail-route.js'), 'utf8');
  
  // a) Verifica que el algoritmo ciego de interpolación ha sido eliminado
  assert.doesNotMatch(proxySource, /function\s+generateRailTopographicCheckpoints/);

  // b) Verifica que fetchOrsHgvPolyline está presente y configurada para driving-hgv
  assert.match(proxySource, /export\s+async\s+function\s+fetchOrsHgvPolyline/);
  assert.match(proxySource, /https:\/\/api\.openrouteservice\.org\/v2\/directions\/driving-hgv\/geojson/);

  // c) Verifica que la distancia de ORS se sobrescribe con theoreticalRailMeters
  assert.match(proxySource, /finalDistanceMeters\s*=\s*theoreticalRailMeters/);
  assert.match(proxySource, /source:\s*routeSource/);
});
