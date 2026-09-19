import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderJsx = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);

test('1. Mapeo Exhaustivo Marítimo (Nivel 1 - Banner Azul) en ForwarderWorkspace', () => {
  // seaOrigin
  assert.match(
    forwarderJsx,
    /const\s+seaOrigin\s*=\s*activeProject\?\.items\?\.\[0\]\?\.payload_data\?\.route_and_chartering\?\.pol\s*\|\|\s*activeProject\?\.route_and_chartering\?\.pol\s*\|\|\s*activeProject\?\.pol\s*\|\|\s*['"]N\/A['"];/,
    'seaOrigin must look in items[0].payload_data.route_and_chartering.pol then route_and_chartering.pol then pol then N/A'
  );

  // seaDest
  assert.match(
    forwarderJsx,
    /const\s+seaDest\s*=\s*activeProject\?\.items\?\.\[0\]\?\.payload_data\?\.route_and_chartering\?\.pod\s*\|\|\s*activeProject\?\.route_and_chartering\?\.pod\s*\|\|\s*activeProject\?\.pod\s*\|\|\s*['"]N\/A['"];/,
    'seaDest must look in items[0].payload_data.route_and_chartering.pod then route_and_chartering.pod then pod then N/A'
  );

  // seaMiles
  assert.match(
    forwarderJsx,
    /const\s+seaMiles\s*=\s*Number\(activeProject\?\.items\?\.\[0\]\?\.payload_data\?\.route_and_chartering\?\.distance_nm\)\s*\|\|\s*Number\(activeProject\?\.route_and_chartering\?\.distance_nm\)\s*\|\|\s*Number\(activeProject\?\.distance_nm\)\s*\|\|\s*0;/,
    'seaMiles must look in items[0].payload_data then route_and_chartering then distance_nm then 0'
  );

  // seaTons
  assert.match(
    forwarderJsx,
    /const\s+seaTons\s*=\s*Number\(activeProject\?\.total_weight_tons\)\s*\|\|\s*Number\(activeProject\?\.items\?\.\[0\]\?\.payload_data\?\.totals\?\.weight\s*\/\s*1000\)\s*\|\|\s*0;/,
    'seaTons must look in total_weight_tons then items[0].payload_data.totals.weight / 1000 then 0'
  );

  // seaFreightSale
  assert.match(
    forwarderJsx,
    /const\s+seaFreightSale\s*=\s*Number\(activeProject\?\.items\?\.\[0\]\?\.payload_data\?\.financial_summary\?\.customer_sale_price_usd\)\s*\|\|\s*Number\(activeProject\?\.financialBreakdown\?\.oceanFreight\?\.subtotal\)\s*\|\|\s*Number\(activeProject\?\.ocean_freight_sale\)\s*\|\|\s*0;/,
    'seaFreightSale must look in items[0].payload_data then financialBreakdown then ocean_freight_sale then 0'
  );
});

test('2. Visual Health Checks (OK / Vacío / Faltan datos) en Banner Marítimo', () => {
  // Health check: seaOrigin and seaDest
  assert.match(
    forwarderJsx,
    /seaOrigin\s*!==\s*['"]N\/A['"]\s*&&\s*seaDest\s*!==\s*['"]N\/A['"]\s*\?\s*\([\s\S]*?✅ OK[\s\S]*?\)\s*:\s*\([\s\S]*?⚠️ Faltan datos[\s\S]*?\)/,
    'Banner must render ✅ OK or ⚠️ Faltan datos for maritime route'
  );

  // Health check: seaMiles
  assert.match(
    forwarderJsx,
    /seaMiles\s*>\s*0\s*\?\s*\([\s\S]*?✅ OK[\s\S]*?\)\s*:\s*\([\s\S]*?⚠️ Vacío[\s\S]*?\)/,
    'Banner must render ✅ OK or ⚠️ Vacío for seaMiles'
  );

  // Health check: seaFreightSale
  assert.match(
    forwarderJsx,
    /seaFreightSale\s*>\s*0\s*\?\s*\([\s\S]*?✅ OK[\s\S]*?\)\s*:\s*\([\s\S]*?⚠️ Vacío[\s\S]*?\)/,
    'Banner must render ✅ OK or ⚠️ Vacío for seaFreightSale'
  );
});

test('3. Visual Health Checks y binding estricto en sección terrestre y formulario', () => {
  // Health check: land route card
  assert.match(
    forwarderJsx,
    /\(?rOrigin\s*&&\s*rDestination\)?\s*\?\s*\([\s\S]*?✅ OK[\s\S]*?\)\s*:\s*\([\s\S]*?⚠️ Faltan datos[\s\S]*?\)/,
    'Land summary must render ✅ OK or ⚠️ Faltan datos for land route'
  );

  // Health check: land distance card
  assert.match(
    forwarderJsx,
    /rDistKm\s*>\s*0\s*\?\s*\([\s\S]*?✅ OK[\s\S]*?\)\s*:\s*\([\s\S]*?⚠️ Vacío[\s\S]*?\)/,
    'Land summary must render ✅ OK or ⚠️ Vacío for distance'
  );

  // Input labels health checks
  assert.match(
    forwarderJsx,
    /Origen \(Carga\) \* \{landOrigin \?[\s\S]*?✅ OK[\s\S]*?:[\s\S]*?⚠️ Vacío[\s\S]*?\}/,
    'Origen label must show health check based on landOrigin'
  );
  assert.match(
    forwarderJsx,
    /Destino \(Entrega\) \* \{landDestination \?[\s\S]*?✅ OK[\s\S]*?:[\s\S]*?⚠️ Vacío[\s\S]*?\}/,
    'Destino label must show health check based on landDestination'
  );
  assert.match(
    forwarderJsx,
    /Distancia Ruta \(KM\) \* \{distanceKm > 0 \?[\s\S]*?✅ OK[\s\S]*?:[\s\S]*?⚠️ Vacío[\s\S]*?\}/,
    'Distancia label must show health check based on distanceKm'
  );

  // Inputs strictly bound to local state
  assert.match(
    forwarderJsx,
    /id="input-pol"[\s\S]*?value=\{landOrigin\}/,
    'Origen input must be bound to landOrigin state'
  );
  assert.match(
    forwarderJsx,
    /id="input-pod"[\s\S]*?value=\{landDestination\}/,
    'Destino input must be bound to landDestination state'
  );
  assert.match(
    forwarderJsx,
    /id="input-distance-nm"[\s\S]*?value=\{distanceKm\s*\|\|\s*['"]['"]\}/,
    'Distancia input must be bound to distanceKm state'
  );
});

test('4. Regla de Oro: Si distanceKm === 0 o !distanceKm, flete terrestre es 0', () => {
  // rCostEur in provisional summary
  assert.match(
    forwarderJsx,
    /const\s+rCostEur\s*=\s*isZeroDist\s*\?\s*0\s*:\s*\(Number\(projectCost\)/,
    'rCostEur must evaluate to 0 if distance is zero or missing'
  );

  // rSaleEur in provisional summary
  assert.match(
    forwarderJsx,
    /const\s+rSaleEur\s*=\s*isZeroDist\s*\?\s*0\s*:\s*\(Number\(projectSale\)/,
    'rSaleEur must evaluate to 0 if distance is zero or missing'
  );

  // Functional simulation of distance = 0
  const computeLandFreight = (distanceKm, projectCost = 1500) => {
    const isZeroDist = !distanceKm || Number(distanceKm) <= 0;
    const rCostEur = isZeroDist ? 0 : (Number(projectCost) || Math.round(distanceKm * 1.57 + 75));
    const rSaleEur = isZeroDist ? 0 : Math.round(rCostEur * 1.18);
    return { rCostEur, rSaleEur };
  };

  const zeroResult = computeLandFreight(0, 2000);
  assert.equal(zeroResult.rCostEur, 0, 'Cost must be 0 when distanceKm is 0');
  assert.equal(zeroResult.rSaleEur, 0, 'Sale must be 0 when distanceKm is 0');

  const nullResult = computeLandFreight(null, 2000);
  assert.equal(nullResult.rCostEur, 0, 'Cost must be 0 when distanceKm is null');
  assert.equal(nullResult.rSaleEur, 0, 'Sale must be 0 when distanceKm is null');

  const validResult = computeLandFreight(500, 1000);
  assert.equal(validResult.rCostEur, 1000, 'Cost must be retained when distanceKm > 0');
  assert.equal(validResult.rSaleEur, 1180, 'Sale must be calculated when distanceKm > 0');
});

test('5. Simulación de extracción marítima con items[0].payload_data de Core PRO', () => {
  const newCoreProProject = {
    name: 'Proyecto Nuevo DataBridge',
    items: [
      {
        id: 'item-1',
        payload_data: {
          route_and_chartering: {
            pol: 'Castellón',
            pod: 'Génova',
            distance_nm: 420
          },
          totals: {
            weight: 25000000 // 25,000 tons in kg
          },
          financial_summary: {
            customer_sale_price_usd: 85000
          }
        }
      }
    ]
  };

  const seaOrigin = newCoreProProject?.items?.[0]?.payload_data?.route_and_chartering?.pol || newCoreProProject?.route_and_chartering?.pol || newCoreProProject?.pol || 'N/A';
  const seaDest = newCoreProProject?.items?.[0]?.payload_data?.route_and_chartering?.pod || newCoreProProject?.route_and_chartering?.pod || newCoreProProject?.pod || 'N/A';
  const seaMiles = Number(newCoreProProject?.items?.[0]?.payload_data?.route_and_chartering?.distance_nm) || Number(newCoreProProject?.route_and_chartering?.distance_nm) || Number(newCoreProProject?.distance_nm) || 0;
  const seaTons = Number(newCoreProProject?.total_weight_tons) || Number(newCoreProProject?.items?.[0]?.payload_data?.totals?.weight / 1000) || 0;
  const seaFreightSale = Number(newCoreProProject?.items?.[0]?.payload_data?.financial_summary?.customer_sale_price_usd) || Number(newCoreProProject?.financialBreakdown?.oceanFreight?.subtotal) || Number(newCoreProProject?.ocean_freight_sale) || 0;

  assert.equal(seaOrigin, 'Castellón');
  assert.equal(seaDest, 'Génova');
  assert.equal(seaMiles, 420);
  assert.equal(seaTons, 25000);
  assert.equal(seaFreightSale, 85000);

  // Health checks evaluation
  assert.equal(seaOrigin !== 'N/A' && seaDest !== 'N/A', true);
  assert.equal(seaMiles > 0, true);
  assert.equal(seaFreightSale > 0, true);
});
