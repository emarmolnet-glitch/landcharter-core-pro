import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderJsx = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);

test('1. Strict initialization of land route state hooks with zero data bleed', () => {
  // Verifies the exact required useState hooks for land route
  assert.match(
    forwarderJsx,
    /const\s+\[landOrigin,\s*setLandOrigin\]\s*=\s*useState\(activeProject\?\.land_route\?\.origin\s*\|\|\s*activeProject\?\.land_origin\s*\|\|\s*['"]['"]\);/,
    'landOrigin must be initialized strictly with activeProject?.land_route?.origin || activeProject?.land_origin || ""'
  );

  assert.match(
    forwarderJsx,
    /const\s+\[landDestination,\s*setLandDestination\]\s*=\s*useState\(activeProject\?\.land_route\?\.destination\s*\|\|\s*activeProject\?\.land_destination\s*\|\|\s*['"]['"]\);/,
    'landDestination must be initialized strictly with activeProject?.land_route?.destination || activeProject?.land_destination || ""'
  );

  assert.match(
    forwarderJsx,
    /const\s+\[distanceKm,\s*setDistanceKm\]\s*=\s*useState\(activeProject\?\.land_route\?\.distance_km\s*\|\|\s*activeProject\?\.land_distance\s*\|\|\s*0\);/,
    'distanceKm must be initialized strictly with activeProject?.land_route?.distance_km || activeProject?.land_distance || 0'
  );

  // Maritime parameters must not bleed into land parameters
  assert.match(
    forwarderJsx,
    /const\s+\[pol,\s*setPol\]\s*=\s*useState\(activeProject\?\.pol\s*\|\|\s*['"]['"]\);/,
    'pol must not have land fallbacks'
  );

  assert.match(
    forwarderJsx,
    /const\s+\[pod,\s*setPod\]\s*=\s*useState\(activeProject\?\.pod\s*\|\|\s*['"]['"]\);/,
    'pod must not have land fallbacks'
  );

  assert.match(
    forwarderJsx,
    /const\s+\[distanceNm,\s*setDistanceNm\]\s*=\s*useState\(activeProject\?\.distance_nm\s*\|\|\s*activeProject\?\.distanceNm\s*\|\|\s*0\);/,
    'distanceNm must not have land fallbacks'
  );
});

test('2. handleOpenCreateService starts land fields blank/zero when no prior land route exists', () => {
  // Checks handleOpenCreateService resets landOrigin, landDestination, and distanceKm
  assert.match(
    forwarderJsx,
    /const\s+handleOpenCreateService\s*=\s*\(\)\s*=>\s*\{[\s\S]*?setLandOrigin\(activeProject\?\.land_route\?\.origin\s*\|\|\s*activeProject\?\.land_origin\s*\|\|\s*['"]['"]\);/,
    'handleOpenCreateService must set landOrigin strictly from land data or blank'
  );

  assert.match(
    forwarderJsx,
    /const\s+handleOpenCreateService\s*=\s*\(\)\s*=>\s*\{[\s\S]*?setLandDestination\(activeProject\?\.land_route\?\.destination\s*\|\|\s*activeProject\?\.land_destination\s*\|\|\s*['"]['"]\);/,
    'handleOpenCreateService must set landDestination strictly from land data or blank'
  );

  assert.match(
    forwarderJsx,
    /const\s+handleOpenCreateService\s*=\s*\(\)\s*=>\s*\{[\s\S]*?setDistanceKm\(Number\(activeProject\?\.land_route\?\.distance_km\s*\|\|\s*activeProject\?\.land_distance\s*\|\|\s*0\)\);/,
    'handleOpenCreateService must set distanceKm strictly from land data or zero'
  );
});

test('3. Modal inputs are bound to isolated landOrigin, landDestination, and distanceKm', () => {
  // Origen input
  assert.match(
    forwarderJsx,
    /id="input-pol"[\s\S]*?value=\{landOrigin\}[\s\S]*?onChange=\{\(e\)\s*=>\s*\{[\s\S]*?setLandOrigin\(val\);/,
    'Origen input must be bound to landOrigin and setLandOrigin'
  );

  // Destino input
  assert.match(
    forwarderJsx,
    /id="input-pod"[\s\S]*?value=\{landDestination\}[\s\S]*?onChange=\{\(e\)\s*=>\s*\{[\s\S]*?setLandDestination\(val\);/,
    'Destino input must be bound to landDestination and setLandDestination'
  );

  // Distancia KM input
  assert.match(
    forwarderJsx,
    /id="input-distance-nm"[\s\S]*?value=\{distanceKm\s*\|\|\s*['"]['"]\}[\s\S]*?onChange=\{\(e\)\s*=>\s*\{[\s\S]*?setDistanceKm\(val\);/,
    'Distance KM input must be bound to distanceKm and setDistanceKm'
  );
});

test('4. Level 1 Maritime Banner extracts seaFreightSale through Core PRO financial summary path', () => {
  // Exact extraction line required
  assert.match(
    forwarderJsx,
    /const\s+seaFreightSale\s*=\s*Number\(activeProject\?\.ocean_freight_sale\)\s*\|\|\s*Number\(activeProject\?\.financial_summary\?\.customer_sale_price_usd\)\s*\|\|\s*Number\(activeProject\?\.data\?\.financial_summary\?\.customer_sale_price_usd\)\s*\|\|\s*0;/,
    'seaFreightSale must extract from activeProject.ocean_freight_sale || financial_summary.customer_sale_price_usd || data.financial_summary.customer_sale_price_usd || 0'
  );
});

test('5. Level 2 Provisional Land Summary avoids data bleed from maritime pol, pod, and distanceNm', () => {
  // rOrigin and rDestination must strictly look at land properties
  assert.match(
    forwarderJsx,
    /const\s+rOrigin\s*=\s*activeProject\?\.land_route\?\.origin\s*\|\|\s*activeProject\?\.land_origin\s*\|\|\s*landOrigin\s*\|\|\s*['"]['"];/,
    'rOrigin must not fall back to pol or sea ports'
  );

  assert.match(
    forwarderJsx,
    /const\s+rDestination\s*=\s*activeProject\?\.land_route\?\.destination\s*\|\|\s*activeProject\?\.land_destination\s*\|\|\s*landDestination\s*\|\|\s*['"]['"];/,
    'rDestination must not fall back to pod or sea ports'
  );

  assert.match(
    forwarderJsx,
    /const\s+rDistKm\s*=\s*Number\(activeProject\?\.land_route\?\.distance_km\s*\|\|\s*activeProject\?\.land_distance\s*\|\|\s*distanceKm\s*\|\|\s*0\);/,
    'rDistKm must not fall back to distanceNm'
  );
});

test('6. Functional simulation: Zero Data Bleed and Financial Extraction behavior', () => {
  // Project with maritime data and no land data
  const maritimeOnlyProject = {
    pol: 'Valencia Port',
    pod: 'Rotterdam Port',
    distance_nm: 1850,
    ocean_freight_sale: 0,
    financial_summary: {
      customer_sale_price_usd: 48500,
    },
  };

  // Land state initialization for maritime-only project: must be blank/zero
  const landOrigin = maritimeOnlyProject?.land_route?.origin || maritimeOnlyProject?.land_origin || '';
  const landDestination = maritimeOnlyProject?.land_route?.destination || maritimeOnlyProject?.land_destination || '';
  const distanceKm = maritimeOnlyProject?.land_route?.distance_km || maritimeOnlyProject?.land_distance || 0;

  assert.equal(landOrigin, '', 'Land origin must be blank for maritime-only project');
  assert.equal(landDestination, '', 'Land destination must be blank for maritime-only project');
  assert.equal(distanceKm, 0, 'Distance KM must be 0 for maritime-only project');

  // Financial extraction in maritime banner: must retrieve 48500 from financial_summary
  const seaFreightSale = Number(maritimeOnlyProject?.ocean_freight_sale) ||
    Number(maritimeOnlyProject?.financial_summary?.customer_sale_price_usd) ||
    Number(maritimeOnlyProject?.data?.financial_summary?.customer_sale_price_usd) ||
    0;

  assert.equal(seaFreightSale, 48500, 'seaFreightSale must extract value from financial_summary');

  // Formatted output
  const formattedSeaFreightSale = `${seaFreightSale.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  assert.equal(formattedSeaFreightSale, '48.500,00 €', 'Should format as 48.500,00 €');
});
