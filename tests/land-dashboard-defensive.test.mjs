import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const landDashboardSource = await readFile(new URL('../land-dashboard.js', import.meta.url), 'utf8');

function createDashboardSandbox({ mockFetch, mockDocument = null, state = {} } = {}) {
  const warnings = [];
  const logs = [];
  const dispatchedEvents = [];

  const windowMock = {
    fetch: mockFetch,
    getApiUrl: (url) => url,
    State: { ...state },
    dispatchEvent(event) {
      dispatchedEvents.push(event);
    },
    console: {
      ...console,
      log(...args) {
        logs.push(args);
      },
      warn(...args) {
        warnings.push(args);
      },
      error(...args) {
        logs.push(args);
      },
    },
  };

  const sandbox = {
    window: windowMock,
    globalThis: windowMock,
    fetch: mockFetch,
    console: windowMock.console,
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    document: mockDocument,
    module: { exports: {} },
    exports: {},
  };

  vm.runInNewContext(landDashboardSource, sandbox);

  return {
    api: sandbox.module.exports,
    windowMock,
    warnings,
    logs,
    dispatchedEvents,
  };
}

test('1. fetchForwarderProjects handles HTTP 500 gracefully with try...catch and console.warn', async () => {
  let requestedUrls = [];
  const mockFetch = async (url) => {
    requestedUrls.push(url);
    return {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error (Server Saturated)',
      json: async () => {
        throw new Error('Unexpected token < in JSON at position 0');
      },
    };
  };

  const { api, warnings, windowMock } = createDashboardSandbox({ mockFetch });

  // Must not throw uncaught error
  const projects = await api.fetchForwarderProjects();

  assert.ok(Array.isArray(projects), 'Must return an array');
  assert.equal(projects.length, 0, 'Must fallback to empty array [] on 500 error');
  assert.equal(windowMock.State.projects.length, 0, 'State.projects must be set to empty array');

  // Must capture silently with console.warn
  assert.ok(warnings.length > 0, 'Must log warning using console.warn');
  const warn500 = warnings.find((w) =>
    w.some((arg) => String(arg).includes('500') || String(arg).includes('Fallback silencioso'))
  );
  assert.ok(warn500, 'Warning must mention HTTP 500 or fallback silencioso');

  // Must target /api/forwarder-projects or /api/projects/forwarder
  assert.ok(
    requestedUrls.some((u) => u.includes('/api/forwarder-projects') || u.includes('/api/projects/forwarder')),
    'Must request forwarder projects endpoint'
  );
});

test('2. fetchForwarderProjects handles network rejection without crashing', async () => {
  const mockFetch = async () => {
    throw new Error('Network timeout / connection refused');
  };

  const { api, warnings, windowMock } = createDashboardSandbox({ mockFetch });

  // Must not throw uncaught error
  let projects;
  await assert.doesNotReject(async () => {
    projects = await api.fetchForwarderProjects();
  });

  assert.equal(projects.length, 0, 'Must return empty array on network failure');
  assert.equal(windowMock.State.projects.length, 0);
  assert.ok(warnings.length > 0, 'Must log warning for network error');
});

test('3. fetchForwarderProjects succeeds and parses JSON when server responds normally', async () => {
  const mockProjects = [
    { id: 1, project_ref: 'PRJ-2026-001', client_name: 'Trans Mediterranean', status: 'Activo' },
    { id: 2, project_ref: 'PRJ-2026-002', client_name: 'Iberia Cargo', status: 'Completado' },
  ];

  const mockFetch = async (url) => ({
    ok: true,
    status: 200,
    json: async () => ({ projects: mockProjects }),
  });

  const { api, warnings, windowMock } = createDashboardSandbox({ mockFetch });

  const projects = await api.fetchForwarderProjects();
  assert.equal(projects.length, 2);
  assert.equal(projects[0].project_ref, 'PRJ-2026-001');
  assert.equal(windowMock.State.projects.length, 2);
  assert.equal(warnings.length, 0, 'No warning when fetch succeeds');
});

test('4. initializeLandDashboard runs without uncaught error during 500 server saturation and completes UI flow', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    json: async () => { throw new Error('500 html response'); },
  });

  let innerHTMLSet = '';
  const fakeElement = {
    set innerHTML(val) {
      innerHTMLSet = val;
    },
    get innerHTML() {
      return innerHTMLSet;
    },
  };

  const mockDocument = {
    getElementById: (id) => {
      if (id === 'forwarder-projects-list' || id === 'land-dashboard-projects') {
        return fakeElement;
      }
      return null;
    },
  };

  const { api, dispatchedEvents, warnings } = createDashboardSandbox({ mockFetch, mockDocument });

  const result = await api.initializeLandDashboard();
  assert.equal(result.success, true);
  assert.equal(result.projects.length, 0);
  assert.ok(innerHTMLSet.includes('No hay proyectos disponibles'), 'UI container must be updated with safe fallback message');
  assert.ok(warnings.length > 0, 'Warning logged without crashing');
});

test('5. land-dashboard.js exposes initializeLandDashboard and fetchForwarderProjects globally', () => {
  assert.match(landDashboardSource, /initializeLandDashboard/);
  assert.match(landDashboardSource, /fetchForwarderProjects/);
  assert.match(landDashboardSource, /\/api\/forwarder-projects/);
  assert.match(landDashboardSource, /\/api\/projects\/forwarder/);
  assert.match(landDashboardSource, /console\.warn/);
});
