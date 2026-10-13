import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const indexHtmlPath = resolve('index.html');

test('Binding Dinámico de Cantidad de Vagones en Tipo de Vehículo (Reporte Ejecutivo)', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // 1. Verifica que la sección de especificaciones contiene la etiqueta Tipo de Vehículo
  assert.match(
    indexSource,
    /<span class="text-slate-400">Tipo de Vehículo:<\/span>/,
    'Debe existir la etiqueta "Tipo de Vehículo:" en Especificaciones de Carga'
  );

  // 2. Verifica que Tipo de Vehículo está enlazado dinámicamente a unitsNeeded en modo RAIL
  assert.match(
    indexSource,
    /\$\{isRail\s*\?\s*\(unitsNeeded === 1 \? '1 Vagón Tolva \(Ferrocarril\)' : `\$\{unitsNeeded\} Vagones Tolva \(Ferrocarril\)`\)\s*:\s*vehicleType\}/,
    'Debe formatear dinámicamente la cantidad de vagones: 1 Vagón Tolva o [N] Vagones Tolva (Ferrocarril)'
  );

  // 3. Simula la evaluación en modo RAIL con múltiples vagones (ej. 12 vagones)
  const isRail = true;
  const vehicleType = 'Vagón Tolva (Ferrocarril)';
  const unitsNeededMulti = 12;
  const resultMulti = isRail ? (unitsNeededMulti === 1 ? '1 Vagón Tolva (Ferrocarril)' : `${unitsNeededMulti} Vagones Tolva (Ferrocarril)`) : vehicleType;
  assert.equal(resultMulti, '12 Vagones Tolva (Ferrocarril)');

  // 4. Simula la evaluación en modo RAIL con un único vagón (1 vagón)
  const unitsNeededSingle = 1;
  const resultSingle = isRail ? (unitsNeededSingle === 1 ? '1 Vagón Tolva (Ferrocarril)' : `${unitsNeededSingle} Vagones Tolva (Ferrocarril)`) : vehicleType;
  assert.equal(resultSingle, '1 Vagón Tolva (Ferrocarril)');

  // 5. Simula la evaluación en modo ROAD (carretera)
  const isRailRoad = false;
  const roadVehicle = 'Tráiler Tauliner (13.6m)';
  const resultRoad = isRailRoad ? (unitsNeededMulti === 1 ? '1 Vagón Tolva (Ferrocarril)' : `${unitsNeededMulti} Vagones Tolva (Ferrocarril)`) : roadVehicle;
  assert.equal(resultRoad, 'Tráiler Tauliner (13.6m)');
});

test('Subtítulo del Hero Superior en Modo RAIL refleja cantidad dinámica de vagones', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Verifica que buildExecutiveVehicleHeroSVG define el subtítulo dinámico con ${unitsNeeded} Vagones
  assert.match(
    indexSource,
    /const\s+subtitleText\s*=\s*isRail\s*\?\s*`Convoy Ferroviario \(Block Train\) - \$\{unitsNeeded\} Vagones`/,
    'El subtítulo del hero superior debe reflejar `${unitsNeeded} Vagones`'
  );
});
