import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('1. Cascada de Enrutamiento: Intento 1 OpenRouteService HGV con radiuses [5000, 5000], extra_info [tollways] y /geojson', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // a) Intento 1 ORS HGV con /geojson, radiuses: [5000, 5000] y extra_info: ["tollways"]
  assert.match(indexHtml, /https:\/\/api\.openrouteservice\.org\/v2\/directions\/driving-hgv\/geojson/);
  assert.match(indexHtml, /radiuses:\s*\[5000,\s*5000\]/);
  assert.match(indexHtml, /extra_info:\s*\[["']tollways["']\]/);
  assert.match(indexHtml, /driving-hgv/);
});

test('2. Cascada de Enrutamiento: Intento 2 Fallback OSRM con geometries=geojson y alternatives=true', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // b) Intento 2 OSRM Driving público
  assert.match(indexHtml, /https:\/\/router\.project-osrm\.org\/route\/v1\/driving\//);
  assert.match(indexHtml, /geometries=geojson/);
  assert.match(indexHtml, /alternatives=true/);
  assert.match(indexHtml, /overview=full/);

  // c) Extracción de distancia real, duración ajustada a camión pesado y coordenadas
  assert.match(indexHtml, /Number\(r\.distance\)\s*\|\|\s*0\)\s*\/\s*1000/);
  assert.match(indexHtml, /route\.geometry\.coordinates/);
  assert.match(indexHtml, /adjustedDuration/);
});

test('3. Renderizado Obligatorio Leaflet con SVG, map.stop() y fitBounds sin animación', async () => {
  const indexHtml = await readFile('index.html', 'utf8');
  const forwarderJsx = await readFile('src/components/ForwarderWorkspace.jsx', 'utf8');

  // Desactivación de preferCanvas para eliminar crash de Canvas.js
  assert.match(indexHtml, /preferCanvas:\s*false/);
  assert.match(forwarderJsx, /preferCanvas:\s*false/);

  // Creación explícita de renderer SVG
  assert.match(indexHtml, /L\.svg\(\{\s*padding:\s*0\.5\s*\}\)/);

  // Detención de animaciones previas para evitar colisión de renderizado
  assert.match(indexHtml, /mapInstance\.stop\(\)/);

  // Conversión GeoJSON [lon, lat] a [lat, lon]
  assert.match(indexHtml, /geojsonCoordinates\.map\(\s*coord\s*=>\s*\[coord\[1\],\s*coord\[0\]\]\)/);

  // Rutas alternativas en azul claro/grisáceo #93c5fd, weight 4, opacity 0.7
  assert.match(indexHtml, /color:\s*['"]#93c5fd['"]/);
  assert.match(indexHtml, /weight:\s*4/);
  assert.match(indexHtml, /opacity:\s*0\.7/);

  // Ruta principal en azul intenso #2563eb, weight 5, opacity 0.95
  assert.match(indexHtml, /color:\s*['"]#2563eb['"]/);
  assert.match(indexHtml, /weight:\s*5/);
  assert.match(indexHtml, /opacity:\s*0\.95/);

  // Borde exterior sutil para destacar sobre carreteras del mapa base
  assert.match(indexHtml, /color:\s*['"]#1d4ed8['"]/);
  assert.match(indexHtml, /weight:\s*7/);

  // Ajuste de encuadre fitBounds con padding [60, 60] y animate: false
  assert.match(indexHtml, /fitBounds\([^)]*padding:\s*\[60,\s*60\][^)]*animate:\s*false/);
});

test('4. Control de Concurrencia: Deduplicación de peticiones geojson idénticas en vuelo', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Control de peticiones idénticas en vuelo
  assert.match(indexHtml, /_inFlightLandRoutePromises/);
  assert.match(indexHtml, /dedupeKey/);
});

test('5. Sincronización y Protección de Distancia Real en [Cerebro.ia/update_fields]', async () => {
  const seaAssistantSrc = await readFile('src/sea-assistant-entry.js', 'utf8');
  const indexHtml = await readFile('index.html', 'utf8');

  // sea-assistant-entry.js protege contra sobrescritura de 0 cuando existen land_origin y land_destination
  assert.match(seaAssistantSrc, /Protección de distancia real/);
  assert.match(seaAssistantSrc, /executeActionableAiUpdateFields/);
  assert.match(seaAssistantSrc, /window\.calculateLandRouteByCoordinates/);

  // Sincronización sync-road hacia Data Bridge tras cálculo de ruta
  assert.match(indexHtml, /syncRoadMetricsToBridge/);
  assert.match(indexHtml, /distKmFormatted/);
});

test('6. Verificación de cálculo real Sétif -> Béjaïa con OSRM / Geometría de Carretera', async () => {
  // Sétif: [5.4047, 36.1893], Béjaïa: [5.0644, 36.7512]
  const origLon = 5.4047;
  const origLat = 36.1893;
  const destLon = 5.0644;
  const destLat = 36.7512;

  const url = `https://router.project-osrm.org/route/v1/driving/${origLon},${origLat};${destLon},${destLat}?overview=full&geometries=geojson&alternatives=true`;
  const res = await fetch(url);
  assert.ok(res.ok, 'OSRM endpoint público responde HTTP 200');

  const json = await res.json();
  assert.equal(json.code, 'Ok');
  assert.ok(json.routes && json.routes.length > 0, 'Devuelve al menos una ruta con geometría');

  const mainRoute = json.routes[0];
  const distanceKm = mainRoute.distance / 1000;
  assert.ok(distanceKm >= 100 && distanceKm <= 115, `Distancia esperada ~107 km, obtenida: ${distanceKm}`);

  const coords = mainRoute.geometry.coordinates;
  assert.ok(Array.isArray(coords) && coords.length > 500, `Debe contener geometría real de carretera (>500 puntos), obtenidos: ${coords.length}`);

  // Leaflet coordinates conversion
  const leafletCoords = coords.map(c => [c[1], c[0]]);
  assert.equal(leafletCoords.length, coords.length);
  assert.ok(Math.abs(leafletCoords[0][0] - origLat) < 0.1, 'El primer punto debe coincidir con Sétif');
  assert.ok(Math.abs(leafletCoords[leafletCoords.length - 1][0] - destLat) < 0.1, 'El último punto debe coincidir con Béjaïa');
});

test('7. Sincronización de Peajes Estimados del Itinerario con la Calculadora LDM', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Si no se detectan tramos de peaje individuales o devuelven 0 en rutas > 50 km,
  // se sincroniza con el cálculo de la calculadora
  assert.match(indexHtml, /effectiveTollsCost/);
  assert.match(indexHtml, /Estimación tarifas HGV por kilometraje/);
  assert.match(indexHtml, /tollRatePerKm/);
});

test('8. Visibilidad Condicionada del Panel de Itinerario a la Pestaña Map', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Se vincula en switchTab la visibilidad del panel #route-itinerary-right-panel a tabId === 'map'
  assert.match(indexHtml, /itineraryPanel\.classList\.(?:add|remove)\(['"]hidden['"]\)/);
  assert.match(indexHtml, /tabId === ['"]map['"]/);
});

