import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getDssOptimalTrucksPerDay, calculateFleetCampaignDimensioning } from '../shared/land-project-policy.mjs';

const rootDir = resolve(process.cwd());

test('1. Cubicación panel implements derived isRail variable checking Tren, Tolva, Vagón', async () => {
  const source = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Verify derivation in cubicación section
  assert.match(
    source,
    /const\s+isRail\s*=\s*vehicleType\.includes\(['"]Tren['"]\)\s*\|\|\s*vehicleType\.includes\(['"]Tolva['"]\)\s*\|\|\s*vehicleType\.includes\(['"]Vagón['"]\)/,
    'Cubicación panel must define isRail checking vehicleType.includes for Tren, Tolva, Vagón'
  );
});

test('2. VisualTruckPlan receives isRail prop, hides truck SVG and renders highlighted CONVOY FERROVIARIO block', async () => {
  const forwarderSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');
  const visualTruckPlanSource = await readFile(resolve(rootDir, 'src/components/VisualTruckPlan.jsx'), 'utf8');

  // ForwarderWorkspace renders VisualTruckPlan directly passing isRail={isRail}
  assert.match(
    forwarderSource,
    /<VisualTruckPlan[\s\S]*?isRail=\{isRail\}/,
    'ForwarderWorkspace must render VisualTruckPlan passing isRail={isRail}'
  );

  // VisualTruckPlan includes highlighted CONVOY FERROVIARIO block and train icon for rail
  assert.match(
    visualTruckPlanSource,
    /CONVOY FERROVIARIO/,
    'VisualTruckPlan must include CONVOY FERROVIARIO highlighted block'
  );

  // VisualTruckPlan returns rail convoy block and bypasses truck SVG when isRail is true
  assert.match(
    visualTruckPlanSource,
    /if\s*\(\s*isRail\s*\)\s*\{[\s\S]*?visual-rail-convoy-card[\s\S]*?return/,
    'VisualTruckPlan must return rail convoy card early before SVG composition'
  );
});

test('3. Dynamic UI labels change from Camiones to Vagones in fleet counters', async () => {
  const source = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Cubicación DSS Cadencia badge
  assert.match(
    source,
    /\{dssOptimalCadence\}\s*\{isRail\s*\?\s*['"]vagones\/día['"]\s*:\s*['"]camiones\/día['"]\}/,
    'Cadencia badge must dynamically toggle between vagones/día and camiones/día'
  );

  // Flota / Convoy badge
  assert.match(
    source,
    /isRail\s*\?\s*`Convoy ferroviario:\s*\$\{trucksReq\}\s*\$\{trucksReq === 1 \? 'Vagón' : 'Vagones'\}`/,
    'Flota badge must dynamically label fleet as Convoy ferroviario with Vagones'
  );

  // Cadencia Diaria card
  assert.match(
    source,
    /id="val-dss-cadencia-camiones-dia"[\s\S]*?\{dssOptimalCadence\}\s*\{isRail\s*\?\s*['"]vagones\/día['"]\s*:\s*['"]camiones\/día['"]\}/,
    'Cadencia diaria metric must dynamically display vagones/día in rail mode'
  );

  // Rotación Activa card
  assert.match(
    source,
    /id="val-dss-rotacion-activa"[\s\S]*?\{campaignDim\.flotaActivaDiaria\}\s*\{isRail\s*\?\s*['"]vagones\/día['"]\s*:\s*['"]camiones\/día['"]\}/,
    'Rotación activa metric must dynamically display vagones/día in rail mode'
  );

  // Ocupación meters
  assert.match(
    source,
    /isRail\s*\?\s*['"]Ocupación por Vagón['"]\s*:\s*['"]Ocupación LDM por Camión['"]/,
    'LDM occupation must adapt to Ocupación por Vagón in rail mode'
  );
  assert.match(
    source,
    /isRail\s*\?\s*['"]Ocupación Masa por Vagón['"]\s*:\s*['"]Ocupación Masa por Camión['"]/,
    'Masa occupation must adapt to Ocupación Masa por Vagón in rail mode'
  );
});

test('4. Desglose Financiero updates title to Flete Ferroviario (Linehaul Rampa a Rampa) when isRail is true', async () => {
  const source = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Title conditionally toggles
  assert.match(
    source,
    /isRail\s*\?\s*['"]Desglose Financiero · Flete Ferroviario \(Linehaul Rampa a Rampa\)['"]\s*:\s*['"]Desglose Financiero · Transporte Terrestre por Carretera['"]/,
    'Desglose Financiero title must toggle to Flete Ferroviario (Linehaul Rampa a Rampa) for rail mode'
  );

  // Icon conditionally toggles
  assert.match(
    source,
    /\{isRail\s*\?\s*['"]🚂['"]\s*:\s*['"]🚚['"]\}/,
    'Desglose Financiero header icon must toggle between 🚂 and 🚚'
  );
});

test('5. Pricing engine protects rail traction cost without applying road km base tariff or multiplying by wagons', async () => {
  const source = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Desglose Financiero pricing logic: costKm and fuelKm zeroed in rail mode
  assert.match(
    source,
    /const\s+costKm\s*=\s*isRail\s*\?\s*0\s*:\s*1\.35;/,
    'Base cost per km must not be applied in rail mode'
  );
  assert.match(
    source,
    /const\s+fuelKm\s*=\s*isRail\s*\?\s*0\s*:\s*0\.22;/,
    'Fuel cost per km must not be applied in rail mode'
  );

  // Tolls and diets zeroed in rail mode
  assert.match(
    source,
    /const\s+displayTolls\s*=\s*\(isRail\s*\|\|/,
    'Road tolls must be bypassed in rail mode'
  );
  assert.match(
    source,
    /const\s+displayDiets\s*=\s*\(isRail\s*\|\|/,
    'Truck driver diets must be bypassed in rail mode'
  );

  // Consolidated total road cost inherits costeTrenConsolidado directly without multiplying by wagons
  assert.match(
    source,
    /const\s+totalRoadCost\s*=\s*isRail\s*\n\s*\?\s*costeTrenConsolidado/,
    'totalRoadCost in rail mode must inherit consolidated traction cost directly without multiplying by wagons'
  );

  // Backend rail cost prioritized from activeProject
  assert.match(
    source,
    /const\s+rawBackendRailCost\s*=\s*Number\(\s*activeProject\?\.costeTren\s*\|\|\s*activeProject\?\.coste_tren/,
    'Backend rail traction cost (costeTren / coste_tren) must be inherited directly from backend/activeProject'
  );

  // Services list preservation in rail mode avoids multiplying by autoTotalTrucks
  assert.match(
    source,
    /if\s*\(\s*isRail_save\s*&&\s*srvCost\s*>\s*0\s*\)\s*\{[\s\S]*?srv\.cost\s*=\s*consolidatedCost/,
    'Services auto-generation must not multiply rail traction cost by wagons'
  );
});

test('6. Fase 4: DSS dynamic cadence formula: Math.ceil(Total de Vehículos / Días de Buffer de Entrega)', () => {
  // Test scenario 1: 334 trucks, 7 days buffer (default)
  const cadence334 = getDssOptimalTrucksPerDay(null, { totalTrucks: 334 });
  assert.equal(cadence334, Math.ceil(334 / 7)); // 48 trucks/day

  // Test scenario 2: 20 wagons, 5 days buffer
  const cadence20 = getDssOptimalTrucksPerDay(null, { totalVehicles: 20, bufferDays: 5 });
  assert.equal(cadence20, Math.ceil(20 / 5)); // 4 wagons/day

  // Test scenario 3: 70 trucks, undefined buffer defaults to 7 business days
  const cadence70 = getDssOptimalTrucksPerDay(null, { totalTrucks: 70 });
  assert.equal(cadence70, 10); // 10 trucks/day (never 1!)

  // High-volume operations never return 1
  assert.ok(cadence70 > 1, 'Cadence for 70 trucks must not be forced to 1');
  assert.ok(cadence334 > 1, 'Cadence for 334 trucks must not be forced to 1');
});

test('7. Fase 4: Backend MADRE / Cerebro high-volume cadence rule', async () => {
  const madreSource = await readFile(resolve(rootDir, 'netlify/functions/madre-ia.js'), 'utf8');
  const cerebroSource = await readFile(resolve(rootDir, 'netlify/functions/cerebro-ia.js'), 'utf8');

  // Verify MADRE checks totalVehiculos > 1 and applies division formula
  assert.match(
    madreSource,
    /totalVehiculosRemote\s*>\s*1[\s\S]*?Math\.ceil\(totalVehiculosRemote\s*\/\s*bufferDaysRemote\)/,
    'MADRE proxy must calculate dynamic cadence for high volume fleet'
  );

  // Verify Cerebro checks totalVehicles > 1 and applies division formula
  assert.match(
    cerebroSource,
    /totalVehicles\s*>\s*1[\s\S]*?Math\.ceil\(totalVehicles\s*\/\s*bufferDays\)/,
    'Cerebro proxy must calculate dynamic cadence for high volume fleet'
  );
});
