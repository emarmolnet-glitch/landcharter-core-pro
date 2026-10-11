import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const syncRoadSource = readFileSync(
  new URL('../netlify/functions/sync-road.ts', import.meta.url),
  'utf8'
);
const forwarderProjectsSource = readFileSync(
  new URL('../netlify/functions/forwarder-projects.js', import.meta.url),
  'utf8'
);
const forwarderWorkspaceSource = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);
const dataBridgeSyncServiceSource = readFileSync(
  new URL('../dataBridgeSyncService.js', import.meta.url),
  'utf8'
);

test('1. DETENER INSERCIONES FANTASMA: sync-road.ts no inserta en BORRADOR silenciosamente sin guardado explícito', () => {
  // sync-road.ts debe condicionar la inserción a isExplicitSave
  assert.match(
    syncRoadSource,
    /isExplicitSave\s*=\s*Boolean\(/,
    'sync-road.ts must check for explicit save'
  );

  // Si no es guardado explícito y rowCount === 0, NO debe ejecutar INSERT; debe retornar ghost_insert_prevented
  assert.match(
    syncRoadSource,
    /ghost_insert_prevented:\s*true/,
    'sync-road.ts must prevent ghost inserts when project does not exist and is not explicit save'
  );

  // dataBridgeSyncService propaga is_explicit_save y allow_insert cuando se invoca con opciones explícitas
  assert.match(
    dataBridgeSyncServiceSource,
    /payload\.is_explicit_save\s*=\s*true/,
    'dataBridgeSyncService must support is_explicit_save flag'
  );
});

test('2. CORREGIR REGEX DESTRUCTIVO: isDescriptiveProjectName permite espacios, "camiones" y terminación en "MT"', () => {
  // Extraer la función isDescriptiveProjectName de forwarder-projects.js
  const matchFn = forwarderProjectsSource.match(/function isDescriptiveProjectName\(str\)\s*\{[\s\S]*?\n\}/);
  assert.ok(matchFn, 'isDescriptiveProjectName must be defined');

  const fnCode = `${matchFn[0]}\nreturn isDescriptiveProjectName;`;
  const isDescriptive = new Function(fnCode)();

  // No debe ser destructivo con nombres de proyecto válidos en Land Charter
  assert.equal(isDescriptive('EXP 2026 5000 MT'), false, 'Should allow spaces and ending in MT');
  assert.equal(isDescriptive('Transporte 10 camiones'), false, 'Should allow "camiones" and spaces');
  assert.equal(isDescriptive('Cliente Valencia - 25MT'), false, 'Should allow hyphens, spaces, and MT');
  assert.equal(isDescriptive('RDM/2026-0042'), false, 'Should allow standard canonical references');

  // Solo debe descartar si supera la longitud máxima razonable (150 chars)
  const longSentence = 'A'.repeat(151);
  assert.equal(isDescriptive(longSentence), true, 'Should reject long narrative descriptions over 150 chars');
});

test('3. EVITAR BORRADO DEL PACKING LIST: Flujo de actualización preserva items y documents intactos', () => {
  // En forwarder-projects.js, tanto el detalle GET (CASO A) como los retornos de guardado aseguran items y documents intactos
  assert.match(
    forwarderProjectsSource,
    /items:\s*Array\.isArray\(row\.items\)\s*\?\s*row\.items\s*:\s*\[\]/,
    'forwarder-projects.js returns complete items array'
  );
  assert.match(
    forwarderProjectsSource,
    /documents:\s*Array\.isArray\(row\.documents\)\s*\?\s*row\.documents\s*:\s*\[\]/,
    'forwarder-projects.js returns complete documents array'
  );

  // En ForwarderWorkspace.jsx, la actualización del activeProject tras consulta general preserva items y documents
  assert.match(
    forwarderWorkspaceSource,
    /items:\s*\(Array\.isArray\(updated\.items\)\s*&&\s*updated\.items\.length\s*>\s*0\)\s*\?\s*updated\.items\s*:\s*\(activeProject\?\.items\s*\|\|\s*\[\]\)/,
    'ForwarderWorkspace fetchProjects preserves activeProject items if list response is lightweight'
  );
  assert.match(
    forwarderWorkspaceSource,
    /documents:\s*\(Array\.isArray\(updated\.documents\)\s*&&\s*updated\.documents\.length\s*>\s*0\)\s*\?\s*updated\.documents\s*:\s*\(activeProject\?\.documents\s*\|\|\s*\[\]\)/,
    'ForwarderWorkspace fetchProjects preserves activeProject documents if list response is lightweight'
  );

  // En persistProjectToDatabase, finalSaved garantiza la persistencia íntegra de items y documentos
  assert.match(
    forwarderWorkspaceSource,
    /items:\s*\(Array\.isArray\(savedProject\.items\)\s*&&\s*savedProject\.items\.length\s*>\s*0\)\s*\?\s*savedProject\.items\s*:\s*\(payload\.items\s*\|\|\s*activeProject\?\.items\s*\|\|\s*\[\]\)/,
    'persistProjectToDatabase protects packing list items from being lost'
  );
});

test('4. ATOMICIDAD EN BASE DE DATOS: Uso estricto de INSERT INTO ... ON CONFLICT (project_ref) DO UPDATE', () => {
  // En forwarder-projects.js, las inserciones incorporan ON CONFLICT (project_ref) DO UPDATE SET para evitar 500 y colisiones concurrentes
  assert.match(
    forwarderProjectsSource,
    /INSERT INTO forwarder_projects[\s\S]*?ON CONFLICT\s*\(project_ref\)\s*DO UPDATE SET/i,
    'forwarder-projects.js must implement atomic upsert with ON CONFLICT (project_ref) DO UPDATE'
  );

  // En sync-road.ts, las inserciones explícitas incorporan ON CONFLICT (project_ref) DO UPDATE SET
  assert.match(
    syncRoadSource,
    /INSERT INTO forwarder_projects[\s\S]*?ON CONFLICT\s*\(project_ref\)\s*DO UPDATE SET/i,
    'sync-road.ts must implement atomic upsert with ON CONFLICT (project_ref) DO UPDATE'
  );
});
