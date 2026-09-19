import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const forwarderComponentSource = readFileSync(new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url), 'utf8');
const forwarderBackendSource = readFileSync(new URL('../netlify/functions/forwarder-projects.js', import.meta.url), 'utf8');

const isProjectMatchingActiveDossierMatch = forwarderComponentSource.match(/export\s+function\s+isProjectMatchingActiveDossier[\s\S]*?\n\}/);
const getActiveGlobalReferenceMatch = forwarderComponentSource.match(/export\s+function\s+getActiveGlobalReference[\s\S]*?\n\}/);

const isProjectMatchingActiveDossier = new Function(
  `return ${isProjectMatchingActiveDossierMatch[0].replace('export function isProjectMatchingActiveDossier', 'function')}`
)();

const getActiveGlobalReference = new Function(
  `return ${getActiveGlobalReferenceMatch[0].replace('export function getActiveGlobalReference', 'function')}`
)();

test('1. ForwarderWorkspace.jsx exports getActiveGlobalReference and isProjectMatchingActiveDossier functions', () => {
  assert.match(forwarderComponentSource, /export\s+function\s+getActiveGlobalReference/);
  assert.match(forwarderComponentSource, /export\s+function\s+isProjectMatchingActiveDossier/);
  assert.equal(typeof isProjectMatchingActiveDossier, 'function');
  assert.equal(typeof getActiveGlobalReference, 'function');
});

test('2. isProjectMatchingActiveDossier correctly matches parent reference across all required candidate fields', () => {
  const activeRef = 'RDM/2026-0080';

  // Coincide por referenciaPadre
  assert.equal(isProjectMatchingActiveDossier({ referenciaPadre: 'RDM/2026-0080' }, activeRef), true);
  assert.equal(isProjectMatchingActiveDossier({ referenciaPadre: 'rdm/2026-0080' }, activeRef), true);

  // Coincide por dossier_ref
  assert.equal(isProjectMatchingActiveDossier({ dossier_ref: 'RDM/2026-0080' }, activeRef), true);

  // Coincide por parent_ref
  assert.equal(isProjectMatchingActiveDossier({ parent_ref: 'RDM/2026-0080' }, activeRef), true);

  // Coincide porque project_ref coincide o empieza por la referencia activa
  assert.equal(isProjectMatchingActiveDossier({ project_ref: 'RDM/2026-0080' }, activeRef), true);
  assert.equal(isProjectMatchingActiveDossier({ project_ref: 'RDM/2026-0080-EXP-01' }, activeRef), true);

  // Coincide por data anidado
  assert.equal(isProjectMatchingActiveDossier({ data: { dossier_ref: 'RDM/2026-0080' } }, activeRef), true);
  assert.equal(isProjectMatchingActiveDossier({ data: { parent_ref: 'RDM/2026-0080' } }, activeRef), true);

  // NO coincide cuando pertenece a otro expediente
  assert.equal(isProjectMatchingActiveDossier({ dossier_ref: 'RDM/2026-9999' }, activeRef), false);
  assert.equal(isProjectMatchingActiveDossier({ parent_ref: 'RDM/2026-9999' }, activeRef), false);
  assert.equal(isProjectMatchingActiveDossier({ project_ref: 'EXP-123456' }, activeRef), false);

  // NO coincide cuando la referencia activa está vacía o es null
  assert.equal(isProjectMatchingActiveDossier({ dossier_ref: 'RDM/2026-0080' }, ''), false);
  assert.equal(isProjectMatchingActiveDossier({ dossier_ref: 'RDM/2026-0080' }, null), false);
  assert.equal(isProjectMatchingActiveDossier({ dossier_ref: 'RDM/2026-0080' }, undefined), false);
  assert.equal(isProjectMatchingActiveDossier(null, activeRef), false);
});

test('3. getActiveGlobalReference extracts reference from DOM, ContractRefManager, State, and fallbacks', () => {
  // Guardar estado original
  const origWindow = globalThis.window;
  const origDocument = globalThis.document;

  try {
    // 1. Simular lectura desde quick-ref en DOM
    globalThis.document = {
      getElementById: (id) => (id === 'quick-ref' ? { value: 'RDM/DOM/2026-1111' } : null)
    };
    globalThis.window = {};
    assert.equal(getActiveGlobalReference(), 'RDM/DOM/2026-1111');

    // 2. Simular lectura desde ContractRefManager
    globalThis.document = { getElementById: () => null };
    globalThis.window = {
      ContractRefManager: { getActiveContractRef: () => 'RDM/MGR/2026-2222' }
    };
    assert.equal(getActiveGlobalReference(), 'RDM/MGR/2026-2222');

    // 3. Simular lectura desde window.State
    globalThis.window = {
      State: { activeReference: 'RDM/STATE/2026-3333' }
    };
    assert.equal(getActiveGlobalReference(), 'RDM/STATE/2026-3333');

    // 4. Vacío cuando no hay nada configurado
    globalThis.window = {};
    assert.equal(getActiveGlobalReference(), '');
  } finally {
    globalThis.window = origWindow;
    globalThis.document = origDocument;
  }
});

test('4. ForwarderWorkspace defines displayedProjects filter and renders empty prompt when referenciaActivaGlobal is empty', () => {
  // Verificación estricta de la definición de displayedProjects
  assert.match(
    forwarderComponentSource,
    /const\s+displayedProjects\s*=\s*!referenciaActivaGlobal\s*\?\s*\[\]\s*:\s*projects\.filter\(\s*(?:\(p\)|p)\s*=>\s*isProjectMatchingActiveDossier\(p,\s*referenciaActivaGlobal\)\s*\);/
  );

  // Verificación del mensaje cuando la referencia global está vacía
  assert.match(
    forwarderComponentSource,
    /Selecciona un expediente en la barra superior/
  );

  // Verificación del mapeo de proyectos sobre displayedProjects
  assert.match(
    forwarderComponentSource,
    /displayedProjects\.map\(\s*(?:\(proj\)|proj)\s*=>/
  );
});

test('5. handleCreateProject injects dossier_ref and parent_ref with current active global reference into POST body', () => {
  // handleCreateProject obtiene la referencia activa
  assert.match(
    forwarderComponentSource,
    /const\s+activeRef\s*=\s*referenciaActivaGlobal\s*\|\|\s*getActiveGlobalReference\(\);/
  );

  // handleCreateProject inyecta dossier_ref y parent_ref en el body JSON
  assert.match(
    forwarderComponentSource,
    /body:\s*JSON\.stringify\(\s*\{[\s\S]*?dossier_ref:\s*activeRef[\s\S]*?parent_ref:\s*activeRef[\s\S]*?\}\s*\)/
  );
});

test('6. Backend forwarder-projects.js auto-migrates and receives dossier_ref and parent_ref on creation', () => {
  // Auto-migración en ensureForwarderProjectsTable
  assert.match(forwarderBackendSource, /ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS dossier_ref VARCHAR\(255\);/);
  assert.match(forwarderBackendSource, /ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS parent_ref VARCHAR\(255\);/);

  // Recepción de dossier_ref y parent_ref en POST
  assert.match(forwarderBackendSource, /dossier_ref,\s*parent_ref/);
  assert.match(forwarderBackendSource, /dossier_ref:\s*createdRow\.dossier_ref\s*\|\|\s*effectiveDossierRef/);
  assert.match(forwarderBackendSource, /parent_ref:\s*createdRow\.parent_ref\s*\|\|\s*effectiveParentRef/);
});
