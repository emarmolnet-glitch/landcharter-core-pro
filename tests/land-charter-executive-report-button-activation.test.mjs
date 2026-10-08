import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../voyage-cost-engine.js');
const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('1. Executive Report Buttons exist in index.html with correct text and action bindings', () => {
  // Both buttons must exist and have the executive report action and onclick
  assert.match(indexSource, /id="btn-executive-report-summary"[^>]*onclick="generateExecutiveReport\(\)"/);
  assert.match(indexSource, /id="btn-executive-report-summary"[\s\S]*?Ver Reporte Ejecutivo del Viaje/);
  assert.match(indexSource, /id="btn-executive-report"[^>]*onclick="generateExecutiveReport\(\)"/);
  assert.match(indexSource, /id="btn-executive-report"[\s\S]*?Ver Reporte Ejecutivo del Viaje/);
});

test('2. CSS rules configure interactive hover/pointer for active state and disabled styles', () => {
  // Disabled styles
  assert.match(indexSource, /#btn-executive-report:disabled[\s\S]*?opacity:\s*0\.5/);
  assert.match(indexSource, /#btn-executive-report:disabled[\s\S]*?cursor:\s*not-allowed/);

  // Enabled / Interactive styles
  assert.match(indexSource, /#btn-executive-report:not\(:disabled\)[\s\S]*?cursor:\s*pointer/);
});

test('3. setCoreReportBlocked and updateExecutiveReportButtonState enable button when calculation exists', () => {
  // Checks condition with tarifaTransportista, precioTotal, and hasCalculated
  assert.match(indexSource, /tarifaTransportista/);
  assert.match(indexSource, /precioTotal/);
  assert.match(indexSource, /hasCalculated/);

  // Toggles opacity-50 and cursor-not-allowed
  assert.match(indexSource, /classList\.toggle\('opacity-50'/);
  assert.match(indexSource, /classList\.toggle\('cursor-not-allowed'/);
  assert.match(indexSource, /classList\.add\('cursor-pointer'\)/);
});

test('4. voyage-cost-engine updateExecutiveDashboard enables buttons on OPERACIÓN RENTABLE', () => {
  const elements = new Map();

  function makeMockElement(id) {
    const classList = new Set();
    return {
      id,
      textContent: '',
      title: '',
      disabled: false,
      style: {},
      classList: {
        add: (...cls) => cls.forEach((c) => classList.add(c)),
        remove: (...cls) => cls.forEach((c) => classList.delete(c)),
        toggle: (c, force) => {
          if (force === undefined) {
            if (classList.has(c)) classList.delete(c);
            else classList.add(c);
          } else if (force) {
            classList.add(c);
          } else {
            classList.delete(c);
          }
        },
        contains: (c) => classList.has(c)
      }
    };
  }

  const ids = [
    'exec-operation-icon',
    'exec-operation-status',
    'exec-pol',
    'exec-pod',
    'exec-total-margin',
    'exec-cargo-qty',
    'exec-cargo-type',
    'exec-load-rate',
    'exec-disch-rate',
    'exec-vessel-type',
    'exec-sea-days',
    'exec-port-days',
    'exec-total-days',
    'exec-buy-freight',
    'exec-buy-freight-total',
    'exec-carrier-sell-freight',
    'exec-carrier-sell-total',
    'exec-tce',
    'exec-carrier-margin-km',
    'exec-sell-freight',
    'exec-sell-freight-total',
    'exec-agency-cost-freight',
    'exec-agency-cost-total',
    'exec-charterer-profit',
    'exec-spread-mt',
    'exec-agency-spread-total',
    'exec-risk-level',
    'exec-insight-text',
    'btn-executive-report-summary',
    'btn-executive-report'
  ];

  ids.forEach((id) => elements.set(id, makeMockElement(id)));

  const mockDocument = {
    getElementById: (id) => elements.get(id) || null
  };

  // Case 1: Empty voyage -> buttons disabled with opacity-50 and cursor-not-allowed
  engine.updateExecutiveDashboard({ forceEmpty: true }, {}, mockDocument);

  const summaryBtnEmpty = elements.get('btn-executive-report-summary');
  const sec5BtnEmpty = elements.get('btn-executive-report');
  assert.equal(elements.get('exec-operation-status').textContent, 'OPERACIÓN PENDIENTE');
  assert.equal(summaryBtnEmpty.disabled, true);
  assert.equal(summaryBtnEmpty.classList.contains('opacity-50'), true);
  assert.equal(summaryBtnEmpty.classList.contains('cursor-not-allowed'), true);
  assert.equal(summaryBtnEmpty.classList.contains('cursor-pointer'), false);
  assert.equal(sec5BtnEmpty.disabled, true);

  // Case 2: Profitable calculation (OPERACIÓN RENTABLE) -> buttons enabled, interactive cursor-pointer
  engine.updateExecutiveDashboard({
    pol: 'Madrid',
    pod: 'Valencia',
    cargoQty: 24,
    totalProfit: 150,
    tarifaTransportista: 450,
    precioTotal: 600,
    hasCalculated: true,
    totalTripCost: 450,
    buyFreightTotal: 450,
    sellFreightTotal: 600,
    totalKm: 350
  }, {}, mockDocument);

  const summaryBtnCalc = elements.get('btn-executive-report-summary');
  const sec5BtnCalc = elements.get('btn-executive-report');
  assert.equal(elements.get('exec-operation-status').textContent, 'OPERACIÓN RENTABLE');
  assert.equal(summaryBtnCalc.disabled, false);
  assert.equal(summaryBtnCalc.classList.contains('opacity-50'), false);
  assert.equal(summaryBtnCalc.classList.contains('cursor-not-allowed'), false);
  assert.equal(summaryBtnCalc.classList.contains('cursor-pointer'), true);
  assert.equal(summaryBtnCalc.title, 'Ver Reporte Ejecutivo del Viaje');

  assert.equal(sec5BtnCalc.disabled, false);
  assert.equal(sec5BtnCalc.classList.contains('opacity-50'), false);
  assert.equal(sec5BtnCalc.classList.contains('cursor-not-allowed'), false);
  assert.equal(sec5BtnCalc.classList.contains('cursor-pointer'), true);
});
