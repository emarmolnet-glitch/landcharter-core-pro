import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateTachographAlgorithm, useTachographTimes } from '../src/tachograph-module.mjs';

test('1. Posicionamiento en el DOM y estructura de acordeón', async () => {
  const indexSource = await readFile('index.html', 'utf8');

  // Verificar que el panel está exactamente ubicado entre el Módulo 2 y el Módulo 3
  const module2Index = indexSource.indexOf('id="vessel-header-title"');
  const tachographIndex = indexSource.indexOf('id="tacografo-header-title"');
  const module3Index = indexSource.indexOf('id="costs-header-title"');

  assert.ok(module2Index > 0, 'El Módulo 2 debe existir');
  assert.ok(tachographIndex > 0, 'El Módulo de Tacógrafo debe existir');
  assert.ok(module3Index > 0, 'El Módulo 3 debe existir');

  assert.ok(
    module2Index < tachographIndex && tachographIndex < module3Index,
    'El Módulo de Tacógrafo debe estar situado exactamente debajo del Módulo 2 y encima del Módulo 3'
  );

  // Verificar clases de acordeón, Tailwind y atributos requeridos
  assert.match(
    indexSource,
    /id="section-tacografo"[^>]*class="[^"]*collapsible-section[^"]*bg-slate-900[^"]*border[^"]*border-slate-700[^"]*rounded-xl[^"]*p-5[^"]*shadow-lg[^"]*"[^>]*data-collapsible-section/,
    'Debe ser un panel collapsible-section con clases de Tailwind idénticas a los demás módulos'
  );

  // Título exacto requerido
  assert.match(
    indexSource,
    /<h2[^>]*id="tacografo-header-title"[^>]*>[\s\S]*?TIEMPOS DE CONDUCCIÓN Y TACÓGRAFO \(REG\. 561\/2006\)[\s\S]*?<\/h2>/,
    'Debe titularse exactamente TIEMPOS DE CONDUCCIÓN Y TACÓGRAFO (REG. 561/2006)'
  );
});

test('2. Entradas y elementos requeridos en la interfaz', async () => {
  const indexSource = await readFile('index.html', 'utf8');

  // Input editable para "Velocidad Media (km/h)" inicializado en 80
  assert.match(
    indexSource,
    /Velocidad Media \(km\/h\)/,
    'Debe existir la etiqueta para Velocidad Media (km/h)'
  );
  assert.match(
    indexSource,
    /<input[^>]*id="tacografo-speed"[^>]*value="80"/,
    'El input tacografo-speed debe existir e inicializarse en 80'
  );

  // Resultados limpios para cada métrica
  assert.match(indexSource, /Conducción Efectiva \(h\)/, 'Debe mostrar Conducción Efectiva (h)');
  assert.match(indexSource, /id="tacografo-driving-hours"/, 'Debe existir contenedor id tacografo-driving-hours');

  assert.match(indexSource, /Pausas Reglamentarias \(h\)/, 'Debe mostrar Pausas Reglamentarias (h)');
  assert.match(indexSource, /id="tacografo-break-hours"/, 'Debe existir contenedor id tacografo-break-hours');

  assert.match(indexSource, /Descansos Diarios \(h\)/, 'Debe mostrar Descansos Diarios (h)');
  assert.match(indexSource, /id="tacografo-daily-rest-hours"/, 'Debe existir contenedor id tacografo-daily-rest-hours');

  assert.match(indexSource, /Tiempo Total de Tránsito/, 'Debe mostrar Tiempo Total de Tránsito');
  assert.match(indexSource, /id="tacografo-total-transit-hours"/, 'Debe existir contenedor id tacografo-total-transit-hours');
  assert.match(indexSource, /id="tacografo-total-transit-days"/, 'Debe existir contenedor id tacografo-total-transit-days para conversión a días');
});

test('3. Algoritmo matemático: Casos de prueba según Reglamento CE 561/2006', () => {
  // Caso 0: Distancia 0
  const r0 = calculateTachographAlgorithm(0, 80);
  assert.equal(r0.horas_conduccion_pura, 0);
  assert.equal(r0.pausas_45m, 0);
  assert.equal(r0.horas_de_pausa, 0);
  assert.equal(r0.jornadas_laborales, 0);
  assert.equal(r0.descansos_diarios_horas, 0);
  assert.equal(r0.tiempo_total_transito, 0);
  assert.equal(r0.tiempo_total_dias, 0);

  // Caso 1: 360 km a 80 km/h = 4.5h pura conducción
  // pausas: Math.floor(4.5 / 4.5) = 1 (0.75h)
  // jornadas: Math.ceil(4.5 / 9) = 1
  // descansos diarios: 1 > 1 ? 0 : 0
  // tiempo total: 4.5 + 0.75 + 0 = 5.25h
  const r1 = calculateTachographAlgorithm(360, 80);
  assert.equal(r1.horas_conduccion_pura, 4.5);
  assert.equal(r1.pausas_45m, 1);
  assert.equal(r1.horas_de_pausa, 0.75);
  assert.equal(r1.jornadas_laborales, 1);
  assert.equal(r1.descansos_diarios_horas, 0);
  assert.equal(r1.tiempo_total_transito, 5.25);
  assert.equal(r1.tiempo_total_dias, 5.25 / 24);

  // Caso 2: 720 km a 80 km/h = 9.0h pura conducción
  // pausas: Math.floor(9 / 4.5) = 2 (1.5h)
  // jornadas: Math.ceil(9 / 9) = 1
  // descansos diarios: 1 > 1 ? 0 : 0
  // tiempo total: 9 + 1.5 + 0 = 10.5h
  const r2 = calculateTachographAlgorithm(720, 80);
  assert.equal(r2.horas_conduccion_pura, 9);
  assert.equal(r2.pausas_45m, 2);
  assert.equal(r2.horas_de_pausa, 1.5);
  assert.equal(r2.jornadas_laborales, 1);
  assert.equal(r2.descansos_diarios_horas, 0);
  assert.equal(r2.tiempo_total_transito, 10.5);

  // Caso 3: 800 km a 80 km/h = 10.0h pura conducción
  // pausas: Math.floor(10 / 4.5) = 2 (1.5h)
  // jornadas: Math.ceil(10 / 9) = 2
  // descansos diarios: (2 - 1) * 11 = 11h
  // tiempo total: 10 + 1.5 + 11 = 22.5h
  const r3 = calculateTachographAlgorithm(800, 80);
  assert.equal(r3.horas_conduccion_pura, 10);
  assert.equal(r3.pausas_45m, 2);
  assert.equal(r3.horas_de_pausa, 1.5);
  assert.equal(r3.jornadas_laborales, 2);
  assert.equal(r3.descansos_diarios_horas, 11);
  assert.equal(r3.tiempo_total_transito, 22.5);
  assert.equal(r3.tiempo_total_dias, 22.5 / 24);

  // Caso 4: 1800 km a 80 km/h = 22.5h pura conducción
  // pausas: Math.floor(22.5 / 4.5) = 5 (3.75h)
  // jornadas: Math.ceil(22.5 / 9) = 3
  // descansos diarios: (3 - 1) * 11 = 22h
  // tiempo total: 22.5 + 3.75 + 22 = 48.25h (~2.01 días)
  const r4 = calculateTachographAlgorithm(1800, 80);
  assert.equal(r4.horas_conduccion_pura, 22.5);
  assert.equal(r4.pausas_45m, 5);
  assert.equal(r4.horas_de_pausa, 3.75);
  assert.equal(r4.jornadas_laborales, 3);
  assert.equal(r4.descansos_diarios_horas, 22);
  assert.equal(r4.tiempo_total_transito, 48.25);
  assert.equal(r4.tiempo_total_dias, 48.25 / 24);

  // Caso 5: Velocidad personalizada (600 km a 60 km/h = 10h)
  const r5 = useTachographTimes({ distance: 600, speed: 60 });
  assert.equal(r5.horas_conduccion_pura, 10);
  assert.equal(r5.tiempo_total_transito, 22.5);
});

test('4. Invocación de calculateTachographTimes en index.html', async () => {
  const indexSource = await readFile('index.html', 'utf8');

  // La función calculateTachographTimes debe estar definida en el script de index.html
  assert.match(indexSource, /function calculateTachographTimes\(/, 'calculateTachographTimes debe estar definida en index.html');
  assert.match(indexSource, /window\.calculateTachographTimes\s*=/, 'calculateTachographTimes debe estar expuesta en window');

  // calculateTachographTimes debe ser llamada en el ciclo del motor
  assert.match(indexSource, /calculateTachographTimes\(\)/, 'calculateTachographTimes debe ser invocada');
});
