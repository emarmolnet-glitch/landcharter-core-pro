import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('1. En index.html el input correspondiente a DESTINO en INPUT GEOGRÁFICO no tiene atributo value con texto predefinido', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Input de destino en el panel Input Geográfico
  const mapPodMatch = indexHtml.match(/<input[^>]*id="map-port-pod"[^>]*>/);
  assert.ok(mapPodMatch, 'Debe existir el input con id="map-port-pod"');
  assert.doesNotMatch(mapPodMatch[0], /\svalue="[^"]+"/i, 'No debe tener ningún atributo value con texto predefinido');
});

test('2. Limpieza forzada de UI al iniciar Land Charter en la inicialización (DOMContentLoaded)', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Comprueba la presencia de las instrucciones explícitas de reseteo con los IDs reales
  assert.match(indexHtml, /\/\/ Limpieza forzada de UI al iniciar Land Charter/);
  assert.match(indexHtml, /const inputDestino = document\.getElementById\('map-port-pod'\);/);
  assert.match(indexHtml, /const inputOrigen = document\.getElementById\('map-port-pol'\);/);
  assert.match(indexHtml, /if\s*\(inputDestino\)\s*inputDestino\.value\s*=\s*'';/);
  assert.match(indexHtml, /if\s*\(inputOrigen\)\s*inputOrigen\.value\s*=\s*'';/);
});

test('3. Barra inferior de métricas arranca mostrando DESTINO: TBA y DISTANCIA: 0 km ignorando localStorage de SeaCharter', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Contenedor estático y etiquetas iniciales
  assert.match(indexHtml, /<strong id="sync-pod-label">TBA<\/strong>/);
  assert.match(indexHtml, /<strong id="sync-miles-label">0 km<\/strong>/);

  // Inicialización de métricas en DOMContentLoaded
  assert.match(indexHtml, /syncPodLabel\.textContent\s*=\s*'TBA';/);
  assert.match(indexHtml, /syncMilesLabel\.textContent\s*=\s*'0 km';/);

  // syncLandBottomMetricsVisibility preserva TBA y 0 km al inicializar si no hay ruta activa
  assert.match(indexHtml, /if\s*\(!window\.currentRoute\)\s*\{[\s\S]*?syncPod\.textContent\s*=\s*'TBA';/);
  assert.match(indexHtml, /syncMiles\.textContent\s*=\s*'0 km';/);
});
