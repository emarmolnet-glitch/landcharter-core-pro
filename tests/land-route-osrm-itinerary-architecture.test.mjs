import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('1. Flujo Global y Dinámico en index.html (runOnDemandMapRouteWorkflow)', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Input geográfico dinámico
  assert.match(indexHtml, /const polInput = document\.getElementById\('map-port-pol'\) \|\| document\.getElementById\('port-pol'\)/);
  assert.match(indexHtml, /const podInput = document\.getElementById\('map-port-pod'\) \|\| document\.getElementById\('port-pod'\)/);

  // Geocodificación dinámica universal
  assert.match(indexHtml, /const resolvedPol = await getCoordinates\(pol\)/);
  assert.match(indexHtml, /const resolvedPod = await getCoordinates\(pod\)/);

  // Consulta OSRM con endpoints redundantes y steps=true&geometries=geojson
  assert.match(
    indexHtml,
    /https:\/\/router\.project-osrm\.org\/route\/v1\/driving\//
  );
  assert.match(
    indexHtml,
    /https:\/\/routing\.openstreetmap\.de\/routed-car\/route\/v1\/driving\//
  );
  assert.match(
    indexHtml,
    /\$\{baseUrl\}\$\{polCoords\.lon\},\$\{polCoords\.lat\};\$\{podCoords\.lon\},\$\{podCoords\.lat\}\?overview=full&geometries=geojson&steps=true/
  );

  // Failsafe Haversine
  assert.match(indexHtml, /const R = 6371;/);
  assert.match(indexHtml, /straightKm \* 1000 \* 1\.3/);
});

test('2. Enriquecimiento de routeSteps (Peajes y Tacógrafo) y almacenamiento en window.LandData', async () => {
  const indexHtml = await readFile('index.html', 'utf8');
  const fnStart = indexHtml.indexOf('async function runOnDemandMapRouteWorkflow');
  const fnEnd = indexHtml.indexOf('window.runOnDemandMapRouteWorkflow = runOnDemandMapRouteWorkflow;', fnStart);
  const fnCode = indexHtml.slice(fnStart, fnEnd);

  // Itera sobre steps acumulando distancia y tiempo
  assert.match(fnCode, /accumulatedDistanceMeters \+= stepDistMeters/);
  assert.match(fnCode, /accumulatedDurationSeconds \+= stepDurSeconds/);

  // Detección automática de peajes (Autopista, AP-, Peaje, Toll) a 0.19€/km
  assert.match(fnCode, /\/\(\?:autopista\|ap-\|peaje\|toll\)\/i/);
  assert.match(fnCode, /stepDistKm \* 0\.19/);

  // Hitos obligatorios de tacógrafo cada 4.5h con parada obligatoria de 45 minutos
  assert.match(fnCode, /nextTachographThresholdHours = 4\.5/);
  assert.match(fnCode, /breakMinutes:\s*45/);
  assert.match(fnCode, /Tacógrafo CE 561\/2006/);

  // Guarda la estructura en window.LandData
  assert.match(fnCode, /window\.LandData = \{/);
  assert.match(fnCode, /totalTollsCost/);
  assert.match(fnCode, /tollBreakdown/);
  assert.match(fnCode, /tachographMilestones/);
  assert.match(fnCode, /routeSteps: enrichedRouteSteps/);
});

test('3. Renderizado Nativo de Alta Visibilidad en el Mapa (LazyGlobeMap.tsx y Leaflet)', async () => {
  const lazyGlobeSource = await readFile('src/components/LazyGlobeMap.tsx', 'utf8');
  const indexHtml = await readFile('index.html', 'utf8');

  // Exposición de GlobalLeafletMap
  assert.match(lazyGlobeSource, /\(window as any\)\.GlobalLeafletMap = map;/);
  assert.match(indexHtml, /window\.GlobalLeafletMap = map;/);

  // Limpieza de polilíneas y trazo con API nativa L.polyline en color azul eléctrico
  assert.match(lazyGlobeSource, /L\.polyline\(allLatLngs,\s*\{[\s\S]*color:\s*['"]#2563eb['"],[\s\S]*weight:\s*6,[\s\S]*opacity:\s*1\.0,[\s\S]*lineCap:\s*['"]round['"],[\s\S]*lineJoin:\s*['"]round['"],[\s\S]*className:\s*['"]leaflet-route-highlight['"][\s\S]*\}\)/);
  assert.match(lazyGlobeSource, /polyline\.addTo\(mapInstance\);/);
  assert.match(lazyGlobeSource, /mapInstance\.fitBounds\(polyline\.getBounds\(\),\s*\{\s*padding:\s*\[50,\s*50\]\s*\}\);/);

  // Regla CSS inyectada en el <head>
  assert.match(indexHtml, /\.leaflet-route-highlight\s*\{[\s\S]*stroke:\s*#2563eb !important;[\s\S]*stroke-width:\s*6px !important;[\s\S]*stroke-opacity:\s*1 !important;[\s\S]*fill:\s*none !important;[\s\S]*\}/);
});

test('4. Panel de Itinerario Fijo a la Derecha (#route-itinerary-right-panel)', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Contenedor persistente fijo a la derecha
  assert.match(
    indexHtml,
    /fixed top-24 right-4 z-\[99999\] w-80 bg-white shadow-2xl rounded-xl p-4 border border-slate-200 font-sans text-slate-800/
  );
  assert.match(indexHtml, /id="route-itinerary-right-panel"/);

  // Componentes requeridos en el panel
  assert.match(indexHtml, /function renderRouteItineraryRightPanel\(landData\)/);
  assert.match(indexHtml, /📍 Origen:/);
  assert.match(indexHtml, /🏁 Destino:/);
  assert.match(indexHtml, /🛣️ Distancia Total/);
  assert.match(indexHtml, /⏱️ Conducción/);
  assert.match(indexHtml, /☕ Tacógrafo \(CE 561\/2006\)/);
  assert.match(indexHtml, /💶 Peajes Estimados/);
});

test('5. Verificación Funcional del Motor de Enriquecimiento (Peajes y Tacógrafo)', () => {
  // Simulación de cálculo paso a paso como en runOnDemandMapRouteWorkflow
  const mockSteps = [
    { name: 'Calle Mayor', distance: 5000, duration: 600 },
    { name: 'Autopista AP-7', distance: 120000, duration: 4200 },
    { name: 'Autovía A-3', distance: 250000, duration: 9000 },
    { name: 'AP-6 Peaje Guadarrama', distance: 60000, duration: 2500 },
    { name: 'Carretera Nacional', distance: 80000, duration: 3600 }
  ];

  let accumulatedDistMeters = 0;
  let accumulatedDurSeconds = 0;
  let totalTollsCost = 0;
  const tollBreakdown = [];
  const tachographMilestones = [];
  let nextThreshold = 4.5;

  const enriched = mockSteps.map((step, idx) => {
    const distKm = step.distance / 1000;
    const durHours = step.duration / 3600;
    accumulatedDistMeters += step.distance;
    accumulatedDurSeconds += step.duration;
    const accKm = accumulatedDistMeters / 1000;
    const accHours = accumulatedDurSeconds / 3600;

    const isToll = /(?:autopista|ap-|peaje|toll)/i.test(step.name);
    let tollCost = 0;
    if (isToll) {
      tollCost = Math.round(distKm * 0.19 * 100) / 100;
      totalTollsCost += tollCost;
      tollBreakdown.push({ name: step.name, distanceKm: distKm, costEur: tollCost });
    }

    while (accHours >= nextThreshold) {
      tachographMilestones.push({
        milestone: tachographMilestones.length + 1,
        km: Math.round(accKm),
        drivingHours: nextThreshold,
        breakMinutes: 45
      });
      nextThreshold += 4.5;
    }

    return { ...step, isToll, tollCost, accKm, accHours };
  });

  totalTollsCost = Math.round(totalTollsCost * 100) / 100;

  // Verificaciones
  assert.equal(tollBreakdown.length, 2); // AP-7 y AP-6
  assert.equal(tollBreakdown[0].costEur, Math.round(120 * 0.19 * 100) / 100);
  assert.equal(tollBreakdown[1].costEur, Math.round(60 * 0.19 * 100) / 100);
  assert.equal(totalTollsCost, Math.round((120 * 0.19 + 60 * 0.19) * 100) / 100);

  // Total durHours = (600 + 4200 + 9000 + 2500 + 3600) / 3600 = 19900 / 3600 = 5.52h
  // Por lo tanto, debe cruzar al menos un hito de 4.5h
  assert.ok(tachographMilestones.length >= 1);
  assert.equal(tachographMilestones[0].milestone, 1);
  assert.equal(tachographMilestones[0].breakMinutes, 45);
  assert.equal(tachographMilestones[0].drivingHours, 4.5);
});
