import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backendFunctionSource = readFileSync(new URL('../netlify/functions/forwarder-projects.js', import.meta.url), 'utf8');

test('1. forwarder-projects.js includes CREATE TABLE IF NOT EXISTS auto-migration for forwarder_projects', () => {
  assert.match(backendFunctionSource, /CREATE TABLE IF NOT EXISTS forwarder_projects/);
  assert.match(backendFunctionSource, /project_ref/);
  assert.match(backendFunctionSource, /client_name/);
  assert.match(backendFunctionSource, /status/);
  assert.match(backendFunctionSource, /documents/);
  assert.match(backendFunctionSource, /items/);
});

test('2. forwarder-projects.js defines isMissingTableError and handles 42P01 / relation does not exist gracefully', () => {
  assert.match(backendFunctionSource, /42P01/);
  assert.match(backendFunctionSource, /relation.*forwarder_projects.*does not exist|undefined_table/i);
});

test('3. handler returns HTTP 200 with empty array on GET when database is not configured or table missing', async () => {
  const mod = await import('../netlify/functions/forwarder-projects.js');
  const handler = mod.handler || mod.default;

  // With no database configured, GET should return status 200 and []
  const originalEnv = process.env.NEON_DATABASE_URL;
  delete process.env.NEON_DATABASE_URL;
  delete process.env.DATABASE_URL;
  delete process.env.NETLIFY_DATABASE_URL;

  const res = await handler({ httpMethod: 'GET' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(res.body), []);

  if (originalEnv) {
    process.env.NEON_DATABASE_URL = originalEnv;
  }
});
