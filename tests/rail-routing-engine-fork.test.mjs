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

test('2. Netlify Function Proxy get-rail-route.js: soporte GET/POST, CORS abierto, abandono de HGV y fallback con checkpoints topográficos', async () => {
  const proxySource = await readFile(resolve(rootDir, 'netlify/functions/get-rail-route.js'), 'utf8');

  // a) Cabeceras CORS abiertas para consumo frontend
  assert.match(proxySource, /"Access-Control-Allow-Origin":\s*"\*"/);
  assert.match(proxySource, /"Access-Control-Allow-Methods":\s*"GET, POST, OPTIONS"/);

  // b) Métodos GET y POST soportados con extracción de coordenadas
  assert.match(proxySource, /req\.method === "GET"/);
  assert.match(proxySource, /req\.method === "POST"/);
  assert.match(proxySource, /polLat.*polLng/);

  // c) Integración de motores open-source (routing.openstreetmap.de y BRouter Rail)
  assert.match(proxySource, /routing\.openstreetmap\.de\/routed-train\/route\/v1\/train/);
  assert.match(proxySource, /brouter\.de\/brouter\?lonlats=.*profile=rail/);

  // d) Abandono del fallback de carreteras HGV
  assert.doesNotMatch(proxySource, /driving-hgv\/geojson/, 'Debe abandonar el fallback de carreteras HGV');
  assert.doesNotMatch(proxySource, /fetchOrsHgvPolylineFallback/, 'Debe eliminar la función fetchOrsHgvPolylineFallback');

  // e) Algoritmo de Interpolación Ferroviaria con Checkpoints y Curvas Topográficas Simuladas
  assert.match(proxySource, /generateRailTopographicCheckpoints/);
  assert.match(proxySource, /RAIL-INTERPOLATED-CHECKPOINTS/);
  assert.match(proxySource, /checkpoints/);
  assert.match(proxySource, /dashArray:\s*['"]10, 15['"]/);

  // f) Protección de distancia teórica de tren
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
    .replace(/export\s+function\s+/g, 'function ');
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

test('5. Algoritmo de Interpolación Topográfica con Checkpoints: genera curvas orográficas realistas y checkpoints', async () => {
  const proxySource = await readFile(resolve(rootDir, 'netlify/functions/get-rail-route.js'), 'utf8');
  
  const sanitizedSource = proxySource
    .replace(/export\s+function\s+/g, 'function ')
    .replace(/export\s+default\s+async\s+function\s+handler[\s\S]*$/, '');
  const wrappedTopo = sanitizedSource + '\nreturn generateRailTopographicCheckpoints(polLat, polLng, podLat, podLng, straightKm);';
  const executeTopo = new Function('polLat', 'polLng', 'podLat', 'podLng', 'straightKm', wrappedTopo);

  const polLat = 40.4168; // Madrid
  const polLng = -3.7038;
  const podLat = 41.3879; // Barcelona
  const podLng = 2.1699;
  const straightKm = 505;

  const result = executeTopo(polLat, polLng, podLat, podLng, straightKm);

  // a) Coordenadas de inicio y fin coinciden exactamente
  assert.deepEqual(result.coordinates[0], [polLng, polLat]);
  assert.deepEqual(result.coordinates[result.coordinates.length - 1], [podLng, podLat]);

  // b) Se han generado waypoints suficientes para suavidad visual
  assert.ok(result.coordinates.length >= 36, `Debe generar al menos 36 waypoints: ${result.coordinates.length}`);

  // c) No es una línea recta: puntos intermedios tienen desviación lateral
  let hasCurvature = false;
  const dLng = podLng - polLng;
  const dLat = podLat - polLat;
  for (let i = 1; i < result.coordinates.length - 1; i++) {
    const t = i / (result.coordinates.length - 1);
    const expectedStraightLng = polLng + dLng * t;
    const actualLng = result.coordinates[i][0];
    if (Math.abs(actualLng - expectedStraightLng) > 0.005) {
      hasCurvature = true;
      break;
    }
  }
  assert.ok(hasCurvature, 'La polilínea debe incluir curvatura topográfica simulada');

  // d) Contiene checkpoints simulados
  assert.ok(Array.isArray(result.checkpoints) && result.checkpoints.length > 0, 'Debe incluir checkpoints simulados');
  assert.ok(result.checkpoints[0].name.includes('Checkpoint Férreo'), 'Nombre de checkpoint debe ser descriptivo');
  assert.ok(result.distanceMeters > straightKm * 1000, 'Distancia ferroviaria con curvas debe superar la línea recta');
});
