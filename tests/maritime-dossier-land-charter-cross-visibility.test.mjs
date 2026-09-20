import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderWorkspaceSource = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);
const forwarderBackendSource = readFileSync(
  new URL('../netlify/functions/forwarder-projects.js', import.meta.url),
  'utf8'
);
const dossiersBackendSource = readFileSync(
  new URL('../netlify/functions/dossiers.ts', import.meta.url),
  'utf8'
);

// Extract helper functions using the project test pattern
function normalizeStr(val) {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
const COMMODITY_TARIFFS = {
  "CEM I 52,5N BIGBAG": { inlandUsdMt: 3.00, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 3.50 },
  "CEM II 42,5 VRAC": { inlandUsdMt: 4.30, portDuesUsdMt: 2.00, customsUsdMt: 0.30, packagingUsdMt: 3.50 }
};

const mapCatMatch = forwarderWorkspaceSource.match(/export\s+function\s+mapCargoCategoryAndType[\s\S]*?\n\}/);
assert.ok(mapCatMatch, 'mapCargoCategoryAndType must be defined in ForwarderWorkspace.jsx');
const mapCargoCategoryAndType = new Function(
  'normalizeStr',
  'COMMODITY_TARIFFS',
  `return ${mapCatMatch[0].replace('export function mapCargoCategoryAndType', 'function')}`
)(normalizeStr, COMMODITY_TARIFFS);

const mapMaritimeMatch = forwarderWorkspaceSource.match(/export\s+function\s+mapMaritimeDossierToLandCharter[\s\S]*?\n\}/);
assert.ok(mapMaritimeMatch, 'mapMaritimeDossierToLandCharter must be defined in ForwarderWorkspace.jsx');
const mapMaritimeDossierToLandCharter = new Function(
  'mapCargoCategoryAndType',
  `return ${mapMaritimeMatch[0].replace('export function mapMaritimeDossierToLandCharter', 'function')}`
)(mapCargoCategoryAndType);

test('1. mapMaritimeDossierToLandCharter accurately maps reference to project_ref and preserves UUID compatibility', () => {
  const mockDossier = {
    id: 'c8d62f6b-73fa-4395-8ec6-91e70e176318',
    reference: 'RDM/2026-9042',
    charterer: 'Cemex España Operaciones',
    cargoName: 'CEM I 52,5N BIGBAG',
    cargoVolume: 3500,
    status: 'BORRADOR',
    sessionPayload: {
      calculatorState: {
        pol: 'Port of Castellón',
        pod: 'Port of Arzew',
        cargoType: 'CEM I 52,5N BIGBAG',
        cargo: 3500,
      },
      fields: {
        'port-pol': 'Port of Castellón',
        'port-pod': 'Port of Arzew',
        clientName: 'Cemex España Operaciones',
      }
    }
  };

  const adapted = mapMaritimeDossierToLandCharter(mockDossier);

  assert.ok(adapted, 'Adapted project must not be null');
  assert.equal(adapted.project_ref, 'RDM/2026-9042', 'Reference must be mapped to project_ref');
  assert.equal(adapted.reference, 'RDM/2026-9042', 'Original reference must be preserved');
  assert.equal(adapted.id, 'c8d62f6b-73fa-4395-8ec6-91e70e176318', 'UUID ID must be preserved compatibly');
  assert.equal(adapted.dossier_id, 'c8d62f6b-73fa-4395-8ec6-91e70e176318', 'dossier_id must be assigned UUID');
  assert.equal(adapted.is_maritime_dossier, true, 'is_maritime_dossier flag must be true');
  assert.equal(adapted.isAdaptedDossier, true, 'isAdaptedDossier flag must be true');
  assert.equal(adapted.from_maritime, true, 'from_maritime flag must be true');
  assert.equal(adapted.source, 'core_pro', 'source must be core_pro');
  assert.equal(adapted.pol, 'Port of Castellón', 'pol must be extracted from sessionPayload');
  assert.equal(adapted.pod, 'Port of Arzew', 'pod must be extracted from sessionPayload');
  assert.equal(adapted.land_origin, 'Port of Castellón', 'land_origin must be initialized with pol');
  assert.equal(adapted.land_destination, 'Port of Arzew', 'land_destination must be initialized with pod');
  assert.equal(adapted.client_name, 'Cemex España Operaciones', 'client_name must be mapped from charterer');
  assert.equal(adapted.dossier_ref, 'RDM/2026-9042', 'dossier_ref must match reference');
  assert.equal(adapted.parent_ref, 'RDM/2026-9042', 'parent_ref must match reference');
});

test('2. mapMaritimeDossierToLandCharter extracts pol and pod from multiple fallback fields in sessionPayload', () => {
  const dossierWithFieldKeys = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    reference: 'RDM/2026-1122',
    sessionPayload: {
      fields: {
        'port-pol': 'Valencia',
        'port-pod': 'Marseille',
      }
    }
  };

  const adapted = mapMaritimeDossierToLandCharter(dossierWithFieldKeys);
  assert.equal(adapted.pol, 'Valencia', 'Must extract pol from fields.port-pol');
  assert.equal(adapted.pod, 'Marseille', 'Must extract pod from fields.port-pod');
  assert.equal(adapted.land_origin, 'Valencia');
  assert.equal(adapted.land_destination, 'Marseille');
});

test('3. ForwarderWorkspace fetchProjects implements fallback to /.netlify/functions/dossiers when forwarder-projects is empty', () => {
  // Verifies fallback query to dossiers endpoint
  assert.match(
    forwarderWorkspaceSource,
    /\/\.netlify\/functions\/dossiers\?q=/i,
    'fetchProjects must reference /.netlify/functions/dossiers?q= endpoint'
  );

  // Verifies use of mapMaritimeDossierToLandCharter to translate maritime dossier to land project
  assert.match(
    forwarderWorkspaceSource,
    /mapMaritimeDossierToLandCharter\(/,
    'fetchProjects must call mapMaritimeDossierToLandCharter to adapt dossier'
  );

  // Verifies inclusion of adapted project into list
  assert.match(
    forwarderWorkspaceSource,
    /list\s*=\s*\[\s*adaptedProject\s*,\s*\.\.\.list\s*\]/,
    'fetchProjects must prepend adapted project into projects list'
  );
});

test('4. persistProjectToDatabase detects adapted Core Pro dossier and dispatches POST insert with same project_ref', () => {
  // Verifies check for adapted dossier
  assert.match(
    forwarderWorkspaceSource,
    /const\s+isAdaptedFromCorePro\s*=\s*Boolean\(/,
    'persistProjectToDatabase must evaluate isAdaptedFromCorePro'
  );

  // Verifies POST request for adapted dossiers instead of PUT
  assert.match(
    forwarderWorkspaceSource,
    /if\s*\(\s*isAdaptedFromCorePro\s*\)\s*\{[\s\S]*?is_maritime_dossier:\s*true[\s\S]*?is_new_insert:\s*true[\s\S]*?method:\s*['"]POST['"]/i,
    'persistProjectToDatabase must send POST with is_maritime_dossier and is_new_insert for adapted dossiers'
  );

  // Verifies project_ref is preserved in insertPayload
  assert.match(
    forwarderWorkspaceSource,
    /project_ref:\s*effectiveProjectRef/,
    'insertPayload must link commercially using same project_ref'
  );
});

test('5. forwarder-projects.js backend handles isAdaptedDossier by executing INSERT with same project_ref when no prior land record exists', () => {
  // Verifies isAdaptedDossier detection in backend
  assert.match(
    forwarderBackendSource,
    /const\s+isAdaptedDossier\s*=\s*Boolean\(\s*data\.is_maritime_dossier\s*\|\|\s*data\.from_maritime\s*\|\|\s*data\.is_new_insert\s*\|\|\s*data\.source\s*===\s*['"]core_pro['"]\s*\);/,
    'forwarder-projects.js must identify adapted dossier from Core PRO'
  );

  // Verifies checking if record already exists
  assert.match(
    forwarderBackendSource,
    /SELECT\s+id,\s*project_ref\s+FROM\s+forwarder_projects/i,
    'forwarder-projects.js must check if record exists'
  );

  // Verifies INSERT query for adapted dossier
  assert.match(
    forwarderBackendSource,
    /if\s*\(\s*isAdaptedDossier\s*&&\s*!existingRecord\s*\)\s*\{[\s\S]*?INSERT\s+INTO\s+forwarder_projects/i,
    'forwarder-projects.js must perform INSERT when isAdaptedDossier and no existing land record exists'
  );

  // Verifies safe integer parsing to prevent invalid input syntax for type integer: "NaN"
  assert.match(
    forwarderBackendSource,
    /const\s+isIntegerId\s*=\s*data\.id\s*!==\s*undefined[\s\S]*?const\s+parsedId\s*=\s*isIntegerId\s*\?\s*parseInt\(data\.id,\s*10\)\s*:\s*null;/,
    'forwarder-projects.js must sanitize integer ID to avoid NaN syntax errors with UUIDs'
  );
});

test('6. dossiers.ts backend supports includePayload query parameter for complete session data transfer', () => {
  assert.match(
    dossiersBackendSource,
    /const\s+includePayload\s*=\s*url\.searchParams\.get\(["']includePayload["']\)\s*===\s*["']true["']\s*\|\|\s*url\.searchParams\.get\(["']include_payload["']\)\s*===\s*["']true["'];/,
    'dossiers.ts must support includePayload query parameter'
  );
  assert.match(
    dossiersBackendSource,
    /serialize\(row,\s*includePayload\)/,
    'dossiers.ts must pass includePayload to serialize'
  );
});
