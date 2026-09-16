import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const indexHtmlPath = resolve('index.html');

test('Purga Marítima: Botones de buques eliminados y UI 100% terrestre', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf-8');

  // 1. Eliminar explícitamente los botones de Historial de Buques y Comparar Buques
  assert.doesNotMatch(indexSource, /id="btn-list-vessels"/, 'No debe existir el botón btn-list-vessels');
  assert.doesNotMatch(indexSource, /id="btn-comparison"/, 'No debe existir el botón btn-comparison');
  assert.doesNotMatch(indexSource, /Historial de Buques/, 'No debe existir texto de Historial de Buques en el HTML');
  assert.doesNotMatch(indexSource, /Comparar Buques/, 'No debe existir texto de Comparar Buques en el HTML');

  // 2. Section 5 de Auditoría y Reportes contiene acciones limpias
  assert.match(indexSource, /id="btn-executive-report"[^>]*onclick="generateExecutiveReport\(\)"/);
  assert.match(indexSource, /Ver Reporte Ejecutivo del Viaje/);
});

test('Validación Defensiva del Botón Reporte Ejecutivo', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf-8');

  // generateExecutiveReport debe validar que haya cálculo de ruta antes de continuar
  assert.match(indexSource, /function\s+generateExecutiveReport\(\)\s*\{[\s\S]*?Calcula una ruta terrestre antes de generar el reporte\./);
  assert.match(indexSource, /if\s*\(!rawDistVal\s*\|\|\s*rawDistVal\s*===\s*'0'\s*\|\|\s*rawDistVal\s*===\s*'N\/D'/);
});

test('Reporte Ejecutivo Terrestre: Datos de origen, destino, km, LDM, camiones necesarios y desglose de costes', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf-8');

  // Integración de métricas de transporte terrestre
  assert.match(indexSource, /Camiones Necesarios:/);
  assert.match(indexSource, /Metros Lineales \(LDM\):/);
  assert.match(indexSource, /Lado Transportista: Estructura de Costes/);
  assert.match(indexSource, /Lado Agencia: Cotización y Margen Comercial/);

  // Botones de acción del reporte: guardar cotización, exportar PDF e imprimir
  assert.match(indexSource, /exportExecutiveReportPdf/);
  assert.match(indexSource, /function\s+exportExecutiveReportPdf\(\)/);
});
