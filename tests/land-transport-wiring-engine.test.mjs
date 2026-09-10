import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appJsxSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const voyageStoreSource = await readFile(new URL('../src/stores/voyage-store.js', import.meta.url), 'utf8');
const tceWorkspaceSource = await readFile(new URL('../TceCalculatorWorkspace.tsx', import.meta.url), 'utf8');
const apiLandDataSource = await readFile(new URL('../netlify/functions/api-land-data.ts', import.meta.url), 'utf8');

test('1. Auto-Fetch de Data Bridge (Init): llamada a /api-land-data y guardado de dieselPrice sin AdBlue', () => {
  // index.html fetches /api-land-data
  assert.match(indexSource, /fetch\(['"]\/api-land-data['"]\)/, 'index.html must fetch /api-land-data');
  // State.dieselPrice is set
  assert.match(indexSource, /State\.dieselPrice\s*=\s*dieselPrice/, 'State.dieselPrice must be stored in State');
  // Must NOT extract adBluePrice in loadLandFuelPrices
  const loadFnStart = indexSource.indexOf('async function loadLandFuelPrices()');
  const loadFnEnd = indexSource.indexOf('window.loadLandFuelPrices', loadFnStart);
  const loadFnCode = indexSource.slice(loadFnStart, loadFnEnd);
  assert.doesNotMatch(loadFnCode, /data\.adBluePrice/, 'Must NOT attempt to extract adBluePrice from data');

  // React App.jsx defines useLandDataBridgeSync with useEffect calling /api-land-data
  assert.match(appJsxSource, /useLandDataBridgeSync/, 'App.jsx must define useLandDataBridgeSync');
  assert.match(appJsxSource, /fetch\(getApiUrl\(['"]\/api-land-data['"]\)\)/, 'App.jsx must fetch /api-land-data');
  assert.match(appJsxSource, /fetch\(getApiUrl\(['"]\/\.netlify\/functions\/api-land-data['"]\)\)/, 'App.jsx must fetch /.netlify/functions/api-land-data');
  assert.match(appJsxSource, /setDieselPrice/, 'App.jsx must set dieselPrice');
  assert.doesNotMatch(appJsxSource, /data\.adBluePrice/, 'App.jsx must not extract adBluePrice');

  // voyage-store has setDieselPrice and fetchLandData
  assert.match(voyageStoreSource, /dieselPrice:\s*1\.48/, 'voyage-store has default dieselPrice');
  assert.match(voyageStoreSource, /setDieselPrice:/, 'voyage-store has setDieselPrice');
  assert.match(voyageStoreSource, /fetchLandData:/, 'voyage-store has fetchLandData');
});

test('2. Mapeo de tipos de vehículos reales de Data Bridge (Frigorífico, Lona Estándar, Mega Lona, Tren de Carretera)', () => {
  // api-land-data includes the 4 canonical vehicle types
  assert.match(apiLandDataSource, /name:\s*['"]Frigorífico['"]/);
  assert.match(apiLandDataSource, /name:\s*['"]Lona Estándar['"]/);
  assert.match(apiLandDataSource, /name:\s*['"]Mega Lona['"]/);
  assert.match(apiLandDataSource, /name:\s*['"]Tren de Carretera['"]/);

  // Module 2 in index.html connects to datalist and handles selection
  assert.match(indexSource, /id="nombre-buque-calculadora"[^>]*list="vehicle-types-datalist"/);
  assert.match(indexSource, /handleVehicleTypeSelection/);
  assert.match(indexSource, /id="vehicle-types-datalist"/);

  // handleVehicleTypeSelection sets consumption (L/100km) and Carga Útil (kg)
  const fnStart = indexSource.indexOf('function handleVehicleTypeSelection');
  const fnEnd = indexSource.indexOf('window.handleVehicleTypeSelection', fnStart);
  const fnCode = indexSource.slice(fnStart, fnEnd);
  assert.match(fnCode, /State\.vehicleConsumption\s*=\s*matched\.consumptionPer100Km/);
  assert.match(fnCode, /State\.consSea\s*=\s*matched\.consumptionPer100Km/);
  assert.match(fnCode, /State\.dwt\s*=\s*matched\.payloadKg/);
  assert.match(fnCode, /State\.cargaUtil\s*=\s*matched\.payloadKg/);
});

test('3. Inyección de Distancia (Map -> State): OSRM extrae totalKilometers y drivingHours en estado reactivo', () => {
  // In index.html runOnDemandMapRouteWorkflow
  assert.match(indexSource, /const totalKilometers = distanceMeters \/ 1000;/);
  assert.match(indexSource, /const drivingHours = durationSeconds \/ 3600;/);
  assert.match(indexSource, /State\.totalKilometers\s*=\s*totalKilometers;/);
  assert.match(indexSource, /State\.drivingHours\s*=\s*drivingHours;/);
  assert.match(indexSource, /SeaCharterStore\.set\(\{[\s\S]*totalKilometers[\s\S]*drivingHours[\s\S]*\}\)/);

  // React App.jsx listens to osrm:route-updated and updates state
  assert.match(appJsxSource, /window\.addEventListener\(['"]osrm:route-updated['"]/);
  assert.match(appJsxSource, /window\.State\.totalKilometers\s*=\s*km/);
  assert.match(appJsxSource, /window\.State\.drivingHours\s*=\s*hours/);

  // voyage-store has setRouteDistanceAndDuration
  assert.match(voyageStoreSource, /setRouteDistanceAndDuration:\s*\(totalKilometers,\s*drivingHours\)/);
});

test('4. Reescritura del Motor de Cálculo (Cost-Plus Terrestre): fuelCost, tollCost, fixedCost y totalTripCost', () => {
  // Formula for fuelCost
  assert.match(indexSource, /\(landTotalKilometers \/ 100\) \* landVehicleConsumption \* landDieselPrice/);
  // Formula for tollCost with 0.19 fallback
  assert.match(indexSource, /landTotalKilometers \* landTollCostPerKm/);
  assert.match(indexSource, /tollCostPerKm[\s\S]*0\.19/);
  // Formula for fixedCost with 350 fallback
  assert.match(indexSource, /\(landDrivingHours \/ 24\) \* landFixedDailyCost/);
  assert.match(indexSource, /fixedDailyCost[\s\S]*350/);
  // Total trip cost summation
  assert.match(indexSource, /totalTripCost = isZeroCalculation \? 0 : \(fuelCost \+ tollCost \+ fixedCost\)/);

  // React CostPlus calculation implements identical land formula
  assert.match(tceWorkspaceSource, /\(totalKm \/ 100\) \* vehicleConsumption \* dieselPrice/);
  assert.match(tceWorkspaceSource, /totalKm \* tollCostPerKm/);
  assert.match(tceWorkspaceSource, /landFuelCost \+ landTollCost \+ landFixedCost/);
});

test('5. Módulos 6 y 10 reaccionan en tiempo real mostrando los resultados consolidados en Euros (€)', () => {
  // Module 6 renders in €
  assert.match(indexSource, /document\.getElementById\('res-cost-bunker'\)\.innerText\s*=\s*`€\$\{Math\.round\(displayFuelCost\)/);
  assert.match(indexSource, /document\.getElementById\('res-cost-opex'\)\.innerText\s*=\s*`€\$\{Math\.round\(displayFixedCost\)/);
  assert.match(indexSource, /pdaEl\.innerText\s*=\s*`€\$\{Math\.round\(displayTollCost\)/);
  assert.match(indexSource, /document\.getElementById\('res-cost-total'\)\.innerText\s*=\s*`€\$\{Math\.round\(displayTotalTripCost\)/);
  assert.match(indexSource, /baseCostBreakEvenEl\.innerText\s*=\s*`€\$\{breakEvenArmadorDisplay\.toFixed\(2\)\} \/Km · Total: €\$\{Math\.round\(displayTotalTripCost\)/);

  // Module 10 updates in real time
  assert.match(indexSource, /updateChartererNegotiationSimulator\(\)/);
  const simStart = indexSource.indexOf('function updateChartererNegotiationSimulator()');
  const simEnd = indexSource.indexOf('function applySuggestedNegotiationTarget()', simStart);
  const simCode = indexSource.slice(simStart, simEnd);
  assert.doesNotMatch(simCode, /\$0/);
  assert.doesNotMatch(simCode, /armador/);
});
