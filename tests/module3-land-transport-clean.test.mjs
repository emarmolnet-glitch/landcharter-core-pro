import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

// Extract Module 3: Estructura de costes
const module3Match = indexSource.match(/<!-- 3\. Bunkers y Gastos -->([\s\S]*?)<!-- 4\. Ajustes Inteligentes/);
const module3Html = module3Match ? module3Match[1] : '';

test('1. Bunkers panel: VLSFO, IFO 380, and MGO removed from Module 3 DOM', () => {
  assert.ok(module3Html.length > 0, 'Module 3 section must exist');
  assert.doesNotMatch(module3Html, /PRECIO VLSFO/, 'PRECIO VLSFO must not be in Module 3 DOM');
  assert.doesNotMatch(module3Html, /PRECIO IFO 380/, 'PRECIO IFO 380 must not be in Module 3 DOM');
  assert.doesNotMatch(module3Html, /PRECIO MGO/, 'PRECIO MGO must not be in Module 3 DOM');
  assert.doesNotMatch(module3Html, /id="price-port"/, 'price-port must not be in Module 3 DOM');
});

test('2. Land fuel fields: Read-only PRECIO DIÉSEL and PRECIO ADBLUE connected to /api-land-data', () => {
  assert.match(module3Html, /PRECIO DIÉSEL \(€\/L\)/, 'PRECIO DIÉSEL (€/L) label must be in Module 3');
  assert.match(module3Html, /PRECIO ADBLUE \(€\/L\)/, 'PRECIO ADBLUE (€/L) label must be in Module 3');
  assert.match(module3Html, /<input[^>]*id="price-sea"[^>]*readonly/i, 'price-sea input must be readonly');
  assert.match(module3Html, /<input[^>]*id="price-ifo"[^>]*readonly/i, 'price-ifo input must be readonly');
  assert.match(indexSource, /fetch\(['"]\/api-land-data['"]\)/, 'Must fetch land fuel prices from /api-land-data');
});

test('3. Maritime buttons removed: SINCRONIZAR OIL PRICE API and BUSCAR DESVÍOS RENTABLES', () => {
  assert.doesNotMatch(module3Html, /Sincronizar Oil Price API/, 'Sincronizar Oil Price API button must not be in Module 3');
  assert.doesNotMatch(module3Html, /Buscar Desvíos Rentables/, 'Buscar Desvíos Rentables button must not be in Module 3');
  assert.doesNotMatch(module3Html, /id="btn-consult-bunker"/, 'btn-consult-bunker must not be in Module 3');
  assert.doesNotMatch(module3Html, /id="btn-search-bunker-arbitrage"/, 'btn-search-bunker-arbitrage must not be in Module 3');
});

test('4. Maritime alert banners removed: Gruas OK and Faltan datos operativos', () => {
  assert.doesNotMatch(module3Html, /id="crane-validation-alert"/, 'crane-validation-alert must not be in Module 3 DOM');
  assert.doesNotMatch(module3Html, /id="voyage-cost-data-alert"/, 'voyage-cost-data-alert must not be in Module 3 DOM');
});

test('5. Vessel details removed: Flag and PSC inspections', () => {
  assert.doesNotMatch(module3Html, /id="label-vessel-flag"/, 'label-vessel-flag must not be in Module 3 DOM');
  assert.doesNotMatch(module3Html, /id="vessel-flag"/, 'vessel-flag input must not be in Module 3 DOM');
  assert.doesNotMatch(module3Html, /id="label-vessel-psc"/, 'label-vessel-psc must not be in Module 3 DOM');
  assert.doesNotMatch(module3Html, /id="vessel-psc"/, 'vessel-psc select must not be in Module 3 DOM');
});

test('6. Currency corrected: Recargo Carga/Especial uses EUR (€) instead of USD ($)', () => {
  assert.match(module3Html, /Recargo Carga\/Especial \(€\)/, 'Recargo Carga/Especial must use (€) symbol in Module 3');
  assert.doesNotMatch(module3Html, /Recargo Carga\/Especial \(\$\)/, 'Recargo Carga/Especial must not use ($) symbol in Module 3');
});
