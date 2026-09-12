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

test('4. El motor nativo actualiza la UI visual con curva geodésica intermitente, el zoom y el panel de itinerario', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Curva geodésica en Leaflet estilo vuelo con línea intermitente (#0f766e, dashed)
  assert.match(indexHtml, /calculateCurvedRoutePoints/);
  assert.match(indexHtml, /L\.polyline\(curvePoints/);
  assert.match(indexHtml, /color:\s*['"]#0f766e['"]/);
  assert.match(indexHtml, /weight:\s*3/);
  assert.match(indexHtml, /dashArray:\s*['"]10,\s*10['"]/);
  assert.match(indexHtml, /opacity:\s*0\.8/);

  // Ajuste de zoom con fitBounds utilizando los dos puntos (Origen y Destino)
  assert.match(indexHtml, /mapInstance\.fitBounds\(\s*\[\s*\[polCoords\.lat,\s*polCoords\.lon\],\s*\[podCoords\.lat,\s*podCoords\.lon\]\s*\]/);

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

test('9. calculateCurvedRoutePoints genera una curva suave estilo vuelo con curvatura hacia el norte', async () => {
  const indexHtml = await readFile('index.html', 'utf8');
  assert.match(indexHtml, /window\.calculateCurvedRoutePoints\s*=\s*calculateCurvedRoutePoints/);

  // Extraer y evaluar calculateCurvedRoutePoints para verificar la matemática
  const fnMatch = indexHtml.match(/function calculateCurvedRoutePoints\([\s\S]*?return points;\s*\}/);
  assert.ok(fnMatch, 'calculateCurvedRoutePoints debe estar definida');

  const evalFn = new Function(`${fnMatch[0]}; return calculateCurvedRoutePoints;`)();
  const moriles = [37.4354, -4.6096];
  const prat = [41.3275, 2.0959];
  const points = evalFn(moriles, prat, 50);

  assert.equal(points.length, 51);
  assert.equal(points[0][0], moriles[0]);
  assert.equal(points[0][1], moriles[1]);
  assert.equal(points[points.length - 1][0], prat[0]);
  assert.equal(points[points.length - 1][1], prat[1]);

  // El punto intermedio debe tener mayor latitud que el punto medio de la línea recta (arco norte)
  const midpoint = points[Math.floor(points.length / 2)];
  const straightMidLat = (moriles[0] + prat[0]) / 2;
  assert.ok(midpoint[0] > straightMidLat, 'El arco de vuelo debe elevarse sobre el segmento recto');
});
