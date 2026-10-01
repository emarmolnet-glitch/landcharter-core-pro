import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderWorkspaceSource = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);
const forwarderProjectsSource = readFileSync(
  new URL('../netlify/functions/forwarder-projects.js', import.meta.url),
  'utf8'
);
const syncRoadSource = readFileSync(
  new URL('../netlify/functions/sync-road.ts', import.meta.url),
  'utf8'
);
const dossiersSource = readFileSync(
  new URL('../netlify/functions/dossiers.ts', import.meta.url),
  'utf8'
);
const dataBridgeSyncServiceSource = readFileSync(
  new URL('../dataBridgeSyncService.js', import.meta.url),
  'utf8'
);
const indexHtmlSource = readFileSync(
  new URL('../index.html', import.meta.url),
  'utf8'
);

test('1. IDENTIDAD ÚNICA DE EXPEDIENTE: project_ref es la clave primaria canónica sin split-brain', () => {
  // forwarder-projects.js define helper para resolver referencias canónicas y descartar nombres libres como PK
  assert.match(forwarderProjectsSource, /function isDescriptiveProjectName/);
  assert.match(forwarderProjectsSource, /function resolveCanonicalProjectRef/);

  // forwarder-projects.js guarda títulos descriptivos como metadatos (project_title / description)
  assert.match(forwarderProjectsSource, /project_title/);
  assert.match(forwarderProjectsSource, /description/);

  // sync-road.ts rechaza usar descripciones como ID y las mapea a metadata
  assert.match(syncRoadSource, /isDescriptive/);
  assert.match(syncRoadSource, /descriptiveTitle/);

  // dossiers.ts previene split-brain cuando el usuario o payload envía nombres descriptivos
  assert.match(dossiersSource, /isDescriptiveReference/);

  // ForwarderWorkspace.jsx extrae el título descriptivo como metadato y asegura que project_ref sea canónico
  assert.match(forwarderWorkspaceSource, /isDescriptiveCandidate/);
  assert.match(forwarderWorkspaceSource, /extractedTitle/);
  assert.match(forwarderWorkspaceSource, /project_title:\s*extractedTitle/);
});

test('2. ELIMINAR AUTO-CÁLCULO DE MERCANCÍA: Mercancía inicializada en 0/vacío y no se autocalcula por toneladas', () => {
  // En ForwarderWorkspace, mercanciaCost se inicializa estrictamente en 0 por defecto
  assert.match(
    forwarderWorkspaceSource,
    /const\s+\[mercanciaCost,\s*setMercanciaCost\]\s*=\s*useState\(\(\)\s*=>\s*\{[\s\S]*?return Number\(activeProject\?\.valor_total_mercancia_usd\)\s*\|\|\s*0;/,
    'mercanciaCost must initialize strictly to 0 by default'
  );

  // Se eliminó la fórmula que multiplicaba toneladas por catálogo en autoCalculateEstimates
  assert.doesNotMatch(
    forwarderWorkspaceSource,
    /const\s+autoMercanciaUsd\s*=\s*totalWeightTons\s*\*\s*COMMODITY_VALUES\[cargoType\];/,
    'autoCalculateEstimates must NOT automatically compute merchandise value from weight/tons'
  );

  // Se eliminó el bucle que forzaba valorCalculadoDeItems a multiplicar items por precios de catálogo
  assert.doesNotMatch(
    forwarderWorkspaceSource,
    /valorCalculadoDeItems\s*=\s*cargoArrayForFob\.reduce/,
    'Must NOT calculate FOB merchandise value automatically from cargo items'
  );

  // En dataBridgeSyncService, valor_total_mercancia_usd solo se envía si se ha introducido explícitamente
  assert.match(
    dataBridgeSyncServiceSource,
    /valor_total_mercancia_usd > 0 \? valor_total_mercancia_usd : 0/,
    'dataBridgeSyncService defaults goods value to 0'
  );
});

test('3. EXPORTACIÓN DEL FLETE TERRESTRE COMO COSTE BASE (FLOTA COMPLETA): Inyección de land_freight_cost en Core PRO', () => {
  // dataBridgeSyncService exporta land_freight_cost para la flota total
  assert.match(
    dataBridgeSyncServiceSource,
    /let\s+land_freight_cost\s*=\s*parseLocalizedNumber\(rawFreightCost,\s*0,\s*2\);/,
    'Must parse land_freight_cost'
  );

  // Se emite por BroadcastChannel ROAD_METRICS_SYNC con land_freight_cost
  assert.match(
    dataBridgeSyncServiceSource,
    /type:\s*'ROAD_METRICS_SYNC'/,
    'Must broadcast ROAD_METRICS_SYNC'
  );
  assert.match(
    dataBridgeSyncServiceSource,
    /land_freight_cost:\s*payload\.land_freight_cost/,
    'Must include land_freight_cost in sync message'
  );

  // index.html (Core PRO) escucha el evento ROAD_METRICS_SYNC y almacena land_freight_cost como coste base
  assert.match(
    indexHtmlSource,
    /if\s*\(\s*data\.type\s*===\s*'ROAD_METRICS_SYNC'\s*\)/,
    'Core PRO must handle ROAD_METRICS_SYNC'
  );
  assert.match(
    indexHtmlSource,
    /window\.State\.land_freight_cost\s*=\s*roadCost;/,
    'Core PRO must inject land_freight_cost into State'
  );

  // Core PRO incorpora land_freight_cost a la base de costes compartida para aplicar el margen global
  assert.match(
    indexHtmlSource,
    /const\s+combinedTotalCosts\s*=\s*totalCosts\s*\+\s*rawLandFreightCost;/,
    'getSharedVoyageCostBasis must sum vessel totalCosts + land_freight_cost'
  );

  // En el panel financiero de Core PRO, se suma rawLandFreightCost a totalCost del fletador
  assert.match(
    indexHtmlSource,
    /totalCost\s*\+=\s*rawLandFreightCost;/,
    'Core PRO must add rawLandFreightCost to charterer totalCost'
  );
});
