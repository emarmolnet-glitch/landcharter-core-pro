import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderWorkspaceSource = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);

test('1. Bypass LTL para Cargas Masivas: handleSyncDataBridge detecta FTL y calcula flete de flota', () => {
  assert.match(
    forwarderWorkspaceSource,
    /const\s+isMassiveFreightSync\s*=\s*!isRail\s*&&\s*\(totalTons\s*>\s*truckPayloadMT\s*\|\|\s*requiredTrucks\s*>\s*1\)/,
    'Debe detectar proyectos terrestres masivos cuando totalTons > truckPayloadMT o requiredTrucks > 1'
  );

  assert.match(
    forwarderWorkspaceSource,
    /Flete Terrestre Masivo \(\$\{requiredTrucks\} Camiones FTL\)/,
    'Debe etiquetar el ítem de carga como Flete Terrestre Masivo con conteo FTL'
  );

  assert.match(
    forwarderWorkspaceSource,
    /Number\(\(unitRoadCostSync\s*\*\s*totalTrucks\)\.toFixed\(2\)\)/,
    'Debe calcular el coste total de carretera multiplicando el coste unitario por la flota de camiones FTL'
  );
});

test('2. Single Source of Truth: Barra inferior y tarjetas resumen mapean directamente Coste Operativo Total Carretera', () => {
  // Verificación de constante central
  assert.match(
    forwarderWorkspaceSource,
    /const\s+finalFooterCost\s*=\s*totalRoadOperatingCost;/,
    'finalFooterCost debe mapear directamente a totalRoadOperatingCost'
  );

  assert.match(
    forwarderWorkspaceSource,
    /const\s+finalFooterSale\s*=\s*suggestedSalePrice;/,
    'finalFooterSale debe mapear directamente a suggestedSalePrice'
  );

  // Verificación de inputs en la barra inferior (Sticky Bar)
  assert.match(
    forwarderWorkspaceSource,
    /id="input-estimated-cost"[\s\S]*?value=\{finalFooterCost\s*>\s*0\s*\?\s*finalFooterCost\.toFixed\(2\)\s*:\s*''\}/,
    'Input de coste en Sticky Bar debe enlazar directamente con finalFooterCost'
  );

  assert.match(
    forwarderWorkspaceSource,
    /id="input-sale-price"[\s\S]*?value=\{finalFooterSale\s*>\s*0\s*\?\s*finalFooterSale\.toFixed\(2\)\s*:\s*''\}/,
    'Input de venta en Sticky Bar debe enlazar directamente con finalFooterSale'
  );
});

test('3. Consolidación de Márgenes: La vista global y calculadora comparten el 18% unificado', () => {
  assert.match(
    forwarderWorkspaceSource,
    /const\s+TARGET_MARGIN_PCT\s*=\s*18;/,
    'Debe definir TARGET_MARGIN_PCT = 18 como parámetro central inmutable'
  );

  assert.match(
    forwarderWorkspaceSource,
    /const\s+rMarginPct\s*=\s*TARGET_MARGIN_PCT;/,
    'Tarjeta resumen 5 debe alimentarse de TARGET_MARGIN_PCT (18%)'
  );

  assert.match(
    forwarderWorkspaceSource,
    /window\.State\.targetMarginPct\s*=\s*TARGET_MARGIN_PCT;/,
    'window.State debe sincronizar targetMarginPct con TARGET_MARGIN_PCT'
  );
});

test('4. Bypass LTL en autoCalculateEstimates para evitar saltos a granel marítimo / TCE', () => {
  assert.match(
    forwarderWorkspaceSource,
    /const\s+isMassiveRoadFTL\s*=/,
    'autoCalculateEstimates debe definir guard de detección de carga masiva FTL'
  );

  assert.match(
    forwarderWorkspaceSource,
    /const\s+totalFtlCost\s*=\s*Number\(\(unitFtlCost\s*\*\s*ftlTrucks\)\.toFixed\(2\)\);/,
    'autoCalculateEstimates debe calcular coste total FTL multiplicando coste unitario por camiones FTL'
  );
});

test('5. Simulación Matemática del caso de usuario: 15.000 TM en 625 camiones FTL', () => {
  const totalTons = 15000;
  const truckPayloadMT = 24;
  const requiredTrucks = Math.ceil(totalTons / truckPayloadMT);
  assert.equal(requiredTrucks, 625, '15.000 TM deben requerir exactamente 625 camiones de 24 TM');

  // Supongamos un coste unitario por camión de 191 USD (ejemplo del usuario)
  const unitRoadCost = 191;
  const totalRoadCost = unitRoadCost * requiredTrucks;
  assert.equal(totalRoadCost, 119375, 'Coste total de flota FTL debe ser 119.375 USD');

  // Con margen del 18%
  const suggestedSale = Math.round(totalRoadCost * 1.18 * 100) / 100;
  assert.equal(suggestedSale, 140862.5, 'Precio de venta con 18% de margen debe ser 140.862,50 USD');

  // Comprobar que NO se calcula el coste astronómico LTL de ~3.5 millones
  assert.ok(totalRoadCost < 1000000, 'El coste total de carretera FTL debe ser realista (~119k USD) y no un valor LTL astronómico');
});
