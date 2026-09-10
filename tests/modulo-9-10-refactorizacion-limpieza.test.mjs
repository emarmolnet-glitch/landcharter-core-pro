import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

// Extraer secciones de Módulo 9 y Módulo 10
const moduleNineStart = indexSource.indexOf('id="stress-test-panel"');
const moduleTenStart = indexSource.indexOf('id="charterer-negotiation-simulator"');
const moduleTenEnd = indexSource.indexOf('id="core-kill-switch-alert"', moduleTenStart);

assert.ok(moduleNineStart !== -1, 'Módulo 9 debe existir');
assert.ok(moduleTenStart !== -1, 'Módulo 10 debe existir');
assert.ok(moduleTenEnd !== -1, 'Fin del Módulo 10 debe existir');

const moduleNineAndTenBlock = indexSource.slice(moduleNineStart, moduleTenEnd);
const moduleNineBlock = indexSource.slice(moduleNineStart, moduleTenStart);
const moduleTenBlock = indexSource.slice(moduleTenStart, moduleTenEnd);

test('Módulo 9 (Matriz de Riesgo): subtítulo actualizado a tráfico, clima y diésel', () => {
  assert.match(moduleNineBlock, /Simulador multi-variable de tráfico, clima y diésel sobre el break-even oficial/);
  assert.doesNotMatch(moduleNineBlock, /Simulador multi-variable de velocidad, clima y bunker/);
});

test('Módulo 10 (Simulador de Negociación): Textos Generales adaptados', () => {
  // Descripción superior
  assert.match(moduleTenBlock, /Compara la petición del transportista con tu contraoferta y mide el ahorro potencial sin cruzar el coste operativo mínimo del viaje\./);
  assert.doesNotMatch(moduleTenBlock, /Compara la petición del armador/);

  // Cajas de resultados: se elimina (€ o $) dejando solo "Margen Neto del Viaje:"
  assert.match(moduleTenBlock, /id="negotiation-owner-tce"[^>]*>Margen Neto del Viaje: 0 €<\/span>/);
  assert.match(moduleTenBlock, /id="negotiation-target-tce"[^>]*>Margen Neto del Viaje: 0 €<\/span>/);
  assert.doesNotMatch(moduleTenBlock, /Margen Neto del Viaje \(€ o \$\)/);
});

test('Módulo 10: Panel de Sincronización en Tiempo Real', () => {
  // Ruta Óptima - Diésel Terrestre
  assert.match(moduleTenBlock, /id="negotiation-vessel-sync-title"[^>]*>Ruta Óptima - Diésel Terrestre<\/strong>/);
  assert.doesNotMatch(moduleTenBlock, /ECO-SPEED - Sin scrubber/);

  // Etiqueta combustible DIÉSEL
  assert.match(moduleTenBlock, /id="negotiation-fuel-strategy"[^>]*>DIÉSEL<\/span>/);
  assert.doesNotMatch(moduleTenBlock, /VLSFO/);

  // Título Tiempos de Ruta (en lugar de DÍAS REALES TCE)
  assert.match(moduleTenBlock, />Tiempos de Ruta<\/span>/i);
  assert.doesNotMatch(moduleTenBlock, /Días Reales TCE/);

  // Valores de tiempos de ruta: horas, conducción, muelle
  assert.match(moduleTenBlock, /id="negotiation-days-summary"[^>]*>0\.00 h · Conducción 0\.00 · Muelle 0\.00<\/strong>/);

  // Exposición Paralizaciones (en lugar de Exposición Demurrage)
  assert.match(moduleTenBlock, />Exposición Paralizaciones<\/span>/i);
  assert.doesNotMatch(moduleTenBlock, />Exposición Demurrage<\/span>/i);
});

test('Módulo 10: Consolidación de Moneda y Unidades', () => {
  // Símbolos de euro (€) en lugar de dólar ($)
  assert.match(moduleTenBlock, /id="negotiation-spread-pmt"[^>]*>0\.00 € \/Km<\/strong>/);
  assert.match(moduleTenBlock, /id="negotiation-total-savings"[^>]*>0 €<\/strong>/);
  assert.match(moduleTenBlock, /id="negotiation-break-even"[^>]*>0\.00 € \/Km<\/strong>/);
  assert.match(moduleTenBlock, /id="negotiation-target-delta"[^>]*>Δ 0\.00 €<\/span>/);
  assert.match(moduleTenBlock, /id="negotiation-contingency-summary"[^>]*>Peajes 0 € · Fijos 0 €\/d<\/strong>/);
});

test('REGLA ESTRICTA: Ni un solo símbolo $ ni la palabra armador en toda la vista de estos dos módulos', () => {
  assert.doesNotMatch(moduleNineAndTenBlock, /\$/);
  assert.doesNotMatch(moduleNineAndTenBlock, /armador/i);
});

test('updateChartererNegotiationSimulator genera textos terrestres en euros sin armador ni $', () => {
  // Verificar la función JS
  const fnStart = indexSource.indexOf('function updateChartererNegotiationSimulator()');
  const fnEnd = indexSource.indexOf('function applySuggestedNegotiationTarget()', fnStart);
  assert.ok(fnStart !== -1);
  assert.ok(fnEnd !== -1);
  const fnSource = indexSource.slice(fnStart, fnEnd);

  assert.match(fnSource, /Margen Neto del Viaje: /);
  assert.doesNotMatch(fnSource, /Margen Neto del Viaje \(€ o \$\): /);
  assert.match(fnSource, /Ruta Óptima - Diésel Terrestre/);
  assert.match(fnSource, /km\/h/);
  assert.doesNotMatch(fnSource, /kn/);
  assert.match(fnSource, /Conducción/);
  assert.match(fnSource, /Muelle/);
  assert.match(fnSource, /Peajes \$\{money\(algorithmicStress\.basePda\)\} · Fijos/);
  assert.match(fnSource, /transportista/);
  assert.doesNotMatch(fnSource, /armador/);
  assert.doesNotMatch(fnSource, /\$0/);
});
