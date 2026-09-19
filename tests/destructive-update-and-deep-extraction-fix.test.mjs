import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderWorkspaceSource = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);

test('1. Fix de Extracción Profunda (Banner Marítimo Nivel 1) en ForwarderWorkspace.jsx', () => {
  // 1.1 seaOrigin busca obligatoriamente en objetos anidados: route_and_chartering, data, pol o 'N/A'
  assert.match(
    forwarderWorkspaceSource,
    /const\s+seaOrigin\s*=\s*activeProject\?\.route_and_chartering\?\.pol\s*\|\|\s*activeProject\?\.data\?\.pol\s*\|\|\s*activeProject\?\.pol\s*\|\|\s*['"]N\/A['"]/,
    'seaOrigin must extract from route_and_chartering.pol || data.pol || pol || "N/A"'
  );

  // 1.2 seaDest busca obligatoriamente en objetos anidados: route_and_chartering, data, pod o 'N/A'
  assert.match(
    forwarderWorkspaceSource,
    /const\s+seaDest\s*=\s*activeProject\?\.route_and_chartering\?\.pod\s*\|\|\s*activeProject\?\.data\?\.pod\s*\|\|\s*activeProject\?\.pod\s*\|\|\s*['"]N\/A['"]/,
    'seaDest must extract from route_and_chartering.pod || data.pod || pod || "N/A"'
  );

  // 1.3 seaMiles busca obligatoriamente en route_and_chartering, distance_nm, data.distance_nm o 0
  assert.match(
    forwarderWorkspaceSource,
    /const\s+seaMiles\s*=\s*activeProject\?\.route_and_chartering\?\.distance_nm\s*\|\|\s*activeProject\?\.distance_nm\s*\|\|\s*activeProject\?\.data\?\.distance_nm\s*\|\|\s*0/,
    'seaMiles must extract from route_and_chartering.distance_nm || distance_nm || data.distance_nm || 0'
  );
});

test('2. Simulación de Extracción Profunda con estructuras reales de Neon', () => {
  // Caso Neon: pol/pod/distance_nm anidados en route_and_chartering
  const neonProjectA = {
    id: 'proj-001',
    project_ref: 'REF-NEON-01',
    route_and_chartering: {
      pol: 'Rotterdam Port',
      pod: 'Valencia Port',
      distance_nm: 1850,
    },
    data: null,
  };
  const seaOriginA = neonProjectA?.route_and_chartering?.pol || neonProjectA?.data?.pol || neonProjectA?.pol || 'N/A';
  const seaDestA = neonProjectA?.route_and_chartering?.pod || neonProjectA?.data?.pod || neonProjectA?.pod || 'N/A';
  const seaMilesA = neonProjectA?.route_and_chartering?.distance_nm || neonProjectA?.distance_nm || neonProjectA?.data?.distance_nm || 0;
  assert.strictEqual(seaOriginA, 'Rotterdam Port');
  assert.strictEqual(seaDestA, 'Valencia Port');
  assert.strictEqual(seaMilesA, 1850);

  // Caso Neon: pol/pod/distance_nm anidados en data
  const neonProjectB = {
    id: 'proj-002',
    project_ref: 'REF-NEON-02',
    data: {
      pol: 'Bilbao',
      pod: 'Hamburg',
      distance_nm: 1100,
    },
  };
  const seaOriginB = neonProjectB?.route_and_chartering?.pol || neonProjectB?.data?.pol || neonProjectB?.pol || 'N/A';
  const seaDestB = neonProjectB?.route_and_chartering?.pod || neonProjectB?.data?.pod || neonProjectB?.pod || 'N/A';
  const seaMilesB = neonProjectB?.route_and_chartering?.distance_nm || neonProjectB?.distance_nm || neonProjectB?.data?.distance_nm || 0;
  assert.strictEqual(seaOriginB, 'Bilbao');
  assert.strictEqual(seaDestB, 'Hamburg');
  assert.strictEqual(seaMilesB, 1100);

  // Caso Fallback: sin datos marítimos
  const emptyProject = {};
  const seaOriginC = emptyProject?.route_and_chartering?.pol || emptyProject?.data?.pol || emptyProject?.pol || 'N/A';
  const seaDestC = emptyProject?.route_and_chartering?.pod || emptyProject?.data?.pod || emptyProject?.pod || 'N/A';
  const seaMilesC = emptyProject?.route_and_chartering?.distance_nm || emptyProject?.distance_nm || emptyProject?.data?.distance_nm || 0;
  assert.strictEqual(seaOriginC, 'N/A');
  assert.strictEqual(seaDestC, 'N/A');
  assert.strictEqual(seaMilesC, 0);
});

test('3. Fix de Payload (Prevenir el borrado del Packing List) en ForwarderWorkspace.jsx', () => {
  // Comprobar la construcción estricta del payload con herencia de activeProject
  assert.match(
    forwarderWorkspaceSource,
    /\.\.\.activeProject,?\s*\/\/\s*Heredar todo por defecto/,
    'Payload must spread ...activeProject with comment "// Heredar todo por defecto"'
  );

  // Comprobar la protección de items
  assert.match(
    forwarderWorkspaceSource,
    /items:\s*\(cargoItems\s*&&\s*cargoItems\.length\s*>\s*0\)\s*\?\s*cargoItems\s*:\s*\(activeProject\?\.items\s*\|\|\s*\[\]\)/,
    'items must inherit activeProject.items if local cargoItems is empty'
  );

  // Comprobar la protección de cargo_items
  assert.match(
    forwarderWorkspaceSource,
    /cargo_items:\s*\(cargoItems\s*&&\s*cargoItems\.length\s*>\s*0\)\s*\?\s*cargoItems\s*:\s*\(activeProject\?\.cargo_items\s*\|\|\s*activeProject\?\.line_items\?\.\[0\]\?\.payload_data\?\.cargo_items\s*\|\|\s*\[\]\)/,
    'cargo_items must inherit from activeProject.cargo_items or line_items[0].payload_data.cargo_items'
  );

  // Comprobar la preservación de packing_list
  assert.match(
    forwarderWorkspaceSource,
    /packing_list:\s*activeProject\?\.packing_list\s*\|\|\s*null/,
    'packing_list must preserve activeProject.packing_list or null'
  );

  // Comprobar land_route y costes/ventas
  assert.match(
    forwarderWorkspaceSource,
    /land_route:\s*\{\s*origin:\s*landOrigin,\s*destination:\s*landDestination,\s*distance_km:\s*distanceKm\s*\}/,
    'land_route must be populated with origin, destination, distance_km'
  );
  assert.match(
    forwarderWorkspaceSource,
    /land_freight_cost:\s*(?:calculatedLandFreightCost|Number\([^)]*tuVariableDeCosteTotalTerrestre[^)]*\))/,
    'land_freight_cost must be included in payload'
  );
  assert.match(
    forwarderWorkspaceSource,
    /land_freight_sale:\s*(?:calculatedLandFreightSale|Number\([^)]*tuVariableDePrecioVentaTerrestre[^)]*\))/,
    'land_freight_sale must be included in payload'
  );
});

test('4. Simulación funcional: Herencia defensiva de Packing List ante sincronización y guardado', () => {
  const masterCargo = [
    { id: 'master-item-1', type: 'CEM I 52.5N BIGBAG', quantity: 20, unit_weight_kg: 1000 },
    { id: 'master-item-2', type: 'Maquinaria Pesada', quantity: 1, unit_weight_kg: 15000 },
  ];

  const activeProject = {
    id: 'proj-core-pro',
    project_ref: 'REF-CORE-2026',
    client_name: 'Cliente Industrial',
    items: masterCargo,
    cargo_items: masterCargo,
    packing_list: { filename: 'packing-list-master.pdf', uploadedAt: '2026-09-19T00:00:00Z' },
    truck_type: 'Tráiler Tauliner (13.6m)',
    vehicle_attributes: { max_payload_tons: 24 },
  };

  // Simulación 1: Usuario NO añade carga localmente (cargoItems = [])
  const localCargoItemsEmpty = [];
  const landOrigin = 'Madrid';
  const landDestination = 'Valencia';
  const distanceKm = 350;
  const tuVariableDeCosteTotalTerrestre = 1200;
  const tuVariableDePrecioVentaTerrestre = 1500;
  const localVehicleType = 'Camión Plataforma con Grúa Autocarga';

  const payloadEmptyLocal = {
    ...activeProject,
    items: (localCargoItemsEmpty && localCargoItemsEmpty.length > 0) ? localCargoItemsEmpty : (activeProject?.items || []),
    cargo_items: (localCargoItemsEmpty && localCargoItemsEmpty.length > 0) ? localCargoItemsEmpty : (activeProject?.cargo_items || activeProject?.line_items?.[0]?.payload_data?.cargo_items || []),
    packing_list: activeProject?.packing_list || null,
    land_route: { origin: landOrigin, destination: landDestination, distance_km: distanceKm },
    land_freight_cost: Number(tuVariableDeCosteTotalTerrestre || 0),
    land_freight_sale: Number(tuVariableDePrecioVentaTerrestre || 0),
    truck_type: localVehicleType,
    vehicle_type: localVehicleType,
    vehicle_attributes: activeProject?.vehicle_attributes || null,
  };

  // Verificación: NUNCA se vacía la mercancía maestra de Core PRO
  assert.deepStrictEqual(payloadEmptyLocal.items, masterCargo, 'items must retain Core PRO master items');
  assert.deepStrictEqual(payloadEmptyLocal.cargo_items, masterCargo, 'cargo_items must retain Core PRO master cargo_items');
  assert.deepStrictEqual(payloadEmptyLocal.packing_list, activeProject.packing_list, 'packing_list must retain master metadata');
  assert.strictEqual(payloadEmptyLocal.truck_type, 'Camión Plataforma con Grúa Autocarga', 'truck_type takes local selection');
  assert.strictEqual(payloadEmptyLocal.land_route.distance_km, 350);

  // Simulación 2: Usuario modifica/añade carga localmente
  const newLocalItems = [
    { id: 'new-piece-1', type: 'Transformador 45T', quantity: 1, unit_weight_kg: 45000 },
  ];
  const payloadWithNewCargo = {
    ...activeProject,
    items: (newLocalItems && newLocalItems.length > 0) ? newLocalItems : (activeProject?.items || []),
    cargo_items: (newLocalItems && newLocalItems.length > 0) ? newLocalItems : (activeProject?.cargo_items || activeProject?.line_items?.[0]?.payload_data?.cargo_items || []),
    packing_list: activeProject?.packing_list || null,
    land_route: { origin: landOrigin, destination: landDestination, distance_km: distanceKm },
    land_freight_cost: Number(tuVariableDeCosteTotalTerrestre || 0),
    land_freight_sale: Number(tuVariableDePrecioVentaTerrestre || 0),
  };

  assert.deepStrictEqual(payloadWithNewCargo.items, newLocalItems, 'items should update when new local items are provided');
  assert.deepStrictEqual(payloadWithNewCargo.cargo_items, newLocalItems, 'cargo_items should update when new local items are provided');
});
