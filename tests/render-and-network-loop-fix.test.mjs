import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderSource = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);

const lazyGlobeSource = readFileSync(
  new URL('../src/components/LazyGlobeMap.tsx', import.meta.url),
  'utf8'
);

test('1. Fix ReferenceError: handleSyncDataBridge defines isRailDataBridge and isDataBridge at start of function', () => {
  const syncMatch = forwarderSource.match(
    /const\s+handleSyncDataBridge\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)(?:const\s+ref\s*=|const\s+syncPayload\s*=)/
  );
  assert.ok(syncMatch, 'handleSyncDataBridge must be defined');
  const syncStart = syncMatch[1];

  assert.match(
    syncStart,
    /const\s+isRailDataBridge\s*=/,
    'isRailDataBridge must be declared at the beginning of handleSyncDataBridge'
  );
  assert.match(
    syncStart,
    /const\s+isDataBridge\s*=/,
    'isDataBridge must be declared at the beginning of handleSyncDataBridge'
  );
});

test('2. Deep Compare Shield: Auto-generated services and cargo items use static predictable IDs without timestamps', () => {
  // Services autogeneration in rail mode
  assert.match(
    forwarderSource,
    /id:\s*['"]srv-auto-rail-traction['"]/,
    'Rail traction linehaul must use static ID srv-auto-rail-traction'
  );
  assert.match(
    forwarderSource,
    /id:\s*['"]srv-auto-drayage-origin['"]/,
    'Drayage origin must use static ID srv-auto-drayage-origin'
  );
  assert.match(
    forwarderSource,
    /id:\s*['"]srv-auto-drayage-dest['"]/,
    'Drayage destination must use static ID srv-auto-drayage-dest'
  );
  assert.match(
    forwarderSource,
    /id:\s*['"]srv-auto-road-freight['"]/,
    'Road freight must use static ID srv-auto-road-freight'
  );

  // No Date.now() or Math.random in hydrateCargoItem
  const hydrateMatch = forwarderSource.match(/export\s+function\s+hydrateCargoItem[\s\S]*?\n\}/);
  assert.ok(hydrateMatch, 'hydrateCargoItem must exist');
  assert.doesNotMatch(
    hydrateMatch[0],
    /Date\.now\(\)/,
    'hydrateCargoItem must not use Date.now() for item IDs'
  );
  assert.doesNotMatch(
    hydrateMatch[0],
    /Math\.random\(\)/,
    'hydrateCargoItem must not use Math.random() for item IDs'
  );
});

test('3. Map Render Stabilization: Leaflet MapContainer uses static key and oscillating interval is removed', () => {
  // LazyGlobeMap MapContainer key must be static
  assert.match(
    lazyGlobeSource,
    /<MapContainer\s+key=['"]map-container-static['"]/,
    'MapContainer key must be fixed statically to map-container-static'
  );
  assert.doesNotMatch(
    lazyGlobeSource,
    /key=\{`map-container-\$\{isRail/,
    'Dynamic isRail key that destroys DOM on mode change must be removed'
  );

  // ForwarderWorkspace oscillating setInterval must be removed
  assert.doesNotMatch(
    forwarderSource,
    /setInterval\(rescatarDatosCalculadora,\s*1000\)/,
    'Oscillating setInterval for rescuing calculator data must be removed'
  );
});
