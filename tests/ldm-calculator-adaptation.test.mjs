import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('1. Sección Especificaciones de Carga y Rutas refleja terminología terrestre LDM', async () => {
  const indexSource = await readFile('index.html', 'utf8');

  // POL y POD adaptados a Origen y Destino (Población / CP)
  assert.match(indexSource, /id="label-port-pol"[^>]*>Origen \(Población \/ CP\)<\/label>/);
  assert.match(indexSource, /id="label-port-pod"[^>]*>Destino \(Población \/ CP\)<\/label>/);
  assert.match(indexSource, /placeholder="Ej: Madrid, 28001"/);
  assert.match(indexSource, /placeholder="Ej: Berlín, 10115"/);

  // Metros Lineales (LDM) y Peso Bruto (KG)
  assert.match(indexSource, /id="label-cargo-sf"[^>]*>Metros Lineales \(LDM\)<\/label>/);
  assert.match(indexSource, /id="label-grab-capacity"[^>]*>Peso Bruto \(KG\)<\/label>/);

  // Horas previstas de Carga, Descarga y Paralizaciones (h)
  assert.match(indexSource, /id="label-laytime-load-condition"[^>]*>Horas previstas de Carga<\/label>/);
  assert.match(indexSource, /id="label-laytime-disch-condition"[^>]*>Horas previstas de Descarga<\/label>/);
  assert.match(indexSource, /id="label-turn-time-hours"[^>]*>Paralizaciones \(h\)<\/label>/);
  assert.match(indexSource, /id="horas-previstas-carga"/);
  assert.match(indexSource, /id="horas-previstas-descarga"/);

  // Opciones de carga por defecto para transporte terrestre
  assert.match(indexSource, /<option value="Paletizado \(Euro-pallets\)">Paletizado \(Euro-pallets\)<\/option>/);
  assert.match(indexSource, /<option value="Granel \(Bañera\)">Granel \(Bañera\)<\/option>/);
  assert.match(indexSource, /<option value="Maquinaria">Maquinaria<\/option>/);
  assert.match(indexSource, /<option value="Temperatura Controlada">Temperatura Controlada<\/option>/);
});

test('2. Sección Estructura de Costes adaptada a Diésel, Peajes y Dietas', async () => {
  const indexSource = await readFile('index.html', 'utf8');

  // Título de la sección
  assert.match(indexSource, /id="costs-header-title"[^>]*>[\s\S]*?ESTRUCTURA DE COSTES \(DIÉSEL, PEAJES, DIETAS\)/);

  // Desglose de combustible adaptado a Gasóleo / Diésel / AdBlue
  assert.match(indexSource, /id="fuel-prices-title"[^>]*>Consumo de Gasóleo \(Diésel \/ AdBlue\)<\/h3>/);

  // Campos reflejan Precio por Litro (€/L) y Consumo L/100km
  assert.match(indexSource, /PRECIO DIÉSEL \(€\/L\)/);
  assert.match(indexSource, /PRECIO ADBLUE \(€\/L\)/);
  assert.match(indexSource, /Consumo Diésel \(L\/100km\)/);
  assert.match(indexSource, /Consumo AdBlue \(L\/100km\)/);

  // Coste Fijo Diario (Chófer, Seguros, Amortización)
  assert.match(indexSource, /id="label-opex-daily"[^>]*>Coste Fijo Diario \(Chófer, Seguros, Amortización\)<\/label>/);

  // Peajes y Dietas / Pernocta Chófer
  assert.match(indexSource, /id="label-pda-pol"[^>]*>Peajes \(€\)<\/label>/);
  assert.match(indexSource, /id="label-pda-pod"[^>]*>Dietas \/ Pernocta Chófer \(€\)<\/label>/);

  // Rutas Especiales (Ferries / Eurotúnel)
  assert.match(indexSource, /id="label-selected-canal"[^>]*>Rutas Especiales \(Ferries \/ Eurotúnel\)<\/label>/);
  assert.match(indexSource, /<option value="Eurotúnel">Eurotúnel \(Calais - Dover\)<\/option>/);
});

test('3. Resultados y Simulador reflejan Coste por Km, Precio total del Viaje y Margen Neto', async () => {
  const indexSource = await readFile('index.html', 'utf8');

  // Rentabilidad referenciada a Coste por Km y Precio total del Viaje
  assert.match(indexSource, /Coste Base · Break-Even \(Coste por Km \/ Precio Total\)/);
  assert.match(indexSource, /Coste por Km y Precio total del Viaje/);
  assert.match(indexSource, /Oferta Inicial \(Coste por Km \/ Precio total del Viaje\)/);
  assert.match(indexSource, /Target \/ Contraoferta \(Coste por Km \/ Precio total del Viaje\)/);
  assert.match(indexSource, /Spread de Negociación \(Coste por Km\)/);

  // Margen Neto del Viaje sustituye TCE Proyectado y consolida Euros (€)
  assert.match(indexSource, /Margen Neto del Viaje/);
  assert.match(indexSource, /id="res-tce-label"[^>]*>Margen Neto del Viaje \(€\): 0 €<\/div>/);
  assert.match(indexSource, /id="negotiation-owner-tce"[^>]*>Margen Neto del Viaje: 0 €<\/span>/);
  assert.match(indexSource, /id="negotiation-target-tce"[^>]*>Margen Neto del Viaje: 0 €<\/span>/);
});

test('4. Apartado 2: Purga total de términos marítimos y adaptación a logística terrestre', async () => {
  const indexSource = await readFile('index.html', 'utf8');

  // Selectores de métodos de carga y descarga en POL y POD
  const polMatch = indexSource.match(/<select[^>]*id="metodo_carga"[^>]*>([\s\S]*?)<\/select>/);
  const podMatch = indexSource.match(/<select[^>]*id="metodo_descarga_pod"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(polMatch, 'metodo_carga select must exist');
  assert.ok(podMatch, 'metodo_descarga_pod select must exist');

  const expectedMethods = [
    'carga_lateral_tauliner',
    'carga_trasera_muelle',
    'carga_superior_techo',
    'transpaleta_carretilla',
    'silo_tubo_granel'
  ];
  for (const method of expectedMethods) {
    assert.match(polMatch[1], new RegExp(`value="${method}"`));
    assert.match(podMatch[1], new RegExp(`value="${method}"`));
  }

  // Purga estricta de términos marítimos en selectores
  const maritimeMethods = [
    'cinta_transportadora',
    'bombas_neumaticas',
    'cuchara_grab',
    'cuchara_portuaria',
    'grua_portuaria_30mt',
    'big_bags_barco',
    'paletizado_barco'
  ];
  for (const maritime of maritimeMethods) {
    assert.equal(polMatch[1].includes(`value="${maritime}"`), false);
    assert.equal(podMatch[1].includes(`value="${maritime}"`), false);
  }

  // Ritmo de Carga/Descarga sustituido por Ratio Operativo (Pallets/h o Toneladas/h)
  assert.match(indexSource, /id="label-rate-load"[^>]*>Ratio Operativo \(Pallets\/h o Toneladas\/h\)<\/label>/);
  assert.match(indexSource, /id="label-rate-disch"[^>]*>Ratio Operativo \(Pallets\/h o Toneladas\/h\)<\/label>/);
  assert.match(indexSource, /id="rate-ref-helper-pol"[\s\S]*?Ref\. Tauliner \/ Muelle: 20 - 30 pallets\/h/);
  assert.match(indexSource, /id="rate-ref-helper-pod"[\s\S]*?Ref\. Tauliner \/ Muelle: 20 - 30 pallets\/h/);

  // Condiciones de Contrato / Incoterms terrestres (sin FIOS)
  const freightMatch = indexSource.match(/<select[^>]*id="freight-conditions"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(freightMatch, 'freight-conditions select must exist');
  assert.match(freightMatch[1], /value="EXW\/FCA"/);
  assert.match(freightMatch[1], /value="CPT\/DAP"/);
  assert.equal(freightMatch[1].includes('value="FIOS"'), false);

  // Campos residuales ocultos
  assert.match(indexSource, /class="input-group hidden"\s+style="display: none;"[\s\S]*?id="vessel-net-tonnage"/);
  assert.match(indexSource, /class="input-group hidden"\s+style="display: none;"[\s\S]*?id="cargo-tolerance"/);
  assert.match(indexSource, /id="contenedor-gruas-pol"[^>]*class="input-group hidden"/);
  assert.match(indexSource, /id="contenedor-gruas-pod"[^>]*class="input-group hidden"/);
});
