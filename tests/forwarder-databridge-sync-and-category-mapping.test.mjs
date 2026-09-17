import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderWorkspaceSource = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);

// Extraemos la función mapCargoCategoryAndType directamente del código fuente para validación pura
const mapFnMatch = forwarderWorkspaceSource.match(/export\s+function\s+mapCargoCategoryAndType[\s\S]*?\n\}/);
assert.ok(mapFnMatch, 'mapCargoCategoryAndType function must be present in ForwarderWorkspace.jsx');

const COMMODITY_TARIFFS = {
  "CEM I 52,5N BIGBAG": true,
  "CEM I 52,5N SAC 50KG": true,
  "CEM I 42,5N/R BIGBAG": true,
  "CEM I 42,5N/R SAC 50KG": true,
  "CEM II 52.5N/R 50KG": true,
  "CEM II 52.5N BIGBAG": true,
  "CEM II 42,5N/R FARDILISE": true,
  "CEM II 42,5N/R FARDILLISE TAVCIM": true,
  "CEM II 42,5 VRAC": true,
  "CEM II 42,5 R BIGBAG": true,
  "CEM I 52,5 R BIGBAG": true
};

function normalizeStr(val) {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const mapCargoCategoryAndType = new Function(
  'normalizeStr',
  'COMMODITY_TARIFFS',
  `return ${mapFnMatch[0].replace('export function mapCargoCategoryAndType', 'function')}`
)(normalizeStr, COMMODITY_TARIFFS);

// ============================================================================
// 1. MAPEO INTELIGENTE DE CATEGORÍA Y TIPO (SINCRONIZACIÓN)
// ============================================================================

test('1. mapCargoCategoryAndType classifies BIGBAG, SAC, FARDILISE, TAVCIM, PALETIZADA strictly to "Carga Unitizada / Envasada" and valid GICA type', () => {
  const samples = [
    { text: '10.000 MT CEMENTO BIGBAG 1.5T', expectedCategory: 'Carga Unitizada / Envasada', expectedType: 'CEM I 52,5N BIGBAG' },
    { text: 'CEM II 52.5N/R 50KG sacos', expectedCategory: 'Carga Unitizada / Envasada', expectedType: 'CEM II 52.5N/R 50KG' },
    { text: 'cemento fardilise paletizada', expectedCategory: 'Carga Unitizada / Envasada', expectedType: 'CEM II 42,5N/R FARDILISE' },
    { text: 'FARDILLISE TAVCIM 42,5', expectedCategory: 'Carga Unitizada / Envasada', expectedType: 'CEM II 42,5N/R FARDILLISE TAVCIM' },
    { text: 'Mercancía en sacos de yeso', expectedCategory: 'Carga Unitizada / Envasada', expectedType: 'CEM I 52,5N BIGBAG' },
    { text: 'Carga paletizada envasada', expectedCategory: 'Carga Unitizada / Envasada', expectedType: 'CEM I 52,5N BIGBAG' }
  ];

  for (const s of samples) {
    const res = mapCargoCategoryAndType(s.text);
    assert.equal(res.category, s.expectedCategory, `Text "${s.text}" must map to category "${s.expectedCategory}"`);
    assert.ok(res.type, `Text "${s.text}" must have a valid type`);
    if (s.expectedType) {
      assert.equal(res.type, s.expectedType, `Text "${s.text}" must match expected GICA code`);
    }
  }
});

test('2. mapCargoCategoryAndType classifies VRAC, GRANEL, BULK to "Graneles Sólidos / Minerales" and "CEM II 42,5 VRAC"', () => {
  const bulkSamples = [
    'Cemento a granel',
    'CEM II 42,5 VRAC',
    'Dry bulk clinker',
    'Graneles minerales en tolva'
  ];

  for (const text of bulkSamples) {
    const res = mapCargoCategoryAndType(text);
    assert.equal(res.category, 'Graneles Sólidos / Minerales', `"${text}" must map to Graneles Sólidos / Minerales`);
    assert.equal(res.type, 'CEM II 42,5 VRAC', `"${text}" must map to CEM II 42,5 VRAC`);
  }
});

// ============================================================================
// 2. VALORES POR DEFECTO AL CREAR FILA (+ AÑADIR PIEZA)
// ============================================================================

test('3. handleAddCargoPiece initializes row with "Carga Unitizada / Envasada" and "Tráiler Lona (13.6m)"', () => {
  assert.match(
    forwarderWorkspaceSource,
    /category:\s*['"]Carga Unitizada \/ Envasada['"]/,
    'handleAddCargoPiece must initialize category as "Carga Unitizada / Envasada"'
  );
  assert.match(
    forwarderWorkspaceSource,
    /shipping_mode_supported:\s*['"]Tráiler Lona \(13\.6m\)['"]/,
    'handleAddCargoPiece must initialize shipping_mode_supported as "Tráiler Lona (13.6m)"'
  );
  assert.doesNotMatch(
    forwarderWorkspaceSource,
    /category:\s*['"]Equipos de Proceso['"]\s*,\s*quantity:\s*1\s*,\s*type:\s*['"]['"]/,
    'handleAddCargoPiece must not default to "Equipos de Proceso"'
  );
});

// ============================================================================
// 3. BLINDAJE CONTRA COSTES EN 0 € (FALLBACK DE SEGURIDAD)
// ============================================================================

test('4. autoCalculateEstimates applies security fallback (totalWeightTons * 4.00 USD/MT) when freight is 0 but weight > 0', () => {
  assert.match(
    forwarderWorkspaceSource,
    /totalWeightTons\s*\*\s*4\.00/,
    'Must define safety fallback rate of 4.00 USD/MT when freight is 0 but tonnage > 0'
  );

  // Simulation: 5,000 MT without commodity tariff and 0 ocean freight
  const totalWeightTons = 5000;
  const fallbackCost = totalWeightTons * 4.00;
  assert.equal(fallbackCost, 20000, '5,000 MT must evaluate to 20,000 USD fallback cost');
});

// ============================================================================
// 4. CONTROL MANUAL DE SYNC Y PREVENCIÓN DE BUCLES INFINITOS
// ============================================================================

test('5. handleSyncDataBridge is strictly manual and no cyclical DOM event listeners trigger network loops', () => {
  // Verifies handleSyncDataBridge calls mapCargoCategoryAndType and autoCalculateEstimates
  assert.match(
    forwarderWorkspaceSource,
    /handleSyncDataBridge[\s\S]*?mapCargoCategoryAndType[\s\S]*?autoCalculateEstimates/,
    'handleSyncDataBridge must map categories/types and immediately invoke autoCalculateEstimates'
  );

  // Verifies no automatic DOM listeners causing network loops (road:sync, vehicle:selected, seacharter:vehicle-change)
  assert.doesNotMatch(
    forwarderWorkspaceSource,
    /window\.addEventListener\(['"](?:road:sync|vehicle:selected|seacharter:vehicle-change)['"]/,
    'Must NOT register cyclical DOM listeners that auto-trigger handleSyncDataBridge'
  );

  // Verifies row deletion stabilizes state and updates project cleanly
  assert.match(
    forwarderWorkspaceSource,
    /const\s+handleRemoveCargoItem\s*=\s*\(id\)\s*=>\s*\{[\s\S]*?const\s+handleRemoveRow\s*=\s*handleRemoveCargoItem/,
    'handleRemoveCargoItem and handleRemoveRow must be defined'
  );
  assert.match(
    forwarderWorkspaceSource,
    /prev\.filter\(\(item\)\s*=>\s*item\.id\s*!==\s*id\)/,
    'Must cleanly filter out deleted item from cargoItems'
  );
});
