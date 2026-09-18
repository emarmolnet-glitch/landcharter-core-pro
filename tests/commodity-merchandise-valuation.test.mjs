import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderWorkspaceSource = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);

function extractCommodityValues() {
  const match = forwarderWorkspaceSource.match(/export\s+const\s+COMMODITY_VALUES\s*=\s*(\{[\s\S]*?\n\};)/);
  assert.ok(match, 'COMMODITY_VALUES definition block must exist');
  // Safe eval of dictionary literal
  const cleanObjStr = match[1].replace(/;$/, '');
  return Function(`"use strict"; return (${cleanObjStr});`)();
}

test('1. COMMODITY_VALUES and CARGO_VALUATIONS catalogs are exported with exact cement valuations', () => {
  assert.match(
    forwarderWorkspaceSource,
    /export\s+const\s+COMMODITY_VALUES\s*=\s*\{/,
    'ForwarderWorkspace must export COMMODITY_VALUES catalog'
  );

  assert.match(
    forwarderWorkspaceSource,
    /export\s+const\s+CARGO_VALUATIONS\s*=\s*COMMODITY_VALUES/,
    'ForwarderWorkspace must export CARGO_VALUATIONS as alias to COMMODITY_VALUES'
  );

  const COMMODITY_VALUES = extractCommodityValues();

  assert.ok(COMMODITY_VALUES, 'COMMODITY_VALUES must exist');
  assert.equal(COMMODITY_VALUES['CEM I 42,5N/R BIGBAG'], 55, 'CEM I 42,5N/R BIGBAG must be valued at 55 USD/MT');
  assert.equal(COMMODITY_VALUES['CEM I 52,5N BIGBAG'], 60, 'CEM I 52,5N BIGBAG must be valued at 60 USD/MT');
  assert.equal(COMMODITY_VALUES['CEM I 52,5N SAC 50KG'], 62, 'CEM I 52,5N SAC 50KG must be valued at 62 USD/MT');
  assert.equal(COMMODITY_VALUES['CEM II 42,5 VRAC'], 50, 'CEM II 42,5 VRAC must be valued at 50 USD/MT');
});

test('2. autoCalculateEstimates detects commodity cargo type and computes autoMercanciaUsd = totalWeightTons * COMMODITY_VALUES[cargoType]', () => {
  // Verifies rule checking if cargoType exists in COMMODITY_VALUES
  assert.match(
    forwarderWorkspaceSource,
    /if\s*\(\s*COMMODITY_VALUES\[cargoType\]\s*!==\s*undefined\s*\)/,
    'autoCalculateEstimates must check if cargoType exists in COMMODITY_VALUES'
  );

  // Verifies mathematical auto-calculation
  assert.match(
    forwarderWorkspaceSource,
    /const\s+autoMercanciaUsd\s*=\s*totalWeightTons\s*\*\s*COMMODITY_VALUES\[cargoType\];/,
    'autoCalculateEstimates must compute: const autoMercanciaUsd = totalWeightTons * COMMODITY_VALUES[cargoType];'
  );

  // Verifies immediate state injection into setMercanciaCost and activeProject.valor_total_mercancia_usd
  assert.match(
    forwarderWorkspaceSource,
    /setMercanciaCost\(\s*autoMercanciaUsd\s*\)/,
    'autoCalculateEstimates must immediately update setMercanciaCost(autoMercanciaUsd)'
  );

  assert.match(
    forwarderWorkspaceSource,
    /activeProject\.valor_total_mercancia_usd\s*=\s*autoMercanciaUsd/,
    'autoCalculateEstimates must update activeProject.valor_total_mercancia_usd'
  );
});

test('3. UI Inputs allow manual editing without disabling or blocking (Aislamiento)', () => {
  // Verifies editable visible input in financial-unit-ratios-summary
  const inputValorMatch = forwarderWorkspaceSource.match(/id="input-valor-mercancia"[\s\S]*?\/>/);
  assert.ok(inputValorMatch, 'Visible input-valor-mercancia must exist in ForwarderWorkspace');
  const inputValor = inputValorMatch[0];

  assert.doesNotMatch(inputValor, /disabled/, 'input-valor-mercancia must not be disabled');
  assert.doesNotMatch(inputValor, /readOnly/, 'input-valor-mercancia must not be readOnly');

  // Verifies editable input-mercancia-cost
  const inputCostMatch = forwarderWorkspaceSource.match(/id="input-mercancia-cost"[\s\S]*?\/>/);
  assert.ok(inputCostMatch, 'input-mercancia-cost must exist in ForwarderWorkspace');
  const inputCost = inputCostMatch[0];

  assert.doesNotMatch(inputCost, /disabled/, 'input-mercancia-cost must not be disabled');
  assert.doesNotMatch(inputCost, /readOnly/, 'input-mercancia-cost must not be readOnly');
});

test('4. Mathematical simulation of auto-calculated merchandise value', () => {
  const COMMODITY_VALUES = extractCommodityValues();

  // Simulation A: 24 MT of CEM I 42,5N/R BIGBAG
  const tonsA = 24;
  const cargoTypeA = 'CEM I 42,5N/R BIGBAG';
  const autoMercanciaA = tonsA * COMMODITY_VALUES[cargoTypeA];
  assert.equal(autoMercanciaA, 1320, '24 MT at 55 USD/MT must equal 1,320 USD');

  // Simulation B: 10,000 MT of CEM I 52,5N BIGBAG (massive project)
  const tonsB = 10000;
  const cargoTypeB = 'CEM I 52,5N BIGBAG';
  const autoMercanciaB = tonsB * COMMODITY_VALUES[cargoTypeB];
  assert.equal(autoMercanciaB, 600000, '10,000 MT at 60 USD/MT must equal 600,000 USD');

  // Simulation C: 500 MT of CEM II 42,5 VRAC
  const tonsC = 500;
  const cargoTypeC = 'CEM II 42,5 VRAC';
  const autoMercanciaC = tonsC * COMMODITY_VALUES[cargoTypeC];
  assert.equal(autoMercanciaC, 25000, '500 MT at 50 USD/MT must equal 25,000 USD');
});

test('5. handleSaveProjectCargo prioritizes mercanciaCost and persists valor_total_mercancia_usd to DB and Data Bridge', () => {
  const saveCargoMatch = forwarderWorkspaceSource.match(/const\s+handleSaveProjectCargo\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?finally\s*\{/);
  assert.ok(saveCargoMatch, 'handleSaveProjectCargo function must exist');
  const saveFn = saveCargoMatch[0];

  assert.match(
    saveFn,
    /const\s+merchandiseValueUsd\s*=\s*Number\(\s*\(\s*mercanciaCost\s*>\s*0\s*\?\s*mercanciaCost\s*:\s*null\s*\)/,
    'merchandiseValueUsd must prioritize mercanciaCost when set'
  );

  assert.match(saveFn, /valor_total_mercancia_usd:\s*merchandiseValueUsd/);
  assert.match(saveFn, /savedLineItem\s*=\s*\{[\s\S]*?valor_total_mercancia_usd:\s*merchandiseValueUsd/);
  assert.match(saveFn, /updatedProject\s*=\s*\{[\s\S]*?valor_total_mercancia_usd:\s*merchandiseValueUsd/);
  assert.match(saveFn, /roadSyncFn\s*\(\s*\{[\s\S]*?valor_total_mercancia_usd:\s*merchandiseValueUsd/);
});
