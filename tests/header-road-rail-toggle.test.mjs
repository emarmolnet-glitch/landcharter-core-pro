import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = resolve(process.cwd());

test('1. index.html defines ROAD/RAIL header toggle with localStorage persistence', async () => {
  const indexHtml = await readFile(resolve(rootDir, 'index.html'), 'utf8');

  // Verify ROAD and RAIL text in header buttons
  assert.match(indexHtml, /setGlobalTransportMode\(['"]ROAD['"]\)/);
  assert.match(indexHtml, /setGlobalTransportMode\(['"]RAIL['"]\)/);
  assert.match(indexHtml, />ROAD<\/span>/);
  assert.match(indexHtml, />RAIL<\/span>/);

  // Verify function declaration and window.globalTransportMode initialization
  assert.match(indexHtml, /window\.globalTransportMode\s*=\s*normalizeTransportMode/);
  assert.match(indexHtml, /function setGlobalTransportMode\(mode\)/);
  assert.match(indexHtml, /window\.setGlobalTransportMode\s*=\s*setGlobalTransportMode/);
  assert.match(indexHtml, /landcharter_global_transport_mode/);

  // Verify injection into route calculation sync
  assert.match(indexHtml, /globalTransportMode:\s*window\.globalTransportMode\s*\|\|\s*['"]ROAD['"]/);
});

test('2. cerebro-ia.js proxy extracts globalTransportMode and shields rail traction cost', async () => {
  const cerebroSource = await readFile(resolve(rootDir, 'netlify/functions/cerebro-ia.js'), 'utf8');

  assert.match(cerebroSource, /incomingTransportMode/);
  assert.match(cerebroSource, /globalTransportMode/);
  assert.match(cerebroSource, /costeTrenConsolidado/);
});

test('3. ForwarderWorkspace and VisualTruckPlan listen to globalTransportMode and protect costs', async () => {
  const forwarderSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');
  const visualTruckPlanSource = await readFile(resolve(rootDir, 'src/components/VisualTruckPlan.jsx'), 'utf8');

  // ForwarderWorkspace reacts to globalTransportMode
  assert.match(forwarderSource, /globaltransportmodechange/);
  assert.match(forwarderSource, /transport-mode-changed/);

  // VisualTruckPlan prioritizes globalTransportMode
  assert.match(visualTruckPlanSource, /window\.globalTransportMode\s*===\s*['"]RAIL['"]/);

  // Financial shielding: costeTren assigned without multiplying by wagons
  assert.match(forwarderSource, /window\.State\.estimatedCost\s*=\s*costeTren/);
});
