import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

// Extraer el Módulo 6 (Resumen de Operación)
const module6Start = indexSource.indexOf('id="summary-header-title"');
const module6End = indexSource.indexOf('<!-- ANÁLISIS DE FLETES', module6Start);
const module6Section = indexSource.slice(module6Start, module6End);

test('1. Módulo 6 adapta bloque de tiempos de días a horas de escandallo terrestre', () => {
  // Título de tiempo total
  assert.match(module6Section, /Horas Totales de Operación \(Ruta \+ Muelle\)/);
  assert.doesNotMatch(module6Section, /Días Mar \+ Puerto \+ Margen Clima/);

  // Desglose de horas
  assert.match(module6Section, /Horas de Posicionamiento \(Vacío\)/);
  assert.doesNotMatch(module6Section, /Días Lastre \(Ballast\)/);

  assert.match(module6Section, /Horas de Conducción \(Carga\)/);
  assert.doesNotMatch(module6Section, /Días Navegación \(Laden\)/);

  assert.match(module6Section, /Horas en Muelle \(Carga\/Descarga\)/);
  assert.doesNotMatch(module6Section, /Días en Puerto \(Port\)/);

  // Unidad h en vez de d
  assert.match(module6Section, /id="res-days-ballast"[^>]*>0\.00 h<\/span>/);
  assert.match(module6Section, /id="res-days-laden"[^>]*>0\.00 h<\/span>/);
  assert.match(module6Section, /id="res-days-port"[^>]*>0\.00 h<\/span>/);
  assert.match(module6Section, /id="res-days-margin"[^>]*>0\.00 h<\/span>/);
  assert.doesNotMatch(module6Section, /0\.00 d/);
});

test('2. Módulo 6 adapta bloque de combustible a Diésel/AdBlue y elimina consumos marítimos de fondeo', () => {
  // Títulos adaptados
  assert.match(module6Section, /Coste de Combustible \(Diésel\/AdBlue\)/);
  assert.doesNotMatch(module6Section, />Bunkers:<\/span>/);
  assert.doesNotMatch(module6Section, /Desglose combustible/i);

  // Líneas de consumo en ruta y ralentí
  assert.match(module6Section, /Consumo en Ruta/);
  assert.doesNotMatch(module6Section, /Consumo Navegación/);

  assert.match(module6Section, /Consumo al Ralentí \/ Esperas/);
  assert.doesNotMatch(module6Section, /Consumo Puerto/);

  // Purga de fondeo
  assert.doesNotMatch(module6Section, /Consumo Fondeo/);
  assert.doesNotMatch(module6Section, /Consumo Auxiliar \(Fondeo\)/);
  assert.doesNotMatch(module6Section, /id="res-fuel-anchorage"/);
  assert.doesNotMatch(module6Section, /id="bunker-fondeo-display"/);
});

test('3. Módulo 6 elimina costes residuales marítimos de estiba, FIOS y ETS', () => {
  // Purga de estiba
  assert.doesNotMatch(module6Section, /Estiba a cargo del armador/);
  assert.doesNotMatch(module6Section, /id="stevedoring-cost-breakdown"/);
  assert.doesNotMatch(module6Section, /id="res-cost-stevedoring"/);
  assert.doesNotMatch(module6Section, /id="res-cost-stevedoring-note"/);
  assert.doesNotMatch(module6Section, /FIOS/);

  // Purga de ETS
  assert.doesNotMatch(module6Section, /ETS Estimado/);
  assert.doesNotMatch(module6Section, /id="label-ets-cost-basis"/);
  assert.doesNotMatch(module6Section, /id="res-cost-ets"/);
});

test('4. Módulo 6 corrige moneda global sustituyendo cualquier $ por €', () => {
  // Asegurar que no hay ningún símbolo de dólar estático en el Módulo 6
  assert.doesNotMatch(module6Section, /\$/);

  // Comprobar que los valores iniciales usan el símbolo de Euro (€)
  assert.match(module6Section, /id="res-cost-bunker"[^>]*>€0<\/span>/);
  assert.match(module6Section, /id="res-fuel-nav"[^>]*>0\.00 t · €0<\/strong>/);
  assert.match(module6Section, /id="res-fuel-port"[^>]*>0\.00 t · €0<\/strong>/);
  assert.match(module6Section, /id="res-cost-opex"[^>]*>€0<\/span>/);
  assert.match(module6Section, /id="res-cost-capex"[^>]*>€0<\/span>/);
  assert.match(module6Section, /id="res-cost-pda"[^>]*>€0<\/span>/);
  assert.match(module6Section, /id="res-cost-base-break-even"[^>]*>€0\.00 \/Km · Total: €0<\/strong>/);
  assert.match(module6Section, /id="res-cost-total"[^>]*>€0<\/span>/);
});
