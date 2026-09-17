import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeNlpVoyagePayload, PACKAGED_REGEX as MAPPER_PACKAGED_REGEX } from '../shared/cargo-mapper.mjs';
import { parseProjectInstruction, PACKAGED_REGEX as PARSER_PACKAGED_REGEX } from '../src/utils/agenteProyectosParser.mjs';

test('1. Regex PACKAGED_REGEX = /(big\\s*bag|saco|sling|palet|envasad)/i está implementada y exportada', () => {
  const expectedRegexStr = /(big\s*bag|saco|sling|palet|envasad)/i.source;
  assert.equal(MAPPER_PACKAGED_REGEX.source, expectedRegexStr);
  assert.equal(PARSER_PACKAGED_REGEX.source, expectedRegexStr);

  const testCases = [
    'cemento en big bags',
    'bigbag de cemento',
    'cemento en sacos',
    'cemento en saco',
    'material en slings',
    'azulejos en palets',
    'mercancía paletizada',
    'cemento envasado',
    'cemento a granel en big bags',
    'cemento granel en sacos'
  ];

  testCases.forEach((text) => {
    assert.ok(MAPPER_PACKAGED_REGEX.test(text), `Mapper regex debe detectar: "${text}"`);
    assert.ok(PARSER_PACKAGED_REGEX.test(text), `Parser regex debe detectar: "${text}"`);
  });
});

test('2. parseProjectInstruction aplica Regla de Prioridad Absoluta para cemento en big bags', () => {
  const res = parseProjectInstruction('necesito mover 10000 toneladas de cemento en big bags');

  // Categoría: "Minerales y Construcción"
  assert.equal(res.payload.categoriaCarga, 'Minerales y Construcción');
  assert.equal(res.payload.cargo_category, 'Minerales y Construcción');

  // Producto: "Big Bags (Minerales/Cemento)"
  assert.equal(res.payload.productoEspecifico, 'Big Bags (Minerales/Cemento)');
  assert.equal(res.payload.cargo_product, 'Big Bags (Minerales/Cemento)');

  // Vehículo (vehicleType / truck_type): "Camión Plataforma con Grúa Autocarga"
  assert.equal(res.payload.vehicleType, 'Camión Plataforma con Grúa Autocarga');
  assert.equal(res.payload.truck_type, 'Camión Plataforma con Grúa Autocarga');

  // Métodos de Carga y Descarga: "Autocarga con Grúa del Camión"
  assert.equal(res.payload.loadingMethod, 'Autocarga con Grúa del Camión');
  assert.equal(res.payload.dischargeMethod, 'Autocarga con Grúa del Camión');
});

test('3. parseProjectInstruction anula asignación a granel cuando el texto contiene granel pero es envasado', () => {
  const res = parseProjectInstruction('mover 5000 t de cemento a granel en big bags en silo o tolva');

  assert.equal(res.payload.categoriaCarga, 'Minerales y Construcción');
  assert.equal(res.payload.productoEspecifico, 'Big Bags (Minerales/Cemento)');
  assert.equal(res.payload.vehicleType, 'Camión Plataforma con Grúa Autocarga');
  assert.equal(res.payload.truck_type, 'Camión Plataforma con Grúa Autocarga');
  assert.equal(res.payload.loadingMethod, 'Autocarga con Grúa del Camión');
  assert.equal(res.payload.dischargeMethod, 'Autocarga con Grúa del Camión');
  assert.equal(res.payload.isBulk, false);
});

test('4. normalizeNlpVoyagePayload aplica prioridad absoluta anulando vehículos a granel (Silos/Tolvas)', () => {
  const payloadSilo = normalizeNlpVoyagePayload({
    cargo_type: 'cemento en big bags',
    vehicleType: 'Camión Silo Presurizado',
    truck_type: 'Camión Silo Presurizado',
    methodPOL: 'camion_tolva',
  });

  // Categoría: "Minerales y Construcción"
  assert.equal(payloadSilo.categoriaCarga, 'Minerales y Construcción');
  assert.equal(payloadSilo.cargo_category, 'Minerales y Construcción');

  // Producto: "Big Bags (Minerales/Cemento)"
  assert.equal(payloadSilo.productoEspecifico, 'Big Bags (Minerales/Cemento)');
  assert.equal(payloadSilo.cargo_product, 'Big Bags (Minerales/Cemento)');

  // Vehículo (vehicleType / truck_type): "Camión Plataforma con Grúa Autocarga"
  assert.equal(payloadSilo.vehicleType, 'Camión Plataforma con Grúa Autocarga');
  assert.equal(payloadSilo.truck_type, 'Camión Plataforma con Grúa Autocarga');

  // Métodos de Carga y Descarga: "Autocarga con Grúa del Camión"
  assert.equal(payloadSilo.loadingMethod, 'Autocarga con Grúa del Camión');
  assert.equal(payloadSilo.dischargeMethod, 'Autocarga con Grúa del Camión');
});

test('5. normalizeNlpVoyagePayload con cemento en sacos, palets o envasado prioriza envase sobre materia prima', () => {
  const cases = [
    'cemento en sacos',
    'cemento paletizado',
    'cemento envasado',
    'cemento en slings',
  ];

  cases.forEach((cargoText) => {
    const payload = normalizeNlpVoyagePayload({
      cargo_type: cargoText,
      vehicleType: 'Bañera Basculante (Granel)',
    });

    assert.equal(payload.categoriaCarga, 'Minerales y Construcción', `Categoría para ${cargoText}`);
    assert.equal(payload.productoEspecifico, 'Big Bags (Minerales/Cemento)', `Producto para ${cargoText}`);
    assert.equal(payload.vehicleType, 'Camión Plataforma con Grúa Autocarga', `Vehículo para ${cargoText}`);
    assert.equal(payload.truck_type, 'Camión Plataforma con Grúa Autocarga', `Truck type para ${cargoText}`);
    assert.equal(payload.loadingMethod, 'Autocarga con Grúa del Camión', `Loading method para ${cargoText}`);
    assert.equal(payload.dischargeMethod, 'Autocarga con Grúa del Camión', `Discharge method para ${cargoText}`);
  });
});
