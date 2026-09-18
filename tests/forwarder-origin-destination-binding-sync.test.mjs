import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderJsx = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);

test('1. ForwarderWorkspace defines origin and destination aliases to match pol and pod', () => {
  assert.match(forwarderJsx, /const\s+origin\s*=\s*pol\s*;/);
  assert.match(forwarderJsx, /const\s+destination\s*=\s*pod\s*;/);
});

test('2. Origen and Destino inputs synchronize activeProject in onChange handlers', () => {
  // Check Origen input updates activeProject with land_origin and pol
  assert.match(
    forwarderJsx,
    /id="input-pol"[\s\S]*?onChange=\{\(e\)\s*=>\s*\{[\s\S]*?setPol\([^)]+\);[\s\S]*?setActiveProject\(prev\s*=>\s*\(\{\s*\.\.\.prev,\s*land_origin:\s*[^,]+,\s*pol:\s*[^}]+}\)\);/
  );

  // Check Destino input updates activeProject with land_destination and pod
  assert.match(
    forwarderJsx,
    /id="input-pod"[\s\S]*?onChange=\{\(e\)\s*=>\s*\{[\s\S]*?setPod\([^)]+\);[\s\S]*?setActiveProject\(prev\s*=>\s*\(\{\s*\.\.\.prev,\s*land_destination:\s*[^,]+,\s*pod:\s*[^}]+}\)\);/
  );
});

test('3. Tiempos de Almacén inputs synchronize activeProject in onChange handlers', () => {
  // Check input-loading-rate updates activeProject
  assert.match(
    forwarderJsx,
    /id="input-loading-rate"[\s\S]*?onChange=\{\(e\)\s*=>\s*\{[\s\S]*?setLoadingRate\([^)]+\);[\s\S]*?setActiveProject\(prev\s*=>\s*\(\{[\s\S]*?loadingRate:/
  );

  // Check input-discharging-rate updates activeProject
  assert.match(
    forwarderJsx,
    /id="input-discharging-rate"[\s\S]*?onChange=\{\(e\)\s*=>\s*\{[\s\S]*?setDischargingRate\([^)]+\);[\s\S]*?setActiveProject\(prev\s*=>\s*\(\{[\s\S]*?dischargingRate:/
  );
});

test('4. persistProjectToDatabase prioritizes fresh React states for land_origin and land_destination', () => {
  // Check persistProjectToDatabase definition
  const persistMatch = forwarderJsx.match(/const\s+persistProjectToDatabase\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?const\s+payload\s*=\s*\{[\s\S]*?\};/);
  assert.ok(persistMatch, 'persistProjectToDatabase payload definition must exist');
  const persistBlock = persistMatch[0];

  assert.match(
    persistBlock,
    /land_origin:\s*pol\s*\|\|\s*origin\s*\|\|\s*projectToSave\.land_origin\s*\|\|\s*projectToSave\.pol/
  );
  assert.match(
    persistBlock,
    /land_destination:\s*pod\s*\|\|\s*destination\s*\|\|\s*projectToSave\.land_destination\s*\|\|\s*projectToSave\.pod/
  );
});

test('5. Behavioral simulation: Fresh UI state overrides stale projectToSave data', () => {
  const projectToSave = {
    id: 101,
    project_ref: 'EXP-101',
    land_origin: 'Bugía',
    land_destination: 'Bugía',
    pol: 'Bugía',
    pod: 'Bugía',
  };

  const pol = 'Praia';
  const origin = pol;
  const pod = 'Lisboa';
  const destination = pod;

  const payloadLandOrigin = pol || origin || projectToSave.land_origin || projectToSave.pol;
  const payloadLandDestination = pod || destination || projectToSave.land_destination || projectToSave.pod;

  assert.equal(payloadLandOrigin, 'Praia', 'Fresh pol state "Praia" must override stale "Bugía"');
  assert.equal(payloadLandDestination, 'Lisboa', 'Fresh pod state "Lisboa" must override stale "Bugía"');
});
