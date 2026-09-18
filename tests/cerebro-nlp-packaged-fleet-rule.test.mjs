import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { normalizeNlpVoyagePayload } from '../shared/cargo-mapper.mjs';
import { parseProjectInstruction } from '../src/utils/agenteProyectosParser.mjs';

const seaAssistantSource = readFileSync(resolve('src/sea-assistant-entry.js'), 'utf8');
const forwarderWorkspaceSource = readFileSync(resolve('src/components/ForwarderWorkspace.jsx'), 'utf8');
const voyageDraftSource = readFileSync(resolve('src/voyage-draft-entry.js'), 'utf8');
const agenteWidgetSource = readFileSync(resolve('src/components/AgenteProyectosWidget.jsx'), 'utf8');

const normalizeStr = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const detectFnMatch = forwarderWorkspaceSource.match(/export\s+function\s+detectCargoPackagingType[\s\S]*?\n\}/);
const detectCargoPackagingType = new Function('normalizeStr', `${detectFnMatch[0].replace('export function detectCargoPackagingType', 'return function detectCargoPackagingType')}`)(normalizeStr);

test('1. Regex de Envasados en Texto Libre evalúa mercancías empaquetadas y descarta granel/bulk', () => {
  const PACKAGED_REGEX = /(big\s*bag|saco|sling|paletizad|envasad)/i;
  const BULK_REGEX = /(granel|bulk)/i;

  const validCases = [
    '10000 toneladas de cemento en big bags',
    'Transportar 5000 t de harina en sacos',
    'Carga en slings de exportación',
    'Mercancía paletizada de azulejos',
    'Fertilizante envasado para distribución',
    'bigbag de yeso',
    'big bag de clinker',
  ];

  validCases.forEach((text) => {
    assert.ok(
      PACKAGED_REGEX.test(text) && !BULK_REGEX.test(text),
      `Debe detectar envasado sin granel en: "${text}"`
    );
  });

  const bulkCases = [
    '10000 toneladas de cemento a granel',
    'cemento en bulk',
    'trigo a granel en bañera basculante',
    'cemento granel en big bags', // contiene granel
  ];

  bulkCases.forEach((text) => {
    const isPackaged = PACKAGED_REGEX.test(text);
    const isBulk = BULK_REGEX.test(text);
    assert.ok(
      isBulk || !isPackaged,
      `Debe descartar o detectar granel en: "${text}"`
    );
  });
});

test('2. detectCargoPackagingType en ForwarderWorkspace asigna Camión Plataforma para big bags y envasados', () => {
  const res = detectCargoPackagingType([{ type: '10000 toneladas de cemento en big bags' }], null);
  assert.equal(res.isPackaged, true);
  assert.equal(res.recommendedVehicle, 'Camión Plataforma con Grúa Autocarga');
  assert.equal(res.payloadKg, 21000);
  assert.equal(res.loadingMethod, 'Autocarga con Grúa del Camión');
  assert.equal(res.dischargeMethod, 'Autocarga con Grúa del Camión');
});

test('3. normalizeNlpVoyagePayload asigna forzosamente Camión Plataforma con Grúa Autocarga anulando fallbacks', () => {
  const payload = normalizeNlpVoyagePayload({
    cargo_type: '10000 toneladas de cemento en big bags',
    cargo_qty: 10000,
  });

  assert.equal(
    payload.vehicleType,
    'Camión Plataforma con Grúa Autocarga',
    'Debe asignar Camión Plataforma con Grúa Autocarga en vehicleType'
  );
  assert.equal(
    payload.vessel_class,
    'Camión Plataforma con Grúa Autocarga',
    'Debe anular el fallback genérico de buque/tauliner'
  );
  assert.equal(payload.truckPayloadCapacity, 21, 'Debe asignar 21 TM de carga útil');
  assert.equal(payload.dwt, 21, 'Debe asignar 21 TM de dwt');
  assert.equal(payload.cargaUtil, 21, 'Debe asignar 21 TM de cargaUtil');
});

test('4. parseProjectInstruction en agenteProyectosParser asigna vehículo plataforma para envasados', () => {
  const res = parseProjectInstruction('necesito mover 10000 toneladas de cemento en big bags');
  assert.equal(res.payload.vehicleType, 'Camión Plataforma con Grúa Autocarga');
  assert.equal(res.payload.truck_type, 'Camión Plataforma con Grúa Autocarga');
  assert.equal(res.payload.loadingMethod, 'Autocarga con Grúa del Camión');
  assert.equal(res.payload.dischargeMethod, 'Autocarga con Grúa del Camión');
  assert.equal(res.payload.truckPayloadCapacity, 21, 'Debe asignar 21 TM de carga útil en parser');
  assert.equal(res.payload.dwt, 21, 'Debe asignar 21 TM de dwt en parser');
  assert.equal(res.payload.cargaUtil, 21, 'Debe asignar 21 TM de cargaUtil en parser');
});

test('5. sea-assistant-entry.js intercepta envasados en executeActionableAiUpdateFields y sincroniza State/DOM', () => {
  // Regex obligatoria en el manejador de Cerebro.ia
  assert.match(
    seaAssistantSource,
    /\/\(big\\s\*bag\|saco\|sling\|paletizad\|envasad\)\/i/,
    'Debe incluir la expresión regular /(big\\s*bag|saco|sling|paletizad|envasad)/i'
  );
  assert.match(
    seaAssistantSource,
    /\/\(granel\|bulk\)\/i/,
    'Debe incluir la verificación de exclusión de granel/bulk'
  );

  // Forzar Camión Plataforma con Grúa Autocarga
  assert.match(
    seaAssistantSource,
    /assignedVehicle\s*=\s*["']Camión Plataforma con Grúa Autocarga["']/,
    'Debe forzar la asignación a Camión Plataforma con Grúa Autocarga'
  );

  // Sincronización reactiva con State, window.handleVehicleTypeSelection y DOM
  assert.match(
    seaAssistantSource,
    /window\.handleVehicleTypeSelection\(assignedVehicle\)/,
    'Debe invocar handleVehicleTypeSelection'
  );
  assert.match(
    seaAssistantSource,
    /window\.State\.vehicleType\s*=\s*assignedVehicle/,
    'Debe actualizar window.State.vehicleType'
  );
  assert.match(
    seaAssistantSource,
    /window\.State\.truckPayloadCapacity\s*=\s*21\b/,
    'Debe actualizar la capacidad de carga útil a 21 TM'
  );
  assert.match(
    seaAssistantSource,
    /document\.getElementById\(["']exec-vessel-type["']\)/,
    'Debe actualizar la Vista Ejecutiva (exec-vessel-type)'
  );
  assert.match(
    seaAssistantSource,
    /document\.getElementById\(["']nombre-buque-calculadora["']\)/,
    'Debe actualizar el input del selector de vehículo en la calculadora'
  );
});

test('6. ForwarderWorkspace.jsx intercepta payload de chat/Cerebro y anula fallback genérico', () => {
  // handleApplyProjectPayload evalúa el string de la mercancía con la regex
  assert.match(
    forwarderWorkspaceSource,
    /const PACKAGED_REGEX\s*=\s*\/\(big\\s\*bag\|saco\|sling\|paletizad\|envasad\)\/i/,
    'handleApplyProjectPayload debe evaluar la expresión regular de envasados'
  );
  assert.match(
    forwarderWorkspaceSource,
    /const BULK_REGEX\s*=\s*\/\(granel\|bulk\)\/i/,
    'handleApplyProjectPayload debe verificar la ausencia de granel/bulk'
  );

  // Asignación forzada de vehículo
  assert.match(
    forwarderWorkspaceSource,
    /handleVehicleTypeChange\(['"]Camión Plataforma con Grúa Autocarga['"]\)/,
    'handleApplyProjectPayload debe disparar handleVehicleTypeChange con Camión Plataforma con Grúa Autocarga'
  );
  assert.match(
    forwarderWorkspaceSource,
    /setVehicleType\(['"]Camión Plataforma con Grúa Autocarga['"]\)/,
    'handleApplyProjectPayload debe disparar setVehicleType'
  );

  // Listener de eventos de Cerebro.ia
  assert.match(
    forwarderWorkspaceSource,
    /window\.addEventListener\(['"]sea-assistant:field-updated['"]/,
    'ForwarderWorkspace debe escuchar actualizaciones reactivas de Cerebro.ia'
  );
});

test('7. voyage-draft-entry.js aplica regla de flota en autocompletado e inyección de escenario', () => {
  assert.match(
    voyageDraftSource,
    /vesselClass\s*=\s*['"]Camión Plataforma con Grúa Autocarga['"]/,
    'applyAssistantCalculatorAutofill debe clasificar como Camión Plataforma con Grúa Autocarga'
  );
  assert.match(
    voyageDraftSource,
    /window\.handleVehicleTypeSelection\(['"]Camión Plataforma con Grúa Autocarga['"]\)/,
    'injectVoyageScenario debe invocar handleVehicleTypeSelection'
  );
});

test('8. AgenteProyectosWidget propaga el texto libre original (prompt / cargoName) al workspace', () => {
  assert.match(
    agenteWidgetSource,
    /prompt:\s*raw/,
    'AgenteProyectosWidget debe incluir el prompt original en onUpdatePayload'
  );
});
