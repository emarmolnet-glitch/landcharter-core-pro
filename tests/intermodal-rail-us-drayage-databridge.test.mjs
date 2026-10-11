import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = resolve(new URL('.', import.meta.url).pathname, '..');

test('1. cerebro-ia.js intercepts rail payload to Data Bridge and applies 50t divisor and wagon terms', async () => {
  const cerebroSource = await readFile(resolve(rootDir, 'netlify/functions/cerebro-ia.js'), 'utf8');

  // Payload interception: sets fleet_tonnage_divisor to 50
  assert.match(
    cerebroSource,
    /fleet_tonnage_divisor\s*=\s*50/,
    'cerebro-ia.js must inject fleet_tonnage_divisor: 50 for rail payload'
  );
  assert.match(
    cerebroSource,
    /wagon_capacity\s*=\s*50/,
    'cerebro-ia.js must inject wagon_capacity: 50 for rail payload'
  );

  // Payload interception: recalculates fleet with Math.ceil(tonnage / 50)
  assert.match(
    cerebroSource,
    /Math\.ceil\(\s*(?:incomingTonnage|tonnage)\s*\/\s*50\s*\)/,
    'cerebro-ia.js must calculate rail fleet with divisor 50'
  );

  // Response interception: replaces camiones/trailers with vagones
  assert.match(
    cerebroSource,
    /replaceRoadTermsWithRail/,
    'cerebro-ia.js must provide term replacement for road terms to rail'
  );
  assert.match(
    cerebroSource,
    /\\bcamiones\\b/i,
    'cerebro-ia.js must match and replace camiones'
  );
  assert.match(
    cerebroSource,
    /\\btr\[aá\]ilers\\b/i,
    'cerebro-ia.js must match and replace trailers'
  );
});

test('2. madre-ia.js intercepts rail payload to Data Bridge and enforces 50t divisor and wagon terms', async () => {
  const madreSource = await readFile(resolve(rootDir, 'netlify/functions/madre-ia.js'), 'utf8');

  // Checks rail mode
  assert.match(
    madreSource,
    /globalTransportMode.*RAIL/i,
    'madre-ia.js must detect globalTransportMode RAIL'
  );

  // Injects fleet_tonnage_divisor = 50 and wagon_capacity = 50 in remotePayload
  assert.match(
    madreSource,
    /remotePayload\.fleet_tonnage_divisor\s*=\s*50/,
    'madre-ia.js must inject fleet_tonnage_divisor: 50 into remotePayload'
  );
  assert.match(
    madreSource,
    /remotePayload\.wagon_capacity\s*=\s*50/,
    'madre-ia.js must inject wagon_capacity: 50 into remotePayload'
  );

  // Replaces camiones/trailers with vagones in response
  assert.match(
    madreSource,
    /replaceRoadTermsWithRail/,
    'madre-ia.js must provide term replacement for road terms to rail'
  );
  assert.match(
    madreSource,
    /sanitizeRoadTermsInObject/,
    'madre-ia.js must sanitize response object strings'
  );
});

test('3. ForwarderWorkspace.jsx updates Desglose Financiero title to Linehaul Rampa a Rampa', async () => {
  const forwarderSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // UI Title matches requirement
  assert.match(
    forwarderSource,
    /isRail\s*\?\s*['"]Desglose Financiero · Flete Ferroviario \(Linehaul Rampa a Rampa\)['"]\s*:\s*['"]Desglose Financiero · Transporte Terrestre por Carretera['"]/,
    'ForwarderWorkspace.jsx must render Desglose Financiero · Flete Ferroviario (Linehaul Rampa a Rampa)'
  );
});

test('4. ForwarderWorkspace.jsx injects US intermodal Drayage Origen and Drayage Destino ($450/wagon)', async () => {
  const forwarderSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Drayage Origen 450 per wagon
  assert.match(
    forwarderSource,
    /const\s+drayageOriginCost\s*=\s*isRail\s*\?\s*\(\s*450\s*\*\s*totalVagones\s*\)\s*:\s*0;/,
    'Drayage & Terminal Handling (Origen) must be calculated at 450 per wagon'
  );

  // Drayage Destino 450 per wagon
  assert.match(
    forwarderSource,
    /const\s+drayageDestCost\s*=\s*isRail\s*\?\s*\(\s*450\s*\*\s*totalVagones\s*\)\s*:\s*0;/,
    'Drayage & Terminal Handling (Destino) must be calculated at 450 per wagon'
  );

  // Injected automatic services in handleSaveProject
  assert.match(
    forwarderSource,
    /name:\s*['"]Drayage & Terminal Handling \(Origen\)['"]/,
    'Services must include Drayage & Terminal Handling (Origen)'
  );
  assert.match(
    forwarderSource,
    /name:\s*['"]Drayage & Terminal Handling \(Destino\)['"]/,
    'Services must include Drayage & Terminal Handling (Destino)'
  );
});

test('5. ForwarderWorkspace.jsx shields total cost: Linehaul + Drayage Origen + Drayage Destino without multiplying Linehaul by wagons', async () => {
  const forwarderSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Total road cost is Linehaul consolidated + total drayage cost
  assert.match(
    forwarderSource,
    /const\s+totalRoadCost\s*=\s*isRail\s*\n\s*\?\s*costeTrenConsolidado\s*\+\s*totalDrayageCost/,
    'totalRoadCost must sum consolidated Linehaul + total Drayage cost'
  );

  // Final footer cost calculation incorporates totalRailCostUpper
  assert.match(
    forwarderSource,
    /const\s+totalRailCostUpper\s*=\s*costeTrenUpper\s*\+\s*totalDrayageUpper;/,
    'totalRailCostUpper must sum costeTrenUpper + totalDrayageUpper'
  );

  // Final land cost in save logic
  assert.match(
    forwarderSource,
    /const\s+totalRailCost\s*=\s*costeTren\s*\+\s*totalDrayageCost;/,
    'handleSaveProject must compute totalRailCost = costeTren + totalDrayageCost'
  );
});

test('6. Chat assistant and MADRE fetch requests inject transportMode from window.globalTransportMode into request body', async () => {
  const assistantSource = await readFile(resolve(rootDir, 'src/sea-assistant-entry.js'), 'utf8');
  const madreAgentSource = await readFile(resolve(rootDir, 'src/madre-agent.js'), 'utf8');

  // Assistant fetch injects transportMode
  assert.match(
    assistantSource,
    /const\s+currentTransportMode\s*=\s*\(typeof window !== 'undefined' && window\.globalTransportMode\)\s*\?\s*window\.globalTransportMode\s*:\s*['"]ROAD['"]/,
    'sea-assistant-entry.js must extract currentTransportMode from window.globalTransportMode'
  );
  assert.match(
    assistantSource,
    /transportMode:\s*currentTransportMode/,
    'sea-assistant-entry.js must inject transportMode in requestPayload'
  );

  // MADRE agent fetch injects transportMode
  assert.match(
    madreAgentSource,
    /const\s+transportMode\s*=\s*\(typeof window !== ["']undefined["'] && window\.globalTransportMode\)\s*\?\s*window\.globalTransportMode\s*:\s*["']ROAD["']/,
    'madre-agent.js must extract transportMode from window.globalTransportMode'
  );
  assert.match(
    madreAgentSource,
    /transportMode[,:]/,
    'madre-agent.js must inject transportMode in sendPromptToMadre payload'
  );
});

