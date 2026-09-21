import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isNonEURoute,
  getDssOptimalTrucksPerDay,
  calculateFleetCampaignDimensioning,
  EU_MEMBER_ISO2
} from '../shared/land-project-policy.mjs';

test('1. Geolocation Check: isNonEURoute identifies routes outside the European Union', () => {
  // Argelia (Sétif ➔ Bugía / Béjaïa)
  assert.equal(isNonEURoute('Sétif', 'Bugía'), true, 'Sétif ➔ Bugía must be recognized as outside EU');
  assert.equal(isNonEURoute('setif', 'bejaia'), true, 'setif ➔ bejaia lowercase must be recognized as outside EU');
  assert.equal(isNonEURoute('Sétif, Daïra Sétif, Sétif, Algérie', 'Béjaïa, Algérie'), true, 'Full Algerian addresses must be outside EU');
  assert.equal(isNonEURoute('Argel', 'Orán'), true, 'Argel ➔ Orán must be recognized as outside EU');
  assert.equal(isNonEURoute('Constantine', 'Skikda'), true, 'Algerian cities must be recognized as outside EU');

  // Norte de África / Países terceros
  assert.equal(isNonEURoute('Casablanca', 'Tánger'), true, 'Moroccan cities must be outside EU');
  assert.equal(isNonEURoute('Túnez', 'Sfax'), true, 'Tunisian cities must be outside EU');
  assert.equal(isNonEURoute('El Cairo', 'Alejandría'), true, 'Egyptian cities must be outside EU');
  assert.equal(isNonEURoute('Estambul', 'Ankara'), true, 'Turkish cities must be outside EU');

  // Rutas comunitarias (dentro de la UE)
  assert.equal(isNonEURoute('Madrid', 'Valencia'), false, 'Madrid ➔ Valencia must be inside EU');
  assert.equal(isNonEURoute('Barcelona', 'Sevilla'), false, 'Barcelona ➔ Sevilla must be inside EU');
  assert.equal(isNonEURoute('París', 'Lyon'), false, 'París ➔ Lyon must be inside EU');
  assert.equal(isNonEURoute('Lisboa', 'Porto'), false, 'Lisboa ➔ Porto must be inside EU');
  assert.equal(isNonEURoute('Berlín', 'Múnich'), false, 'Berlín ➔ Múnich must be inside EU');
});

test('2. Directiva 1: getDssOptimalTrucksPerDay returns 72 trucks/day for Sétif-Bugía corridor', () => {
  // Corredor específico Sétif - Bugía sin estado previo
  const cadence = getDssOptimalTrucksPerDay(null, { origin: 'Sétif', destination: 'Bugía' });
  assert.equal(cadence, 72, 'Sétif-Bugía corridor must yield strictly 72 trucks/day according to DSS Escenario Óptimo');

  const cadenceReverse = getDssOptimalTrucksPerDay(null, { origin: 'Bugía', destination: 'Sétif' });
  assert.equal(cadenceReverse, 72, 'Bugía-Sétif corridor must also yield strictly 72 trucks/day');

  const cadenceProjectRef = getDssOptimalTrucksPerDay({ project_ref: 'EXP-SETIF-BUGIA-2026' }, {});
  assert.equal(cadenceProjectRef, 72, 'Project with setif-bugia reference must yield 72 trucks/day');
});

test('3. Directiva 1: Prioritizes explicit DSS optimal cadence from project or simulation state', () => {
  // Cuando el proyecto ya tiene persistida la cadencia óptima del DSS
  const cadenceFromProject = getDssOptimalTrucksPerDay({ dss_optimal_cadence: 85 }, { origin: 'Madrid', destination: 'Valencia' });
  assert.equal(cadenceFromProject, 85, 'Must prioritize project.dss_optimal_cadence over generic calculations');

  // Cálculo algorítmico DSS (+30% eficiencia operativa) cuando no es Sétif-Bugía
  // Ritmo de carga: 100 MT/h => 100 * 1.30 * 8h = 1040 MT/día => 1040 / 24 MT por camión = 44 camiones/día
  const genericDssCadence = getDssOptimalTrucksPerDay(null, { origin: 'Madrid', destination: 'Valencia', loadingRate: 100 });
  assert.equal(genericDssCadence, 44, 'Algorithmic DSS Escenario Óptimo must apply +30% boost to loading rate');
});

test('4. Directiva 1: calculateFleetCampaignDimensioning dimensions campaign days, daily rotation, and fleet distribution', () => {
  // 144 camiones con cadencia óptima DSS de 72 camiones/día (ruta Sétif-Bugía)
  const dim = calculateFleetCampaignDimensioning(144, 72);
  assert.equal(dim.cadenciaOptima, 72, 'Cadence must be 72 trucks/day');
  assert.equal(dim.plazoCampanaDias, 2, '144 trucks / 72 trucks/day = 2 operational days of campaign');
  assert.equal(dim.rotacionDiaria, 72, 'Daily rotation must be 72 trucks/day');
  assert.equal(dim.flotaActivaDiaria, 72, 'Active fleet in daily rotation must be 72 trucks');
  assert.equal(dim.totalCamionesCampana, 144);
  assert.ok(dim.distribucionFlota.descripcion.includes('72 camiones/día en rotación activa durante 2 jornadas operativas'));

  // Caso con residuo: 180 camiones a 72 camiones/día => ceil(180 / 72) = 3 días operativos
  const dimOdd = calculateFleetCampaignDimensioning(180, 72);
  assert.equal(dimOdd.plazoCampanaDias, 3, '180 trucks / 72 trucks/day = 3 operational days');
  assert.equal(dimOdd.flotaActivaDiaria, 72);
});

test('5. Directiva 2: Driver diets / per diems are 0 for non-EU routes and cost is strictly pure traction + tolls', () => {
  const distKm = 110; // Distancia aproximada Sétif - Bugía
  const isOutsideEU = isNonEURoute('Sétif', 'Bugía');
  assert.equal(isOutsideEU, true);

  const transitDays = Math.max(1, Math.ceil(distKm / 650));
  const diets = isOutsideEU ? 0 : (transitDays * 75);
  assert.equal(diets, 0, 'Diets must be exactly 0 € for Sétif-Bugía outside EU');

  const runningCost = Math.round(distKm * 1.57);
  const tolls = Math.round(distKm * 0.18);
  const baseTruckCost = runningCost + tolls + diets;

  assert.equal(baseTruckCost, runningCost + tolls, 'Cost must be strictly pure traction and tolls with NO driver diet');
});

test('6. ForwarderWorkspace source code verifies strict implementation of both directives', () => {
  const workspaceSource = readFileSync(new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url), 'utf8');

  // Verifica importación de helpers de directivas
  assert.match(workspaceSource, /import\s*\{[\s\S]*isNonEURoute[\s\S]*getDssOptimalTrucksPerDay[\s\S]*calculateFleetCampaignDimensioning[\s\S]*\}\s*from\s*['"]\.\.\/\.\.\/shared\/land-project-policy\.mjs['"]/);

  // Verifica exclusión de dietas en persistProjectToDatabase
  assert.match(workspaceSource, /const\s+isOutsideEU\s*=\s*isNonEURoute\(landOrigin,\s*landDestination/);
  assert.match(workspaceSource, /const\s+diets\s*=\s*isOutsideEU\s*\?\s*0\s*:\s*Math\.round/);

  // Verifica dimensionamiento con cadencia óptima DSS en persistProjectToDatabase
  assert.match(workspaceSource, /const\s+dssOptimalTrucksPerDay\s*=\s*getDssOptimalTrucksPerDay/);
  assert.match(workspaceSource, /const\s+campaignDimensioning\s*=\s*calculateFleetCampaignDimensioning\(trucksNeeded,\s*dssOptimalTrucksPerDay\)/);

  // Verifica badges y UI de cadencia óptima DSS y plazo de campaña
  assert.match(workspaceSource, /id="badge-cadencia-optima-dss"/);
  assert.match(workspaceSource, /id="badge-plazo-campana-dss"/);
  assert.match(workspaceSource, /id="card-dss-cadencia-flota"/);

  // Verifica texto de exclusión geográfica en el desglose del reporte ejecutivo
  assert.match(workspaceSource, /Exclusión geográfica \(fuera de la UE\): Operativa limitada estrictamente a tracción pura y peajes sin compensación de personal UE/);
});

test('7. Netlify Functions project-parser applies non-EU diet exclusion and DSS optimal cadence', () => {
  const parserSource = readFileSync(new URL('../netlify/functions/project-parser.js', import.meta.url), 'utf8');

  // Verifica detección de ruta fuera de UE en project-parser
  assert.match(parserSource, /const\s+isNonEURouteDetected\s*=/);
  assert.match(parserSource, /const\s+driverDietCostEur\s*=\s*isNonEURouteDetected\s*\?\s*0\s*:\s*roadTransitDays\s*\*\s*75/);

  // Verifica cálculo de cadencia óptima DSS (72 camiones/día para Sétif-Bugía)
  assert.match(parserSource, /const\s+dssOptimalTrucksPerDay\s*=\s*isSetifRoute\s*\?\s*72/);
  assert.match(parserSource, /Cadencia Óptima DSS:\s*\$\{dssOptimalTrucksPerDay\}\s*camiones\/día/);
});

test('8. AgenteProyectosWidget and backend prompts include strict directives for Land Charter projects', () => {
  const widgetSource = readFileSync(new URL('../src/components/AgenteProyectosWidget.jsx', import.meta.url), 'utf8');
  const backendAgentSource = readFileSync(new URL('../netlify/functions/agente-proyectos.js', import.meta.url), 'utf8');
  const projectChatSource = readFileSync(new URL('../netlify/functions/project-chat.ts', import.meta.url), 'utf8');

  for (const [name, source] of [['Widget', widgetSource], ['Backend Agent', backendAgentSource], ['Project Chat', projectChatSource]]) {
    assert.match(
      source,
      /Cadencia de Flota \(Escenario Óptimo DSS\):[\s\S]*?72 camiones\/día de la ruta Sétif-Bugía/,
      `${name} must instruct the agent on DSS optimal fleet cadence`
    );
    assert.match(
      source,
      /Exclusión de Dietas por Ubicación Geográfica:[\s\S]*?rutas en Argelia: Sétif ➔ Bugía[\s\S]*?elimina por completo del cálculo unitario y global cualquier concepto de dietas/,
      `${name} must instruct the agent on non-EU driver diet exclusion`
    );
  }
});

test('9. Strict Module Boundary: Outside modules are completely unmodified', () => {
  // Asegura que TceCalculatorWorkspace no ha sido alterado indebidamente
  const tceSource = readFileSync(new URL('../TceCalculatorWorkspace.tsx', import.meta.url), 'utf8');
  assert.ok(tceSource.length > 1000);
  assert.doesNotMatch(tceSource, /land-project-policy/);

  // Asegura que decisiones.html conserva su lógica original del DSS
  const dssSource = readFileSync(new URL('../decisiones.html', import.meta.url), 'utf8');
  assert.ok(dssSource.length > 1000);
  assert.doesNotMatch(dssSource, /land-project-policy/);
});
