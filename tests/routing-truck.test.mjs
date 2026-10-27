import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = process.cwd();

test('1. index.html does not expose raw ORS API key and calls /api/routing/truck', async () => {
  const indexHtml = await readFile(resolve(rootDir, 'index.html'), 'utf8');

  // Verify raw token is completely gone from index.html
  assert.doesNotMatch(indexHtml, /eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgi/);

  // Verify fetch calls /api/routing/truck
  assert.match(indexHtml, /fetch\(\s*['"]\/api\/routing\/truck['"]/);
});

test('2. routing-truck.js handles CORS, invalid coordinates, missing API key, and executes request', async () => {
  const funcSource = await readFile(resolve(rootDir, 'netlify/functions/routing-truck.js'), 'utf8');

  assert.match(funcSource, /process\.env\.ORS_API_KEY/);
  assert.match(funcSource, /api\.openrouteservice\.org\/v2\/directions\/driving-hgv\/geojson/);
  assert.match(funcSource, /"Access-Control-Allow-Origin":\s*"\*"/);

  // Evaluate handler in isolated scope
  const sanitizedSource = funcSource
    .replace('export default async function handler(req, context)', 'async function handler(req, context)')
    .replace(/export\s+\{\s*handler\s*\};?/g, '');
  const wrapped = sanitizedSource + '\nreturn handler(req, context);';
  const executeHandler = new Function('req', 'context', wrapped);

  // a) Preflight OPTIONS returns 204
  const optReq = new Request('http://localhost/api/routing/truck', { method: 'OPTIONS' });
  const optRes = await executeHandler(optReq);
  assert.equal(optRes.status, 204);
  assert.equal(optRes.headers.get('Access-Control-Allow-Origin'), '*');

  // b) POST without coordinates returns 400
  const badReq = new Request('http://localhost/api/routing/truck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const badRes = await executeHandler(badReq);
  assert.equal(badRes.status, 400);

  // c) POST with missing API key returns 500
  const origKey = process.env.ORS_API_KEY;
  const origKey2 = process.env.OPENROUTESERVICE_API_KEY;
  delete process.env.ORS_API_KEY;
  delete process.env.OPENROUTESERVICE_API_KEY;

  const validReq = new Request('http://localhost/api/routing/truck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coordinates: [[2.1734, 41.3851], [-3.7038, 40.4168]],
      radiuses: [5000, 5000],
    }),
  });

  const missingKeyRes = await executeHandler(validReq);
  assert.equal(missingKeyRes.status, 500);

  // Restore env
  if (origKey) process.env.ORS_API_KEY = origKey;
  if (origKey2) process.env.OPENROUTESERVICE_API_KEY = origKey2;
});
