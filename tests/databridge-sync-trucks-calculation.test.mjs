import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderSource = readFileSync(new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url), 'utf8');
const landCharterAliasSource = readFileSync(new URL('../src/components/LandCharterWorkspace.jsx', import.meta.url), 'utf8');

test('1. ForwarderWorkspace defines reactive state variables for total tons and required trucks', () => {
  assert.match(forwarderSource, /const\s+\[totalProjectTons,\s*setTotalProjectTons\]\s*=\s*useState\(0\)/);
  assert.match(forwarderSource, /const\s+\[requiredTrucksCount,\s*setRequiredTrucksCount\]\s*=\s*useState\(0\)/);
  assert.match(forwarderSource, /const\s+setProjectWeightTons\s*=\s*setTotalProjectTons;/);
  assert.match(forwarderSource, /const\s+setTotalQuantity\s*=\s*setTotalProjectTons;/);
  assert.match(forwarderSource, /const\s+setTrucksCount\s*=\s*setRequiredTrucksCount;/);
  assert.match(forwarderSource, /const\s+setVehicleCount\s*=\s*setRequiredTrucksCount;/);
});

test('2. handleSyncDataBridge captures tonnage safely with fallbacks', () => {
  assert.match(forwarderSource, /window\.__ACTIVE_FORWARDER_TOTAL_WEIGHT_TONS__/);
  assert.match(forwarderSource, /seacharter_active_project_weight_tons/);
  assert.match(forwarderSource, /packingListWeightTons/);
});

test('3. handleSyncDataBridge calculates required trucks dynamically using Math.ceil', () => {
  assert.match(forwarderSource, /const\s+requiredTrucks\s*=\s*totalTons\s*>\s*0\s*\?\s*Math\.ceil\(totalTons\s*\/\s*truckPayloadMT\)\s*:\s*0/);
});

test('4. handleSyncDataBridge triggers reactive state updates for UI refresh and logs to console', () => {
  assert.match(forwarderSource, /setTotalProjectTons\(totalTons\)/);
  assert.match(forwarderSource, /setRequiredTrucksCount\(requiredTrucks\)/);
  assert.match(forwarderSource, /if\s*\(typeof\s+setProjectWeightTons\s*===\s*['"]function['"]\)\s*setProjectWeightTons\(totalTons\)/);
  assert.match(forwarderSource, /if\s*\(typeof\s+setTrucksCount\s*===\s*['"]function['"]\)\s*setTrucksCount\(requiredTrucks\)/);
  assert.match(forwarderSource, /id:\s*['"]sync-land-charter-fixed-row['"]/);
  assert.match(forwarderSource, /category:\s*['"]Carga Unificada \/ Envasada['"]/);
  assert.match(forwarderSource, /console\.log\(`Sync DataBridge:\s*\$\{totalTons\}\s*MT/);
});

test('5. Sync DataBridge buttons have onClick={handleSyncDataBridge}', () => {
  assert.match(forwarderSource, /id=["']btn-sync-databridge["'][\s\S]*?onClick=\{handleSyncDataBridge\}/);
  assert.match(forwarderSource, /id=["']btn-sync-databridge-top["'][\s\S]*?onClick=\{handleSyncDataBridge\}/);
  assert.match(forwarderSource, /id=["']btn-sync-databridge-bottom["'][\s\S]*?onClick=\{handleSyncDataBridge\}/);
});

test('6. LandCharterWorkspace alias exists and exports ForwarderWorkspace', () => {
  assert.match(landCharterAliasSource, /import\s+ForwarderWorkspace\s+from\s+['"]\.\/ForwarderWorkspace(?:\.jsx)?['"]/);
  assert.match(landCharterAliasSource, /export\s+default\s+ForwarderWorkspace/);
});
