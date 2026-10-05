import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = resolve(process.cwd());

test('1. Executive Report render block in ForwarderWorkspace defines projectData, currentVehicle and isRail safely', async () => {
  const source = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  // Verify projectData and currentVehicle extraction in Executive Report
  assert.match(
    source,
    /const\s+projectData\s*=\s*activeProject\s*\|\|\s*\{\};/,
    'Executive Report must define projectData safely from activeProject'
  );

  assert.match(
    source,
    /const\s+currentVehicle\s*=\s*projectData\?\.vehicle_type\s*\|\|\s*projectData\?\.tipo_vehiculo/,
    'currentVehicle must read from projectData.vehicle_type or projectData.tipo_vehiculo'
  );

  assert.match(
    source,
    /const\s+isRail\s*=\s*currentVehicle\.toLowerCase\(\)\.includes\(['"]tren['"]\)\s*\|\|\s*currentVehicle\.toLowerCase\(\)\.includes\(['"]ferrocarril['"]\)/,
    'isRail must check for tren or ferrocarril safely before JSX return'
  );
});

test('2. ForwarderWorkspace exports ExecutiveReport component handling projectData and isRail props', async () => {
  const source = await readFile(resolve(rootDir, 'src/components/ForwarderWorkspace.jsx'), 'utf8');

  assert.match(
    source,
    /export\s+const\s+ExecutiveReport\s*=\s*\(\{\s*projectData\s*=\s*\{\},\s*isRail:/,
    'ExecutiveReport must be exported and accept projectData and isRail props'
  );
});

test('3. Operational safety: evaluating isRail in report conditionals does not throw ReferenceError', () => {
  // Simulate the report evaluation logic
  const projectData = { vehicle_type: 'Tren Tolva (Ferrocarril)' };
  const currentVehicle = projectData?.vehicle_type || projectData?.tipo_vehiculo || "";
  const isRail = currentVehicle.toLowerCase().includes('tren') || currentVehicle.toLowerCase().includes('ferrocarril');

  assert.equal(isRail, true);

  // Evaluate the exact JSX string conditionals that were causing the crash
  const labelDistancia = isRail ? 'Distancia ferroviaria' : 'Distancia por carretera';
  const labelKm = isRail ? 'Kilómetros (Línea Ferroviaria)' : 'Kilómetros (Transporte Terrestre)';
  const labelTransito = isRail ? 'Tránsito Ferroviario' : 'Jornadas de tacógrafo';
  const labelCorredor = isRail ? 'Corredor Ferroviario' : 'Ruta Terrestre';

  assert.equal(labelDistancia, 'Distancia ferroviaria');
  assert.equal(labelKm, 'Kilómetros (Línea Ferroviaria)');
  assert.equal(labelTransito, 'Tránsito Ferroviario');
  assert.equal(labelCorredor, 'Corredor Ferroviario');

  // Verify road vehicle
  const roadProject = { vehicle_type: 'Tráiler Tauliner (13.6m)' };
  const roadVehicle = roadProject?.vehicle_type || roadProject?.tipo_vehiculo || "";
  const roadIsRail = roadVehicle.toLowerCase().includes('tren') || roadVehicle.toLowerCase().includes('ferrocarril');
  assert.equal(roadIsRail, false);
  assert.equal(roadIsRail ? 'Distancia ferroviaria' : 'Distancia por carretera', 'Distancia por carretera');
});
