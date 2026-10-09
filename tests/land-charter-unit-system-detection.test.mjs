import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isUSLocation,
  detectUnitSystem,
  convertDistance,
  formatDistance,
  getUnitLabels,
  KM_TO_MILES
} from '../src/utils/unitSystemDetector.mjs';

test('1. DETECCIÓN GEOGRÁFICA EE. UU.: Reconocimiento preciso de ciudades, estados y códigos US', () => {
  // Ciudades emblemáticas de EE. UU.
  assert.equal(isUSLocation('New York'), true, 'New York debe detectarse como EE. UU.');
  assert.equal(isUSLocation('Los Angeles, CA'), true, 'Los Angeles, CA debe detectarse como EE. UU.');
  assert.equal(isUSLocation('Chicago, IL'), true, 'Chicago, IL debe detectarse como EE. UU.');
  assert.equal(isUSLocation('Houston, Texas'), true, 'Houston, Texas debe detectarse como EE. UU.');
  assert.equal(isUSLocation('Miami, FL'), true, 'Miami, FL debe detectarse como EE. UU.');
  assert.equal(isUSLocation('Dallas, TX'), true, 'Dallas, TX debe detectarse como EE. UU.');
  assert.equal(isUSLocation('Seattle, WA'), true, 'Seattle, WA debe detectarse como EE. UU.');
  assert.equal(isUSLocation('Atlanta, Georgia'), true, 'Atlanta, Georgia debe detectarse como EE. UU.');

  // Estados completos y códigos postales
  assert.equal(isUSLocation('California'), true, 'California debe detectarse como EE. UU.');
  assert.equal(isUSLocation('Texas'), true, 'Texas debe detectarse como EE. UU.');
  assert.equal(isUSLocation('United States'), true, 'United States debe detectarse como EE. UU.');
  assert.equal(isUSLocation('USA'), true, 'USA debe detectarse como EE. UU.');
  assert.equal(isUSLocation('Port of Houston, USA'), true, 'Port of Houston, USA debe detectarse como EE. UU.');
});

test('2. PRESERVACIÓN DEL RESTO DEL MUNDO (MÉTRICO): Europa, LatAm, África y Asia se mantienen en METRIC', () => {
  // Europa
  assert.equal(isUSLocation('Madrid, España'), false, 'Madrid no es EE. UU.');
  assert.equal(isUSLocation('Paris, France'), false, 'París no es EE. UU.');
  assert.equal(isUSLocation('Berlin, Germany'), false, 'Berlín no es EE. UU.');
  assert.equal(isUSLocation('Lisboa, Portugal'), false, 'Lisboa no es EE. UU.');
  assert.equal(isUSLocation('Roma, Italia'), false, 'Roma no es EE. UU.');

  // Norte de África (Rutas DSS protegidas como Sétif - Béjaïa)
  assert.equal(isUSLocation('Sétif'), false, 'Sétif no es EE. UU.');
  assert.equal(isUSLocation('Béjaïa'), false, 'Béjaïa no es EE. UU.');
  assert.equal(isUSLocation('Argel, Argelia'), false, 'Argel no es EE. UU.');
  assert.equal(isUSLocation('Casablanca, Marruecos'), false, 'Casablanca no es EE. UU.');

  // Latinoamérica
  assert.equal(isUSLocation('Buenos Aires, Argentina'), false, 'Buenos Aires no es EE. UU.');
  assert.equal(isUSLocation('Bogotá, Colombia'), false, 'Bogotá no es EE. UU.');
  assert.equal(isUSLocation('Ciudad de México, México'), false, 'México no es EE. UU.');
  assert.equal(isUSLocation('Valparaíso, Chile'), false, 'Valparaíso no es EE. UU.');

  // Casos nulos o vacíos
  assert.equal(isUSLocation(''), false, 'Cadena vacía no es EE. UU.');
  assert.equal(isUSLocation(null), false, 'Null no es EE. UU.');
  assert.equal(isUSLocation(undefined), false, 'Undefined no es EE. UU.');
});

test('3. SWITCH DINÁMICO IMPERIAL / METRIC: detectUnitSystem asigna IMPERIAL para rutas US y METRIC para resto', () => {
  // Rutas en EE. UU. -> IMPERIAL
  assert.equal(detectUnitSystem('Houston, TX', 'Dallas, TX'), 'IMPERIAL');
  assert.equal(detectUnitSystem('Los Angeles, CA', 'Las Vegas, NV'), 'IMPERIAL');
  assert.equal(detectUnitSystem('New York, NY', 'Chicago, IL'), 'IMPERIAL');
  assert.equal(detectUnitSystem('Miami, FL', ''), 'IMPERIAL');

  // Rutas en Europa / LatAm / África -> METRIC
  assert.equal(detectUnitSystem('Madrid, España', 'Paris, Francia'), 'METRIC');
  assert.equal(detectUnitSystem('Sétif', 'Béjaïa'), 'METRIC');
  assert.equal(detectUnitSystem('Valencia', 'Rotterdam'), 'METRIC');
  assert.equal(detectUnitSystem('Bogotá', 'Medellín'), 'METRIC');
  assert.equal(detectUnitSystem('', ''), 'METRIC');
});

test('4. CONVERSIÓN MATEMÁTICA VISUAL DE DISTANCIA: km * 0.621371 exacta en IMPERIAL y 1:1 en METRIC', () => {
  assert.equal(KM_TO_MILES, 0.621371, 'Factor de conversión matemático oficial debe ser 0.621371');

  const km = 1000;
  const milesCalculated = km * 0.621371;

  // En IMPERIAL se aplica la conversión
  assert.equal(convertDistance(km, 'IMPERIAL'), milesCalculated);
  assert.equal(formatDistance(km, 'IMPERIAL'), '621 mi');

  // En METRIC se mantiene 1:1 en km
  assert.equal(convertDistance(km, 'METRIC'), 1000);
  assert.equal(formatDistance(km, 'METRIC'), '1.000 km');

  // Valores cero o negativos
  assert.equal(convertDistance(0, 'IMPERIAL'), 0);
  assert.equal(convertDistance(-10, 'IMPERIAL'), 0);
});

test('5. ETIQUETAS Y ADAPTACIÓN VISUAL DE LA UI: Peso a Libras (lbs), Moneda $ vs € y Distancia mi vs km', () => {
  const imperialLabels = getUnitLabels('IMPERIAL');
  assert.equal(imperialLabels.isImperial, true);
  assert.equal(imperialLabels.distanceUnit, 'mi');
  assert.equal(imperialLabels.weightUnit, 'lbs');
  assert.equal(imperialLabels.weightInputLabel, 'Libras (lbs)');
  assert.equal(imperialLabels.currencySymbol, '$');
  assert.equal(imperialLabels.costPerDistanceUnit, '$/mi');

  const metricLabels = getUnitLabels('METRIC');
  assert.equal(metricLabels.isImperial, false);
  assert.equal(metricLabels.distanceUnit, 'km');
  assert.equal(metricLabels.weightUnit, 'kg');
  assert.equal(metricLabels.weightInputLabel, 'Toneladas / Kilos');
  assert.equal(metricLabels.currencySymbol, '€');
  assert.equal(metricLabels.costPerDistanceUnit, '€/km');
});

test('6. INTEGRACIÓN EN FORWARDERWORKSPACE: Detección reactiva y etiquetas adaptativas en JSX', () => {
  const workspacePath = path.resolve(process.cwd(), 'src/components/ForwarderWorkspace.jsx');
  const workspaceSource = fs.readFileSync(workspacePath, 'utf8');

  // Importación del detector de unidades
  assert.match(
    workspaceSource,
    /import\s*\{[\s\S]*?detectUnitSystem[\s\S]*?\}\s*from\s*['"]\.\.\/utils\/unitSystemDetector\.js['"]/,
    'ForwarderWorkspace debe importar detectUnitSystem'
  );

  // Instanciación del sistema de unidades en base a landOrigin y landDestination
  assert.match(
    workspaceSource,
    /const\s+unitSystem\s*=\s*detectUnitSystem\(landOrigin,\s*landDestination\);/,
    'ForwarderWorkspace debe evaluar unitSystem con landOrigin y landDestination'
  );

  // Adaptación de la etiqueta del input de distancia a MI / KM
  assert.match(
    workspaceSource,
    /\{isImperial \? 'Distancia Ruta \(MI\)' : 'Distancia Ruta \(KM\)'\}/,
    'Etiqueta de distancia debe alternar entre MI y KM según isImperial'
  );

  // Adaptación de la cabecera de peso unitario a lbs / kg
  assert.match(
    workspaceSource,
    /\{isImperial \? 'Peso Unitario \(lbs\)' : 'Peso Unitario \(kg\)'\}/,
    'Cabecera de peso unitario debe alternar entre lbs y kg'
  );

  // Adaptación de la Tarjeta 2 de distancia
  assert.match(
    workspaceSource,
    /Distancia \(\{isImperial \? 'mi' : 'km'\}\)/,
    'Tarjeta 2 debe mostrar la unidad dinámica mi / km'
  );
  assert.match(
    workspaceSource,
    /Math\.round\(isImperial \? rDistKm \* 0\.621371 : rDistKm\)/,
    'Tarjeta 2 debe aplicar la conversión rDistKm * 0.621371 en modo imperial'
  );
});

test('7. INTEGRACIÓN EN INDEX.HTML: Observador DOM y Panel OSRM con soporte dinámico', () => {
  const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
  const indexSource = fs.readFileSync(indexHtmlPath, 'utf8');

  // Carga del script del observador
  assert.match(
    indexSource,
    /setupLandCharterUnitObserver/,
    'index.html debe cargar e invocar setupLandCharterUnitObserver'
  );

  // Conversión visual en renderRouteItineraryRightPanel
  assert.match(
    indexSource,
    /const\s+isImperialRoute\s*=\s*window\.LandCharterIsImperial\s*\|\|[\s\S]*?detectUnitSystem/,
    'renderRouteItineraryRightPanel debe evaluar si la ruta es imperial'
  );
  assert.match(
    indexSource,
    /const\s+convertedDist\s*=\s*isImperialRoute\s*\?\s*rawDist\s*\*\s*0\.621371\s*:\s*rawDist;/,
    'renderRouteItineraryRightPanel debe aplicar rawDist * 0.621371 en modo imperial'
  );

  // Conversión visual en sync-miles-card
  assert.match(
    indexSource,
    /const\s+isImperialSync\s*=\s*window\.LandCharterIsImperial\s*\|\|[\s\S]*?detectUnitSystem/,
    'runOnDemandMapRouteWorkflow debe detectar isImperialSync'
  );
  assert.match(
    indexSource,
    /const\s+displayDistSync\s*=\s*isImperialSync\s*\?\s*Math\.round\(distanceKm\s*\*\s*0\.621371\)\s*:\s*Math\.round\(distanceKm\);/,
    'runOnDemandMapRouteWorkflow debe convertir distanceKm * 0.621371 para visualización'
  );
});

test('8. PRESERVACIÓN DEL MOTOR CORE: Tacógrafo, OSRM y directivas DSS intactas', () => {
  const policyPath = path.resolve(process.cwd(), 'shared/land-project-policy.mjs');
  const policySource = fs.readFileSync(policyPath, 'utf8');

  // Directivas de cadencia DSS Sétif - Béjaïa protegidas
  assert.match(policySource, /s[eé]tif/i, 'La directiva DSS para Sétif debe preservarse');
  assert.match(policySource, /b[eé]ja[iï]a/i, 'La directiva DSS para Béjaïa debe preservarse');

  // Lógica de tacógrafo en index.html protegida (horas de conducción y descansos puros)
  const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
  const indexSource = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.match(indexSource, /horas_conduccion_pura\s*=\s*distancia_total\s*\/\s*velocidad_media/);
  assert.match(indexSource, /pausas_45m\s*=\s*Math\.floor\(horas_conduccion_pura\s*\/\s*4\.5\)/);
});
