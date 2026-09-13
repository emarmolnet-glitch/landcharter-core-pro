import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fnSource = await readFile(new URL('../netlify/functions/save-land-route.ts', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appJsxSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const redirectsSource = await readFile(new URL('../_redirects', import.meta.url), 'utf8');

test('1. netlify/functions/save-land-route.ts exports default handler and configured path', () => {
  assert.match(fnSource, /export\s+default\s+async/);
  assert.match(fnSource, /export\s+const\s+config\s*:\s*Config/);
  assert.match(fnSource, /\/api\/save-land-route/);
});

test('2. save-land-route validates required contractRef parameter and returns 400', () => {
  assert.match(fnSource, /contractRef.*is required/i);
  assert.match(fnSource, /status:\s*400/);
});

test('3. save-land-route restricts method to POST and supports CORS OPTIONS', () => {
  assert.match(fnSource, /req\.method\s*===\s*["']OPTIONS["']/);
  assert.match(fnSource, /req\.method\s*!==\s*["']POST["']/);
  assert.match(fnSource, /status:\s*405/);
});

test('4. save-land-route connects to Neon DB and performs UPDATE on forwarder_projects with pre_carriage / on_carriage JSONB', () => {
  assert.match(fnSource, /UPDATE forwarder_projects/i);
  assert.match(fnSource, /pre_carriage/i);
  assert.match(fnSource, /on_carriage/i);
  assert.match(fnSource, /land_route/i);
  assert.match(fnSource, /project_ref/i);
});

test('5. save-land-route ensures forwarder_projects schema with fallback INSERT on zero rows updated', () => {
  assert.match(fnSource, /CREATE TABLE IF NOT EXISTS forwarder_projects/i);
  assert.match(fnSource, /INSERT INTO forwarder_projects/i);
  assert.match(fnSource, /rowCount\s*===\s*0/);
});

test('6. save-land-route returns HTTP 200 with { success: true } on completion', () => {
  assert.match(fnSource, /success:\s*true/);
  assert.match(fnSource, /status:\s*200/);
});

test('7. index.html contains "Guardar/Exportar Cotización" button connected to saveLandRouteQuote', () => {
  assert.match(indexSource, /Guardar\/Exportar Cotización/);
  assert.match(indexSource, /onclick=["']saveLandRouteQuote\(\)["']/);
  assert.match(indexSource, /id=["']btn-save-export-cotizacion["']/);
});

test('8. index.html defines saveLandRouteQuote gathering contractRef, origin, destination, distance, freight_cost, and cargo_details', () => {
  assert.match(indexSource, /async function saveLandRouteQuote/);
  assert.match(indexSource, /contractRef/);
  assert.match(indexSource, /origin_name/);
  assert.match(indexSource, /destination_name/);
  assert.match(indexSource, /total_distance_km/);
  assert.match(indexSource, /freight_cost/);
  assert.match(indexSource, /cargo_details/);
  assert.match(indexSource, /fetch\(["']\/api\/save-land-route["']/);
});

test('9. saveCotizacion in index.html syncs with saveLandRouteQuote', () => {
  assert.match(indexSource, /saveLandRouteQuote\(\{ contractRef: uniqueReference \}\)/);
});

test('10. src/App.jsx exports saveLandRouteQuote and attaches it to window', () => {
  assert.match(appJsxSource, /export async function saveLandRouteQuote/);
  assert.match(appJsxSource, /window\.saveLandRouteQuote\s*=\s*saveLandRouteQuote/);
});

test('11. _redirects maps /api/save-land-route to /.netlify/functions/save-land-route', () => {
  assert.match(redirectsSource, /\/api\/save-land-route\s+\/\.netlify\/functions\/save-land-route\s+200!/);
});

test('12. netlify.toml contains redirect rule for /api/save-land-route', async () => {
  const netlifyTomlSource = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
  assert.match(netlifyTomlSource, /from\s*=\s*"\/api\/save-land-route"[\s\S]*?to\s*=\s*"\/\.netlify\/functions\/save-land-route"/);
});
