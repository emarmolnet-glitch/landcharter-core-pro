import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspaceSource = readFileSync(new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url), 'utf8');

test('1. autoCalculateEstimates: active maritime state setters', () => {
  const match = workspaceSource.match(/const\s+autoCalculateEstimates\s*=\s*\((?:items)?\)\s*=>\s*\{([\s\S]*?)\n\s*\};/);
  assert.ok(match, 'autoCalculateEstimates function must exist in ForwarderWorkspace.jsx');
  const fnBody = match[1];

  assert.match(
    fnBody,
    /setEstimatedCost\(totalEstimatedCost\.toFixed\(2\)\);/,
    'autoCalculateEstimates must call setEstimatedCost(totalEstimatedCost.toFixed(2))'
  );
  assert.match(
    fnBody,
    /setSalePrice\(\(totalEstimatedCost\s*\*\s*1\.15\)\.toFixed\(2\)\);/,
    'autoCalculateEstimates must call setSalePrice((totalEstimatedCost * 1.15).toFixed(2))'
  );
});

test('2. Footer decoupling: terrestrial calculations isolated from maritime estimatedCost', () => {
  assert.match(
    workspaceSource,
    /const\s+terrestrialUnitCost\s*=\s*Number\(/,
    'Must define terrestrialUnitCost'
  );
  assert.match(
    workspaceSource,
    /const\s+rawCost\s*=\s*Number\(activeProject\?\.land_freight_cost\)\s*\|\|\s*terrestrialUnitCost\s*\|\|\s*0;/,
    'rawCost must use activeProject.land_freight_cost or terrestrialUnitCost, not estimatedCost'
  );
  assert.match(
    workspaceSource,
    /const\s+rawSale\s*=\s*Number\(activeProject\?\.land_freight_sale\)\s*\|\|\s*\(terrestrialUnitCost\s*\*\s*1\.18\)\s*\|\|\s*0;/,
    'rawSale must use activeProject.land_freight_sale or terrestrialUnitCost * 1.18, not salePrice'
  );
});

test('3. handleSaveProjectCargo: pure mathematical calculation and maritime shielding', () => {
  const saveCargoMatch = workspaceSource.match(/const\s+handleSaveProjectCargo\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?finally\s*\{/);
  assert.ok(saveCargoMatch, 'handleSaveProjectCargo function must exist');
  const saveFn = saveCargoMatch[0];

  assert.match(
    saveFn,
    /const\s+safeDist\s*=\s*Number\(distanceKm\)\s*\|\|\s*Number\(activeProject\?\.land_route\?\.distance_km\)\s*\|\|\s*0;/,
    'Must define safeDist'
  );
  assert.match(
    saveFn,
    /const\s+safeTrucks\s*=\s*Number\(camionesReales\)\s*\|\|\s*Number\(activeProject\?\.total_trucks\)\s*\|\|\s*1;/,
    'Must define safeTrucks'
  );
  assert.match(
    saveFn,
    /const\s+absoluteLandCost\s*=\s*\(\(safeDist\s*\*\s*1\.57\)\s*\+\s*\(safeDist\s*\*\s*0\.18\)\s*\+\s*75\)\s*\*\s*safeTrucks\s*\*\s*safeExchange;/,
    'Must calculate absoluteLandCost pure math'
  );
  assert.match(
    saveFn,
    /const\s+absoluteLandSale\s*=\s*absoluteLandCost\s*\*\s*1\.18;/,
    'Must calculate absoluteLandSale with 18% margin'
  );

  // In payload and updatedProject
  assert.match(saveFn, /land_freight_cost:\s*absoluteLandCost/);
  assert.match(saveFn, /land_freight_sale:\s*absoluteLandSale/);
  assert.match(saveFn, /total_trucks:\s*safeTrucks/);
  assert.match(saveFn, /cost:\s*activeProject\?\.cost\s*\|\|\s*null/);
  assert.match(saveFn, /sale:\s*activeProject\?\.sale\s*\|\|\s*null/);
  assert.match(saveFn, /items:\s*activeProject\?\.items\s*\|\|\s*\[\]/);
  assert.match(saveFn, /services:\s*activeProject\?\.services\s*\|\|\s*\[\]/);
  assert.match(saveFn, /cargoQuantity:\s*activeProject\?\.cargoQuantity\s*\|\|\s*null/);
});

test('4. Central Card UI: strictly calculates unitary truck cost times fleet without double multiplication', () => {
  assert.match(
    workspaceSource,
    /<span[^>]*>Coste Operativo Total Carretera:<\/span>\s*<strong[^>]*>\{\(Number\(cost\s*\|\|\s*0\)\s*\*\s*\(camionesReales\s*\|\|\s*1\)\)\.toLocaleString\(\)\}\s*€<\/strong>/,
    'Must render Coste Operativo Total Carretera as Number(cost || 0) * (camionesReales || 1)'
  );
});

test('5. Footer UI inputs: bound to finalFooterCost and finalFooterSale with dynamic global currency', () => {
  assert.match(
    workspaceSource,
    /<input[^>]*id="input-estimated-cost"[^>]*value=\{finalFooterCost\s*>\s*0\s*\?\s*finalFooterCost\.toFixed\(2\)\s*:\s*['"]['"]\}/,
    'input-estimated-cost must be bound to finalFooterCost'
  );
  assert.match(
    workspaceSource,
    /<input[^>]*id="input-sale-price"[^>]*value=\{finalFooterSale\s*>\s*0\s*\?\s*finalFooterSale\.toFixed\(2\)\s*:\s*['"]['"]\}/,
    'input-sale-price must be bound to finalFooterSale'
  );
});
