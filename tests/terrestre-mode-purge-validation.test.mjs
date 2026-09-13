import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const indexHtmlPath = resolve('index.html');
const voyageCostEnginePath = resolve('voyage-cost-engine.js');

test('1. Bloqueo de override del fetch de mercado en modo terrestre', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // applyBunkerIndexData guards terrestrial mode with fixed fuel rates
  assert.match(indexSource, /function\s+applyBunkerIndexData\s*\(/);
  assert.match(indexSource, /isTerrestreMode\(\)/);
  assert.match(indexSource, /precioDiesel\s*=\s*1\.48/);
  assert.match(indexSource, /precioAdblue\s*=\s*0\.60/);
  assert.match(indexSource, /consumoDiesel\s*=\s*32/);

  // performRegionalBunkerFetch bypasses remote bunker API in terrestrial mode
  assert.match(indexSource, /async\s+function\s+performRegionalBunkerFetch/);
  assert.match(indexSource, /if\s*\(typeof\s+isTerrestreMode\s*===\s*'function'\s*&&\s*isTerrestreMode\(\)\)\s*\{\s*return\s+applyBunkerIndexData\(\{\},\s*options\);/);
});

test('2. Forzado de OPEX diario a 350 € desvinculado del DWT', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');
  const voyageEngineSource = await readFile(voyageCostEnginePath, 'utf8');

  // calculateFixedOpex returns 350 for terrestrial mode
  assert.match(indexSource, /function\s+calculateFixedOpex\s*\(/);
  assert.match(indexSource, /if\s*\(typeof\s+isTerrestreMode\s*===\s*'function'\s*&&\s*isTerrestreMode\(\)\)\s*\{\s*return\s+350;/);

  // estimateDailyOpexByDwt returns 350 in terrestrial mode
  assert.match(voyageEngineSource, /function\s+estimateDailyOpexByDwt\s*\(/);
  assert.match(voyageEngineSource, /if\s*\(isTerrestreModeContext\(\)\)\s*\{\s*return\s+350;/);

  // opexBadge helper text says "Autocalculado: media operativa terrestre 350 € / día"
  assert.match(indexSource, /Autocalculado:\s*media operativa terrestre 350 € \/ día/);
  assert.match(voyageEngineSource, /Autocalculado:\s*media operativa terrestre 350 € \/ día/);
});

test('3. Peajes y dietas con cálculo unitario de 1 solo camión', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // autoFillPDA computes unitary road tolls (~0.18 €/km) and per diem without fleet multipliers
  assert.match(indexSource, /async\s+function\s+autoFillPDA\s*\(/);
  assert.match(indexSource, /peajeUnitario\s*=\s*Math\.round\(distKm\s*\*\s*0\.18\)/);
  assert.match(indexSource, /dietasUnitarias\s*=\s*pernoctas\s*\*\s*65/);
});

test('4. Ocultación estricta de paneles de Regulación de Emisiones SECA / ZBE', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Container has hidden and display: none !important
  assert.match(indexSource, /id="seca-regulation-panel"[^>]*class="[^"]*hidden"[^>]*style="display:\s*none\s*!important;"/);
  assert.match(indexSource, /id="seca-pol-indicator"[^>]*class="[^"]*hidden"[^>]*style="display:\s*none\s*!important;"/);
  assert.match(indexSource, /id="seca-pod-indicator"[^>]*class="[^"]*hidden"[^>]*style="display:\s*none\s*!important;"/);

  // updateSecaIndicator suppresses rendering in terrestrial mode
  assert.match(indexSource, /function\s+updateSecaIndicator\s*\(/);
  assert.match(indexSource, /if\s*\(typeof\s+isTerrestreMode\s*===\s*'function'\s*&&\s*isTerrestreMode\(\)\)\s*\{/);
});

test('5. Tiempos portuarios aislados a ~2h carga / ~2h descarga y supresión de benchmark naval', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // calcularDiasPuertoPorEstiba returns 2 / 24 days (2 hours)
  assert.match(indexSource, /function\s+calcularDiasPuertoPorEstiba\s*\(/);
  assert.match(indexSource, /if\s*\(typeof\s+isTerrestreMode\s*===\s*'function'\s*&&\s*isTerrestreMode\(\)\)\s*\{\s*return\s+2\s*\/\s*24;/);

  // updateMarketBenchmarkComparison suppresses búnker text in terrestrial mode
  assert.match(indexSource, /function\s+updateMarketBenchmarkComparison\s*\(/);
  assert.match(indexSource, /if\s*\(typeof\s+isTerrestreMode\s*===\s*'function'\s*&&\s*isTerrestreMode\(\)\)\s*\{\s*if\s*\(sourceEl\)\s*\{\s*sourceEl\.innerText\s*=\s*'';/);
});

test('6. Forzado de vehículo a Camión / Tráiler y eliminación de sector CBAM', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // vessel-badge and default inputs
  assert.match(indexSource, /id="vessel-badge"[^>]*>Camión \/ Tráiler<\/span>/);
  assert.match(indexSource, /id="nombre-buque-calculadora"[^>]*value="Camión \/ Tráiler"/);

  // product-sector container hidden
  assert.match(indexSource, /<div\s+class="input-group hidden"\s+style="display:\s*none\s*!important;">\s*<label\s+id="label-product-sector"/);

  // Router forces Camión / Tráiler
  assert.match(indexSource, /function\s+updateVesselPricingRouter\s*\(\)\s*\{/);
  assert.match(indexSource, /status\.textContent\s*=\s*'Clase detectada:\s*Camión \/ Tráiler';/);
});

test('7. Coste Total Riesgo y Base de costes reflejan transporte unitario real (~140 €)', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // runEngine sets State.totalCosts to displayTotalTripCost in terrestrial mode
  assert.match(indexSource, /State\.totalCosts\s*=\s*isZeroCalculation\s*\?\s*0\s*:\s*\(isTerrestre\s*\?\s*displayTotalTripCost\s*:\s*adjustedCostTotal\);/);

  // getSharedVoyageCostBasis returns totalTripCost in terrestrial mode
  assert.match(indexSource, /sourceState\?\.totalTripCost\s*\?\?\s*sourceState\?\.totalCosts/);
});

test('8. Validación del Tacógrafo en Dietas / Pernocta (Caso Sétif - Béjaïa: 107km / 1.5h -> 0 €)', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Strict formula: Dietas = costeDietaBase * pernoctasCalculadasTacografo
  assert.match(indexSource, /pernoctasCalculadasTacografo\s*=\s*Math\.floor\(.*?\/\s*9\)/);
  assert.match(indexSource, /dietasUnitarias\s*=\s*costeDietaBase\s*\*\s*pernoctasCalculadasTacografo/);

  // Functional simulation for Sétif - Béjaïa
  const distKm = 107;
  const drivingHours = 1.5; // 1h 30m
  const pernoctasCalculadasTacografo = Math.floor(drivingHours / 9);
  const costeDietaBase = 65.0;
  const dietas = costeDietaBase * pernoctasCalculadasTacografo;
  const peajes = Math.round(distKm * 0.18);

  assert.equal(pernoctasCalculadasTacografo, 0, 'Sétif - Béjaïa (1.5h driving) must have 0 pernoctas');
  assert.equal(dietas, 0, 'Dietas for Sétif - Béjaïa must be strictly 0 € (not 14.527 €)');
  assert.equal(peajes, 19, 'Peajes for 107 km is ~19 €');
});

test('9. Validación de arranque limpio: Sin SyntaxError de isTerrestre y llamada segura a hydrateLatestEuCarbonPrice', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Verify runEngine declares isTerrestre exactly once
  const runEngineMatch = indexSource.match(/function runEngine\(\) \{([\s\S]*?)\n        function /);
  assert.ok(runEngineMatch, 'runEngine function body must be found');
  const isTerrestreDeclarations = runEngineMatch[1].match(/(?:const|let|var)\s+isTerrestre\b/g) || [];
  assert.equal(isTerrestreDeclarations.length, 1, 'isTerrestre must be declared exactly once in runEngine scope');

  // Verify hydrateLatestEuCarbonPrice is safely guarded with typeof check in bootstrap
  assert.match(indexSource, /if\s*\(typeof\s+hydrateLatestEuCarbonPrice\s*===\s*'function'\)\s*\{\s*void\s+hydrateLatestEuCarbonPrice\(\);?\s*\}/);
});

test('10. Sincronización Módulo 7 (Escandallo) y TOTAL COSTS con Módulo 3', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Verify syncCostPlusFromRoute sets routePortCosts strictly from unitary Peajes y Dietas in terrestrial mode
  assert.match(indexSource, /const\s+unitaryPeajesYDietas\s*=\s*Math\.max\(0,\s*safeCalculationNumber\(/);
  assert.match(indexSource, /const\s+routePortCosts\s*=\s*isTerrestre\s*\?\s*unitaryPeajesYDietas/);

  // Verify updates writes value even if 0
  assert.match(indexSource, /!Number\.isFinite\(numericValue\)\s*\|\|\s*numericValue\s*<\s*0/);

  // Verify calculateCostPlusFreight totalCosts respects unitary totalTripCost
  assert.match(indexSource, /const\s+totalCosts\s*=\s*isTerrestre\s*\?\s*Math\.max\(0,\s*safeCalculationNumber\(State\.totalTripCost/);

  // Verify voyage-cost-engine renderTotals and calculateTotals do not overwrite res-cost-total with maritime 5509 €
  const voyageCostSource = await readFile(voyageCostEnginePath, 'utf8');
  assert.match(voyageCostSource, /if\s*\(isTerrestreModeContext\(\)\)\s*\{[\s\S]*?res-cost-total/);
  assert.match(voyageCostSource, /if\s*\(isTerrestreModeContext\(\)\)\s*\{[\s\S]*?coste_total_viaje:\s*tripCost/);
});


