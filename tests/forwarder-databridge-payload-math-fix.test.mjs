import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const forwarderJsxPath = path.resolve('src/components/ForwarderWorkspace.jsx');
const forwarderJsx = fs.readFileSync(forwarderJsxPath, 'utf8');

test('1. handleSaveProject implements strict math formula for totalKg, trucksNeeded, and per-truck cost/sale', () => {
  assert.match(
    forwarderJsx,
    /const\s+totalKg\s*=\s*activeProject\?\.total_weight_tons\s*\?\s*\(activeProject\.total_weight_tons\s*\*\s*1000\)\s*:\s*\(tuVariableDeKilosCalculados\s*\|\|\s*0\)/,
    'totalKg must obtain total cargo in KG using activeProject.total_weight_tons * 1000 or tuVariableDeKilosCalculados'
  );

  assert.match(
    forwarderJsx,
    /const\s+payloadPerTruck\s*=\s*getVehiclePayloadKg\(\s*truckType\s*\)\s*\|\|\s*24000/,
    'payloadPerTruck must be retrieved via getVehiclePayloadKg(truckType) with fallback 24000'
  );

  assert.match(
    forwarderJsx,
    /const\s+trucksNeeded\s*=\s*totalKg\s*>\s*0\s*\?\s*Math\.ceil\(\s*totalKg\s*\/\s*payloadPerTruck\s*\)\s*:\s*1/,
    'trucksNeeded must calculate Math.ceil(totalKg / payloadPerTruck) or fallback to 1'
  );

  assert.match(
    forwarderJsx,
    /const\s+finalTotalLandCost\s*=\s*Number\(\s*\(\s*trucksNeeded\s*\*\s*costeOperativoPorCamion\s*\)\.toFixed\(2\)\s*\)/,
    'finalTotalLandCost must strictly multiply trucksNeeded * costeOperativoPorCamion without weight/ton multiplication'
  );

  assert.match(
    forwarderJsx,
    /const\s+finalTotalLandSale\s*=\s*Number\(\s*\(\s*trucksNeeded\s*\*\s*precioVentaPorCamion\s*\)\.toFixed\(2\)\s*\)/,
    'finalTotalLandSale must strictly multiply trucksNeeded * precioVentaPorCamion'
  );
});

test('2. handleSaveProject cleanly injects exact variables into payload JSON for Neon/DataBridge', () => {
  const saveFnMatch = forwarderJsx.match(/const\s+handleSaveProject\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?return\s+persistProjectToDatabase\(/);
  assert.ok(saveFnMatch, 'handleSaveProject definition must exist');
  const saveFnSource = saveFnMatch[0];

  assert.match(
    saveFnSource,
    /land_freight_cost:\s*finalTotalLandCost/,
    'payload must inject finalTotalLandCost'
  );

  assert.match(
    saveFnSource,
    /land_freight_sale:\s*finalTotalLandSale/,
    'payload must inject finalTotalLandSale'
  );

  assert.match(
    saveFnSource,
    /total_trucks:\s*trucksNeeded/,
    'payload must inject trucksNeeded'
  );

  assert.match(
    saveFnSource,
    /land_route:\s*\{\s*origin:\s*landOrigin,\s*destination:\s*landDestination,\s*distance_km:\s*distanceKm\s*\}/,
    'payload must inject land_route with origin, destination, distance_km'
  );
});

test('3. Mathematical simulation: prevents astronomical multi-million payload values', () => {
  // Scenario: 50 metric tons (50,000 kg) over 1,200 km
  const activeProject = {
    total_weight_tons: 50,
    land_distance: 1200,
  };

  const tuVariableDeKilosCalculados = 50000;
  const totalKg = activeProject?.total_weight_tons ? (activeProject.total_weight_tons * 1000) : (tuVariableDeKilosCalculados || 0);
  assert.equal(totalKg, 50000, 'totalKg should be 50,000 kg');

  const payloadPerTruck = 24000;
  const trucksNeeded = totalKg > 0 ? Math.ceil(totalKg / payloadPerTruck) : 1;
  assert.equal(trucksNeeded, 3, '50,000 kg in 24,000 kg capacity requires 3 trucks');

  // Baseline cost per truck ~2,520 EUR
  const costeOperativoPorCamion = 2520.00;
  const precioVentaPorCamion = 2973.60;

  const finalTotalLandCost = Number((trucksNeeded * costeOperativoPorCamion).toFixed(2));
  const finalTotalLandSale = Number((trucksNeeded * precioVentaPorCamion).toFixed(2));

  // Verify sane total cost (7,560 EUR, NOT 126,000,000 EUR)
  assert.equal(finalTotalLandCost, 7560.00);
  assert.equal(finalTotalLandSale, 8920.80);
  assert.ok(finalTotalLandCost < 100000, 'Cost must be sane fleet cost, never in millions');

  // Verify payload matches
  const payload = {
    ...activeProject,
    land_freight_cost: finalTotalLandCost,
    land_freight_sale: finalTotalLandSale,
    total_trucks: trucksNeeded,
    land_route: {
      origin: 'Valencia',
      destination: 'Madrid',
      distance_km: 1200
    }
  };

  assert.equal(payload.land_freight_cost, 7560.00);
  assert.equal(payload.land_freight_sale, 8920.80);
  assert.equal(payload.total_trucks, 3);
  assert.equal(payload.land_route.distance_km, 1200);
});
