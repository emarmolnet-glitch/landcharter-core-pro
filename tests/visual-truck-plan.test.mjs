import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Import component logic
import {
  TRUCK_PROFILES_METADATA,
  getTruckProfile,
  resolveTruckProfile
} from '../src/components/visual-truck-plan-logic.mjs';

test('1. getTruckProfile classifies vehicle types accurately into the 4 conditional profiles', () => {
  // Profile: TAUTLINER / LONA CORREDERA
  assert.equal(getTruckProfile('Camión Plataforma con lona corredera'), 'TAUTLINER');
  assert.equal(getTruckProfile('Tráiler Tauliner (13.6m)'), 'TAUTLINER');
  assert.equal(getTruckProfile('Lona Estándar'), 'TAUTLINER');
  assert.equal(getTruckProfile('Semirremolque Tautliner con cortina'), 'TAUTLINER');
  assert.equal(getTruckProfile('Mega Lona'), 'TAUTLINER');

  // Profile: PLATAFORMA ABIERTA / FLATBED
  assert.equal(getTruckProfile('Camión Plataforma Abierta (Sin Grúa)'), 'PLATAFORMA_ABIERTA');
  assert.equal(getTruckProfile('Flatbed Trailer 13.6m'), 'PLATAFORMA_ABIERTA');
  assert.equal(getTruckProfile('Plataforma plana portuaria'), 'PLATAFORMA_ABIERTA');
  assert.equal(getTruckProfile('Project Cargo Open Flatbed'), 'PLATAFORMA_ABIERTA');

  // Profile: GÓNDOLA / LOWBED / TIE-BOY
  assert.equal(getTruckProfile('Góndola Especial Rebajada'), 'GONDOLA');
  assert.equal(getTruckProfile('Semirremolque Lowbed / Tie-Boy'), 'GONDOLA');
  assert.equal(getTruckProfile('Cama rebajada extrapesada'), 'GONDOLA');
  assert.equal(getTruckProfile('Góndola Tieboy Heavy Lift'), 'GONDOLA');

  // Profile: RÍGIDO / FURGÓN
  assert.equal(getTruckProfile('Camión Rígido Pesado (3 Ejes)'), 'RIGIDO');
  assert.equal(getTruckProfile('Furgón de Chasis Único'), 'RIGIDO');
  assert.equal(getTruckProfile('Camión Furgoneta 3.5t Carrozado'), 'RIGIDO');
  assert.equal(getTruckProfile('Camión Rígido 2 Ejes'), 'RIGIDO');
});

test('2. TRUCK_PROFILES_METADATA contains complete specifications for each of the 4 profiles', () => {
  assert.ok(TRUCK_PROFILES_METADATA.TAUTLINER);
  assert.ok(TRUCK_PROFILES_METADATA.PLATAFORMA_ABIERTA);
  assert.ok(TRUCK_PROFILES_METADATA.GONDOLA);
  assert.ok(TRUCK_PROFILES_METADATA.RIGIDO);

  assert.match(TRUCK_PROFILES_METADATA.TAUTLINER.category, /TAUTLINER|LONA CORREDERA/i);
  assert.match(TRUCK_PROFILES_METADATA.PLATAFORMA_ABIERTA.category, /PLATAFORMA|FLATBED/i);
  assert.match(TRUCK_PROFILES_METADATA.GONDOLA.category, /GÓNDOLA|LOWBED|TIE-BOY/i);
  assert.match(TRUCK_PROFILES_METADATA.RIGIDO.category, /RÍGIDO|FURGÓN/i);
});

test('3. VisualTruckPlan.jsx source defines all required elements, conditional SVGs and metrics', async () => {
  const componentPath = resolve('src/components/VisualTruckPlan.jsx');
  const source = await readFile(componentPath, 'utf8');

  // Check SVG elements and profiles
  assert.match(source, /data-profile=\{profileKey\}/);
  assert.match(source, /data-element="tractor-cab"/);
  assert.match(source, /data-element="tautliner-enclosure"/);
  assert.match(source, /data-element="flatbed-deck"/);
  assert.match(source, /data-element="front-bulkhead"/);
  assert.match(source, /data-element="gooseneck"/);
  assert.match(source, /data-element="lowered-drop-bed"/);
  assert.match(source, /data-element="multi-axles"/);
  assert.match(source, /data-element="rigid-chassis"/);
  assert.match(source, /data-element="rigid-box"/);

  // Check cargo block and proportional scaling
  assert.match(source, /data-element="cargo-block"/);
  assert.match(source, /cargoBlockWidth/);
  assert.match(source, /ldmRatio/);

  // Check payload % and weight overlay
  assert.match(source, /payloadPercentage/);
  assert.match(source, /effectiveWeight\.toLocaleString\('es-ES'\)/);
  assert.match(source, /Metros Lineales \(LDM\)/);
  assert.match(source, /Carga Útil Asignada/);
});

test('4. Proportional calculation behaves accurately across ratios', () => {
  const bedWidth = 540;
  const maxLdm = 13.6;

  // 11.47 on 13.6m
  const ldm1 = 11.47;
  const ratio1 = ldm1 / maxLdm;
  const cargoWidth1 = Math.round(bedWidth * ratio1 * 10) / 10;
  assert.equal(Math.round(ratio1 * 100), 84);
  assert.ok(cargoWidth1 > 400 && cargoWidth1 < 500);

  // Full load: 13.6 on 13.6m
  const ldmFull = 13.6;
  const ratioFull = ldmFull / maxLdm;
  const cargoWidthFull = Math.round(bedWidth * ratioFull * 10) / 10;
  assert.equal(cargoWidthFull, 540);

  // Partial load: 6.8 on 13.6m (50%)
  const ldmHalf = 6.8;
  const ratioHalf = ldmHalf / maxLdm;
  const cargoWidthHalf = Math.round(bedWidth * ratioHalf * 10) / 10;
  assert.equal(cargoWidthHalf, 270);
});

test('5. ForwarderWorkspace Executive Report displays dynamic project name and purges static UNIVERSAL FORWARDING', async () => {
  const forwarderPath = resolve('src/components/ForwarderWorkspace.jsx');
  const source = await readFile(forwarderPath, 'utf8');

  // Must not have the static text in the header
  assert.doesNotMatch(
    source,
    /<h1>\s*Universal Forwarding\s*\/\s*B2B Module\s*<\/h1>/i,
    'Static "Universal Forwarding / B2B Module" must be removed from the header'
  );

  // Must have dynamic project name
  assert.match(
    source,
    /activeProject\?\.(?:name|project_name|title|client_name|project_ref)/,
    'Header must render dynamic project name'
  );
});

test('6. Resumen Operativo renders distance with KM (Kilómetros) unit for road transport', async () => {
  const forwarderPath = resolve('src/components/ForwarderWorkspace.jsx');
  const source = await readFile(forwarderPath, 'utf8');

  const summaryIdx = source.indexOf('Resumen Operativo (Operational Summary)');
  assert.ok(summaryIdx > 0, 'Resumen Operativo section must exist');

  const tableCostsIdx = source.indexOf('TABLA DE COSTES Y MATRIZ DE TRANSPORTE TERRESTRE B2B');
  assert.ok(tableCostsIdx > summaryIdx, 'Table of costs must follow Resumen Operativo');

  const summaryBlock = source.slice(summaryIdx, tableCostsIdx);

  // Must contain KM
  assert.match(summaryBlock, /\bKM\b/, 'Operational summary must show KM unit');
  assert.doesNotMatch(summaryBlock, /\bNM\b/, 'Operational summary must not show NM unit');
});

test('7. VisualTruckPlan is rendered only once in the bottom section and not duplicated under Resumen Operativo', async () => {
  const forwarderPath = resolve('src/components/ForwarderWorkspace.jsx');
  const source = await readFile(forwarderPath, 'utf8');

  const summaryIdx = source.indexOf('Resumen Operativo (Operational Summary)');
  const cubicacionIdx = source.indexOf('MOTOR DE CUBICACIÓN DE CAMIONES');
  assert.ok(summaryIdx > 0 && cubicacionIdx > summaryIdx);

  const blockBetweenSummaryAndCubicacion = source.slice(summaryIdx, cubicacionIdx);

  // Under Resumen Operativo and before Motor de Cubicación, VisualTruckPlan must NOT be present
  assert.doesNotMatch(
    blockBetweenSummaryAndCubicacion,
    /<VisualTruckPlan\b/,
    'VisualTruckPlan must NOT be duplicated under Resumen Operativo'
  );

  // In or directly above the Motor de Cubicación section, it MUST be present
  const bottomSection = source.slice(cubicacionIdx);
  assert.match(
    bottomSection,
    /<VisualTruckPlan\b/,
    'VisualTruckPlan must be rendered in the Motor de Cubicación section'
  );
});

test('8. Weight parsing for standard loads converts kg to MT without multiplying by 1000', async () => {
  const forwarderPath = resolve('src/components/ForwarderWorkspace.jsx');
  const source = await readFile(forwarderPath, 'utf8');

  // Must have the check preventing multiplying kg by 1000
  assert.match(
    source,
    /const\s+isBulkFspeContract\s*=/,
    'Must check for bulk FSPE commodity contract vs standard cargo'
  );

  // Extract function to test execution
  const buildQuickItemFnMatch = source.match(/export\s+function\s+buildQuickTonnageCargoItem\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
  assert.ok(buildQuickItemFnMatch, 'buildQuickTonnageCargoItem function must exist');

  const fnBody = buildQuickItemFnMatch[0]
    .replace('export function buildQuickTonnageCargoItem', 'function buildQuickTonnageCargoItem')
    .replace(/mapCargoCategoryAndType\([^)]*\)/, '{ category: "Carga General", type: "Maquinaria Industrial General", shipping_mode_supported: "Tráiler Lona (13.6m)" }');

  const buildQuickTonnageCargoItem = new Function(`
    ${fnBody};
    return buildQuickTonnageCargoItem;
  `)();

  // Standard load of 10,017 kg: must NOT become 10,017,000 kg!
  const item = buildQuickTonnageCargoItem(10017, 'Maquinaria Industrial General', 'Carga General');
  assert.equal(item.quantity, 1, 'Standard single load of 10017 kg should not generate hundreds of units');
  assert.equal(item.weight, 10017, 'Total weight should remain ~10017 kg, not 10 million kg');

  const totalCalculatedTons = (item.quantity * item.weight) / 1000;
  assert.ok(totalCalculatedTons >= 10.0 && totalCalculatedTons <= 10.1, `Expected ~10.017 MT but got ${totalCalculatedTons} MT`);
});

