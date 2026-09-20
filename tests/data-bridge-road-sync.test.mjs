import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const serviceSource = await readFile(new URL('../dataBridgeSyncService.js', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');

const serviceModuleUrl = `data:text/javascript;base64,${Buffer.from(serviceSource).toString('base64')}`;
const {
    buildRoadSyncPayload,
    syncRoadMetricsToBridge,
    extractActiveSessionReference,
    resolveDataBridgeBaseUrl,
    DEFAULT_DATA_BRIDGE_BASE_URL,
    showSyncSuccessUI,
} = await import(serviceModuleUrl);

test('1. buildRoadSyncPayload constructs the exact JSON contract with numbers parsed', () => {
    const payload = buildRoadSyncPayload({
        reference: 'RDM/2026-4455',
        total_trucks: '334 camiones',
        road_transit_days: '1.34 días',
        road_net_margin: '7.848,52 €',
    });

    assert.deepEqual(payload, {
        project_ref: 'RDM/2026-4455',
        reference: 'RDM/2026-4455',
        total_trucks: 334,
        road_transit_days: 1.34,
        road_net_margin: 7848.52,
    });

    assert.equal(typeof payload.reference, 'string');
    assert.equal(typeof payload.total_trucks, 'number');
    assert.equal(typeof payload.road_transit_days, 'number');
    assert.equal(typeof payload.road_net_margin, 'number');
});

test('2. buildRoadSyncPayload handles numeric types directly', () => {
    const payload = buildRoadSyncPayload({
        reference: 'RDM/2026-9999',
        total_trucks: 334,
        road_transit_days: 1.34,
        road_net_margin: 7848.52,
    });

    assert.deepEqual(payload, {
        project_ref: 'RDM/2026-9999',
        reference: 'RDM/2026-9999',
        total_trucks: 334,
        road_transit_days: 1.34,
        road_net_margin: 7848.52,
    });
});

test('3. extractActiveSessionReference extracts from window.location.search or fallback', () => {
    // Explicit override
    assert.equal(extractActiveSessionReference({ reference: 'RDM/2026-0042' }), 'RDM/2026-0042');

    // Default when no window is present
    const defaultRef = extractActiveSessionReference({});
    assert.match(defaultRef, /^RDM\/\d{4}-\d{4}$/);
});

test('4. resolveDataBridgeBaseUrl resolves base URL from options, window or default', () => {
    assert.equal(resolveDataBridgeBaseUrl('https://custom-bridge.app/'), 'https://custom-bridge.app');
    assert.equal(resolveDataBridgeBaseUrl(''), DEFAULT_DATA_BRIDGE_BASE_URL);
    assert.equal(DEFAULT_DATA_BRIDGE_BASE_URL, typeof window !== 'undefined' ? window.location.origin : '');
});

test('5. syncRoadMetricsToBridge sends POST request to [URL_BASE_DATABRIDGE]/api/projects/sync-road', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedHeaders = null;
    let capturedBody = null;
    const logs = [];

    const mockFetch = async (url, options) => {
        capturedUrl = url;
        capturedMethod = options.method;
        capturedHeaders = options.headers;
        capturedBody = JSON.parse(options.body);
        return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ status: 'success' }),
        };
    };

    const mockLogger = {
        log(...args) { logs.push(args); },
        warn() {},
        error() {},
    };

    const result = await syncRoadMetricsToBridge({
        baseUrl: 'https://data-bridge-test.netlify.app',
        reference: 'RDM/2026-0123',
        total_trucks: 334,
        road_transit_days: 1.34,
        road_net_margin: 7848.52,
        fetchImpl: mockFetch,
        logger: mockLogger,
        showUI: false,
    });

    assert.equal(result.success, true);
    assert.equal(capturedUrl, 'https://data-bridge-test.netlify.app/api/projects/sync-road');
    assert.equal(capturedMethod, 'POST');
    assert.equal(capturedHeaders['Content-Type'], 'application/json');
    assert.deepEqual(capturedBody, {
        project_ref: 'RDM/2026-0123',
        reference: 'RDM/2026-0123',
        total_trucks: 334,
        road_transit_days: 1.34,
        road_net_margin: 7848.52,
    });

    // Check console.log confirmation
    const confirmLog = logs.find((entry) =>
        entry.some((item) => typeof item === 'string' && item.includes('Volcado exitoso'))
    );
    assert.ok(confirmLog, 'console.log must confirm the data sync');
});

test('6. syncRoadMetricsToBridge supports PUT method when requested', async () => {
    let capturedMethod = '';

    const mockFetch = async (_url, options) => {
        capturedMethod = options.method;
        return { ok: true, status: 200, statusText: 'OK' };
    };

    const result = await syncRoadMetricsToBridge({
        method: 'PUT',
        fetchImpl: mockFetch,
        showUI: false,
        logger: { log() {}, warn() {} },
    });

    assert.equal(result.success, true);
    assert.equal(capturedMethod, 'PUT');
});

test('7. syncRoadMetricsToBridge is non-blocking and contains network errors', async () => {
    const warnings = [];
    const mockLogger = {
        log() {},
        warn(...args) { warnings.push(args); },
    };

    const failingFetch = async () => {
        throw new Error('Network timeout or CORS error');
    };

    const result = await syncRoadMetricsToBridge({
        fetchImpl: failingFetch,
        logger: mockLogger,
        showUI: false,
    });

    assert.equal(result.success, false);
    assert.match(result.error, /Network timeout or CORS error/);
    assert.ok(warnings.length > 0, 'Must warn about sync failures without throwing');
});

test('8. index.html imports and exposes syncRoadMetricsToBridge in window', () => {
    assert.match(indexHtml, /import\s*\{\s*syncRoadMetricsToBridge/);
    assert.match(indexHtml, /window\.syncRoadMetricsToBridge\s*=\s*syncRoadMetricsToBridge/);
    assert.match(indexHtml, /window\.buildRoadSyncPayload\s*=\s*buildRoadSyncPayload/);
});

test('9. index.html includes header discrete synchronized badge', () => {
    assert.match(indexHtml, /id="header-sync-status-badge"/);
    assert.match(indexHtml, /Sincronizado/);
});

test('10. index.html triggers sync in handleMasterValidationAndCalculate', () => {
    const handlerStart = indexHtml.indexOf('async function handleMasterValidationAndCalculate');
    const handlerEnd = indexHtml.indexOf('window.handleMasterValidationAndCalculate = handleMasterValidationAndCalculate;', handlerStart);
    const handlerSource = indexHtml.slice(handlerStart, handlerEnd);

    assert.match(handlerSource, /syncRoadMetricsToBridge/);
});

test('11. index.html triggers sync in generarAuditoriaOperativa (DSS)', () => {
    const dssStart = indexHtml.indexOf('function generarAuditoriaOperativa(');
    const dssEnd = indexHtml.indexOf('window.generarAuditoriaOperativa = generarAuditoriaOperativa;', dssStart);
    const dssSource = indexHtml.slice(dssStart, dssEnd);

    assert.match(dssSource, /syncRoadMetricsToBridge/);
});

test('12. State stores total_trucks, road_transit_days, and road_net_margin', () => {
    assert.match(indexHtml, /State\.total_trucks\s*=\s*fleetTrucksNeeded/);
    assert.match(indexHtml, /State\.road_net_margin\s*=\s*isTerrestre\s*\?\s*finalNetProfitOwner\s*:\s*netProfitOwner/);
    assert.match(indexHtml, /State\.road_transit_days\s*=\s*tiempo_total_dias/);
});
