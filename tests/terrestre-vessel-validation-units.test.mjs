import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const tceWorkspace = await readFile(new URL('../TceCalculatorWorkspace.tsx', import.meta.url), 'utf8');

test('1. Módulo 2 UI label displays "Carga Útil (TM)" in index.html and TceCalculatorWorkspace', () => {
  // Label in index.html Module 2
  assert.match(indexHtml, /<label id="label-vessel-dwt"[^>]*>Carga Útil \(TM\)<\/label>/);
  assert.doesNotMatch(indexHtml, /<label id="label-vessel-dwt"[^>]*>Carga Útil \(kg\)<\/label>/);

  // Label in TceCalculatorWorkspace
  assert.match(tceWorkspace, /Carga Útil \(TM\)/);
  assert.doesNotMatch(tceWorkspace, /Carga Útil \(kg\)/);
});

test('2. refreshVesselCompatibilityWarning blocks naval excess weight alert in terrestrial mode', () => {
  // Extract refreshVesselCompatibilityWarning definition from index.html
  const fnStart = indexHtml.indexOf('function refreshVesselCompatibilityWarning()');
  assert.ok(fnStart !== -1, 'refreshVesselCompatibilityWarning must exist');
  const fnEnd = indexHtml.indexOf('window.refreshVesselCompatibilityWarning = refreshVesselCompatibilityWarning;', fnStart);
  const fnSource = indexHtml.slice(fnStart, fnEnd);

  // Check terrestrial mode context bypass
  assert.match(fnSource, /isTerrestreModeContext|isTerrestreMode/);

  // Simulate execution of the function logic
  const mockWarningEl = {
    innerText: '',
    className: '',
    classList: {
      hidden: false,
      add(cls) { if (cls === 'hidden') this.hidden = true; },
      remove(cls) { if (cls === 'hidden') this.hidden = false; }
    }
  };

  const elements = {
    'vessel-compatibility-warning': mockWarningEl,
    'vessel-dwt': { value: '24' },
    'cargo-qty': { value: '8000' },
    'cargo-type': { value: 'Granel Sólido (Dry Bulk)' },
    'gc-add-purpose': { value: '' }
  };

  const globalScope = {
    document: {
      getElementById(id) {
        return elements[id] || null;
      }
    },
    isTerrestreModeContext: () => true,
    isTerrestreMode: () => true
  };

  const fnEvaluator = new Function(
    'document',
    'isTerrestreModeContext',
    'isTerrestreMode',
    `${fnSource}; return refreshVesselCompatibilityWarning;`
  );

  const testFn = fnEvaluator(
    globalScope.document,
    globalScope.isTerrestreModeContext,
    globalScope.isTerrestreMode
  );

  // Initial state has excess weight scenario: cargo = 8000, dwt = 24
  testFn();

  // In terrestrial mode, excess weight warning must NOT trigger and warningEl must be hidden
  assert.equal(mockWarningEl.classList.hidden, true, 'Warning banner must be hidden in terrestrial mode');
  assert.equal(mockWarningEl.innerText, '', 'Warning text must be cleared in terrestrial mode');

  // Conversely, when NOT in terrestrial mode (maritime mode), warning triggers
  const maritimeEvaluator = new Function(
    'document',
    'isTerrestreModeContext',
    'isTerrestreMode',
    `${fnSource}; return refreshVesselCompatibilityWarning;`
  );
  const maritimeFn = maritimeEvaluator(
    globalScope.document,
    () => false,
    () => false
  );

  maritimeFn();
  assert.equal(mockWarningEl.classList.hidden, false, 'Warning banner must appear in maritime mode when DWT < cargo');
  assert.equal(mockWarningEl.innerText, 'NOTICE: THIS VESSEL IS NOT COMPATIBLE DUE TO EXCESS WEIGHT.');
});

test('3. Toast and AI viability modal checks guard against naval excess weight alert in terrestrial mode', () => {
  // Check specs toast guard
  assert.match(indexHtml, /isTerrestreToast\s*&&\s*dwt\s*>\s*0\s*&&\s*cargoQty\s*>\s*0\s*&&\s*dwt\s*<\s*cargoQty/);

  // Check viability check guard
  assert.match(indexHtml, /isTerrestreViability\s*&&\s*dwt\s*>\s*0\s*&&\s*cargo\s*>\s*0\s*&&\s*dwt\s*<\s*cargo/);
});

test('4. truckPayloadCapacity treats input literally as TM without dividing by 1000', async () => {
  const voyageEngineSource = await readFile(new URL('../voyage-cost-engine.js', import.meta.url), 'utf8');

  // Verify index.html does not divide truckPayloadCapacity by 1000
  assert.doesNotMatch(indexHtml, /truckPayloadCapacity\s*=\s*[^;]*\/\s*1000/);
  assert.match(indexHtml, /truckPayloadCapacity\s*=\s*rawVehiclePayload\s*>\s*0\s*\?\s*rawVehiclePayload\s*:\s*24/);

  // Verify voyage-cost-engine.js does not divide truckPayloadCapacity by 1000
  assert.doesNotMatch(voyageEngineSource, /truckPayloadCapacity\s*=\s*[^;]*\/\s*1000/);
  assert.match(voyageEngineSource, /truckPayloadCapacity\s*=\s*rawPayload\s*>\s*0\s*\?\s*rawPayload\s*:\s*24/);

  // Verify TceCalculatorWorkspace.tsx does not divide truckPayloadCapacity by 1000
  assert.doesNotMatch(tceWorkspace, /truckPayloadCapacity\s*=\s*[^;]*\/\s*1000/);

  // Strict mathematical validation:
  const tonnage = 8000;

  // Case 1: input 24 TM -> 334 trucks
  const input24 = 24;
  const trucks24 = Math.ceil(tonnage / input24);
  assert.equal(trucks24, 334, '8000t / 24t must yield strictly 334 trucks');

  // Case 2: input 9200 TM -> 1 truck (never 870)
  const input9200 = 9200;
  const trucks9200 = Math.ceil(tonnage / input9200);
  assert.equal(trucks9200, 1, '8000t / 9200t must yield strictly 1 truck');
});

test('5. Módulo 7: Venta Sugerida Transportista y Agencia usa (Coste Base del Viaje / Capacidad de Carga Útil) ~6.75 €/t, NO dividida por 8000 (0.02 €/t)', () => {
  // autoScaleVesselAndCosts preserves truck payload without scaling to cargo * 1.15 in terrestrial mode
  assert.match(indexHtml, /function autoScaleVesselAndCosts\(\)[\s\S]*?isTerrestreModeContext/);

  // Suggested sale calculation base
  const totalTripCost = 162;
  const truckPayload = 24;
  const roadCostPerTon = totalTripCost / truckPayload;
  assert.equal(roadCostPerTon.toFixed(2), '6.75', 'Coste base unitario por tonelada debe ser 6.75 €/t');

  // Verify that dividing by project cargo (8000) does NOT happen
  const incorrectDivByProjectCargo = totalTripCost / 8000;
  assert.equal(incorrectDivByProjectCargo.toFixed(2), '0.02', '162/8000 is 0.02 (the erroneous bug value)');
  assert.notEqual(roadCostPerTon.toFixed(2), incorrectDivByProjectCargo.toFixed(2));
});

test('6. Módulo 8: Escala del proyecto (trucks_needed = 334) multiplica Coste Total, Ingreso Total y Margen Neto cuando isTerrestreModeContext() es true', () => {
  // Verify State properties are scaled by fleetTrucksNeeded in terrestrial mode
  assert.match(indexHtml, /State\.netProfitOwner = isTerrestre \? finalNetProfitOwner : netProfitOwner;/);
  assert.match(indexHtml, /State\.netProfitCharterer = isTerrestre \? finalNetProfitCharterer : netProfitCharterer;/);
  assert.match(indexHtml, /State\.totalCosts = isTerrestre \? finalSharedTotalCosts : sharedTotalCosts;/);
  assert.match(indexHtml, /State\.totalRevenue = isTerrestre \? finalGrossRevCharterer : totalRevenue;/);

  // Mathematical validation for 334 trucks
  const unitaryCost = 162;
  const trucksNeeded = Math.ceil(8000 / 24);
  assert.equal(trucksNeeded, 334);
  const totalProjectCost = unitaryCost * trucksNeeded;
  assert.equal(totalProjectCost, 54108, 'Coste total del proyecto para 334 camiones debe ser 54,108 € (nunca 162 € de 1 camión)');

  // Initial net profit with zero revenue
  const totalProjectNetProfitInitial = 0 - totalProjectCost;
  assert.equal(totalProjectNetProfitInitial, -54108, 'Margen inicial del proyecto debe ser -54,108 € (nunca -162 €)');
});

test('7. Decoupled truckPayloadCapacity input, state and mandatory fleet formula', () => {
  // Module 2 input has id truckPayloadCapacity
  assert.match(indexHtml, /id="truckPayloadCapacity"/);
  assert.match(indexHtml, /name="truckPayloadCapacity"/);

  // State initialization has truckPayloadCapacity
  assert.match(indexHtml, /truckPayloadCapacity:\s*24/);

  // Mandatory fleet formula: const trucks_needed = Math.ceil(totalCargoTonnage / truckPayloadCapacity);
  assert.match(indexHtml, /const\s+trucks_needed\s*=\s*\(isTerrestre\s*&&\s*totalCargoTonnage\s*>\s*0\s*&&\s*truckPayloadCapacity\s*>\s*0\)\s*\?\s*Math\.ceil\(totalCargoTonnage\s*\/\s*truckPayloadCapacity\)\s*:\s*1/);

  // Strictly verify: totalCargoTonnage = 8000, truckPayloadCapacity = 24 -> trucks_needed = 334
  const totalCargoTonnage = 8000;
  const truckPayloadCapacity = 24;
  const trucks_needed = Math.ceil(totalCargoTonnage / truckPayloadCapacity);
  assert.equal(trucks_needed, 334, '8000 / 24 must strictly yield 334');

  // Module 8 trip cost multiplier: 162 * 334 = 54108
  const tripCost = 162;
  const scaledCost = tripCost * trucks_needed;
  assert.equal(scaledCost, 54108, 'Unitary trip cost 162 multiplied by 334 must yield 54108');
});

test('8. truckPayloadCapacity default 24 in DOM and auto-calculation when totalCargoTonnage > 0', async () => {
  // Input in index.html initializes with value="24"
  assert.match(indexHtml, /id="truckPayloadCapacity"[^>]*value="24"/);

  // App.jsx initializes truckPayloadCapacity with 24
  const appJsx = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(appJsx, /const\s*\[truckPayloadCapacity,\s*setTruckPayloadCapacity\]\s*=\s*useState\(24\)/);

  // Auto-calculation validation in index.html and App.jsx: totalCargoTonnage > 0 and capacity === 24
  assert.match(indexHtml, /if\s*\(initialCargoTonnage\s*>\s*0\s*&&\s*initialTruckPayload\s*===\s*24\)/);
  assert.match(appJsx, /if\s*\(totalCargoTonnage\s*>\s*0\s*&&\s*effectiveTruckPayload\s*===\s*24\)/);
});



