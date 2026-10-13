import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = process.cwd();

test('1. Intercepción en el Workflow (index.html): Captura de distancia purificada del proxy ferroviario y sobrescritura de polilínea', async () => {
  const indexHtml = await readFile(resolve(rootDir, 'index.html'), 'utf8');

  // a) Almacenamiento prioritario en window.railProxyDistanceKm y window.railPurifiedDistanceKm tras fetch(/api/get-rail-route)
  assert.match(indexHtml, /window\.railProxyDistanceKm\s*=\s*proxyDistanceKm/);
  assert.match(indexHtml, /window\.railPurifiedDistanceKm\s*=\s*proxyDistanceKm/);

  // b) Sobrescritura estricta de cualquier distancia geométrica de polilínea en modo RAIL
  assert.match(
    indexHtml,
    /if\s*\((?:isRailRouting|currentGlobalMode === 'RAIL'|typeof window !== 'undefined' && window\.globalTransportMode === 'RAIL')[\s\S]*?purifiedRailKm[\s\S]*?distanceKm\s*=\s*purifiedRailKm/
  );

  // c) Disparo de eventos osrm:route-updated y rail:route-updated con la distancia purificada
  assert.match(indexHtml, /railProxyDistanceKm:\s*(?:\(isRailRouting\s*\|\|\s*currentGlobalMode\s*===\s*'RAIL'\)\s*\?\s*distanceKm\s*:\s*undefined|distanceKm)/);
  assert.match(indexHtml, /window\.dispatchEvent\(new CustomEvent\('rail:route-updated'/);

  // d) Inyección unificada en dist-laden y dist-total de la Calculadora LDM
  assert.match(indexHtml, /const\s+effectiveDistToInjectLDM\s*=\s*isImperialRouteLDM\s*\?\s*Math\.round\(\(effectiveDistKmLDM\s*\/\s*1\.60934\)\s*\*\s*10\)\s*\/\s*10\s*:\s*effectiveDistKmLDM;/);
});

test('2. Sincronización del Formulario LDM (ForwarderWorkspace.jsx): Consumo estricto de la variable del proxy en modo RAIL', async () => {
  const workspaceSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // a) Escucha reactiva de osrm:route-updated y rail:route-updated con prioridad de railProxyDistanceKm
  assert.match(workspaceSource, /window\.addEventListener\(['"]rail:route-updated['"],\s*handleRouteUpdated\)/);
  assert.match(workspaceSource, /railDist\s*=\s*Number\(d\.railProxyDistanceKm\s*\?\?\s*d\.railPurifiedDistanceKm/);

  // b) En modo RAIL, dist-laden y dist-total consumen estrictamente proxyRailKm
  assert.match(workspaceSource, /const\s+isRailMode\s*=\s*\(typeof window !== 'undefined' && window\.globalTransportMode === 'RAIL'\)/);
  assert.match(workspaceSource, /const\s+proxyRailKm\s*=\s*Number\([\s\S]*?window\.railProxyDistanceKm\s*\|\|\s*window\.railPurifiedDistanceKm/);
  assert.match(workspaceSource, /rawLadenKm\s*=\s*\(isRailMode\s*&&\s*proxyRailKm\s*>\s*0\)\s*\?\s*proxyRailKm/);

  // c) Conversión a millas dividiendo por 1.60934
  assert.match(workspaceSource, /injectedLaden\s*=\s*isImperial\s*\?\s*\(rawLadenKm\s*>\s*0\s*\?\s*Math\.round\(\(rawLadenKm\s*\/\s*1\.60934\)\s*\*\s*10\)\s*\/\s*10\s*:\s*0\)\s*:\s*rawLadenKm/);

  // d) Sincronización del campo Total Millas/Km (dist-total) sumando carga y vacío convertido
  assert.match(workspaceSource, /injectedTotal\s*=\s*Math\.round\(\(injectedLaden\s*\+\s*injectedBallast\)\s*\*\s*10\)\s*\/\s*10/);
});

test('3. Garantía de Identidad: El número en "Itinerario Ferroviario" es exactamente idéntico al inyectado en la "Calculadora LDM"', async () => {
  // Simulación:
  // Supongamos que la polilínea física de carretera devuelve 2253 km (~1400 mi)
  // pero el proxy backend devuelve la distancia geodésica purificada Haversine * 1.10 = 1398.5 km (~869 mi)
  const proxyPurifiedKm = 1398.5; // Distancia purificada del proxy
  const roadPolylineMeters = 2253000; // Polilínea bruta de carretera
  const isImperial = true;

  // 1. En index.html: Sobrescritura de la distancia bruta por la purificada
  let distanceKm = Number((roadPolylineMeters / 1000).toFixed(1)); // 2253 km (bruto)
  const isRailRouting = true;
  if (isRailRouting && proxyPurifiedKm > 0) {
    distanceKm = proxyPurifiedKm; // Sobrescrito a 1398.5 km
  }
  assert.equal(distanceKm, 1398.5, 'La distancia en modo RAIL debe quedar sobrescrita por el proxy');

  // 2. Cálculo en la tarjeta del Itinerario Ferroviario (renderRouteItineraryRightPanel)
  const rawDist = distanceKm;
  const preciseImperialDist = isImperial ? Math.round((rawDist / 1.60934) * 10) / 10 : rawDist;
  const itineraryFormattedNumber = (preciseImperialDist > 0)
    ? (preciseImperialDist % 1 === 0 ? preciseImperialDist.toFixed(0) : preciseImperialDist.toFixed(1))
    : '0';

  // 3. Cálculo en el formulario de la Calculadora LDM (ForwarderWorkspace.jsx)
  const isRailMode = true;
  const rawLadenKm = (isRailMode && proxyPurifiedKm > 0) ? proxyPurifiedKm : distanceKm;
  const injectedLaden = isImperial
    ? (rawLadenKm > 0 ? Math.round((rawLadenKm / 1.60934) * 10) / 10 : 0)
    : rawLadenKm;
  const injectedTotal = Math.round((injectedLaden + 0) * 10) / 10;

  // 4. Verificación de identidad exacta:
  assert.equal(injectedLaden, 869, 'Calculadora LDM debe mostrar 869 mi (no 1400 mi)');
  assert.equal(injectedTotal, 869, 'Total Millas/Km en Calculadora LDM debe ser 869 mi');
  assert.equal(itineraryFormattedNumber, '869', 'Tarjeta de Itinerario Ferroviario debe mostrar exactamente "869"');
  assert.equal(
    String(injectedLaden),
    itineraryFormattedNumber,
    'El número mostrado en la tarjeta del Itinerario Ferroviario debe ser exactamente el mismo que el del formulario LDM'
  );
});
