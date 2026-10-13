import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = process.cwd();

test('1. Eliminación de Interpolación Ciega: get-rail-route.js no contiene fórmulas que tracen sobre el agua', async () => {
  const proxySource = await readFile(resolve(rootDir, 'netlify/functions/get-rail-route.js'), 'utf8');

  // a) No existe generateRailTopographicCheckpoints
  assert.doesNotMatch(proxySource, /generateRailTopographicCheckpoints/, 'Debe estar completamente removida');
  assert.doesNotMatch(proxySource, /RAIL-INTERPOLATED-CHECKPOINTS/, 'No debe existir source de interpolación matemática sobre agua');

  // b) No existen fórmulas sinusoidales / armónicos sobre el mar
  assert.doesNotMatch(proxySource, /maxLateralDeflectionDeg/, 'No debe simular curvas euclídeas directas');
  assert.doesNotMatch(proxySource, /harmonic1.*harmonic2/, 'No debe aplicar armónicos matemáticos a ciegas');
});

test('2. Ruteo Terrestre ORS HGV: método principal con protección de theoreticalRailMeters', async () => {
  const proxySource = await readFile(resolve(rootDir, 'netlify/functions/get-rail-route.js'), 'utf8');

  // a) Presencia de endpoint OpenRouteService HGV y función de consulta
  assert.match(proxySource, /https:\/\/api\.openrouteservice\.org\/v2\/directions\/driving-hgv\/geojson/);
  assert.match(proxySource, /export\s+async\s+function\s+fetchOrsHgvPolyline/);
  assert.match(proxySource, /export\s+async\s+function\s+fetchOrsHgvPolylineFallback/);

  // b) Protección de datos financieros: source "ORS-HGV-FALLBACK-POLYLINE" y sobrescritura con theoreticalRailMeters
  assert.match(proxySource, /source:\s*['"]ORS-HGV-FALLBACK-POLYLINE['"]/);
  assert.match(proxySource, /finalDistanceMeters\s*=\s*theoreticalRailMeters/);
  assert.match(proxySource, /routeSource\s*=\s*['"]ORS-HGV-FALLBACK-POLYLINE['"]/);

  // c) Estilos ferroviarios embebidos en el GeoJSON
  assert.match(proxySource, /color:\s*['"]#1e293b['"]/);
  assert.match(proxySource, /dashArray:\s*['"]10, 15['"]/);
  assert.match(proxySource, /weight:\s*4/);
});

test('3. Verificación Funcional del Handler de get-rail-route.js: devuelve ORS-HGV-FALLBACK-POLYLINE con distancia teórica', async () => {
  const proxySource = await readFile(resolve(rootDir, 'netlify/functions/get-rail-route.js'), 'utf8');

  const sanitizedSource = proxySource
    .replace('export default async function handler(req)', 'async function handler(req)')
    .replace(/export\s+(async\s+)?function\s+/g, '$1function ');
  const wrapped = sanitizedSource + '\nreturn handler(req);';
  const executeHandler = new Function('req', wrapped);

  // Simular POST de ruta costera (ej. Valencia a Barcelona)
  const req = new Request('http://localhost/api/get-rail-route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      polLat: 39.4699,
      polLng: -0.3763,
      podLat: 41.3879,
      podLng: 2.1699
    })
  });

  const res = await executeHandler(req);
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.type, 'FeatureCollection');
  assert.ok(json.features && json.features.length > 0);

  const feat = json.features[0];
  assert.equal(feat.properties.isRail, true);
  assert.equal(feat.properties.transportMode, 'RAIL');
  assert.equal(feat.properties.source, 'ORS-HGV-FALLBACK-POLYLINE');

  // Distancia teórica ferroviaria preservada (aprox ~303km * 1.10 = ~333.3km)
  assert.ok(feat.properties.distanceKm >= 300 && feat.properties.distanceKm <= 400, `Distancia en rango ferroviario: ${feat.properties.distanceKm} km`);
  assert.equal(feat.properties.style.dashArray, '10, 15');
  assert.equal(feat.properties.style.color, '#1e293b');
  assert.equal(feat.properties.style.weight, 4);

  // Coordenadas válidas en tierra firme
  assert.ok(feat.geometry.coordinates.length > 10, 'La polilínea debe contener waypoints terrestres');
});

test('4. Renderizado Frontend Estricto en LazyGlobeMap.tsx: CSS ferroviario cuando globalTransportMode === RAIL', async () => {
  const lazyGlobeSource = await readFile(resolve(rootDir, 'src/components/LazyGlobeMap.tsx'), 'utf8');

  // a) Override CSS infalible para modo tren: dashArray 10 15, peso de 4px, color oscuro
  assert.match(lazyGlobeSource, /stroke-dasharray:\s*10\s+15\s*!important/);
  assert.match(lazyGlobeSource, /stroke-width:\s*4px\s*!important/);
  assert.match(lazyGlobeSource, /stroke:\s*#1e293b\s*!important/);

  // b) Estilado del Polyline de Leaflet: dashArray '10, 15', color '#1e293b', weight 4
  assert.match(lazyGlobeSource, /dashArray:\s*['"]10, 15['"]/);
  assert.match(lazyGlobeSource, /color:\s*['"]#1e293b['"]/);
  assert.match(lazyGlobeSource, /weight:\s*4/);

  // c) Activación estricta de isRail cuando globalTransportMode === 'RAIL'
  assert.match(lazyGlobeSource, /globalTransportMode[\s\S]*?===?\s*['"]RAIL['"]/);
  assert.match(lazyGlobeSource, /globalMode\s*===\s*['"]RAIL['"]/);
  assert.match(lazyGlobeSource, /container\.classList\.add\(['"]train-mode['"]\)/);
});
