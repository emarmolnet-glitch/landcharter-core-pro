import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const dataBridgeSource = await readFile(new URL('../public/databridge.html', import.meta.url), 'utf8');
const loaderSource = await readFile(new URL('../src/map-cartography-loader.js', import.meta.url), 'utf8');
const splashSource = await readFile(new URL('../src/global-splash-screen.js', import.meta.url), 'utf8');
const forwarderComponentSource = await readFile(new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url), 'utf8');

test('1. Error bloqueante eliminado: No hay ninguna llamada ni definición residual a hydrateBunkerIndexData', () => {
  assert.doesNotMatch(indexSource, /hydrateBunkerIndexData/);
  assert.doesNotMatch(indexSource, /applyHydratedBunkers/);
});

test('2. Purga de density-globe.css y datalastic-credit-counter.css', () => {
  assert.doesNotMatch(indexSource, /density-globe\.css/);
  assert.doesNotMatch(indexSource, /datalastic-credit-counter\.css/);
  assert.doesNotMatch(dataBridgeSource, /density-globe\.css/);
  assert.doesNotMatch(dataBridgeSource, /datalastic-credit-counter\.css/);
  assert.doesNotMatch(loaderSource, /density-globe\.css/);
});

test('3. Actualización de texto en la Pantalla de Carga (Loading Screen)', () => {
  assert.doesNotMatch(indexSource, /Iniciando motor cartográfico y datos AIS\.\.\./);
  assert.match(indexSource, /Iniciando motor de rutas terrestres \(OSRM\)\.\.\./);
});

test('4. Inicialización no bloqueante y soporte de lienzo 2D Leaflet en controlador de arranque', () => {
  assert.match(splashSource, /mapContainer\.querySelector\('\.leaflet-container'\)|mapContainer\.classList\.contains\('leaflet-container'\)/);
  assert.match(forwarderComponentSource, /fetch\(getApiUrl\('\/\.netlify\/functions\/forwarder-projects'\)/);
  // Verify error in forwarder projects fetch does not throw blocking error
  assert.match(forwarderComponentSource, /console\.warn\('\[ForwarderWorkspace\]/);
});

test('5. Sin SyntaxError ni bloques try huérfanos en scripts de index.html', () => {
  // Tacografo block is properly closed
  assert.doesNotMatch(indexSource, /autoTacografo = 'true';\s*\}\s*deltaInput\.value/);
});

