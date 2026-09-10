import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

// Extraer el Módulo 4 de index.html
const module4Match = indexSource.match(/<!-- 4\. Ajustes Inteligentes \(Optimización de Cálculo\) -->([\s\S]*?)<!-- 5\. Acciones de Auditoría y Reportes -->/);

test('Module 4 exists and is properly bounded in index.html', () => {
  assert.ok(module4Match, 'Module 4 section must exist in index.html');
});

const module4Html = module4Match ? module4Match[1] : '';

test('Eliminación de elementos 100% marítimos en Módulo 4', () => {
  // 1. Eliminar bloque completo de Coste Remolcadores / Tug Cost
  assert.doesNotMatch(module4Html, /Coste Remolcadores/i, 'No debe haber texto de Coste Remolcadores en Módulo 4');
  assert.doesNotMatch(module4Html, /Tug Cost/i, 'No debe haber texto de Tug Cost en Módulo 4');
  assert.doesNotMatch(module4Html, /contenedor_coste_remolcadores/, 'No debe existir el contenedor de coste remolcadores en Módulo 4');

  // 2. Eliminar botón de "Consultar Radar En Vivo"
  assert.doesNotMatch(module4Html, /btn-live-radar-risk/, 'No debe existir el botón btn-live-radar-risk en Módulo 4');
  assert.doesNotMatch(module4Html, /Consultar Radar En Vivo/, 'No debe aparecer el texto Consultar Radar En Vivo en Módulo 4');
  assert.doesNotMatch(module4Html, /data-datalastic-credit-counter/, 'No debe haber contador de créditos Datalastic en Módulo 4');

  // 3. Eliminar la etiqueta de "LAYCAN LIBRE"
  assert.doesNotMatch(module4Html, />\s*Laycan libre\s*</i, 'No debe existir la etiqueta visible de Laycan libre');
});

test('Adaptación de Origen y Destino (POL/POD) en títulos y resultados de Módulo 4', () => {
  // Títulos adaptados
  assert.match(module4Html, /ORIGEN - PUNTO DE CARGA/, 'Debe titular ORIGEN - PUNTO DE CARGA');
  assert.match(module4Html, /DESTINO - PUNTO DE DESCARGA/, 'Debe titular DESTINO - PUNTO DE DESCARGA');
  assert.doesNotMatch(module4Html, /POL · Puerto de carga/, 'No debe titular POL · Puerto de carga');
  assert.doesNotMatch(module4Html, /POD · Puerto de descarga/, 'No debe titular POD · Puerto de descarga');

  // Resultados inferiores
  assert.match(module4Html, /ETA Origen:/, 'Debe contener etiqueta ETA Origen:');
  assert.match(module4Html, /Ajuste Origen:/, 'Debe contener etiqueta Ajuste Origen:');
  assert.match(module4Html, /Tránsito a Destino:/, 'Debe contener etiqueta Tránsito a Destino:');
  assert.match(module4Html, /ETA Final:/, 'Debe contener etiqueta ETA Final:');

  assert.doesNotMatch(module4Html, /ETA Radar POL:/, 'No debe contener ETA Radar POL:');
  assert.doesNotMatch(module4Html, /ETA Final POL:/, 'No debe contener ETA Final POL:');
  assert.doesNotMatch(module4Html, /ETA Radar POD:/, 'No debe contener ETA Radar POD:');
});

test('Adaptación de Factores de Riesgo, Esperas e Impacto en Euros', () => {
  // Factores en Horas adaptados a transporte terrestre
  assert.match(module4Html, /T\. ESPERA EN MUELLE \(Horas\)/, 'Debe incluir T. ESPERA EN MUELLE (Horas)');
  assert.match(module4Html, /FACTOR CLIMA Y TRÁFICO \(Horas\)/, 'Debe incluir FACTOR CLIMA Y TRÁFICO (Horas)');
  assert.doesNotMatch(module4Html, /T\. espera fondeo POL/i, 'No debe mantener texto de fondeo POL');
  assert.doesNotMatch(module4Html, /T\. espera fondeo POD/i, 'No debe mantener texto de fondeo POD');

  // Impacto de riesgo en Euros (Total) en lugar de $/TM
  assert.match(module4Html, /0\.00 € \(Total\)/, 'Impacto de riesgo inicial debe expresarse en Euros: 0.00 € (Total)');
  assert.doesNotMatch(module4Html, /\$0\.00\/TM/, 'Impacto de riesgo no debe expresarse en $0.00/TM');
});

test('Integración del Tacógrafo y ruta OSRM en cálculo de ETA', () => {
  // Entrada para descansos de tacógrafo
  assert.match(module4Html, /Descansos Tacógrafo/i, 'Debe mostrar campo para Descansos Tacógrafo');

  // Lógica en JavaScript
  assert.match(indexSource, /tacografoHours/, 'El script debe procesar horas de tacógrafo');
  assert.match(indexSource, /navigationDays = baseNavigationDays \+ tacografoDays/, 'El script debe sumar los días de tacógrafo a navigationDays');
  assert.match(indexSource, /CE 561\/2006/, 'Debe referenciar la normativa de tiempos de conducción y descanso CE 561/2006');
});
