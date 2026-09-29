import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('1. Panel de Input Geográfico colapsable con toggle y pestaña visible', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Funciones de control de colapso expuestas globalmente
  assert.match(indexHtml, /function toggleRouteInputPanel\(forceCollapsed\)/);
  assert.match(indexHtml, /function setIsGeoInputOpen\(isNextOpen\)/);
  assert.match(indexHtml, /window\.setRouteInputPanelOpen = setRouteInputPanelOpen/);
  assert.match(indexHtml, /window\.setIsGeoInputOpen = setIsGeoInputOpen/);

  // Clases CSS de transición y visibilidad del panel colapsado
  assert.match(indexHtml, /transition:\s*transform\s+300ms/);
  assert.match(indexHtml, /#map-input-overlay\.is-collapsed/);
  assert.match(indexHtml, /transform:\s*translateX\(calc\(-100% \+ 46px\)\)/);

  // Botón flecha toggle en el panel
  assert.match(indexHtml, /id="btn-map-collapse-input"/);
  assert.match(indexHtml, /onclick="toggleRouteInputPanel\(\)"/);

  // Sincronización de chevron font-awesome
  assert.match(indexHtml, /icon\.classList\.toggle\('fa-chevron-left', isGeoInputOpen\)/);
  assert.match(indexHtml, /icon\.classList\.toggle\('fa-chevron-right', !isGeoInputOpen\)/);
});

test('2. Panel de Itinerario de Ruta Terrestre arrastrable (Drag & Drop)', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Header como drag handle con cursor grab / grabbing
  assert.match(indexHtml, /id="route-itinerary-header"/);
  assert.match(indexHtml, /cursor-grab active:cursor-grabbing/);

  // Inicialización de lógica draggable idéntica a Cerebro.ia
  assert.match(indexHtml, /function initRouteItineraryDraggable\(panel\)/);
  assert.match(indexHtml, /window\.initRouteItineraryDraggable = initRouteItineraryDraggable/);
  assert.match(indexHtml, /panel\.addEventListener\('mousedown'/);
  assert.match(indexHtml, /window\.addEventListener\('mousemove'/);
  assert.match(indexHtml, /window\.addEventListener\('mouseup'/);

  // Control de límites y sujeción de coordenadas (clamping)
  assert.match(indexHtml, /window\.innerWidth - \(panel\.offsetWidth/);
  assert.match(indexHtml, /window\.innerHeight - \(panel\.offsetHeight/);
  assert.match(indexHtml, /panel\.style\.left = `\${position\.x}px`/);
  assert.match(indexHtml, /panel\.style\.top = `\${position\.y}px`/);
});

test('3. Sincronización de visibilidad entre Input Geográfico y tarjetas inferiores (land-bottom-metrics)', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Contenedor padre identificado con id="land-bottom-metrics"
  assert.match(indexHtml, /id="land-bottom-metrics"/);

  // Mantenimiento de los IDs internos críticos intactos
  assert.match(indexHtml, /id="sync-pol-label"/);
  assert.match(indexHtml, /id="sync-pod-label"/);
  assert.match(indexHtml, /id="sync-miles-card"/);
  assert.match(indexHtml, /id="sync-miles-label"/);

  // Regla CSS para ocultar el contenedor inferior
  assert.match(indexHtml, /#land-bottom-metrics\.hidden/);

  // Lógica de toggle sincronizado en setIsGeoInputOpen
  assert.match(indexHtml, /const bottomMetrics = document\.getElementById\('land-bottom-metrics'\)/);
  assert.match(indexHtml, /bottomMetrics\.classList\.toggle\('hidden', !isGeoInputOpen\)/);

  // Estado inicial sincronizado al cargar la página (DOMContentLoaded)
  assert.match(indexHtml, /function syncLandBottomMetricsVisibility\(\)/);
  assert.match(indexHtml, /syncLandBottomMetricsVisibility\(\);/);
});
