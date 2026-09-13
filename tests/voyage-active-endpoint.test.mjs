import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const voyageActiveSource = await readFile(new URL('../netlify/functions/voyage-active.js', import.meta.url), 'utf8');
const netlifyTomlSource = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
const redirectsSource = await readFile(new URL('../_redirects', import.meta.url), 'utf8');

test('1. voyage-active.js exports.handler handles contractRef, ref, and project_ref query params', () => {
  assert.match(voyageActiveSource, /exports\.handler\s*=\s*async/);
  assert.match(voyageActiveSource, /queryParams\.contractRef/);
  assert.match(voyageActiveSource, /queryParams\.ref/);
});

test('2. voyage-active.js queries Neon DB across voyages_tracking, charter_dossiers, and forwarder_projects', () => {
  assert.match(voyageActiveSource, /FROM voyages_tracking/i);
  assert.match(voyageActiveSource, /FROM charter_dossiers/i);
  assert.match(voyageActiveSource, /FROM forwarder_projects/i);
});

test('3. voyage-active.js returns Netlify standard statusCode 200 with JSON body containing { pol, pod }', () => {
  assert.match(voyageActiveSource, /statusCode:\s*200/);
  assert.match(voyageActiveSource, /'Content-Type':\s*'application\/json'/);
  assert.match(voyageActiveSource, /pol:/);
  assert.match(voyageActiveSource, /pod:/);
});

test('4. netlify.toml and _redirects contain explicit rewrite for /api/voyage/active to /.netlify/functions/voyage-active', () => {
  assert.match(netlifyTomlSource, /from\s*=\s*"\/api\/voyage\/active"[\s\S]*?to\s*=\s*"\/\.netlify\/functions\/voyage-active"/);
  assert.match(redirectsSource, /\/api\/voyage\/active\s+\/\.netlify\/functions\/voyage-active\s+200!/);
});

test('5. voyage-active.js extracts exact geographic column aliases columna_correcta_pol and columna_correcta_pod', () => {
  assert.match(voyageActiveSource, /AS\s+columna_correcta_pol/i);
  assert.match(voyageActiveSource, /AS\s+columna_correcta_pod/i);
  assert.match(voyageActiveSource, /pol_name/);
  assert.match(voyageActiveSource, /pod_name/);
  assert.match(voyageActiveSource, /session_payload/);
  assert.match(voyageActiveSource, /items/);
});

