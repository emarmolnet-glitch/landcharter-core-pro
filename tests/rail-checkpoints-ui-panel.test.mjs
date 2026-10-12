import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = process.cwd();

test('1. Título Dinámico de Sección: Tacógrafo vs Nodos Ferroviarios de Paso (Ruta Simulada)', async () => {
  const indexHtml = await readFile(resolve(rootDir, 'index.html'), 'utf8');

  // a) Verificación de la condición y los títulos alternantes
  assert.match(
    indexHtml,
    /Nodos Ferroviarios de Paso \(Ruta Simulada\)/,
    'Debe contener el título específico para modo tren'
  );
  assert.match(
    indexHtml,
    /Tacógrafo \(CE 561\/2006\)/,
    'Debe mantener el título de tacógrafo para carretera'
  );

  // b) Estructura condicional ternaria exacta
  assert.match(
    indexHtml,
    /\$\{isRailItinerary\s*\?\s*['"]🛤️ Nodos Ferroviarios de Paso \(Ruta Simulada\)['"]\s*:\s*['"]☕ Tacógrafo \(CE 561\/2006\)['"]\}/
  );
});

test('2. Visibilidad y Estética de Paradas Ferroviarias: muestra nombre de ciudad/coordenada y progreso porcentual', async () => {
  const indexHtml = await readFile(resolve(rootDir, 'index.html'), 'utf8');

  // a) NO ocultar checkpoints cuando es ferrocarril
  assert.match(indexHtml, /railCheckpoints/);
  assert.match(indexHtml, /cp\.name/);
  assert.match(indexHtml, /cp\.progress/);
  assert.match(indexHtml, /Progreso en ruta/);

  // b) No muestra descansos de chófer cuando isRailItinerary es true
  assert.doesNotMatch(
    indexHtml,
    /Tránsito ferroviario continuo por corredor de mercancías con surcos asignados\. Sin paradas de tacógrafo vial\./,
    'Ya no debe ocultar los nodos mostrando el texto de bloqueo'
  );
});

test('3. Verificación Funcional del Renderizado de Itinerario en Modo RAIL y ROAD', async () => {
  const indexHtml = await readFile(resolve(rootDir, 'index.html'), 'utf8');

  // Extraer función renderRouteItineraryRightPanel de index.html
  const fnMatch = indexHtml.match(/function renderRouteItineraryRightPanel\(landData\) \{([\s\S]*?)\}\nwindow\.renderRouteItineraryRightPanel/);
  assert.ok(fnMatch, 'renderRouteItineraryRightPanel debe estar definida en index.html');

  // Mock DOM
  let innerHtmlCaptured = '';
  const mockPanel = {
    className: '',
    innerHTML: '',
    classList: {
      toggle: () => {},
      remove: () => {},
      add: () => {},
      contains: () => false
    },
    style: {},
    setAttribute: () => {},
    dataset: {}
  };

  const mockDocument = {
    getElementById: (id) => {
      if (id === 'route-itinerary-right-panel') return mockPanel;
      if (id === 'view-map') return { classList: { contains: () => true } };
      return null;
    },
    createElement: () => mockPanel,
    body: { appendChild: () => {} }
  };

  const testEnv = {
    document: mockDocument,
    window: {
      globalTransportMode: 'RAIL',
      isGeoInputOpen: true,
      State: { globalTransportMode: 'RAIL' }
    },
    initRouteItineraryDraggable: () => {}
  };

  const wrapped = `
    const { document, window, initRouteItineraryDraggable } = env;
    ${fnMatch[0]}
    renderRouteItineraryRightPanel(landData);
    return mockPanel.innerHTML;
  `;

  const runner = new Function('env', 'landData', 'mockPanel', wrapped);

  // 1) Caso RAIL con checkpoints
  const railData = {
    origin: { displayName: 'Valencia' },
    destination: { displayName: 'Barcelona' },
    distanceKm: 350,
    drivingHours: 4.5,
    isRail: true,
    globalTransportMode: 'RAIL',
    checkpoints: [
      { name: 'València (Estació del Nord)', progress: 0 },
      { name: 'Castelló de la Plana', progress: 25 },
      { name: 'Tarragona Terminal', progress: 70 },
      { name: 'Barcelona Sants', progress: 100 }
    ]
  };

  const railHtml = runner(testEnv, railData, mockPanel);
  assert.ok(railHtml.includes('Nodos Ferroviarios de Paso (Ruta Simulada)'), 'Debe incluir título ferroviario');
  assert.ok(railHtml.includes('València (Estació del Nord)'), 'Debe mostrar origen ferroviario');
  assert.ok(railHtml.includes('Castelló de la Plana'), 'Debe mostrar nodo intermedio');
  assert.ok(railHtml.includes('Barcelona Sants'), 'Debe mostrar destino ferroviario');
  assert.ok(railHtml.includes('100%'), 'Debe incluir progreso 100%');
  assert.ok(railHtml.includes('Progreso en ruta'), 'Debe renderizar barra de progreso en ruta');
  assert.ok(!railHtml.includes('CE 561/2006'), 'No debe referenciar tacógrafo vial en modo tren');

  // 2) Caso ROAD con tacógrafo
  testEnv.window.globalTransportMode = 'ROAD';
  testEnv.window.State = { globalTransportMode: 'ROAD' };
  const roadData = {
    origin: { displayName: 'Madrid' },
    destination: { displayName: 'Sevilla' },
    distanceKm: 530,
    drivingHours: 6.2,
    isRail: false,
    globalTransportMode: 'ROAD',
    tachographMilestones: [
      { milestone: 1, km: 324, drivingHours: 4.5, breakMinutes: 45 }
    ]
  };

  const roadHtml = runner(testEnv, roadData, mockPanel);
  assert.ok(roadHtml.includes('Tacógrafo (CE 561/2006)'), 'Debe incluir título de tacógrafo vial');
  assert.ok(roadHtml.includes('Parada obligatoria de 45 min (CE 561/2006)'), 'Debe incluir parada obligatoria de camión');
});
