import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = process.cwd();

test('1. Motor Ferroviario: get-rail-route.js elimina interpolación ciega e implementa ruteo terrestre con fallback ORS', async () => {
  const proxySource = await readFile(resolve(rootDir, 'netlify/functions/get-rail-route.js'), 'utf8');

  // a) Elimina por completo las fórmulas matemáticas que ondulan líneas rectas sobre el mar
  assert.doesNotMatch(proxySource, /generateRailTopographicCheckpoints/, 'Debe eliminar por completo generateRailTopographicCheckpoints');
  assert.doesNotMatch(proxySource, /RAIL-INTERPOLATED-CHECKPOINTS/, 'No debe emitir checkpoints matemáticos sobre agua');

  // b) Fuerza el uso del motor de carreteras OpenRouteService HGV como método principal
  assert.match(proxySource, /https:\/\/api\.openrouteservice\.org\/v2\/directions\/driving-hgv\/geojson/);
  assert.match(proxySource, /fetchOrsHgvPolyline/);
  assert.match(proxySource, /ORS-HGV-FALLBACK-POLYLINE/);
  assert.match(proxySource, /dashArray:\s*['"]10, 15['"]/);

  // c) Protección de datos: sobrescribe distancia de ORS con theoreticalRailMeters
  assert.match(proxySource, /finalDistanceMeters\s*=\s*theoreticalRailMeters/);
  assert.match(proxySource, /theoreticalRailMeters/);
});

test('2. Estilado Frontend Ferroviario: dashArray estético "10, 15" en mapa y capas Leaflet', async () => {
  const lazyGlobeSource = await readFile(resolve(rootDir, 'src/components/LazyGlobeMap.tsx'), 'utf8');
  const indexHtmlSource = await readFile(resolve(rootDir, 'index.html'), 'utf8');
  const forwarderWorkspaceSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // a) LazyGlobeMap usa dashArray '10, 15' y CSS stroke-dasharray '10 15'
  assert.match(lazyGlobeSource, /stroke-dasharray:\s*10\s+15/);
  assert.match(lazyGlobeSource, /dashArray:\s*['"]10, 15['"]/);

  // b) index.html usa dashArray '10, 15' para vías de tren
  assert.match(indexHtmlSource, /dashArray:\s*['"]10, 15['"]/);

  // c) ForwarderWorkspace usa dashArray '10, 15'
  assert.match(forwarderWorkspaceSource, /dashArray:\s*isRail\s*\?\s*['"]10, 15['"]/);
});

test('3. Fix 404 Backend: forwarder-projects.js no rechaza peticiones si el proyecto es nuevo en PUT ni en GET', async () => {
  const forwarderProjectsSource = await readFile(resolve(rootDir, 'netlify/functions/forwarder-projects.js'), 'utf8');

  // a) En PUT, si el registro no existe (!row), realiza inserción atómica ON CONFLICT DO UPDATE en lugar de responder 404
  assert.match(forwarderProjectsSource, /fallbackPutQuery\s*=\s*`\s*INSERT\s+INTO\s+forwarder_projects/i);
  assert.match(forwarderProjectsSource, /ON\s+CONFLICT\s+\(project_ref\)\s+DO\s+UPDATE/i);
  assert.doesNotMatch(forwarderProjectsSource, /if\s*\(!row\)\s*\{\s*return\s*\{\s*statusCode:\s*404/i, 'PUT nunca debe devolver 404 para proyectos nuevos');

  // b) En GET, para un expediente nuevo no encontrado, devuelve 200 con exists: false o consulta fallback
  assert.match(forwarderProjectsSource, /exists:\s*false/);
  assert.match(forwarderProjectsSource, /is_new:\s*true/);
  assert.doesNotMatch(forwarderProjectsSource, /if\s*\(detailResult\.rows\.length\s*===\s*0\)\s*\{\s*return\s*\{\s*statusCode:\s*404/i, 'GET por referencia nunca debe rechazar con 404 un proyecto nuevo');
});

test('4. Fix 404 Frontend: ForwarderWorkspace verifica si la referencia existe en app-state y fuerza creación de nuevo registro', async () => {
  const forwarderWorkspaceSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // a) Exporta e implementa verifyReferenceInAppState
  assert.match(forwarderWorkspaceSource, /export\s+async\s+function\s+verifyReferenceInAppState\(/);
  assert.match(forwarderWorkspaceSource, /\/api\/app-state/);

  // b) En persistProjectToDatabase, invoca verifyReferenceInAppState antes de PUT/POST
  assert.match(forwarderWorkspaceSource, /verifyReferenceInAppState\(targetRefToCheck\)/);
  assert.match(forwarderWorkspaceSource, /const\s+forceNewRecord\s*=\s*!isKnownDatabaseProject/);
  assert.match(forwarderWorkspaceSource, /else\s+if\s*\(\s*forceNewRecord\s*\)\s*\{[\s\S]*?method:\s*['"]POST['"]/);

  // c) En syncRoadProjectState, invoca verifyReferenceInAppState y fuerza POST para registros nuevos
  assert.match(forwarderWorkspaceSource, /verifyReferenceInAppState\(targetSyncRef\)/);
  assert.match(forwarderWorkspaceSource, /if\s*\(\s*forceNew\s*\)\s*\{[\s\S]*?method:\s*['"]POST['"]/);
});
