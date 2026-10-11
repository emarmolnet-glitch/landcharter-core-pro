import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = resolve(process.cwd());

test('1. ForwarderWorkspace defines clearAndResetProjectState function and exposes window.resetForwarderWorkspace', async () => {
  const source = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Verify clearAndResetProjectState exists
  assert.match(
    source,
    /const\s+clearAndResetProjectState\s*=\s*\(\)\s*=>\s*\{/,
    'clearAndResetProjectState function must be declared'
  );

  // Verify window exposure
  assert.match(
    source,
    /window\.resetForwarderWorkspace\s*=\s*clearAndResetProjectState;/,
    'window.resetForwarderWorkspace must be exposed'
  );
});

test('2. clearAndResetProjectState resets land route, cargo items, financial costs, and assessment', async () => {
  const source = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Find clearAndResetProjectState body
  const match = source.match(/const\s+clearAndResetProjectState\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\};/);
  assert.ok(match, 'clearAndResetProjectState body must be matched');
  const body = match[1];

  // Land route resets
  assert.match(body, /setLandOrigin\(['"]['"]\);/);
  assert.match(body, /setLandDestination\(['"]['"]\);/);
  assert.match(body, /setDistanceKm\(0\);/);
  assert.match(body, /setTollCost\(0\);/);
  assert.match(body, /setDriverDiets\(0\);/);
  assert.match(body, /setWarehouseWaitPenaltyEur\(0\);/);

  // Packing list / cargo resets
  assert.match(body, /setCargoItems\(\[\]\);/);
  assert.match(body, /setEditingLineItemId\(null\);/);

  // Financial costs resets
  assert.match(body, /setEstimatedCost\(['"]['"]\);/);
  assert.match(body, /setSalePrice\(['"]['"]\);/);
  assert.match(body, /setMercanciaCost\(0\);/);
  assert.match(body, /setSurveyorCost\(0\);/);
  assert.match(body, /setInlandCost\(0\);/);

  // Control refs resets
  assert.match(body, /lastHydratedProjectIdRef\.current\s*=\s*null;/);
  assert.match(body, /lastCalculatedItemsRef\.current\s*=\s*['"]\[\]['"];/);

  // Global window.State purge
  assert.match(body, /delete\s+window\.State\.land_origin/);
  assert.match(body, /delete\s+window\.State\.land_destination/);
  assert.match(body, /delete\s+window\.State\.land_freight_cost/);
  assert.match(body, /delete\s+window\.State\.totalTripCost/);
  assert.match(body, /delete\s+window\.GlobalStore\.land_freight_cost/);
});

test('3. handleCreateProject executes clearAndResetProjectState before setting activeProject', async () => {
  const source = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  assert.match(
    source,
    /const\s+handleCreateProject\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?clearAndResetProjectState\(\);[\s\S]*?setActiveProject\(createdProject\);/,
    'handleCreateProject must execute clearAndResetProjectState before setting activeProject'
  );
});

test('4. activeProject effect purges and resets state when activeProject is null or closed', async () => {
  const source = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Verify that else branch of activeProject effect invokes clearAndResetProjectState
  assert.match(
    source,
    /if\s*\(\s*activeProject\s*\)\s*\{[\s\S]*?\}\s*else\s*\{\s*clearAndResetProjectState\(\);\s*\}/,
    'activeProject effect must call clearAndResetProjectState when activeProject is falsy'
  );
});

test('5. State hooks for land route do not fall back to global window.State', async () => {
  const source = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  assert.match(
    source,
    /const\s+\[landOrigin,\s*setLandOrigin\]\s*=\s*useState\(activeProject\?\.land_route\?\.origin\s*\|\|\s*activeProject\?\.land_origin\s*\|\|\s*["']["']\);/,
    'landOrigin hook must not fall back to window.State'
  );
  assert.match(
    source,
    /const\s+\[landDestination,\s*setLandDestination\]\s*=\s*useState\(activeProject\?\.land_route\?\.destination\s*\|\|\s*activeProject\?\.land_destination\s*\|\|\s*["']["']\);/,
    'landDestination hook must not fall back to window.State'
  );
});
