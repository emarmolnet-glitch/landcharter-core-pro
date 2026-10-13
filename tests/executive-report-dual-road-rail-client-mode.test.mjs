import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const indexHtmlPath = resolve('index.html');

test('1. Render Visual Dinámico (Header del Reporte): SVG Camión tráiler y Locomotora con vagones tolva', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Verifica la función generadora de Hero SVG y su disponibilidad global
  assert.match(indexSource, /function\s+buildExecutiveVehicleHeroSVG/);
  assert.match(indexSource, /window\.buildExecutiveVehicleHeroSVG\s*=\s*buildExecutiveVehicleHeroSVG/);

  // Modo ROAD: Subtítulo dinámico "Transporte Terrestre - [X] Vehículos"
  assert.match(
    indexSource,
    /`Transporte Terrestre - \$\{trucksNeeded\} Vehículos`/,
    'Debe incluir subtítulo dinámico Transporte Terrestre - [X] Vehículos en modo ROAD'
  );

  // Modo RAIL: Subtítulo dinámico "Convoy Ferroviario (Block Train) - [X] Vagones"
  assert.match(
    indexSource,
    /`Convoy Ferroviario \(Block Train\) - \$\{unitsNeeded\} Vagones`/,
    'Debe incluir subtítulo dinámico Convoy Ferroviario (Block Train) - [X] Vagones en modo RAIL'
  );

  // Simulación funcional del renderizado SVG en sandbox VM
  const sandbox = {
    window: {},
    document: {},
    console
  };
  vm.createContext(sandbox);

  const heroFnMatch = indexSource.match(/function buildExecutiveVehicleHeroSVG\([\s\S]*?\n\s*\}\s*window\.buildExecutiveVehicleHeroSVG\s*=\s*buildExecutiveVehicleHeroSVG;/);
  assert.ok(heroFnMatch, 'buildExecutiveVehicleHeroSVG function found');
  vm.runInContext(heroFnMatch[0], sandbox);

  // Ejecución ROAD
  const roadHtml = sandbox.window.buildExecutiveVehicleHeroSVG({
    isRail: false,
    trucksNeeded: 5,
    unitsNeeded: 5,
    ldmValue: 13.6,
    cargoTon: 120
  });
  assert.ok(roadHtml.includes('Transporte Terrestre - 5 Vehículos'), 'Debe reflejar 5 vehículos en subtítulo');
  assert.ok(roadHtml.includes('tractor-cab'), 'Debe incluir cabina tractora SVG');
  assert.ok(roadHtml.includes('trailer-group'), 'Debe incluir semirremolque SVG');
  assert.ok(roadHtml.includes('fa-truck'), 'Debe incluir icono fa-truck');

  // Ejecución RAIL
  const railHtml = sandbox.window.buildExecutiveVehicleHeroSVG({
    isRail: true,
    trucksNeeded: 2,
    unitsNeeded: 12,
    ldmValue: 13.6,
    cargoTon: 600
  });
  assert.ok(railHtml.includes('Convoy Ferroviario (Block Train) - 12 Vagones'), 'Debe reflejar 12 vagones en subtítulo');
  assert.ok(railHtml.includes('locomotive-group'), 'Debe incluir locomotora SVG');
  assert.ok(railHtml.includes('hopper-wagon-1'), 'Debe incluir vagón tolva SVG');
  assert.ok(railHtml.includes('fa-train'), 'Debe incluir icono fa-train');
});

test('2. Selector de Privacidad Universal (Interno vs. Cliente): Tabs y regla de ocultación estricta', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Control Toggle / Tabs en el header del reporte
  assert.match(indexSource, /id="btn-view-internal"[^>]*onclick="setExecutiveReportView\('internal'\)"/);
  assert.match(indexSource, /id="btn-view-client"[^>]*onclick="setExecutiveReportView\('client'\)"/);
  assert.match(indexSource, /Vista Interna/);
  assert.match(indexSource, /Vista Cliente/);

  // Función setExecutiveReportView definida y asignada a window
  assert.match(indexSource, /function\s+setExecutiveReportView\(viewMode\)/);
  assert.match(indexSource, /window\.setExecutiveReportView\s*=\s*setExecutiveReportView/);

  // Vista Cliente: Renderiza Precio de Venta Sugerido (Flete Final)
  assert.match(indexSource, /Precio de Venta Sugerido \(Flete Final\)/);

  // Vista Interna vs Cliente: Ocultación estricta de Estructura de Costes (Transportista), Gastos Operativos y Margen de Beneficio
  assert.match(indexSource, /\$\{isClientView\s*\?\s*`[\s\S]*?Cotización Comercial y Precio de Venta Sugerido \(Flete Final\)[\s\S]*?`\s*:\s*`[\s\S]*?Lado Transportista: Estructura de Costes[\s\S]*?Gastos Operativos Unitarios[\s\S]*?Margen de Beneficio \(€\)[\s\S]*?`\}/);

  // Ocultación de desglose Break-Even interno en Vista Cliente
  assert.match(indexSource, /\$\{isClientView\s*\?\s*''\s*:\s*`[\s\S]*?Análisis Detallado de Punto de Equilibrio/);
});

test('3. Exportación Segura a PDF y Print: Herencia del selector y purga de trazas internas', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // exportExecutiveReportPdf hereda vista cliente y purga elementos no imprimibles
  assert.match(indexSource, /window\.executiveReportViewMode\s*===\s*'client'/);
  assert.match(indexSource, /Land_Charter_Cotizacion_Cliente_/);
  assert.match(indexSource, /Land_Charter_Reporte_Ejecutivo_/);
  assert.match(indexSource, /cloneNode\(true\)/);
  assert.match(indexSource, /querySelectorAll\('\.no-print'\)\.forEach\(el\s*=>\s*el\.remove\(\)\)/);

  // printExecutiveScreenReport hereda vista cliente y neutraliza trazas no imprimibles
  assert.match(indexSource, /function\s+printExecutiveScreenReport\(\)\s*\{[\s\S]*?window\.executiveReportViewMode\s*===\s*'client'/);
  assert.match(indexSource, /Cotización Cliente/);
});
