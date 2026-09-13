import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('1. Sustitución del Mapa: LazyGlobeMap y Leaflet 2D con Polyline y Marcadores Minimalistas', async () => {
  const packageJsonSource = await readFile('package.json', 'utf8');
  const pkg = JSON.parse(packageJsonSource);
  assert.ok(pkg.dependencies.leaflet, 'leaflet debe estar en dependencies');
  assert.ok(pkg.dependencies['react-leaflet'], 'react-leaflet debe estar en dependencies');

  const lazyGlobeSource = await readFile('src/components/LazyGlobeMap.tsx', 'utf8');
  assert.match(lazyGlobeSource, /from ['"]react-leaflet['"]/);
  assert.match(lazyGlobeSource, /<MapContainer/);
  assert.match(lazyGlobeSource, /center=\{\s*\[\s*50\.5,\s*10\.5\s*\]\s*\}/);
  assert.match(lazyGlobeSource, /<TileLayer/);
  assert.match(lazyGlobeSource, /import ['"]leaflet\/dist\/leaflet\.css['"]/);

  // React Leaflet Polyline y Marcadores
  assert.match(lazyGlobeSource, /<Polyline/);
  assert.match(lazyGlobeSource, /#0f766e/);
  assert.match(lazyGlobeSource, /weight:\s*5/);
  assert.match(lazyGlobeSource, /fitBounds/);
  assert.match(lazyGlobeSource, /L\.divIcon/);
  assert.match(lazyGlobeSource, /border:\s*2px solid/);
  assert.match(lazyGlobeSource, /<Marker/);

  const indexSource = await readFile('index.html', 'utf8');
  assert.match(indexSource, /L\.map\('map-container'/);
  assert.match(indexSource, /center:\s*\[50\.5,\s*10\.5\]/);
  assert.match(indexSource, /tile\.openstreetmap\.org/);
  // Vanilla Leaflet Polyline & minimal dots
  assert.match(indexSource, /color:\s*['"]#0f766e['"]/);
  assert.match(indexSource, /weight:\s*5/);
  assert.match(indexSource, /minimal-route-dot/);
  assert.match(indexSource, /map\.fitBounds/);
});

test('2. Módulo 1 (Inputs): Origen/Destino, Nominatim y OSRM', async () => {
  const indexSource = await readFile('index.html', 'utf8');
  assert.match(indexSource, /<label[^>]*data-i18n="map_label_pol"[^>]*>\s*Origen\s*<\/label>/);
  assert.match(indexSource, /<label[^>]*data-i18n="map_label_pod"[^>]*>\s*Destino\s*<\/label>/);
  
  // Laycan inputs hidden from view
  assert.match(indexSource, /<div class="grid grid-cols-1 md:grid-cols-2 gap-3 hidden"\s+style="display:\s*none;">\s*<div class="input-group">\s*<label>Laydays \(Inicio\)<\/label>/);

  // Puerto previo (Lastre) eliminado permanentemente
  assert.doesNotMatch(indexSource, /<input[^>]*id="map-port-ballast"/);
  assert.doesNotMatch(indexSource, /sync-ballast-label/);

  // Tarjetas de resumen en km
  assert.match(indexSource, /<span class="block text-slate-500 uppercase">Kilómetros<\/span>/);
  assert.match(indexSource, /id="sync-miles-label">0 km<\/strong>/);

  // Nominatim y OSRM
  assert.match(indexSource, /https:\/\/nominatim\.openstreetmap\.org\/search\?q=/);
  assert.match(indexSource, /https:\/\/router\.project-osrm\.org\/route\/v1\/driving\//);
  assert.match(indexSource, /Math\.round\(distanceMeters \/ 1000\)/);

  // RouteConfigurator React component
  const routeConfiguratorSource = await readFile('src/components/RouteConfigurator.tsx', 'utf8');
  assert.match(routeConfiguratorSource, /selection\.role === 'POL' \? 'Origen' : selection\.role === 'POD' \? 'Destino' : selection\.role/);
  // Button Confirmar Charter Party hidden from view
  assert.match(routeConfiguratorSource, /confirmCharterParty\(\)[\s\S]*className="[^"]*hidden"[\s\S]*style=\{\{\s*display:\s*['"]none['"]\s*\}\}/);
});

test('3. Módulo 2 (Especificaciones): Nombre del Buque -> Tipo de Vehículo, Capacidad DWT -> Carga Útil (TM), y campos marítimos ocultos del DOM', async () => {
  const indexSource = await readFile('index.html', 'utf8');
  // Visual labels
  assert.match(indexSource, /<span id="label-vessel-name-real">Tipo de Vehículo<\/span>/);
  assert.match(indexSource, /<label id="label-vessel-dwt"[^>]*>Carga Útil \(TM\)<\/label>/);

  // Hidden inputs in Module 2: Scrubber, Velocidad Lastre, IMO, Bandera, Año, Calado
  assert.match(indexSource, /<div class="input-group hidden" style="display: none;">\s*<label for="vessel-has-scrubber-no"/);
  assert.match(indexSource, /<div class="input-group hidden" style="display: none;">\s*<label id="label-spd-ballast"/);
  assert.match(indexSource, /<div class="[^"]*hidden" style="display: none;">\s*<span[^>]*>IMO:<\/span>/);
  assert.match(indexSource, /<div class="[^"]*hidden" style="display: none;">\s*<span[^>]*>BANDERA:<\/span>/);
  assert.match(indexSource, /<div class="[^"]*hidden" style="display: none;">\s*<span[^>]*>AÑO:<\/span>/);
  assert.match(indexSource, /<div class="input-group hidden" style="display: none;">\s*<label id="label-current-draft"/);

  // TceCalculatorWorkspace React component
  const tceWorkspaceSource = await readFile('TceCalculatorWorkspace.tsx', 'utf8');
  assert.match(tceWorkspaceSource, /Carga Útil \(TM\)/);
  assert.match(tceWorkspaceSource, /<div className="min-w-\[16rem\] hidden" style=\{\{\s*display:\s*['"]none['"]\s*\}\}>/);
});

test('4. Módulo 3 (Costes): OPEX -> Costes Fijos (Chófer/Amort.) y PDAs -> Peajes y Dietas', async () => {
  const indexSource = await readFile('index.html', 'utf8');
  assert.match(indexSource, /<span id="label-opex-cost-basis"[^>]*>Costes Fijos \(Chófer\/Amort\.\) Total:<\/span>/);
  assert.match(indexSource, /<span id="label-pda-cost-basis"[^>]*>Peajes y Dietas <button/);
  assert.match(indexSource, /Costes Fijos \(Chófer\/Amort\.\)/);
  assert.match(indexSource, /Peajes y Dietas Diluido/);
  assert.match(indexSource, /Peajes y Dietas base: (\$0|0 €)/);

  // TceCalculatorWorkspace React component
  const tceWorkspaceSource = await readFile('TceCalculatorWorkspace.tsx', 'utf8');
  assert.match(tceWorkspaceSource, /Costes Fijos \(Chófer\/Amort\.\)/);
  assert.match(tceWorkspaceSource, /Peajes y Dietas/);
});
