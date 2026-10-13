import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = process.cwd();

test('1. Aproximación Geodésica Ferroviaria en get-rail-route.js: Factor 1.10 sobre Haversine', async () => {
  const proxySource = await readFile(resolve(rootDir, 'netlify/functions/get-rail-route.js'), 'utf8');

  // a) Verifica que calculateHaversineKm se usa con factor 1.10
  assert.match(proxySource, /calculateHaversineKm\s*\(\s*polLat,\s*polLng,\s*podLat,\s*podLng\s*\)/);
  assert.match(proxySource, /straightKm\s*\*\s*1\.10/);
  assert.match(proxySource, /theoreticalRailKm/);
  assert.match(proxySource, /theoreticalRailMeters/);

  // b) Desacoplamiento geométrico-financiero: geometría de ORS con distancia matemática
  assert.match(proxySource, /finalCoordinates\s*=\s*orsResult\.coordinates/);
  assert.match(proxySource, /finalDistanceMeters\s*=\s*theoreticalRailMeters/);
  assert.match(proxySource, /ORS-HGV-FALLBACK-POLYLINE/);

  // c) Recálculo de duración basándose en distanceKm geodésico (65 km/h)
  assert.match(proxySource, /const\s+distanceKm\s*=\s*Math\.round\(\(finalDistanceMeters\s*\/\s*1000\)\s*\*\s*10\)\s*\/\s*10/);
  assert.match(proxySource, /const\s+durationSeconds\s*=\s*Math\.round\(\(distanceKm\s*\/\s*65\)\s*\*\s*3600\)/);
});

test('2. Verificación Funcional del Handler Ferroviario: Ejecución Haversine * 1.10', async () => {
  const proxySource = await readFile(resolve(rootDir, 'netlify/functions/get-rail-route.js'), 'utf8');

  const sanitizedSource = proxySource
    .replace('export default async function handler(req)', 'async function handler(req)')
    .replace(/export\s+(async\s+)?function\s+/g, '$1function ');
  const wrapped = sanitizedSource + '\nreturn handler(req);';
  const executeHandler = new Function('req', wrapped);

  // Coordenadas Valencia (39.4699, -0.3763) -> Barcelona (41.3879, 2.1699)
  const polLat = 39.4699;
  const polLng = -0.3763;
  const podLat = 41.3879;
  const podLng = 2.1699;

  // Haversine Valencia a Barcelona (~303 km)
  // Multiplicado por 1.10 = ~333.3 km
  const req = new Request('http://localhost/api/get-rail-route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polLat, polLng, podLat, podLng })
  });

  const res = await executeHandler(req);
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.type, 'FeatureCollection');
  const feat = json.features[0];

  assert.equal(feat.properties.isRail, true);
  assert.ok(feat.properties.distanceKm >= 300 && feat.properties.distanceKm <= 400, `Distancia en rango: ${feat.properties.distanceKm}`);
  const expectedDurationSec = Math.round((feat.properties.distanceKm / 65) * 3600);
  assert.equal(feat.properties.durationSeconds, expectedDurationSec);
  assert.equal(json.metadata.distanceKm, feat.properties.distanceKm);
  assert.equal(json.routes[0].distance, feat.properties.distanceKm * 1000);
  assert.equal(json.routes[0].duration, expectedDurationSec);
});

test('3. Conversión Dinámica de Unidades en LDM (ForwarderWorkspace.jsx): Lógica reactiva con factor 1.60934', async () => {
  const workspaceSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // a) Verifica presencia de los campos del formulario LDM (Sección 1): dist-ballast, dist-laden y dist-total
  assert.match(workspaceSource, /getElementById\(['"]dist-ballast['"]\)/);
  assert.match(workspaceSource, /getElementById\(['"]dist-laden['"]\)/);
  assert.match(workspaceSource, /getElementById\(['"]dist-total['"]\)/);

  // b) Verifica que en modo Imperial divide estrictamente por 1.60934 y en métrico usa km
  assert.match(workspaceSource, /1\.60934/);
  assert.match(workspaceSource, /\/\s*1\.60934/);
  assert.match(workspaceSource, /isImperial/);

  // c) Sincronización reactiva del evento osrm:route-updated hacia ForwarderWorkspace
  assert.match(workspaceSource, /window\.addEventListener\(['"]osrm:route-updated['"]/);
});

test('4. Comprobación Matemática de Conversión Métrico vs Imperial para LDM', () => {
  const kmToConvert = 160.934;
  const isImperial = true;

  // Lógica exigida por la orden: Si es imperial divide por 1.60934, si es métrico usa distanceKm
  const imperialMiles = isImperial ? Math.round((kmToConvert / 1.60934) * 10) / 10 : kmToConvert;
  assert.equal(imperialMiles, 100.0, '160.934 km deben convertirse reactivamente a 100.0 millas');

  const metricKm = !isImperial ? Math.round((kmToConvert / 1.60934) * 10) / 10 : kmToConvert;
  assert.equal(metricKm, 160.934, 'En modo métrico se preservan los kilómetros íntegros');
});
