import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSafeNumber } from '../shared/land-project-policy.mjs';

const forwarderWorkspaceSource = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf-8'
);

const appSource = readFileSync(
  new URL('../src/App.jsx', import.meta.url),
  'utf-8'
);

// ============================================================================
// 1. PARSEO NUMÉRICO SEGURO (SEPARADORES DE MILES)
// ============================================================================

test('1. parseSafeNumber parses numbers and strings with thousands separators correctly', () => {
  // String con punto de miles como "3.003" (problema crítico reportado)
  assert.equal(parseSafeNumber('3.003'), 3003, 'String "3.003" must parse to numeric 3003, not 3');
  
  // String con punto de miles y coma decimal "3.003,50"
  assert.equal(parseSafeNumber('3.003,50'), 3003.5, 'String "3.003,50" must parse to 3003.5');

  // String con múltiples puntos de miles "1.250.000"
  assert.equal(parseSafeNumber('1.250.000'), 1250000, 'String "1.250.000" must parse to 1250000');

  // Números directos (raw numbers)
  assert.equal(parseSafeNumber(3003), 3003, 'Raw number 3003 must be preserved');
  assert.equal(parseSafeNumber(24), 24, 'Raw number 24 must be preserved');
  assert.equal(parseSafeNumber(143), 143, 'Raw number 143 must be preserved');

  // Decimales estándar
  assert.equal(parseSafeNumber('24.5'), 24.5, 'String "24.5" must parse to 24.5');

  // Casos nulos o vacíos
  assert.equal(parseSafeNumber(null), 0, 'Null must return default 0');
  assert.equal(parseSafeNumber(undefined), 0, 'Undefined must return default 0');
  assert.equal(parseSafeNumber(''), 0, 'Empty string must return default 0');
});

// ============================================================================
// 2. FACTURACIÓN DINÁMICA POR FLOTA (REGLA FTL MULTI-CAMIÓN: totalCamiones * 24)
// ============================================================================

test('2. ForwarderWorkspace defines dynamic fleet FTL floor: Math.max(pesoTotalRealMT, totalCamiones * 24)', () => {
  // Verificación en el bloque de Desglose Financiero de Transporte por Carretera
  assert.match(
    forwarderWorkspaceSource,
    /const\s+pesoFacturable\s*=\s*Math\.max\(pesoTotalRealMT,\s*totalCamiones\s*\*\s*24\);/,
    'Must calculate pesoFacturable as Math.max(pesoTotalRealMT, totalCamiones * 24)'
  );

  // Verificación de que la tarifa unitaria en la sección comercial se multiplica por pesoFacturable
  assert.match(
    forwarderWorkspaceSource,
    /totalRoadCost\s*=\s*\(isCommodityTariffActive\s*&&\s*currentTariff\)\s*\?\s*Math\.round\(pesoFacturable\s*\*\s*currentTariff\.inlandUsdMt\)/,
    'Carrier road cost must be calculated as pesoFacturable * currentTariff.inlandUsdMt'
  );

  // Verificación de que el precio de venta sugerido aplica sobre totalRoadCost
  assert.match(
    forwarderWorkspaceSource,
    /const\s+roadSale\s*=\s*Math\.round\(totalRoadCost\s*\*\s*1\.18\);/,
    'Customer sale price must apply 18% margin to totalRoadCost'
  );

  // Verificación en la tabla de costes del Reporte Ejecutivo
  assert.match(
    forwarderWorkspaceSource,
    /const\s+pesoFacturable\s*=\s*Math\.max\(pesoTotalRealMT,\s*totalCamiones\s*\*\s*24\);[\s\S]*?const\s+officialInlandCost\s*=\s*Math\.round\(pesoFacturable\s*\*\s*tariffRate\s*\*\s*100\)\s*\/\s*100;/,
    'Executive report table must use pesoFacturable * tariffRate'
  );
});

// ============================================================================
// 3. SIMULACIÓN MATEMÁTICA: FLOTA DE 143 CAMIONES Y 3.003 TONELADAS
// ============================================================================

test('3. Mathematical simulation for 143 trucks and 3,003 MT under FTL multi-truck rule', () => {
  const totalCamiones = 143;
  const pesoTotalRealMT = parseSafeNumber('3.003');
  assert.equal(pesoTotalRealMT, 3003, 'Parsed tonnage must be 3003 MT');

  // Suelo FTL para la flota de 143 camiones: 143 * 24 = 3432 MT
  const ftlCapacityThreshold = totalCamiones * 24;
  assert.equal(ftlCapacityThreshold, 3432, 'FTL floor for 143 trucks is 3432 MT');

  // pesoFacturable debe ser 3432 MT (Math.max(3003, 3432))
  const pesoFacturable = Math.max(pesoTotalRealMT, totalCamiones * 24);
  assert.equal(pesoFacturable, 3432, 'pesoFacturable must be 3432 MT');

  // Tarifa unitaria oficial (ej. 3.00 USD/MT)
  const tariffRate = 3.00;
  const carrierCost = Math.round(pesoFacturable * tariffRate * 100) / 100;
  assert.equal(carrierCost, 10296, 'Carrier cost must be 3432 * 3.00 = 10,296');

  // Precio de venta cliente con 18% de margen
  const clientSalePrice = Math.round(carrierCost * 1.18 * 100) / 100;
  assert.equal(clientSalePrice, 12149.28, 'Client sale price must be 10,296 * 1.18 = 12,149.28');
});

// ============================================================================
// 4. CORRECCIÓN VISUAL: RESUMEN OPERATIVO MUESTRA TONELADAS REALES SIN RECORTAR
// ============================================================================

test('4. Resumen Operativo preserves real project tons without dividing by 1000', () => {
  // Asegura que no se recorten los miles con rawReportWeight > 200 ? rawReportWeight / 1000
  assert.doesNotMatch(
    forwarderWorkspaceSource,
    /rawReportWeight\s*>\s*200[\s\S]*?\?\s*\(?rawReportWeight\s*\/\s*1000\)?/,
    'Must not divide rawReportWeight by 1000 for weights over 200 tons'
  );

  // Asegura que totalWeightTons en el reporte ejecutivo conserve el peso parseado seguro
  assert.match(
    forwarderWorkspaceSource,
    /const\s+rawReportWeight\s*=\s*parseSafeNumber\(activeReport\?\.totalWeightTons/,
    'rawReportWeight must use parseSafeNumber'
  );

  // Resumen Operativo muestra Peso Total con totalWeightTons
  assert.match(
    forwarderWorkspaceSource,
    /<span\s+className="block\s+text-\[10px\]\s+uppercase\s+font-bold\s+text-slate-500">Peso\s+Total<\/span>\s*<span\s+className="text-lg\s+font-black\s+text-slate-900">\{\(totalWeightTons\s*>\s*0\s*\?\s*totalWeightTons/,
    'Operational summary must render Peso Total directly using totalWeightTons'
  );
});

// ============================================================================
// 5. ENLACE EN APP.JSX A PARSEO NUMÉRICO SEGURO
// ============================================================================

test('5. App.jsx uses parseSafeNumber for URL and DOM cargo inputs to prevent thousands truncation', () => {
  assert.match(
    appSource,
    /const\s+domCargo\s*=\s*parseSafeNumber\(document\.getElementById\('cargo-qty'\)\?\.value/,
    'App.jsx must parse DOM cargo quantity safely using parseSafeNumber'
  );
  assert.match(
    appSource,
    /const\s+stateCargo\s*=\s*parseSafeNumber\(window\.State\?\.cargo\s*\|\|\s*window\.State\?\.cargoQuantity\s*\|\|\s*0\);/,
    'App.jsx must parse stateCargo using parseSafeNumber'
  );
});
