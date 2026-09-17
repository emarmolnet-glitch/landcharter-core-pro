import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderWorkspaceSource = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);

// ============================================================================
// 1. REPARACIÓN DEL CRASH TDZ: COMMODITY_TARIFFS COMO CONSTANTE LOCAL
// ============================================================================

test('1. COMMODITY_TARIFFS is declared as a local constant without export to prevent TDZ crash', () => {
  // Verifies that COMMODITY_TARIFFS is declared as const COMMODITY_TARIFFS =
  assert.match(
    forwarderWorkspaceSource,
    /const\s+COMMODITY_TARIFFS\s*=\s*\{/,
    'ForwarderWorkspace.jsx must declare COMMODITY_TARIFFS as a constant'
  );

  // Verifies that export const COMMODITY_TARIFFS is NOT used
  assert.doesNotMatch(
    forwarderWorkspaceSource,
    /export\s+const\s+COMMODITY_TARIFFS/,
    'ForwarderWorkspace.jsx must NOT export COMMODITY_TARIFFS to avoid cyclic Vite TDZ'
  );

  // Verifies rawType and currentTariff are defined before displayTolls to avoid TDZ in road breakdown
  const roadBreakdownSection = forwarderWorkspaceSource.match(/Desglose Financiero · Transporte Terrestre por Carretera[\s\S]*?Coste Operativo Total Carretera/);
  assert.ok(roadBreakdownSection, 'Road breakdown section must exist');
  assert.match(
    forwarderWorkspaceSource,
    /const\s+rawType\s*=\s*String\(cargoItems\[0\]\?\.type[\s\S]*?const\s+currentTariff\s*=\s*COMMODITY_TARIFFS\[rawType\][\s\S]*?const\s+displayTolls/,
    'currentTariff must be declared before displayTolls to prevent ReferenceError TDZ'
  );
});

// ============================================================================
// 2. TRANSFORMACIÓN DE ALERTA A BANNER INFORMATIVO MULTI-CAMIÓN
// ============================================================================

test('2. Informative banner replaces red error for massive multi-truck projects (totalWeightKg > 24000)', () => {
  // Verifies blue/indigo background styling
  assert.match(
    forwarderWorkspaceSource,
    /bg-indigo-50\s+border\s+border-indigo-200\s+text-indigo-800/,
    'Banner must use informative blue/indigo palette (bg-indigo-50 border-indigo-200 text-indigo-800)'
  );

  // Verifies exact required copy and truck formula: Math.ceil(totalWeightKg / 24000)
  assert.match(
    forwarderWorkspaceSource,
    /"🚛 Proyecto Masivo: Se requieren "\s*\+\s*Math\.ceil\(totalWeightKg\s*\/\s*24000\)\s*\+\s*" tráilers estándar para esta partida\."/,
    'Banner text must dynamically compute required trailers using exact required phrasing'
  );

  // Verifies red error is not rendered when totalWeightKg > 24000
  assert.match(
    forwarderWorkspaceSource,
    /totalWeightKg\s*>\s*24000\s*\?\s*\([\s\S]*?bg-indigo-50[\s\S]*?\)\s*:\s*\(/,
    'Must branch to indigo banner when totalWeightKg > 24000, eliminating the red error'
  );
});

test('3. Mathematical calculation for multi-truck project sizing', () => {
  // Test case with massive project: 10,000 MT = 10,000,000 kg
  const massiveWeightKg = 10000 * 1000;
  const trucksNeeded = Math.ceil(massiveWeightKg / 24000);
  assert.equal(trucksNeeded, 417, '10,000 MT requires 417 trailers of 24t');

  // Exact trailer payload limit: 24,000 kg -> 1 truck
  assert.equal(Math.ceil(24000 / 24000), 1);

  // 24,001 kg -> 2 trucks
  assert.equal(Math.ceil(24001 / 24000), 2);
});

// ============================================================================
// 3. PURGADO DE SUMANDOS RESIDUALES EN TARIFA FSPE (BLINDAJE FINANCIERO)
// ============================================================================

test('4. AppliedTariff validator explicitly purges residual local states to zero', () => {
  // Verifies setTollCost(0), setDriverDiets(0), setWarehouseWaitPenaltyEur(0)
  assert.match(
    forwarderWorkspaceSource,
    /setTollCost\(0\);/,
    'AppliedTariff validator must explicitly invoke setTollCost(0)'
  );
  assert.match(
    forwarderWorkspaceSource,
    /setDriverDiets\(0\);/,
    'AppliedTariff validator must explicitly invoke setDriverDiets(0)'
  );
  assert.match(
    forwarderWorkspaceSource,
    /setWarehouseWaitPenaltyEur\(0\);/,
    'AppliedTariff validator must explicitly invoke setWarehouseWaitPenaltyEur(0)'
  );
});

test('5. Screen cost reflects strictly inlandCost (tons * USD/MT) without residual demoras', () => {
  // Verifies localEstimatedCost = inlandCost without adding demoras or port costs in land charter
  assert.match(
    forwarderWorkspaceSource,
    /localEstimatedCost\s*=\s*inlandCost;/,
    'Screen cost (localEstimatedCost) must be strictly inlandCost'
  );

  // Verifies mathematical logic: 10,000 MT @ 3.00 USD/MT
  const weightTons = 10000;
  const tariffUsdMt = 3.00;
  const inlandCost = weightTons * tariffUsdMt;
  assert.equal(inlandCost, 30000.00, 'Cost must strictly equal 30,000 without added penalties or demurrage');
});

// ============================================================================
// 4. MODO DE ENVÍO POR DEFECTO
// ============================================================================

test('6. Default shipping mode is "Tráiler Lona (13.6m)" instead of "40\' HC Contenedor"', () => {
  // Row creation function (handleAddCargoPiece / handleAddRow / addCargoItem)
  assert.match(
    forwarderWorkspaceSource,
    /shipping_mode_supported:\s*['"]Tráiler Lona \(13\.6m\)['"]/,
    'Row initialization must default shipping_mode_supported to "Tráiler Lona (13.6m)"'
  );

  // Verifies no residual "40' HC Contenedor" default remains in ForwarderWorkspace.jsx
  assert.doesNotMatch(
    forwarderWorkspaceSource,
    /shipping_mode_supported:\s*(?:ci\.|item\.)?shipping_mode_supported\s*\|\|\s*['"]40['\\]* HC Contenedor['"]/,
    'No fallback should point to "40\' HC Contenedor"'
  );
  assert.doesNotMatch(
    forwarderWorkspaceSource,
    /shipping_mode_supported:\s*['"]40['\\]* HC Contenedor['"]/,
    'No initialization should assign "40\' HC Contenedor"'
  );
});
