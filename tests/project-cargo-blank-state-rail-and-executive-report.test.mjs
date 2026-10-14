import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = resolve(process.cwd());

test('1. Erradicación de Herencia de Estado (Blank State): reset total y purga exhaustiva', async () => {
  const workspaceSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // a) Purga de variables globales de transporte, distancias y costes en clearAndResetProjectState
  assert.match(workspaceSource, /delete\s+window\.State\.railProxyDistanceKm/);
  assert.match(workspaceSource, /delete\s+window\.State\.railPurifiedDistanceKm/);
  assert.match(workspaceSource, /delete\s+window\.State\.costeTrenConsolidado/);
  assert.match(workspaceSource, /delete\s+window\.State\.traction_cost/);
  assert.match(workspaceSource, /delete\s+window\.State\.totalKilometers/);
  assert.match(workspaceSource, /delete\s+window\.State\.total_wagons/);
  assert.match(workspaceSource, /delete\s+window\.railProxyDistanceKm/);
  assert.match(workspaceSource, /delete\s+window\.railPurifiedDistanceKm/);

  // b) handleCreateProject ejecuta clearAndResetProjectState y crea proyecto con lienzo en blanco (origen/destino vacíos, distancias a 0)
  assert.match(
    workspaceSource,
    /land_origin:\s*['"]['"][\s\S]*?land_destination:\s*['"]['"][\s\S]*?land_distance:\s*0[\s\S]*?land_freight_cost:\s*0[\s\S]*?clearAndResetProjectState\(\)/
  );

  // c) No hereda valores residuales de window.State?.cargo en proyectos nuevos
  assert.match(
    workspaceSource,
    /const\s+quickTonnage\s*=\s*parseSafeNumber\(activeProject\.cargoQuantity\s*\|\|\s*activeProject\.cargo_quantity\s*\|\|\s*activeProject\.toneladas\s*\|\|\s*activeProject\.tonnes\s*\|\|\s*activeProject\.cargo\s*\|\|\s*0\);/
  );

  // d) Un nuevo proyecto en blanco resetea costes a vacío
  assert.match(
    workspaceSource,
    /isNewBlankProject[\s\S]*?setEstimatedCost\(['"]['"]\)[\s\S]*?setSalePrice\(['"]['"]\)/
  );
});

test('2. Sincronización Inteligente de Modalidad (Tren vs Camión): DataBridge y guardado de servicios', async () => {
  const workspaceSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // a) dataBridgePayloadObject incluye globalTransportMode e isRail / is_rail
  assert.match(workspaceSource, /globalTransportMode:\s*(?:currentSyncMode|currentSaveMode|isRail\s*\?\s*['"]RAIL['"]\s*:\s*['"]ROAD['"])/);
  assert.match(workspaceSource, /isRail:\s*(?:isRail|isRailSave)/);
  assert.match(workspaceSource, /is_rail:\s*(?:isRail|isRailSave)/);

  // b) En modo RAIL, almacena la distancia ferroviaria purificada
  assert.match(
    workspaceSource,
    /const\s+purifiedRailDistSync\s*=\s*isRail\s*\?\s*Number\([\s\S]*?window\.railPurifiedDistanceKm\s*\|\|\s*window\.railProxyDistanceKm/
  );

  // c) En modo RAIL, almacena costes de tracción y anula métricas específicas de carretera (peajes, dietas)
  assert.match(
    workspaceSource,
    /const\s+syncTollCost\s*=\s*isRail\s*\?\s*0\s*:\s*Number/
  );
  assert.match(
    workspaceSource,
    /const\s+syncDriverDiets\s*=\s*isRail\s*\?\s*0\s*:\s*Number/
  );
});

test('3. Adaptación Dinámica del UI "Project Cargo": etiquetas condicionales para RAIL', async () => {
  const workspaceSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // a) Lista de servicios adapta etiquetas estáticas
  assert.match(
    workspaceSource,
    /isRailResumen\s*\?\s*['"]Servicios Ferroviarios['"]\s*:\s*['"]Servicios['"]/
  );
  assert.match(
    workspaceSource,
    /replace\(\/flete terrestre\/gi,\s*['"]Flete Ferroviario['"]\)\.replace\(\/camiones\/gi,\s*['"]Vagones['"]\)/
  );

  // b) Tarjetas de resumen en vista de proyecto adaptan Toneladas/Granel vs LDM y Flete Ferroviario vs Flete Terrestre
  assert.match(
    workspaceSource,
    /isRailResumen\s*\?\s*['"]Toneladas\/Granel['"]\s*:\s*['"]Metros Lineales \(LDM\) \/ Palets['"]/
  );
  assert.match(
    workspaceSource,
    /isRailResumen\s*\?\s*['"]Flete Ferroviario vs\. Venta['"]\s*:\s*['"]Flete Terrestre vs\. Venta['"]/
  );
  assert.match(
    workspaceSource,
    /isRailResumen\s*\?\s*['"]Vagones['"]\s*:\s*['"]Camiones['"]/
  );

  // c) Empty state cuando no hay servicios
  assert.match(
    workspaceSource,
    /isRailResumen\s*\?\s*['"]Configura un servicio de transporte ferroviario por tren para calcular fletes y emitir reportes\.['"]\s*:\s*['"]Configura un servicio de transporte terrestre por carretera para calcular fletes y emitir reportes\.['"]/
  );

  // d) Declaración segura de isRailResumen en el alcance del componente para evitar ReferenceError en renderizado
  assert.match(
    workspaceSource,
    /const\s+isRailResumen\s*=\s*Boolean\([\s\S]*?isRail[\s\S]*?\);[\s\S]*?return\s*\(/
  );
});

test('4. Unificación Absoluta del Reporte Ejecutivo: Vista Interna/Cliente y render de vehículo SVG', async () => {
  const workspaceSource = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');
  const indexSource = await readFile(resolve(rootDir, 'index.html'), 'utf8');

  // a) El botón de Generar Reporte Ejecutivo en proyecto guardado invoca handleOpenExecutiveReport
  assert.match(
    workspaceSource,
    /id="btn-generate-executive-report-project"[\s\S]*?onClick=\{\(\)\s*=>\s*handleOpenExecutiveReport/
  );
  assert.match(
    workspaceSource,
    /id="btn-generate-executive-report-project"[\s\S]*?Generar Reporte Ejecutivo/
  );

  // b) handleOpenExecutiveReport sincroniza datos a window.State e invoca window.generateExecutiveReport
  assert.match(
    workspaceSource,
    /window\.generateExecutiveReport\(window\.executiveReportViewMode/
  );

  // c) index.html expone generateExecutiveReport en window
  assert.match(
    indexSource,
    /window\.generateExecutiveReport\s*=\s*generateExecutiveReport;/
  );

  // d) El componente incluye el Selector de Privacidad Universal (Vista Interna / Vista Cliente)
  assert.match(workspaceSource, /id="btn-view-internal"/);
  assert.match(workspaceSource, /id="btn-view-client"/);
  assert.match(workspaceSource, /Vista Interna/);
  assert.match(workspaceSource, /Vista Cliente/);

  // e) El componente renderiza el Vehicle Hero SVG mediante buildExecutiveVehicleHeroSVG
  assert.match(
    workspaceSource,
    /id="executive-vehicle-hero-container"[\s\S]*?window\.buildExecutiveVehicleHeroSVG/
  );

  // f) Botón de exportación a PDF dedicado
  assert.match(workspaceSource, /id="btn-export-pdf-executive"/);
  assert.match(workspaceSource, /window\.exportExecutiveReportPdf/);
});
