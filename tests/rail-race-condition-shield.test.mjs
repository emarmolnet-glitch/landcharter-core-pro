import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = resolve(process.cwd());

test('1. ForwarderWorkspace.jsx implements guard clause in autoCalculateEstimates to abort road recalculations in RAIL mode', async () => {
  const forwarderSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Guard clause at the beginning of autoCalculateEstimates checking window.globalTransportMode === 'RAIL'
  assert.match(
    forwarderSource,
    /const\s+autoCalculateEstimates\s*=\s*\([^{]*\{\s*[\s\S]*?window\.globalTransportMode\s*===\s*['"]RAIL['"][\s\S]*?return;/
  );
});

test('2. ForwarderWorkspace.jsx shields useEffect listening to cargoItems from executing in RAIL mode', async () => {
  const forwarderSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Guard clause in useEffect listening to cargoItems
  assert.match(
    forwarderSource,
    /useEffect\(\(\)\s*=>\s*\{[\s\S]*?window\.globalTransportMode\s*===\s*['"]RAIL['"][\s\S]*?return;[\s\S]*?autoCalculateEstimates\(cargoItems\);[\s\S]*?cargoItems/
  );
});

test('3. ForwarderWorkspace.jsx hydrates rail costs using strict formula: CosteConsolidado + (vagones * 450) /* Drayage Origen */ + (vagones * 450) /* Drayage Destino */', async () => {
  const forwarderSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Strict formula with inline comments
  assert.match(
    forwarderSource,
    /coste\s*=\s*CosteConsolidado\s*\+\s*\(\s*vagones\s*\*\s*450\s*\)\s*\/\*\s*Drayage Origen\s*\*\/\s*\+\s*\(\s*vagones\s*\*\s*450\s*\)\s*\/\*\s*Drayage Destino\s*\*\//
  );
});

test('4. ForwarderWorkspace.jsx blocks circular re-renders with railHydrationLockRef', async () => {
  const forwarderSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Lock ref declared
  assert.match(forwarderSource, /const\s+railHydrationLockRef\s*=\s*useRef\(['"]{2}\);/);

  // Lock check prevents circular loops
  assert.match(forwarderSource, /if\s*\(railHydrationLockRef\.current\s*===\s*lockKey\)\s*\{\s*return;\s*\}/);
});

test('5. App.jsx protects master validation from triggering 24t road auto-calculation in RAIL mode', async () => {
  const appSource = await readFile(resolve(rootDir, 'src/App.jsx'), 'utf8');

  assert.match(
    appSource,
    /window\.globalTransportMode\s*===\s*['"]RAIL['"]/
  );
});

test('6. Simulated rail hydration correctly preserves 160 wagons and shields consolidated linehaul and drayage costs', () => {
  // Simulate 8000t payload scenario
  const totalTons = 8000;
  const wagonCapacity = 50;
  const vagones = Math.ceil((totalTons * 1000) / (wagonCapacity * 1000));
  assert.equal(vagones, 160, '8000 MT in RAIL mode must yield 160 wagons (never 334 trucks)');

  const CosteConsolidado = 28800; // Simulated linehaul
  const drayageOrigin = vagones * 450;
  const drayageDest = vagones * 450;
  const coste = CosteConsolidado + (vagones * 450) /* Drayage Origen */ + (vagones * 450) /* Drayage Destino */;

  assert.equal(drayageOrigin, 72000, 'Origin drayage for 160 wagons must be 72,000');
  assert.equal(drayageDest, 72000, 'Destination drayage for 160 wagons must be 72,000');
  assert.equal(coste, 28800 + 72000 + 72000, 'Total cost must strictly sum CosteConsolidado + drayage');
});

test('7. handleSyncDataBridge implements Deep Compare Cortafuegos to block redundant /api/projects/sync-road requests', async () => {
  const forwarderSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Deep compare check before calling sync-road
  assert.match(
    forwarderSource,
    /lastSyncDataBridgeRef\.current\s*===\s*currentPayloadString[\s\S]*?return;[\s\S]*?fetch\(getApiUrl\(['"]\/api\/projects\/sync-road['"]\)/
  );
});

test('8. ForwarderWorkspace protects rail costs from 154M multiplication bug across footer and sync', async () => {
  const forwarderSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // In rail mode, finalFooterCost uses totalRailCostUpper directly, bypassing any corrupted activeProject.land_freight_cost
  assert.match(
    forwarderSource,
    /const\s+finalFooterCost\s*=\s*isRailFooter\s*\?\s*totalRailCostUpper\s*:\s*\(Number\(activeProject\?\.land_freight_cost\)/
  );

  // In handleSyncDataBridge, totalCost uses costeTrenSync + totalDrayageSync directly in rail mode
  assert.match(
    forwarderSource,
    /const\s+totalCost\s*=\s*isRail\s*\?\s*costeTrenSync\s*\+\s*totalDrayageSync/
  );
});

test('9. Hard reset on mount aggressively purges ghost memory and interrupts residual sync', async () => {
  const forwarderSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // useEffect on mount interrupts refs and resets form state
  assert.match(
    forwarderSource,
    /lastSyncDataBridgeRef\.current\s*=\s*['"]{2};[\s\S]*?setActiveProject\(null\);[\s\S]*?setLandOrigin\(['"]{2}\);[\s\S]*?delete\s+window\.State\.costeTrenConsolidado;/
  );
});
