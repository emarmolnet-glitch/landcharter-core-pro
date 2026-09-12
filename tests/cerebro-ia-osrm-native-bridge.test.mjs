import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('1. index.html expone las funciones nativas de cálculo en window para Cerebro IA / React', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Comprobación de funciones nativas expuestas globalmente
  assert.match(indexHtml, /window\.calculateLandRouteByCoordinates\s*=\s*calculateLandRouteByCoordinates/);
  assert.match(indexHtml, /window\.calculateLandRoute\s*=\s*calculateLandRouteByCoordinates/);
  assert.match(indexHtml, /window\.calculateOsrmRoute\s*=\s*calculateLandRouteByCoordinates/);
  assert.match(indexHtml, /window\.calculateOpenRouteService\s*=\s*calculateLandRouteByCoordinates/);
  assert.match(indexHtml, /window\.runOnDemandMapRouteWorkflow\s*=\s*runOnDemandMapRouteWorkflow/);
});

test('2. runOnDemandMapRouteWorkflow y calculateLandRouteByCoordinates aceptan coordenadas directamente', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Soporta bypass de inputs leyendo coordenadas directas de los argumentos
  assert.match(indexHtml, /const normalizeCoord\s*=\s*\(input,\s*fallbackName\)\s*=>/);
  assert.match(indexHtml, /Number\.isFinite\(lat\)\s*&&\s*Number\.isFinite\(lon\)/);
  assert.match(indexHtml, /directPol\s*=\s*normalizeCoord\(overridePol,\s*['"]Origen['"]\)/);
  assert.match(indexHtml, /directPod\s*=\s*normalizeCoord\(overridePod,\s*['"]Destino['"]\)/);

  // Exposición directa de calculateLandRouteByCoordinates
  assert.match(indexHtml, /async function calculateLandRouteByCoordinates\(originCoords,\s*destCoords/);
});

test('3. ForwarderWorkspace invoca la función nativa directamente sin hacks ni clics simulados en el DOM', async () => {
  const forwarderJsx = await readFile('src/components/ForwarderWorkspace.jsx', 'utf8');

  // No debe simular clics en el botón nativo para el cálculo de Cerebro IA
  assert.doesNotMatch(forwarderJsx, /btnMapNative\.click\(\)/, 'No debe existir simulación de clics sintéticos');

  // Invocación directa a la función expuesta en window
  assert.match(forwarderJsx, /window\.calculateLandRouteByCoordinates/);
  assert.match(forwarderJsx, /routeFn\(originData\s*\|\|\s*aiPol,\s*destData\s*\|\|\s*aiPod\)/);
});

test('4. El motor nativo actualiza la UI visual, el zoom y el panel de itinerario', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Trazado de ruta en Leaflet y ajuste de zoom con fitBounds
  assert.match(indexHtml, /L\.polyline\(leafletRoutePoints/);
  assert.match(indexHtml, /mapInstance\.fitBounds\(polyline\.getBounds\(\),\s*\{\s*padding:\s*\[50,\s*50\]\s*\}\)/);

  // Renderizado del panel de itinerario persistente (#route-itinerary-right-panel)
  assert.match(indexHtml, /renderRouteItineraryRightPanel\(window\.LandData\)/);

  // Disparo del evento global osrm:route-updated con la información enriquecida
  assert.match(indexHtml, /window\.dispatchEvent\(new CustomEvent\('osrm:route-updated'/);
  assert.match(indexHtml, /landData:\s*window\.LandData/);
});

test('5. Data-binding de la distancia terrestre al ecosistema global y tarjeta unificada', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Propagación de distancia al Estado global y stores
  assert.match(indexHtml, /State\.totalMiles\s*=\s*distanceKm;/);
  assert.match(indexHtml, /State\.distLaden\s*=\s*distanceKm;/);
  assert.match(indexHtml, /window\.currentCalculatedDistance\s*=\s*distanceKm;/);
  assert.match(indexHtml, /GlobalStore\.totalMiles\s*=\s*distanceKm;/);
  assert.match(indexHtml, /GlobalStore\.distLaden\s*=\s*distanceKm;/);

  // Sincronización de inputs clave (dist-laden, dist-total)
  assert.match(indexHtml, /\['dist-total',\s*'dist-laden',\s*'input-distance-km'\]/);

  // Actualización directa de la tarjeta de KILÓMETROS
  assert.match(indexHtml, /document\.getElementById\('sync-miles-label'\)/);
  assert.match(indexHtml, /document\.getElementById\('sync-miles-card'\)/);
  assert.match(indexHtml, /document\.getElementById\('sync-miles-breakdown'\)/);
});

test('6. Sincronización del display_name completo de Nominatim en inputs visuales', async () => {
  const indexHtml = await readFile('index.html', 'utf8');
  const forwarderJsx = await readFile('src/components/ForwarderWorkspace.jsx', 'utf8');

  // Nominatim display_name en index.html
  assert.match(indexHtml, /\['map-port-pol',\s*'port-pol'\]\.forEach/);
  assert.match(indexHtml, /\['map-port-pod',\s*'port-pod'\]\.forEach/);
  assert.match(indexHtml, /el\.value\s*=\s*polDisplayName/);
  assert.match(indexHtml, /el\.value\s*=\s*podDisplayName/);

  // ForwarderWorkspace también actualiza inputs con el display_name completo
  assert.match(forwarderJsx, /\['map-port-pol',\s*'port-pol'\]\.forEach/);
  assert.match(forwarderJsx, /\['map-port-pod',\s*'port-pod'\]\.forEach/);
  assert.match(forwarderJsx, /el\.value\s*=\s*polLabel/);
  assert.match(forwarderJsx, /el\.value\s*=\s*podLabel/);
});

test('7. calculateVoyageRouteService y recalculateAdjustedAndSave reconocen rutas terrestres y LandData', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // calculateVoyageRouteService lee LandData para no fallar en rutas terrestres
  assert.match(indexHtml, /if\s*\(window\.LandData\s*&&\s*\(window\.LandData\.totalKilometers\s*\|\|\s*window\.LandData\.distanceKm\)\)/);

  // recalculateAdjustedAndSave busca en map-port-pol y State como fallback seguro
  assert.match(indexHtml, /document\.getElementById\('map-port-pol'\)\?\.value/);
  assert.match(indexHtml, /document\.getElementById\('map-port-pod'\)\?\.value/);
});

test('8. Cierre forzado del autocompletado y desenfoque programático en inputs de ruta', async () => {
  const indexHtml = await readFile('index.html', 'utf8');
  const forwarderJsx = await readFile('src/components/ForwarderWorkspace.jsx', 'utf8');

  // Desenfocar inputs (blur) en index.html y ForwarderWorkspace
  assert.match(indexHtml, /el\.blur\(\)/);
  assert.match(forwarderJsx, /el\.blur\(\)/);

  // Ocultar contenedores de sugerencias y cerrar lista de autocompletado
  assert.match(indexHtml, /forceCloseAutocompleteDropdowns/);
  assert.match(indexHtml, /closePortAutocomplete\(el\)/);
  assert.match(indexHtml, /\.port-autocomplete-menu/);
  assert.match(indexHtml, /menu\.style\.display\s*=\s*['"]none['"]/);
  assert.match(forwarderJsx, /\.port-autocomplete-menu/);
  assert.match(forwarderJsx, /menu\.style\.display\s*=\s*['"]none['"]/);
});
