import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const forwarderWorkspacePath = path.join(projectRoot, 'src/components/ForwarderWorkspace.jsx');
const forwarderWorkspaceSource = fs.readFileSync(forwarderWorkspacePath, 'utf8');

const apiLandDataPath = path.join(projectRoot, 'netlify/functions/api-land-data.ts');
const apiLandDataSource = fs.readFileSync(apiLandDataPath, 'utf8');

const indexHtmlPath = path.join(projectRoot, 'index.html');
const indexHtmlSource = fs.readFileSync(indexHtmlPath, 'utf8');

function normalizeStr(val) {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Extraer constantes y funciones de ForwarderWorkspace mediante evaluación segura
const catalogMatch = forwarderWorkspaceSource.match(/export\s+const\s+LAND_VEHICLE_CATALOG\s*=\s*(\[[\s\S]*?\n\]);/);
const LAND_VEHICLE_CATALOG = new Function(`return ${catalogMatch[1]};`)();

const payloadFnMatch = forwarderWorkspaceSource.match(/export\s+function\s+getVehiclePayloadKg[\s\S]*?\n\}/);
const getVehiclePayloadKg = new Function(`${payloadFnMatch[0].replace('export function getVehiclePayloadKg', 'return function getVehiclePayloadKg')}`)();

const compatFnMatch = forwarderWorkspaceSource.match(/export\s+function\s+getCompatibleMethodsForVehicle[\s\S]*?\n\}/);
const getCompatibleMethodsForVehicle = new Function(`${compatFnMatch[0].replace('export function getCompatibleMethodsForVehicle', 'return function getCompatibleMethodsForVehicle')}`)();

const detectFnMatch = forwarderWorkspaceSource.match(/export\s+function\s+detectCargoPackagingType[\s\S]*?\n\}/);
const detectCargoPackagingType = new Function('normalizeStr', `${detectFnMatch[0].replace('export function detectCargoPackagingType', 'return function detectCargoPackagingType')}`)(normalizeStr);

test('1. LAND_VEHICLE_CATALOG defines Camión Plataforma con Grúa Autocarga (21.000 kg) and Camión Plataforma Abierta (Sin Grúa) (24.000 kg)', () => {
  assert.ok(Array.isArray(LAND_VEHICLE_CATALOG), 'LAND_VEHICLE_CATALOG must be an array');

  const plataformaGrua = LAND_VEHICLE_CATALOG.find(v => v.name === 'Camión Plataforma con Grúa Autocarga');
  assert.ok(plataformaGrua, 'Must include "Camión Plataforma con Grúa Autocarga"');
  assert.equal(plataformaGrua.payloadKg, 21000, 'Payload for Plataforma con grúa must be exactly 21.000 kg (reflecting crane tare)');
  assert.equal(plataformaGrua.defaultLoadingMethod, 'Autocarga con Grúa del Camión');
  assert.equal(plataformaGrua.defaultDischargeMethod, 'Autocarga con Grúa del Camión');

  const plataformaAbierta = LAND_VEHICLE_CATALOG.find(v => v.name === 'Camión Plataforma Abierta (Sin Grúa)');
  assert.ok(plataformaAbierta, 'Must include "Camión Plataforma Abierta (Sin Grúa)"');
  assert.equal(plataformaAbierta.payloadKg, 24000, 'Payload for Plataforma abierta must be exactly 24.000 kg');
  assert.equal(plataformaAbierta.defaultLoadingMethod, 'Carga Superior (Grúa Portuaria / Puente Grúa)');
  assert.equal(plataformaAbierta.defaultDischargeMethod, 'Carga Superior (Grúa Portuaria / Puente Grúa)');
});

test('2. getVehiclePayloadKg accurately returns payload factoring crane boom tare', () => {
  assert.equal(getVehiclePayloadKg('Camión Plataforma con Grúa Autocarga'), 21000);
  assert.equal(getVehiclePayloadKg('Plataforma con Grúa'), 21000);
  assert.equal(getVehiclePayloadKg('Camión Plataforma Abierta (Sin Grúa)'), 24000);
  assert.equal(getVehiclePayloadKg('Bañera Basculante (Granel)'), 26000);
  assert.equal(getVehiclePayloadKg('Camión Silo Presurizado'), 25000);
  assert.equal(getVehiclePayloadKg('Tráiler Tauliner (13.6m)'), 24000);
});

test('3. Multicamión fleet calculation differentiates between 21.000 kg and 24.000 kg payload', () => {
  const cargoWeightKg = 44000; // 44 toneladas
  const payloadGrua = getVehiclePayloadKg('Camión Plataforma con Grúa Autocarga'); // 21.000 kg
  const payloadSinGrua = getVehiclePayloadKg('Camión Plataforma Abierta (Sin Grúa)'); // 24.000 kg

  const trucksGrua = Math.ceil(cargoWeightKg / payloadGrua);
  const trucksSinGrua = Math.ceil(cargoWeightKg / payloadSinGrua);

  assert.equal(trucksGrua, 3, '44 tonnes with crane platform (21t payload) requires 3 trucks');
  assert.equal(trucksSinGrua, 2, '44 tonnes with open platform (24t payload) requires 2 trucks');
});

test('4. detectCargoPackagingType detects packaged keywords and defaults to Camión Plataforma con Grúa Autocarga', () => {
  const testCases = [
    { items: [{ type: 'CEM I 52,5N BIGBAG' }] },
    { items: [{ type: 'CEM I 52,5N SAC 50KG' }] },
    { items: [{ description: 'Carga paletizada en bolsas' }] },
    { items: [{ type: 'Sling bags 1000kg' }] },
    { items: [{ type: 'Mercancía envasada' }] },
    { items: [{ type: '6667 big bags de cemento' }] },
  ];

  for (const tc of testCases) {
    const res = detectCargoPackagingType(tc.items);
    assert.equal(res.isPackaged, true, `Should detect packaged for ${tc.items[0].type || tc.items[0].description}`);
    assert.equal(res.isBulk, false);
    assert.equal(res.recommendedVehicle, 'Camión Plataforma con Grúa Autocarga');
    assert.equal(res.payloadKg, 21000);
    assert.equal(res.loadingMethod, 'Autocarga con Grúa del Camión');
    assert.equal(res.dischargeMethod, 'Autocarga con Grúa del Camión');
  }
});

test('5. detectCargoPackagingType preserves bulk vehicle for VRAC / BULK / GRANEL', () => {
  const bulkCases = [
    { items: [{ type: 'CEM II 42,5 VRAC' }] },
    { items: [{ description: 'Clinker bulk carrier' }] },
    { items: [{ type: 'Mineral a granel' }] },
    { items: [{ category: 'Graneles Sólidos / Minerales' }] },
  ];

  for (const tc of bulkCases) {
    const res = detectCargoPackagingType(tc.items);
    assert.equal(res.isBulk, true, `Should detect bulk for ${tc.items[0].type || tc.items[0].description || tc.items[0].category}`);
    assert.equal(res.isPackaged, false);
    assert.equal(res.recommendedVehicle, 'Bañera Basculante (Granel)');
    assert.equal(res.payloadKg, 26000);
    assert.equal(res.loadingMethod, 'Carga por Silo / Tubo (Granel)');
    assert.equal(res.dischargeMethod, 'Basculante / Tolva (Granel)');
  }
});

test('6. getCompatibleMethodsForVehicle manages compatible and incompatible methods for platforms', () => {
  const gruaCompat = getCompatibleMethodsForVehicle('Camión Plataforma con Grúa Autocarga');
  assert.equal(gruaCompat.isPlatform, true);
  assert.equal(gruaCompat.hasCrane, true);
  assert.ok(gruaCompat.allowed.includes('Autocarga con Grúa del Camión'));
  assert.ok(gruaCompat.allowed.includes('Carga Superior (Grúa Portuaria / Puente Grúa)'));
  assert.ok(gruaCompat.incompatible.includes('Carga Trasera por Muelle / Rampa'));

  const abiertaCompat = getCompatibleMethodsForVehicle('Camión Plataforma Abierta (Sin Grúa)');
  assert.equal(abiertaCompat.isPlatform, true);
  assert.equal(abiertaCompat.hasCrane, false);
  assert.ok(abiertaCompat.allowed.includes('Carga Superior (Grúa Portuaria / Puente Grúa)'));
  assert.ok(abiertaCompat.incompatible.includes('Autocarga con Grúa del Camión'), 'Open platform cannot self-load (no crane)');
  assert.ok(abiertaCompat.incompatible.includes('Carga Trasera por Muelle / Rampa'));
});

test('7. ForwarderWorkspace UI includes vehicle_type selector with both required platform options', () => {
  assert.match(
    forwarderWorkspaceSource,
    /id="vehicle_type"/,
    'Must include vehicle_type selector'
  );
  assert.match(
    forwarderWorkspaceSource,
    /<option[^>]*value="Camión Plataforma con Grúa Autocarga"[^>]*>/,
    'Must explicitly offer "Camión Plataforma con Grúa Autocarga"'
  );
  assert.match(
    forwarderWorkspaceSource,
    /<option[^>]*value="Camión Plataforma Abierta \(Sin Grúa\)"[^>]*>/,
    'Must explicitly offer "Camión Plataforma Abierta (Sin Grúa)"'
  );
});

test('8. ForwarderWorkspace UI includes metodo_carga and metodo_descarga selectors that prevent dock loading on platforms', () => {
  assert.match(
    forwarderWorkspaceSource,
    /id="metodo_carga"/,
    'Must include metodo_carga selector'
  );
  assert.match(
    forwarderWorkspaceSource,
    /id="metodo_descarga"/,
    'Must include metodo_descarga selector'
  );
  assert.match(
    forwarderWorkspaceSource,
    /disabled[^>]*value="carga_trasera_muelle"/,
    'Must disable rear dock loading on platforms'
  );
});

test('9. ForwarderWorkspace autoCalculateEstimates reactively applies packaged rule to vehicle and methods', () => {
  assert.match(
    forwarderWorkspaceSource,
    /detectCargoPackagingType\(items,\s*activeProject\)/,
    'autoCalculateEstimates must detect packaging from items and activeProject'
  );
  assert.match(
    forwarderWorkspaceSource,
    /setVehicleType\(['"]Camión Plataforma con Grúa Autocarga['"]\)/,
    'Must automatically set Camión Plataforma con Grúa Autocarga for packaged goods'
  );
  assert.match(
    forwarderWorkspaceSource,
    /setLoadingMethod\(['"]Autocarga con Grúa del Camión['"]\)/,
    'Must automatically set Autocarga con Grúa del Camión for packaged goods'
  );
});

test('10. api-land-data.ts catalog includes both platform types', () => {
  assert.match(
    apiLandDataSource,
    /Camión Plataforma con Grúa Autocarga[\s\S]*?payloadKg:\s*21000/,
    'api-land-data.ts must define Camión Plataforma con Grúa Autocarga with 21.000 kg'
  );
  assert.match(
    apiLandDataSource,
    /Camión Plataforma Abierta \(Sin Grúa\)[\s\S]*?payloadKg:\s*24000/,
    'api-land-data.ts must define Camión Plataforma Abierta with 24.000 kg'
  );
});

test('11. index.html recognizes both platform types with exact 21.000 kg payload', () => {
  assert.match(
    indexHtmlSource,
    /Camión Plataforma con Grúa Autocarga[\s\S]*?payloadKg:\s*21000/,
    'index.html must define Camión Plataforma con Grúa Autocarga with 21.000 kg'
  );
  assert.match(
    indexHtmlSource,
    /Camión Plataforma Abierta \(Sin Grúa\)[\s\S]*?payloadKg:\s*24000/,
    'index.html must define Camión Plataforma Abierta with 24.000 kg'
  );
});
