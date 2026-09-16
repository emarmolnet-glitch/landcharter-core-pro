import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

// Extraer el Módulo 4 de index.html
const module4Match = indexSource.match(/<!-- 4\. Ajustes Inteligentes \(Optimización de Cálculo\) -->([\s\S]*?)<!-- 5\. Acciones de Auditoría y Reportes -->/);

test('Módulo 4: UI de inputs con etiquetas en HORAS y formateo .toFixed(2)', () => {
  assert.ok(module4Match, 'El Módulo 4 debe existir en index.html');
  const module4Html = module4Match[1];

  assert.match(module4Html, /FACTOR CLIMA Y TRÁFICO \(Horas\)/, 'Etiqueta clima debe estar en Horas');
  assert.match(module4Html, /T\. ESPERA EN MUELLE \(Horas\)/, 'Etiqueta espera en muelle debe estar en Horas');

  // Verificar presencia de inputs clave
  assert.match(module4Html, /id="factor-clima"/);
  assert.match(module4Html, /id="t-fondeo"/);
  assert.match(module4Html, /id="factor-clima-pod"/);
  assert.match(module4Html, /id="t-fondeo-pod"/);
  assert.match(module4Html, /id="delta-historico"/);

  // Verificar prevención de decimales sucios onblur
  assert.match(module4Html, /id="factor-clima"[^>]*toFixed\(2\)/);
  assert.match(module4Html, /id="t-fondeo"[^>]*toFixed\(2\)/);
  assert.match(module4Html, /id="factor-clima-pod"[^>]*toFixed\(2\)/);
  assert.match(module4Html, /id="t-fondeo-pod"[^>]*toFixed\(2\)/);
});

test('calculateAdjustedEtaAndDays: Conexión con Tacógrafo y eliminación de laytime marítimo', () => {
  // Debe extraer el tiempo del tacógrafo
  assert.match(indexSource, /calculateTachographTimes/, 'Debe consultar el tacógrafo');
  assert.match(indexSource, /tachographTransitDays/, 'Debe manejar variable de días de tránsito del tacógrafo');

  // Laytime marítimo debe estar descartado
  assert.match(indexSource, /const laytimePol = 0/, 'El laytime marítimo heredado debe fijarse a 0');

  // La duración final debe calcularse como suma de Tacógrafo + Muelle + Clima (convertidos a días)
  assert.match(indexSource, /climaPol\s*=\s*climaPolHours\s*\/\s*24/, 'Factor Clima origen debe dividirse entre 24');
  assert.match(indexSource, /fondeoPol\s*=\s*fondeoPolHours\s*\/\s*24/, 'T. Espera en muelle origen debe dividirse entre 24');
  assert.match(indexSource, /climaPod\s*=\s*climaPodHours\s*\/\s*24/, 'Factor Clima destino debe dividirse entre 24');
  assert.match(indexSource, /fondeoPod\s*=\s*fondeoPodHours\s*\/\s*24/, 'T. Espera en muelle destino debe dividirse entre 24');

  // Normativa tacógrafo CE 561/2006 y preservación de variables probadas
  assert.match(indexSource, /tacografoHours/);
  assert.match(indexSource, /navigationDays = baseNavigationDays \+ tacografoDays/);
  assert.match(indexSource, /const finalPolDate = new Date\(baseDate\.getTime\(\) \+ \(polRiskDays \* dayMs\)\)/);
  assert.match(indexSource, /const radarPodDate = new Date\(finalPolDate\.getTime\(\) \+ \(\(laytimePol \+ navigationDays\) \* dayMs\)\)/);
  assert.match(indexSource, /const finalPodDate = new Date\(radarPodDate\.getTime\(\) \+ \(podRiskDays \* dayMs\)\)/);
});

test('Simulación de cálculo de ETA para trayecto de 1035 km y 25 horas', () => {
  // Simular la lógica de cálculo del Tacógrafo para 1035 km a 80 km/h
  const distancia_total = 1035;
  const velocidad_media = 80;
  const horas_conduccion_pura = distancia_total / velocidad_media; // 12.9375 h
  const pausas_45m = Math.floor(horas_conduccion_pura / 4.5); // 2
  const horas_de_pausa = pausas_45m * 0.75; // 1.5 h
  const jornadas_laborales = Math.ceil(horas_conduccion_pura / 9); // 2
  const descansos_diarios_horas = jornadas_laborales > 1 ? (jornadas_laborales - 1) * 11 : 0; // 11 h
  const tiempo_total_transito_horas = horas_conduccion_pura + horas_de_pausa + descansos_diarios_horas; // 25.4375 h
  const tachographTransitDays = tiempo_total_transito_horas / 24; // 1.05989... días

  assert.equal(tachographTransitDays.toFixed(2), '1.06', 'Un trayecto de 1035 km debe dar 1.06 días de tacógrafo');

  // Caso A: Sin esperas ni clima adicional
  const polRiskDays_A = (0 + 0) / 24;
  const podRiskDays_A = (0 + 0) / 24;
  const adjustedDays_A = tachographTransitDays + polRiskDays_A + podRiskDays_A;
  assert.equal(adjustedDays_A.toFixed(2), '1.06', 'La Duración Final debe ser 1.06 días y no los 6.31 días de lógicas heredadas');

  // Caso B: Con esperas en muelle de 2 horas (1h POL + 1h POD)
  const polRiskDays_B = (0 + 1) / 24; // 1 hora espera = 0.04167 días
  const podRiskDays_B = (0 + 1) / 24; // 1 hora espera = 0.04167 días
  const adjustedDays_B = tachographTransitDays + polRiskDays_B + podRiskDays_B;
  // 1.05989 + 0.08333 = 1.1432 días (~1.1 días)
  assert.equal(adjustedDays_B.toFixed(2), '1.14', '2 horas extra de espera deben sumar 0.083 días');

  // Caso C: Fechas de ETA
  const baseDate = new Date('2026-09-16T00:00:00.000Z');
  const dayMs = 24 * 60 * 60 * 1000;
  const finalPolDate = new Date(baseDate.getTime() + (polRiskDays_A * dayMs));
  const radarPodDate = new Date(finalPolDate.getTime() + (tachographTransitDays * dayMs));
  const finalPodDate = new Date(radarPodDate.getTime() + (podRiskDays_A * dayMs));

  assert.equal(finalPolDate.toISOString().split('T')[0], '2026-09-16', 'Salida de origen el mismo día');
  assert.equal(radarPodDate.toISOString().split('T')[0], '2026-09-17', 'Llegada al destino al día siguiente (~25.4h)');
  assert.equal(finalPodDate.toISOString().split('T')[0], '2026-09-17', 'ETA Final correcta en el día siguiente');
});

test('Fix de Redondeo UI: valores flotantes sucios como 0.850000000000001 se redondean a 2 decimales', () => {
  const dirtyValue = 0.850000000000001;
  const cleanValue = Number(dirtyValue.toFixed(2)).toFixed(2);
  assert.equal(cleanValue, '0.85', '0.850000000000001 debe formatearse a 0.85');

  // Verificar que setInputValue en index.html contiene manejo toFixed(2)
  assert.match(indexSource, /nextValue\s*=\s*Number\(value\.toFixed\(2\)\)\.toFixed\(2\)/);
});
