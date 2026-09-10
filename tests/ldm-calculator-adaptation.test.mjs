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

  // Margen Neto del Viaje (€ o $) sustituye TCE Proyectado
  assert.match(indexSource, /Margen Neto del Viaje \(€ o \$\)/);
  assert.match(indexSource, /id="res-tce-label"[^>]*>Margen Neto del Viaje \(€ o \$\): \$0<\/div>/);
  assert.match(indexSource, /id="negotiation-owner-tce"[^>]*>Margen Neto del Viaje \(€ o \$\): \$0<\/span>/);
  assert.match(indexSource, /id="negotiation-target-tce"[^>]*>Margen Neto del Viaje \(€ o \$\): \$0<\/span>/);
});
