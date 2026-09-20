import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderJsx = readFileSync(new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const syncServiceSource = readFileSync(new URL('../dataBridgeSyncService.js', import.meta.url), 'utf8');
const costEngineSource = readFileSync(new URL('../voyage-cost-engine.js', import.meta.url), 'utf8');

test('1. index.html shields renderRouteOnMap and Leaflet layer addition against appendChild TypeError', () => {
  // renderRouteOnMap must have try/catch protecting Leaflet polyline addTo
  assert.match(indexHtml, /function renderRouteOnMap\s*\(\s*routeMap\s*\)\s*\{[\s\S]*?try\s*\{/);
  assert.match(indexHtml, /console\.warn\s*\(\s*['"]\[MapController\] Error no bloqueante en renderRouteOnMap/);
  assert.match(indexHtml, /console\.warn\s*\(\s*['"]\[MapController\] Error no bloqueante en renderPortOnMap/);
  assert.match(indexHtml, /console\.warn\s*\(\s*['"]\[DataBridge\] Error no bloqueante en sendMapDataToDataBridge/);
});

test('2. recalculateAdjustedAndSave defends map/route calculations with try/catch and syncs to Data Bridge', () => {
  // Must catch autoCalculateDistances error and continue
  assert.match(
    indexHtml,
    /if\s*\(\s*typeof\s+autoCalculateDistances\s*===\s*'function'\s*\)\s*\{[\s\S]*?try\s*\{[\s\S]*?await\s+autoCalculateDistances\(\)[\s\S]*?\}\s*catch\s*\(\s*routeErr\s*\)\s*\{[\s\S]*?console\.warn/
  );
  // Must sync land_freight_cost and valor_total_mercancia_usd
  assert.match(indexHtml, /land_freight_cost:\s*calculatedRoadCost/);
  assert.match(indexHtml, /valor_total_mercancia_usd:\s*merchandiseValueUsd/);
});

test('3. handleSaveProjectCargo wraps map calls in try/catch with console.warn', () => {
  const saveCargoMatch = forwarderJsx.match(/const\s+handleSaveProjectCargo\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?finally\s*\{/);
  assert.ok(saveCargoMatch, 'handleSaveProjectCargo function must exist');
  const saveFn = saveCargoMatch[0];

  assert.match(
    saveFn,
    /try\s*\{[\s\S]*?renderRouteOnMap[\s\S]*?sendMapDataToDataBridge[\s\S]*?\}\s*catch\s*\(\s*mapErr\s*\)\s*\{[\s\S]*?console\.warn/,
    'Must wrap renderRouteOnMap and sendMapDataToDataBridge in try/catch with console.warn'
  );
});

test('4. handleSaveProjectCargo explicitly injects land_freight_cost and valor_total_mercancia_usd in payload and line item', () => {
  const saveCargoMatch = forwarderJsx.match(/const\s+handleSaveProjectCargo\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?finally\s*\{/);
  assert.ok(saveCargoMatch, 'handleSaveProjectCargo function must exist');
  const saveFn = saveCargoMatch[0];

  // In payload
  assert.match(saveFn, /land_freight_cost:\s*(?:absoluteLandCost|calculatedLandFreightCost)/);
  assert.match(saveFn, /valor_total_mercancia_usd:\s*merchandiseValueUsd/);

  // In savedLineItem
  assert.match(saveFn, /savedLineItem\s*=\s*\{[\s\S]*?land_freight_cost:\s*calculatedLandFreightCost/);
  assert.match(saveFn, /savedLineItem\s*=\s*\{[\s\S]*?valor_total_mercancia_usd:\s*merchandiseValueUsd/);

  // In updatedProject
  assert.match(saveFn, /updatedProject\s*=\s*\{[\s\S]*?land_freight_cost:\s*(?:totalServicesCost|calculatedLandFreightCost)/);
  assert.match(saveFn, /updatedProject\s*=\s*\{[\s\S]*?valor_total_mercancia_usd:\s*merchandiseValueUsd/);

  // In Data Bridge sync call
  assert.match(saveFn, /roadSyncFn\s*\(\s*\{[\s\S]*?land_freight_cost:\s*(?:totalServicesCost|calculatedLandFreightCost)/);
  assert.match(saveFn, /roadSyncFn\s*\(\s*\{[\s\S]*?valor_total_mercancia_usd:\s*merchandiseValueUsd/);
});

test('5. dataBridgeSyncService buildRoadSyncPayload includes land_freight_cost and valor_total_mercancia_usd', async () => {
  const serviceModuleUrl = `data:text/javascript;base64,${Buffer.from(syncServiceSource).toString('base64')}`;
  const { buildRoadSyncPayload } = await import(serviceModuleUrl);

  const payload = buildRoadSyncPayload({
    reference: 'EXP-99999',
    total_trucks: 15,
    road_transit_days: 2.5,
    road_net_margin: 3200,
    land_freight_cost: 14500.5,
    valor_total_mercancia_usd: 850000,
  });

  assert.equal(payload.land_freight_cost, 14500.5);
  assert.equal(payload.valor_total_mercancia_usd, 850000);
});

test('6. "FOB + Mercancía Unitario" calculates (goodsValue / cargoTons) + fleteUnitario and links to UI state', () => {
  // Check state hook exists
  assert.match(forwarderJsx, /const\s*\[\s*fobMasMercanciaUnitario\s*,\s*setFobMasMercanciaUnitario\s*\]\s*=\s*useState\s*\(\s*0\s*\)/);

  // Check reactive effect calculates goodsValue / tonnage and updates state
  assert.match(forwarderJsx, /unitMercancia\s*=\s*rawGoodsVal\s*\/\s*effectiveTons/);
  assert.match(forwarderJsx, /setFobMasMercanciaUnitario\s*\(\s*totalRatio\s*\)/);

  // Check UI text binding links to fobMasMercanciaUnitario
  assert.match(
    forwarderJsx,
    /activeReport\?\.fob_mas_mercancia_unitario_usd_mt\s*\?\?\s*financialBreakdown\?\.fob_mas_mercancia_unitario_usd_mt\s*\?\?\s*fobMasMercanciaUnitario/
  );
});

test('7. voyage-cost-engine exports calculateFobMasMercanciaUnitario math helper', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const engine = require('../voyage-cost-engine.js');

  assert.equal(typeof engine.calculateFobMasMercanciaUnitario, 'function');

  // 100,000 USD goods, 2,000 MT cargo => 50 USD/MT goods. Freight 35 USD/MT => 85 USD/MT
  const result = engine.calculateFobMasMercanciaUnitario({
    valor_total_mercancia_usd: 100000,
    toneladas: 2000,
    flete_unitario_usd_mt: 35
  });

  assert.equal(result, 85);
});
