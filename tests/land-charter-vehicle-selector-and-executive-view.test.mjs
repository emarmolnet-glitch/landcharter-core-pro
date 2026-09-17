import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const indexHtmlPath = resolve('index.html');
const voyageCostPath = resolve('voyage-cost-engine.js');
const forwarderWorkspacePath = resolve('src/components/ForwarderWorkspace.jsx');

test('1. Purgado de residuos marítimos en TIPO DE VEHÍCULO (Modo Técnico)', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Input TIPO DE VEHÍCULO has no visible magnifying glass button
  assert.match(indexSource, /id="nombre-buque-calculadora"[^>]*list="vehicle-types-datalist"/);
  assert.match(indexSource, /id="btn-vessel-specs-real-2"[^>]*class="hidden"[^>]*style="display:\s*none\s*!important;"/);

  // Expanded datalist contains complete terrestrial fleet options including platforms
  assert.match(indexSource, /<option value="Camión Plataforma con Grúa Autocarga">/);
  assert.match(indexSource, /<option value="Camión Plataforma Abierta \(Sin Grúa\)">/);
  assert.match(indexSource, /<option value="Bañera Basculante \(Granel\)">/);
  assert.match(indexSource, /<option value="Camión Silo Presurizado">/);
  assert.match(indexSource, /<option value="Tráiler Tauliner \(13\.6m\)">/);

  // In searchLocalVesselDataBridge, terrestrial mode guards against IMO searching
  assert.match(indexSource, /const isTerrestre = typeof isTerrestreMode === 'function' \? isTerrestreMode\(\) : true;/);
  assert.match(indexSource, /targetVehicle = vesselName && vesselName\.toUpperCase\(\) !== 'TBN'/);

  // resetCalculatorForm does NOT wipe nombre-buque-calculadora to empty string
  assert.doesNotMatch(indexSource, /'asb-cancel-time',\s*'nombre-buque-calculadora'/);
  assert.match(indexSource, /setInputValue\('nombre-buque-calculadora',\s*State\.vehicleType\s*\|\|\s*'Camión \/ Tráiler'\)/);
});

test('2. Data Binding de TIPO DE VEHÍCULO y auto-selección de Camión Plataforma con Grúa Autocarga', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');
  const forwarderSource = await readFile(forwarderWorkspacePath, 'utf8');

  // handleVehicleTypeSelection updates inputBuque.value directly whenever matched is found
  assert.match(indexSource, /const inputBuque = document\.getElementById\('nombre-buque-calculadora'\);[\s\S]*?if \(inputBuque && inputBuque\.value !== matched\.name\) \{\s*inputBuque\.value = matched\.name;\s*\}/);

  // updateCargoUnit switches vehicle to Camión Plataforma con Grúa Autocarga for bigbag/slingbag
  assert.match(indexSource, /if \(type === 'bigbag' \|\| type === 'slingbag'\) \{\s*handleVehicleTypeSelection\('Camión Plataforma con Grúa Autocarga'\);\s*\}/);

  // ForwarderWorkspace contains reactive effect syncing vehicleType to State, DOM and handleVehicleTypeSelection
  assert.match(forwarderSource, /useEffect\(\(\) => \{[\s\S]*?window\.State\.vehicleType = vehicleType;[\s\S]*?document\.getElementById\('nombre-buque-calculadora'\)[\s\S]*?\}, \[vehicleType\]\);/);

  // ForwarderWorkspace select is strictly value-bound to vehicleType
  assert.match(forwarderSource, /<select[^>]*id="vehicle_type"[^>]*value=\{vehicleType\}/);
});

test('3. Actualización dinámica del vehículo en la Vista Ejecutiva', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');
  const voyageEngineSource = await readFile(voyageCostPath, 'utf8');
  const forwarderSource = await readFile(forwarderWorkspacePath, 'utf8');

  // syncExecutiveDashboard passes dynamic vehicleType instead of hardcoded 'Camión / Tráiler'
  assert.match(indexSource, /vesselType:\s*State\.vehicleType\s*\|\|\s*\(document\.getElementById\('nombre-buque-calculadora'\)\?\.value\)\s*\|\|\s*'Camión \/ Tráiler'/);

  // voyage-cost-engine updates exec-vessel-type with resolvedVesselType including vehicleType and truckType
  assert.match(voyageEngineSource, /calcResults\.vehicleType\s*\|\|\s*calcResults\.truckType\s*\|\|\s*calcResults\.vesselType/);
  assert.match(voyageEngineSource, /setText\('exec-vessel-type',\s*resolvedVesselType\)/);

  // Executive screen report print uses dynamic State.vehicleType
  assert.match(indexSource, /document\.getElementById\('print-vessel-name'\)\.innerText\s*=\s*State\.vehicleType\s*\|\|\s*"Camión \/ Tráiler";/);

  // ForwarderWorkspace executive modal displays dynamic vehicle type
  assert.match(forwarderSource, /\{activeReport\?\.vehicleType \|\| vehicleType \|\| activeProject\?\.truck_type \|\| 'Camión \/ Tráiler'\}/);
});
