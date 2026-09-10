import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const tceWorkspaceSource = await readFile(new URL('../TceCalculatorWorkspace.tsx', import.meta.url), 'utf8');

// Extraer el Módulo 7 (Análisis de Fletes)
const module7Start = indexSource.indexOf('id="freight-analysis-title"');
const module7End = indexSource.indexOf('8. NEGOCIACIÓN COMERCIAL', module7Start);
const module7Section = indexSource.slice(module7Start, module7End);

test('1. Erradicación total de Inteligencia de Mercado Naval en Módulo 7', () => {
  // Eliminado por completo el bloque MARKET INTEL - DRY BULK
  assert.doesNotMatch(module7Section, /Market Intel · Dry Bulk/i);
  assert.doesNotMatch(module7Section, /MARKET INTEL - DRY BULK/i);
  assert.doesNotMatch(module7Section, /id="market-intel-dashboard"/);

  // Segmentos navales eliminados
  assert.doesNotMatch(module7Section, /Capesize/i);
  assert.doesNotMatch(module7Section, /Panamax/i);
  assert.doesNotMatch(module7Section, /Supramax/i);
  assert.doesNotMatch(module7Section, /Handysize/i);
  assert.doesNotMatch(module7Section, /data-market-field="capesize_tc"/);
  assert.doesNotMatch(module7Section, /data-market-field="panamax_tc"/);
  assert.doesNotMatch(module7Section, /data-market-field="supramax_tc"/);
  assert.doesNotMatch(module7Section, /data-market-field="handysize_tc"/);
  assert.doesNotMatch(module7Section, /data-market-field="bdi_index"/);

  // Bloque BDI y TCE Spot Teórico eliminado
  assert.doesNotMatch(module7Section, /id="baltic-spot-reference-card"/);
  assert.doesNotMatch(module7Section, /id="baltic-spot-index"/);
  assert.doesNotMatch(module7Section, /id="tce-spot-theoretical-card"/);
  assert.doesNotMatch(module7Section, /TCE Spot Teórico/i);
  assert.doesNotMatch(module7Section, /Espejo Data Bridge/i);

  // Router de Pricing por DWT eliminado
  assert.doesNotMatch(module7Section, /Router de Pricing por DWT/i);
  assert.doesNotMatch(module7Section, /ROUTES PRICING POR DWT/i);
  assert.doesNotMatch(module7Section, /id="vessel-pricing-router-card"/);
  assert.doesNotMatch(module7Section, /id="vessel-pricing-router-status"/);
  assert.doesNotMatch(module7Section, /id="vessel-pricing-router-badge"/);
});

test('2. Adaptación de Modalidades y Títulos en Módulo 7', () => {
  // Botones superiores: SPOT -> Viaje Único, COA -> Contrato Regular
  assert.match(module7Section, /<button id="btn-mode-spot"[^>]*>Viaje Único<\/button>/);
  assert.match(module7Section, /<button id="btn-mode-coa"[^>]*>Contrato Regular<\/button>/);
  assert.doesNotMatch(module7Section, /<button id="btn-mode-spot"[^>]*>SPOT<\/button>/);
  assert.doesNotMatch(module7Section, /<button id="btn-mode-coa"[^>]*>COA<\/button>/);

  // Título Cost-Plus Coaster -> ESCANDALLO DE COSTES (COST-PLUS)
  assert.match(module7Section, /ESCANDALLO DE COSTES \(COST-PLUS\)/);
  assert.doesNotMatch(module7Section, /Cost-Plus Coaster/);

  // Título en TceCalculatorWorkspace.tsx también adaptado
  assert.match(tceWorkspaceSource, /ESCANDALLO DE COSTES \(COST-PLUS\)/);
});

test('3. Adaptación del panel de cálculo a tiempos y gastos terrestres', () => {
  // HORAS CONDUCCIÓN en lugar de DÍAS MAR
  assert.match(module7Section, /<label for="cost-plus-days-sea"[^>]*>HORAS CONDUCCIÓN<\/label>/);
  assert.doesNotMatch(module7Section, /<label for="cost-plus-days-sea"[^>]*>Días mar<\/label>/);

  // HORAS MUELLE/ESPERA en lugar de DÍAS PUERTO
  assert.match(module7Section, /<label for="cost-plus-days-port"[^>]*>HORAS MUELLE\/ESPERA<\/label>/);
  assert.doesNotMatch(module7Section, /<label for="cost-plus-days-port"[^>]*>Días puerto<\/label>/);

  // PEAJES Y DIETAS en lugar de GASTOS PUERTO
  assert.match(module7Section, /<label for="cost-plus-port-costs"[^>]*>PEAJES Y DIETAS<\/label>/);
  assert.doesNotMatch(module7Section, /<label for="cost-plus-port-costs"[^>]*>Gastos puerto<\/label>/);
});

test('4. Corrección de Resultados y Penalizaciones (Caja Azul)', () => {
  // Paralizaciones (€/h) en lugar de Demurrage ($/d)
  assert.match(module7Section, /Paralizaciones \(€\/h\): <span id="cost-plus-demurrage-rate">/);
  assert.doesNotMatch(module7Section, /Demurrage \(\$\/d\)/);

  // Símbolos de divisa en la caja azul en Euros (€)
  const blueBoxStart = module7Section.indexOf('id="cost-plus-box-title"');
  const blueBoxEnd = module7Section.indexOf('</div>', module7Section.indexOf('id="cost-plus-demurrage-rate"'));
  const blueBoxContent = module7Section.slice(blueBoxStart, blueBoxEnd + 6);

  assert.match(blueBoxContent, /12\.65 € \/Km/);
  assert.match(blueBoxContent, /Coste Total Riesgo: <span id="cost-plus-total-costs">0 €<\/span>/);
  assert.match(blueBoxContent, /Beneficio Neto Proyectado: <span id="cost-plus-calculated-margin">13,200 €<\/span>/);
  assert.match(blueBoxContent, /Paralizaciones \(€\/h\): <span id="cost-plus-demurrage-rate">5,625 €<\/span>/);
  assert.doesNotMatch(blueBoxContent, /\$/);
});

test('5. Limpieza de ETS y Adaptación de Márgenes Inferiores', () => {
  // Bloque de ETS / CO2 eliminado por completo
  assert.doesNotMatch(module7Section, /Costes y Recargos ETS \/ CO₂/i);
  assert.doesNotMatch(module7Section, /id="label-ets-charges-title"/);
  assert.doesNotMatch(module7Section, /id="ets-route-type"/);
  assert.doesNotMatch(module7Section, /id="apply-ets-surcharge"/);
  assert.doesNotMatch(module7Section, /id="eu-carbon-price"/);
  assert.doesNotMatch(module7Section, /id="res-ets-total-cost"/);

  // Márgenes inferiores adaptados a transportista y agencia
  assert.match(module7Section, /Margen Transportista/);
  assert.match(module7Section, /Venta Sugerida Transportista/);
  assert.doesNotMatch(module7Section, /Margen Armador/);
  assert.doesNotMatch(module7Section, /Venta Sugerida Armador/);

  assert.match(module7Section, /Margen Agencia/);
  assert.match(module7Section, /Venta Sugerida Agencia/);
  assert.doesNotMatch(module7Section, /Margen Fletador/);
  assert.doesNotMatch(module7Section, /Venta Sugerida Fletador/);

  // TceCalculatorWorkspace.tsx adaptado
  assert.match(tceWorkspaceSource, /label: 'Margen transportista'/);
  assert.match(tceWorkspaceSource, /label: 'Margen agencia'/);
});
