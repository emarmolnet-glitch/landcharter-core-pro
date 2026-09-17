import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderWorkspaceSource = readFileSync(new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url), 'utf8');

// ============================================================================
// 1. DICCIONARIO LOCAL Y EXPORTACIÓN DE COMMODITY_TARIFFS
// ============================================================================

test('1. COMMODITY_TARIFFS dictionary is defined and exported with exact 11 cement varieties', () => {
  assert.match(
    forwarderWorkspaceSource,
    /(?:export\s+)?const\s+COMMODITY_TARIFFS\s*=\s*\{/,
    'ForwarderWorkspace.jsx must define COMMODITY_TARIFFS catalog'
  );

  const EXPECTED_TARIFFS = {
    "CEM I 52,5N BIGBAG": { inlandUsdMt: 3.00, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 3.50 },
    "CEM I 52,5N SAC 50KG": { inlandUsdMt: 3.00, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 3.50 },
    "CEM I 42,5N/R BIGBAG": { inlandUsdMt: 3.00, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 3.50 },
    "CEM I 42,5N/R SAC 50KG": { inlandUsdMt: 3.00, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 3.50 },
    "CEM II 52.5N/R 50KG": { inlandUsdMt: 4.26, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 2.60 },
    "CEM II 52.5N BIGBAG": { inlandUsdMt: 4.26, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 3.50 },
    "CEM II 42,5N/R FARDILISE": { inlandUsdMt: 4.26, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 2.56 },
    "CEM II 42,5N/R FARDILLISE TAVCIM": { inlandUsdMt: 4.26, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 2.65 },
    "CEM II 42,5 VRAC": { inlandUsdMt: 4.30, portDuesUsdMt: 2.00, customsUsdMt: 0.30, packagingUsdMt: 3.50 },
    "CEM II 42,5 R BIGBAG": { inlandUsdMt: 4.30, portDuesUsdMt: 2.00, customsUsdMt: 0.30, packagingUsdMt: 3.50 },
    "CEM I 52,5 R BIGBAG": { inlandUsdMt: 3.00, portDuesUsdMt: 2.00, customsUsdMt: 0.30, packagingUsdMt: 3.50 }
  };

  for (const [key, rates] of Object.entries(EXPECTED_TARIFFS)) {
    assert.match(
      forwarderWorkspaceSource,
      new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
      `COMMODITY_TARIFFS must include key: ${key}`
    );
    assert.match(
      forwarderWorkspaceSource,
      new RegExp(`inlandUsdMt:\\s*${rates.inlandUsdMt}`),
      `Tariff for ${key} must include inlandUsdMt: ${rates.inlandUsdMt}`
    );
  }
});

// ============================================================================
// 2. AUTOCOMPLETADO EN EL INPUT DE CARGA (UX) CON DATALIST
// ============================================================================

test('2. Packing list table binds TIPO/MODELO to datalist with id commodity-list', () => {
  assert.match(
    forwarderWorkspaceSource,
    /list="commodity-list"/,
    'TIPO/MODELO input must have list="commodity-list"'
  );

  assert.match(
    forwarderWorkspaceSource,
    /<input[^>]*list="commodity-list"/,
    'TIPO/MODELO input must bind to datalist id commodity-list'
  );

  assert.match(
    forwarderWorkspaceSource,
    /<datalist\s+id="commodity-list">/,
    'ForwarderWorkspace must render <datalist id="commodity-list">'
  );

  assert.match(
    forwarderWorkspaceSource,
    /Object\.keys\(COMMODITY_TARIFFS\)\.map\(/,
    'Datalist must dynamically map keys of COMMODITY_TARIFFS to <option>'
  );
});

// ============================================================================
// 3. ESTADO BOOLEANO Y VALIDACIÓN DEL BYPASS DE COSTES
// ============================================================================

test('3. ForwarderWorkspace defines isCommodityTariffActive state hook', () => {
  assert.match(
    forwarderWorkspaceSource,
    /const\s*\[\s*isCommodityTariffActive\s*,\s*setIsCommodityTariffActive\s*\]\s*=\s*useState\(false\)/,
    'ForwarderWorkspace must declare isCommodityTariffActive state hook initialized to false'
  );
});

test('4. autoCalculateEstimates and handleRecalculate validate appliedTariff and apply commodity bypass', () => {
  // Verificación del validador saneado contra Null Reference
  assert.match(
    forwarderWorkspaceSource,
    /const\s+rawType\s*=\s*String\(cargoItems\[0\]\?\.type\s*\|\|\s*''\)\.toUpperCase\(\)\.trim\(\);[\s\S]*?const\s+appliedTariff\s*=\s*COMMODITY_TARIFFS\[rawType\]\s*\|\|\s*null;/,
    'Must include safe validator using String(cargoItems[0]?.type || "").toUpperCase().trim() to avoid crashes on empty items'
  );

  // Verificación de activación del flag booleano
  assert.match(
    forwarderWorkspaceSource,
    /setIsCommodityTariffActive\(true\)/,
    'Must set isCommodityTariffActive to true when appliedTariff is found'
  );

  // Verificación de reseteo a false si no hay appliedTariff
  assert.match(
    forwarderWorkspaceSource,
    /setIsCommodityTariffActive\(false\)/,
    'Must set isCommodityTariffActive to false when appliedTariff is null'
  );

  // Verificación de flete terrestre: totalWeightTons * appliedTariff.inlandUsdMt
  assert.match(
    forwarderWorkspaceSource,
    /totalWeightTons\s*\*\s*appliedTariff\.inlandUsdMt/,
    'Inland freight must be calculated as totalWeightTons * appliedTariff.inlandUsdMt'
  );

  // Verificación de costes portuarios/FOB: totalWeightTons * (portDuesUsdMt + customsUsdMt + packagingUsdMt)
  assert.match(
    forwarderWorkspaceSource,
    /totalWeightTons\s*\*\s*\(\s*appliedTariff\.portDuesUsdMt\s*\+\s*appliedTariff\.customsUsdMt\s*\+\s*appliedTariff\.packagingUsdMt\s*\)/,
    'Port/FOB costs must be calculated as totalWeightTons * (portDuesUsdMt + customsUsdMt + packagingUsdMt)'
  );
});

test('4b. Adding an item with empty, undefined or null type safely evaluates without throwing', () => {
  const sampleTariffs = {
    "CEM I 52,5N BIGBAG": { inlandUsdMt: 3.00, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 3.50 }
  };

  const safeLookup = (item) => {
    const rawType = String(item?.type || '').toUpperCase().trim();
    return sampleTariffs[rawType] || null;
  };

  assert.doesNotThrow(() => safeLookup(undefined));
  assert.doesNotThrow(() => safeLookup({}));
  assert.doesNotThrow(() => safeLookup({ type: '' }));
  assert.doesNotThrow(() => safeLookup({ type: null }));
  assert.doesNotThrow(() => safeLookup({ type: undefined }));
  assert.equal(safeLookup({ type: '' }), null);
  assert.equal(safeLookup({}), null);
  assert.equal(safeLookup(null), null);
  assert.notEqual(safeLookup({ type: 'cem i 52,5n bigbag' }), null);
});

// ============================================================================
// 4. FEEDBACK VISUAL: BANNER UI DESTACADO EN DESGLOSE FINANCIERO
// ============================================================================

test('5. Visual feedback banner is rendered in Desglose Financiero when isCommodityTariffActive is true', () => {
  assert.match(
    forwarderWorkspaceSource,
    /isCommodityTariffActive\s*&&/,
    'Banner must be conditionally rendered when isCommodityTariffActive is true'
  );

  assert.match(
    forwarderWorkspaceSource,
    /bg-emerald-50\s+border\s+border-emerald-200\s+text-emerald-800\s+p-3\s+rounded-lg\s+mb-4\s+text-xs\s+font-bold/,
    'Banner must have exact requested Tailwind classes'
  );

  assert.match(
    forwarderWorkspaceSource,
    /💡 Tarifa de Convenio Comercial \/ FSPE Aplicada\. Los cálculos dinámicos de km y estiba han sido sustituidos por tarifas netas de commodity\./,
    'Banner must render exact requested notification copy'
  );
});

// ============================================================================
// 5. SIMULACIÓN MATEMÁTICA DEL MOTOR DE TARIFAS DE COMMODITY
// ============================================================================

test('6. Mathematical simulation of subsidized flat tariffs (FSPE)', () => {
  const tariffs = {
    "CEM I 52,5N BIGBAG": { inlandUsdMt: 3.00, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 3.50 },
    "CEM II 52.5N/R 50KG": { inlandUsdMt: 4.26, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 2.60 },
    "CEM II 42,5 VRAC": { inlandUsdMt: 4.30, portDuesUsdMt: 2.00, customsUsdMt: 0.30, packagingUsdMt: 3.50 },
  };

  // Escenario 1: 5.000 MT de CEM I 52,5N BIGBAG
  const weightTons1 = 5000;
  const tariff1 = tariffs["CEM I 52,5N BIGBAG"];
  const inland1 = weightTons1 * tariff1.inlandUsdMt;
  const portFob1 = weightTons1 * (tariff1.portDuesUsdMt + tariff1.customsUsdMt + tariff1.packagingUsdMt);
  assert.equal(inland1, 15000.00);
  assert.equal(portFob1, 28750.00); // 5000 * 5.75 = 28750

  // Escenario 2: 24 MT (1 camión tráiler) de CEM II 52.5N/R 50KG
  const weightTons2 = 24;
  const tariff2 = tariffs["CEM II 52.5N/R 50KG"];
  const inland2 = weightTons2 * tariff2.inlandUsdMt;
  const portFob2 = weightTons2 * (tariff2.portDuesUsdMt + tariff2.customsUsdMt + tariff2.packagingUsdMt);
  assert.equal(inland2.toFixed(2), '102.24');
  assert.equal(portFob2.toFixed(2), '116.40'); // 24 * 4.85 = 116.40
});
