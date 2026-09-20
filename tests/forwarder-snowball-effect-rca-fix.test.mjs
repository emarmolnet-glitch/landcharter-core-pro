import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const forwarderJsxPath = path.resolve('src/components/ForwarderWorkspace.jsx');
const forwarderJsx = fs.readFileSync(forwarderJsxPath, 'utf8');

test('1. Paso 1: handleSaveProjectCargo payload sanitized without duplicate keys', () => {
  const saveCargoMatch = forwarderJsx.match(/const\s+handleSaveProjectCargo\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?finally\s*\{/);
  assert.ok(saveCargoMatch, 'handleSaveProjectCargo function must exist');
  const saveFn = saveCargoMatch[0];

  // In payload, absoluteLandCost and absoluteLandSale are the single source of truth
  assert.match(saveFn, /land_freight_cost:\s*absoluteLandCost/);
  assert.match(saveFn, /land_freight_sale:\s*absoluteLandSale/);

  // Duplicate keys calculatedLandFreightCost/Sale must NOT exist inside payload object
  const payloadObjMatch = saveFn.match(/const\s+payload\s*=\s*\{([\s\S]*?)\n\s*\};/);
  assert.ok(payloadObjMatch, 'payload object must exist');
  const payloadBody = payloadObjMatch[1];
  assert.doesNotMatch(payloadBody, /land_freight_cost:\s*calculatedLandFreightCost/);
  assert.doesNotMatch(payloadBody, /land_freight_sale:\s*calculatedLandFreightSale/);
});

test('2. Paso 1: updatedLineItems enforces idempotency by filtering previous terrestrial services', () => {
  assert.match(
    forwarderJsx,
    /existingItems\.filter\(\s*item\s*=>\s*item\.service_name\s*!==\s*savedLineItem\.service_name\s*&&\s*!item\.service_name\?\.toLowerCase\(\)\.includes\('terrestre'\)\s*\)/,
    'Must filter previous terrestrial services to guarantee idempotency'
  );
});

test('3. Paso 1: totalServicesCost and totalServicesSale assume absoluteLandCost/Sale plus non-terrestrial items', () => {
  assert.match(
    forwarderJsx,
    /const\s+totalServicesCost\s*=\s*updatedLineItems\.reduce\(/,
    'Must calculate totalServicesCost via reduce'
  );
  assert.match(
    forwarderJsx,
    /const\s+totalServicesSale\s*=\s*updatedLineItems\.reduce\(/,
    'Must calculate totalServicesSale via reduce'
  );
  assert.match(
    forwarderJsx,
    /absoluteLandCost\s*\)/,
    'totalServicesCost reduce must initialize with absoluteLandCost'
  );
  assert.match(
    forwarderJsx,
    /absoluteLandSale\s*\)/,
    'totalServicesSale reduce must initialize with absoluteLandSale'
  );
});

test('4. Paso 2: Eliminación de la heurística > 20000 y cálculo declarativo e inmutable del total', () => {
  assert.doesNotMatch(
    forwarderJsx,
    /rawCost\s*>\s*20000/,
    'Must remove arbitrary > 20000 heuristic for rawCost'
  );
  assert.doesNotMatch(
    forwarderJsx,
    /rawSale\s*>\s*20000/,
    'Must remove arbitrary > 20000 heuristic for rawSale'
  );

  assert.match(
    forwarderJsx,
    /const\s+finalFooterCost\s*=\s*terrestrialUnitCost\s*\*\s*camionesReales\s*\*\s*exchangeRate;/,
    'finalFooterCost must strictly be terrestrialUnitCost * camionesReales * exchangeRate'
  );
  assert.match(
    forwarderJsx,
    /const\s+finalFooterSale\s*=\s*\(terrestrialUnitCost\s*\*\s*1\.18\)\s*\*\s*camionesReales\s*\*\s*exchangeRate;/,
    'finalFooterSale must strictly be (terrestrialUnitCost * 1.18) * camionesReales * exchangeRate'
  );
});

test('5. Paso 3: terrestrialUnitCost is pure operational calculation isolated from ambiguous cost/BD totals', () => {
  const unitCostMatch = forwarderJsx.match(/const\s+terrestrialUnitCost\s*=\s*Number\(([\s\S]*?)\);/);
  assert.ok(unitCostMatch, 'terrestrialUnitCost definition must exist');
  const expr = unitCostMatch[1];

  assert.doesNotMatch(expr, /activeProject\?\.land_freight_cost/, 'terrestrialUnitCost must never depend on activeProject.land_freight_cost');
  assert.doesNotMatch(expr, /\bcost\b/, 'terrestrialUnitCost must never depend on ambiguous cost state');
  assert.match(expr, /calculatedTerrestrialUnit/, 'terrestrialUnitCost must use calculatedTerrestrialUnit');
});
