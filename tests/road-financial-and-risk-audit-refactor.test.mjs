import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const indexHtmlPath = resolve('index.html');
const voyageCostEnginePath = resolve('voyage-cost-engine.js');
const tceWorkspacePath = resolve('TceCalculatorWorkspace.tsx');
const chatAssistantPath = resolve('netlify/functions/chat-assistant.js');
const getMarketDataPath = resolve('netlify/functions/get-market-data.mts');

const [indexSource, voyageCostSource, tceSource, chatSource, marketDataSource] = await Promise.all([
  readFile(indexHtmlPath, 'utf8'),
  readFile(voyageCostEnginePath, 'utf8'),
  readFile(tceWorkspacePath, 'utf8'),
  readFile(chatAssistantPath, 'utf8'),
  readFile(getMarketDataPath, 'utf8'),
]);

test('1. Financial Refactor - Diesel fuel formula in Calculator / Executive Report', async () => {
  // Fuel: (Distancia Total / 100) * Consumo Tráiler (32 L/100km) * Precio Diésel local
  assert.match(indexSource, /totalDieselLiters\s*=\s*\(\s*totalKm\s*\/\s*100\s*\)\s*\*\s*trailerConsumption/);
  assert.match(indexSource, /totalFuelCost\s*=\s*totalDieselLiters\s*\*\s*dieselPrice/);
  assert.match(tceSource, /landFuelCost\s*=\s*\(\s*totalKm\s*\/\s*100\s*\)\s*\*\s*vehicleConsumption\s*\*\s*dieselPrice/);

  // Check 32 L/100km standard trailer consumption default
  assert.match(indexSource, /trailerConsumption\s*=\s*Number\(State\.vehicleConsumption\)\s*\|\|\s*32\.0/);
  assert.match(tceSource, /vehicleConsumption\s*=\s*\(typeof window !== 'undefined'\s*\?\s*\(window\.State\?\.vehicleConsumption\s*\|\|\s*32\.0\)\s*:\s*32\.0\)/);
});

test('2. Financial Refactor - Operating Expenses: Peajes + Dietas + Coste diario por tacógrafo', async () => {
  // Operating costs: Tolls + Driver per diems + Route daily cost (based on tachograph days)
  assert.match(indexSource, /totalOperatingExpenses\s*=\s*totalTollsCost\s*\+\s*totalPerDiemsCost\s*\+\s*totalRouteDailyCost/);
  assert.match(indexSource, /totalTollsCost\s*=\s*totalKm\s*\*\s*tollCostPerKm/);
  assert.match(indexSource, /totalPerDiemsCost\s*=\s*tachographDays\s*\*\s*dailyPerDiem/);
  assert.match(indexSource, /totalRouteDailyCost\s*=\s*tachographDays\s*\*\s*fixedDailyCost/);

  // Check in TceCalculatorWorkspace
  assert.match(tceSource, /landOperatingCost\s*=\s*landTollCost\s*\+\s*driverPerDiemCost\s*\+\s*routeDailyCost/);
  assert.match(tceSource, /tachographDays\s*=\s*Math\.max\(1,\s*Math\.ceil\(drivingHours\s*\/\s*9\)\)/);
});

test('3. Financial Refactor - Key Executive Metrics: Coste por Km, Coste por Tonelada, Margen de Beneficio', async () => {
  // Executive Report presents: Coste por Km, Coste por Tonelada, and Margen de Beneficio
  assert.match(indexSource, /costPerKm\s*=\s*totalKm\s*>\s*0\s*\?\s*\(totalTripCost\s*\/\s*totalKm\)\s*:\s*0/);
  assert.match(indexSource, /costPerTon\s*=\s*cargoTon\s*>\s*0\s*\?\s*\(totalTripCost\s*\/\s*cargoTon\)\s*:\s*0/);
  assert.match(indexSource, /profitMarginEur\s*=\s*grossFreightRevenue\s*-\s*totalTripCost/);

  // Visible in the modal UI
  assert.match(indexSource, /Coste por Kilómetro:/);
  assert.match(indexSource, /Coste por Tonelada:/);
  assert.match(indexSource, /Margen de Beneficio \(€\):/);
  assert.match(indexSource, /Margen de Beneficio s\/ Flete \(%\):/);

  // And in TceCalculatorWorkspace
  assert.match(tceSource, /costPerKm/);
  assert.match(tceSource, /costPerTon/);
  assert.match(tceSource, /profitMargin:\s*calculatedMargin/);
});

test('4. Risk Audit Refactor - Purged maritime risks and implemented road risks', async () => {
  // Purged from executive risk evaluation: no piracy, no JWC zones, no Draft/Calado restrictions
  assert.match(voyageCostSource, /function evaluateRoadOperationalRisks/);
  assert.match(voyageCostSource, /hasBorderRisk/);
  assert.match(voyageCostSource, /hasTachographRisk/);
  assert.match(voyageCostSource, /hasAdrRisk/);

  // 1) Border Risk (Posibles demoras aduaneras)
  assert.match(voyageCostSource, /Posibles demoras aduaneras/);
  assert.match(indexSource, /Posibles demoras aduaneras/);
  assert.match(chatSource, /Posibles demoras aduaneras/);

  // 2) Tachograph Risk (Ruta requiere 2 conductores o pernocta obligatoria)
  assert.match(voyageCostSource, /Ruta requiere 2 conductores o pernocta obligatoria/);
  assert.match(indexSource, /Ruta requiere 2 conductores o pernocta obligatoria/);
  assert.match(chatSource, /Ruta requiere 2 conductores o pernocta obligatoria/);

  // 3) ADR Risk (Posibles restricciones en túneles o peajes)
  assert.match(voyageCostSource, /Posibles restricciones en túneles o peajes/);
  assert.match(indexSource, /Posibles restricciones en túneles o peajes/);
  assert.match(chatSource, /Posibles restricciones en túneles o peajes/);
});

test('5. Operational Stability - Market data and Chat Assistant do not fail on VLSFO', async () => {
  // get-market-data provides safe diesel and fallback bunker prices without 502 error
  assert.match(marketDataSource, /dieselPrice/);
  assert.match(marketDataSource, /source:\s*'DataBridge-LandTransport-SSOT'/);
  assert.match(marketDataSource, /source:\s*'DataBridge-LandTransport-Fallback'/);

  // chat-assistant never complains about missing VLSFO
  assert.match(chatSource, /NUNCA exijas ni te quejes de que falta combustible marítimo VLSFO/);
  assert.match(chatSource, /NUNCA te quejes de que falta búnker marítimo o VLSFO/);
});

test('6. Startup Clean Execution - No duplicate modeNarrative and safe autoFillBunkers guarding', async () => {
  // Extract generateExecutiveReport function body
  const execStart = indexSource.indexOf('function generateExecutiveReport()');
  const execEnd = indexSource.indexOf('function renderExecutiveReportPrintView', execStart);
  const execBody = indexSource.slice(execStart, execEnd);

  // modeNarrative must be declared exactly once in generateExecutiveReport
  const modeNarrativeMatches = execBody.match(/const\s+modeNarrative\s*=/g) || [];
  assert.equal(modeNarrativeMatches.length, 1, 'modeNarrative must only be declared once in generateExecutiveReport');

  // autoFillBunkers has safe global definition and startup guarding
  assert.match(indexSource, /var\s+autoFillBunkers\s*=\s*window\.autoFillBunkers/);
  assert.match(indexSource, /if\s*\(typeof\s+autoFillBunkers\s*===\s*'function'\)/);
});

test('7. Calibration - Forced road vehicle (Camión / Tráiler), OSRM times override, and realistic road cost per km', async () => {
  // 1. Vehicle type is forced to Camión / Tráiler when modeNarrative is terrestre, ignoring Mini Bulker
  assert.match(indexSource, /vehicleType\s*=\s*\(modeNarrative\s*===\s*'terrestre'/);
  assert.match(indexSource, /'Camión \/ Tráiler'/);

  // 2. Override of driving and total times using exclusively OSRM duration + tachograph rests (no knots formula)
  assert.match(indexSource, /tiempoConduccion\s*=\s*Number\(window\.LandData\?\.drivingHours\)/);
  assert.match(indexSource, /pausasTacografoHoras\s*=\s*Math\.floor\(tiempoConduccion\s*\/\s*4\.5\)\s*\*\s*0\.75/);
  assert.match(indexSource, /pernoctas\s*=\s*Math\.floor\(tiempoConduccion\s*\/\s*9\)/);
  assert.match(indexSource, /descansosDiariosHoras\s*=\s*pernoctas\s*\*\s*11/);
  assert.match(indexSource, /tiempoTotalHoras\s*=\s*tiempoConduccion\s*\+\s*pausasTacografoHoras\s*\+\s*descansosDiariosHoras/);

  // 3. Base road cost calibration: (distancia * 1.30 €/km) + peajes + (dietas * pernoctas)
  assert.match(indexSource, /baseKmRate\s*=\s*1\.30/);
  assert.match(indexSource, /baseKmCost\s*=\s*totalKm\s*\*\s*baseKmRate/);

  // 4. Verification in voyage-cost-engine: updateExecutiveDashboard overrides Mini Bulker and 67.50 rate
  assert.match(voyageCostSource, /isMaritimeCatalogType/);
  assert.match(voyageCostSource, /resolvedVesselType/);
  assert.match(voyageCostSource, /effectiveTotalDays/);
  assert.match(voyageCostSource, /effectiveBuyFreight/);
});

