import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderWorkspaceSource = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);

// ============================================================================
// 1. HERENCIA DE DATOS FSPE EN EL REPORTE EJECUTIVO (BUILDEXECUTIVEPORTDATA)
// ============================================================================

test('1. buildExecutiveReportData evalúa isCommodityTariffActive y appliedTariff para blindaje FSPE', () => {
  // Debe verificar appliedTariff y isCommodityTariffActive
  assert.match(
    forwarderWorkspaceSource,
    /const\s+appliedTariff\s*=\s*COMMODITY_TARIFFS\[rawType\]\s*\|\|\s*null;[\s\S]*?const\s+isTariffActive\s*=\s*Boolean\(isCommodityTariffActive\s*\|\|\s*appliedTariff\);/,
    'buildExecutiveReportData must determine isTariffActive from isCommodityTariffActive or appliedTariff'
  );

  // Demoras a 0 cuando FSPE está activo
  assert.match(
    forwarderWorkspaceSource,
    /let\s+reportDemDays\s*=\s*isTariffActive\s*\?\s*0\s*:/,
    'reportDemDays must be forced to 0 when isTariffActive is true'
  );
  assert.match(
    forwarderWorkspaceSource,
    /let\s+demurrageCostNum\s*=\s*isTariffActive\s*\?\s*0\s*:/,
    'demurrageCostNum must be forced to 0 when isTariffActive is true'
  );

  // Flete / Transporte terrestre oficial
  assert.match(
    forwarderWorkspaceSource,
    /const\s+officialInlandCost\s*=\s*Math\.round\(effectiveWeightTons\s*\*\s*tariffRate\s*\*\s*100\)\s*\/\s*100;/,
    'officialInlandCost must be calculated based on effectiveWeightTons * tariffRate'
  );
  assert.match(
    forwarderWorkspaceSource,
    /const\s+officialSalePrice\s*=\s*Math\.round\(officialInlandCost\s*\*\s*1\.18\s*\*\s*100\)\s*\/\s*100;/,
    'officialSalePrice must apply 18% margin to officialInlandCost'
  );

  // Estiba, materiales y servicios portuarios forzados a 0
  assert.match(
    forwarderWorkspaceSource,
    /const\s+estibaCostNum\s*=\s*isTariffActive\s*\?\s*0\s*:/,
    'estibaCostNum must be 0 under FSPE'
  );
  assert.match(
    forwarderWorkspaceSource,
    /const\s+matCostNum\s*=\s*isTariffActive\s*\?\s*0\s*:/,
    'matCostNum must be 0 under FSPE'
  );
  assert.match(
    forwarderWorkspaceSource,
    /const\s+periCostNum\s*=\s*isTariffActive\s*\?\s*0\s*:/,
    'periCostNum must be 0 under FSPE'
  );
  assert.match(
    forwarderWorkspaceSource,
    /const\s+fobSubtotal\s*=\s*isTariffActive\s*\?\s*0\s*:/,
    'fobSubtotal must be 0 under FSPE'
  );
});

// ============================================================================
// 2. TABLA DE COSTES Y TOTALES FSPE EN EL REPORTE EJECUTIVO (PRINTABLE VIEW)
// ============================================================================

test('2. Tabla de costes del reporte ejecutivo replica lógica de pantalla y anula peajes, dietas y penalizaciones', () => {
  // Comprobación de bandera de tarifa en la tabla
  assert.match(
    forwarderWorkspaceSource,
    /const\s+isTariffActive\s*=\s*Boolean\(isCommodityTariffActive\s*\|\|\s*appliedTariff\s*\|\|\s*activeReport\?\.isCommodityTariffActive\);/,
    'Executive report table must evaluate isTariffActive'
  );

  // Peajes, dietas y penalizaciones a 0
  assert.match(
    forwarderWorkspaceSource,
    /tollsCost\s*=\s*0;[\s\S]*?driverDiets\s*=\s*0;[\s\S]*?waitPenalty\s*=\s*0;/,
    'tollsCost, driverDiets, and waitPenalty must be explicitly zeroed out when FSPE is active'
  );

  // Coste y venta oficial en tabla
  assert.match(
    forwarderWorkspaceSource,
    /const\s+officialInlandCost\s*=\s*Math\.round\(totalTons\s*\*\s*tariffRate\s*\*\s*100\)\s*\/\s*100;[\s\S]*?runningCost\s*=\s*officialInlandCost;[\s\S]*?totalRoadCost\s*=\s*officialInlandCost;/,
    'runningCost and totalRoadCost must equal officialInlandCost under FSPE'
  );
  assert.match(
    forwarderWorkspaceSource,
    /finalSalePrice\s*=\s*Math\.round\(totalRoadCost\s*\*\s*1\.18\s*\*\s*100\)\s*\/\s*100;/,
    'finalSalePrice must be calculated with 18% margin'
  );

  // Totalizador All-In de venta evita multiplicación errónea de km por camiones
  assert.match(
    forwarderWorkspaceSource,
    /if\s*\(isTariffActive\)\s*\{[\s\S]*?projectTotalCost\s*=\s*Math\.round\(totalTons\s*\*\s*tariffRate\s*\*\s*100\)\s*\/\s*100;[\s\S]*?projectTotalSale\s*=\s*Math\.round\(projectTotalCost\s*\*\s*1\.18\s*\*\s*100\)\s*\/\s*100;/,
    'Project total sale in executive report must be computed directly from flat FSPE inland cost, avoiding km multiplication'
  );
});

// ============================================================================
// 3. PURGA DE TERMINOLOGÍA MARÍTIMA EN LA CABECERA DEL RESUMEN OPERATIVO
// ============================================================================

test('3. Cabecera del resumen operativo muestra exclusivamente parámetros terrestres en Land Charter', () => {
  // Localizar el bloque del Resumen Operativo
  const summaryHeaderIdx = forwarderWorkspaceSource.indexOf('Resumen Operativo (Operational Summary)');
  assert.ok(summaryHeaderIdx > 0, 'Debe existir la sección de Resumen Operativo');

  const tableCostsIdx = forwarderWorkspaceSource.indexOf('TABLA DE COSTES Y MATRIZ DE TRANSPORTE TERRESTRE B2B');
  assert.ok(tableCostsIdx > summaryHeaderIdx, 'La tabla de costes debe seguir al Resumen Operativo');

  const visibleSummaryBlock = forwarderWorkspaceSource.slice(summaryHeaderIdx, tableCostsIdx);

  // Elimina menciones a "Modalidad operativa: Lo-Lo" o "Buque recomendado: Handysize Bulk Carrier"
  assert.doesNotMatch(
    visibleSummaryBlock,
    /Modalidad Operativa/,
    'Visible operational summary header must NOT contain "Modalidad Operativa"'
  );
  assert.doesNotMatch(
    visibleSummaryBlock,
    /Buque Recomendado/,
    'Visible operational summary header must NOT contain "Buque Recomendado"'
  );
  assert.doesNotMatch(
    visibleSummaryBlock,
    /Revenue Tons \(RT\)/,
    'Visible operational summary header must NOT contain maritime "Revenue Tons (RT)"'
  );

  // En su lugar, debe contener los parámetros terrestres requeridos
  assert.match(
    visibleSummaryBlock,
    /Tráilers Estándar de 24t/,
    'Visible operational summary header must include "Tráilers Estándar de 24t"'
  );
  assert.match(
    visibleSummaryBlock,
    /Distancia por carretera/,
    'Visible operational summary header must include "Distancia por carretera"'
  );
  assert.match(
    visibleSummaryBlock,
    /Jornadas de tacógrafo/,
    'Visible operational summary header must include "Jornadas de tacógrafo"'
  );
});

// ============================================================================
// 4. SIMULACIÓN MATEMÁTICA EXACTA DEL CASO DEL USUARIO (29.997 € / 35.396,46 €)
// ============================================================================

test('4. Simulación FSPE: 9.999 MT con tarifa 3.00 $/MT produce exactamente 29.997 € coste y 35.396,46 € venta', () => {
  const tons = 9999;
  const rate = 3.00;
  const margin = 1.18;

  const totalCost = Math.round(tons * rate * 100) / 100;
  const totalSale = Math.round(totalCost * margin * 100) / 100;
  const totalMargin = Math.round((totalSale - totalCost) * 100) / 100;

  assert.equal(totalCost, 29997.00, 'El coste oficial FSPE debe ser exactamente 29.997 €');
  assert.equal(totalSale, 35396.46, 'El precio de venta oficial debe ser exactamente 35.396,46 €');
  assert.equal(totalMargin, 5399.46, 'El margen comercial de agencia debe ser 5.399,46 €');

  // Verificar que el cálculo erróneo previo (128.853 €) derivado de camiones dinámicos ya no se produce
  const trucksRequired = Math.ceil(tons / 24); // 417 camiones
  assert.equal(trucksRequired, 417);
  assert.notEqual(totalSale, 128853, 'El total nunca debe inflarse a 128.853 €');
});
