import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderWorkspaceSource = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);
const forwarderProjectsSource = readFileSync(
  new URL('../netlify/functions/forwarder-projects.js', import.meta.url),
  'utf8'
);
const syncRoadSource = readFileSync(
  new URL('../netlify/functions/sync-road.ts', import.meta.url),
  'utf8'
);
const dataBridgeSyncSource = readFileSync(
  new URL('../dataBridgeSyncService.js', import.meta.url),
  'utf8'
);
const schemaSource = readFileSync(
  new URL('../db/schema.ts', import.meta.url),
  'utf8'
);

test('1. ForwarderWorkspace handleSaveProjectCargo forces complete payload with services array and financial totals', () => {
  // Verifies handleSaveProjectCargo builds line items with cost, sale and merchandise value
  assert.match(
    forwarderWorkspaceSource,
    /const\s+savedLineItem\s*=\s*\{[\s\S]*?cost_eur:\s*lineItemCost[\s\S]*?sale_price_eur:\s*lineItemPrice[\s\S]*?land_freight_cost:\s*calculatedLandFreightCost[\s\S]*?land_freight_sale:\s*lineItemPrice[\s\S]*?valor_total_mercancia_usd:\s*merchandiseValueUsd/i,
    'savedLineItem must include cost, sale, and merchandise value fields'
  );

  // Verifies updatedProject includes services and line_items with aggregated financial totals
  assert.match(
    forwarderWorkspaceSource,
    /const\s+totalServicesCost\s*=\s*updatedLineItems\.reduce\(/,
    'totalServicesCost must aggregate cost_eur across all services'
  );
  assert.match(
    forwarderWorkspaceSource,
    /const\s+totalServicesSale\s*=\s*updatedLineItems\.reduce\(/,
    'totalServicesSale must aggregate sale_price_eur across all services'
  );

  assert.match(
    forwarderWorkspaceSource,
    /updatedProject\s*=\s*\{[\s\S]*?land_freight_cost:\s*totalServicesCost[\s\S]*?land_freight_sale:\s*totalServicesSale[\s\S]*?valor_total_mercancia_usd:\s*merchandiseValueUsd[\s\S]*?line_items:\s*updatedLineItems[\s\S]*?services:\s*updatedLineItems/i,
    'updatedProject must contain land_freight_cost, land_freight_sale, valor_total_mercancia_usd, line_items and services'
  );
});

test('2. persistProjectToDatabase builds complete payload and sends PUT/POST to forwarder-projects endpoint', () => {
  assert.match(
    forwarderWorkspaceSource,
    /const\s+persistProjectToDatabase\s*=\s*async\s*\(\s*projectToSave\s*\)\s*=>\s*\{[\s\S]*?services:\s*servicesList[\s\S]*?line_items:\s*servicesList[\s\S]*?land_freight_cost:\s*Number\(projectToSave\.land_freight_cost\)[\s\S]*?land_freight_sale:\s*Number\(projectToSave\.land_freight_sale[\s\S]*?valor_total_mercancia_usd:\s*Number\(estadoDelValorFobCalculado\)\s*\|\|\s*Number\(valorCalculadoDeItems\)\s*\|\|\s*Number\(projectToSave\.valor_total_mercancia_usd\)/,
    'persistProjectToDatabase must explicitly build payload with services, land_freight_cost, land_freight_sale, and valor_total_mercancia_usd'
  );
});

test('3. forwarder-projects.js backend receives, parses, and defensively updates services JSONB and financial fields', () => {
  // Ensures schema auto-migration creates services, land_freight_sale, valor_total_mercancia_usd
  assert.match(
    forwarderProjectsSource,
    /ALTER\s+TABLE\s+forwarder_projects\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+services\s+JSONB/i,
    'forwarder-projects.js must auto-migrate schema to include services JSONB column'
  );
  assert.match(
    forwarderProjectsSource,
    /ALTER\s+TABLE\s+forwarder_projects\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+land_freight_sale\s+NUMERIC/i,
    'forwarder-projects.js must auto-migrate schema to include land_freight_sale column'
  );
  assert.match(
    forwarderProjectsSource,
    /ALTER\s+TABLE\s+forwarder_projects\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+valor_total_mercancia_usd\s+NUMERIC/i,
    'forwarder-projects.js must auto-migrate schema to include valor_total_mercancia_usd column'
  );

  // Verifies UPDATE query defends against partial overwrites
  assert.match(
    forwarderProjectsSource,
    /services\s*=\s*CASE\s+WHEN\s+\$8::jsonb\s+IS\s+NOT\s+NULL\s+AND\s+jsonb_array_length\(\$8::jsonb\)\s*>\s*0\s+THEN\s+\$8::jsonb\s+ELSE\s+services\s+END/i,
    'forwarder-projects.js must not overwrite existing services if incoming payload has null or empty array'
  );
  assert.match(
    forwarderProjectsSource,
    /land_freight_cost\s*=\s*CASE\s+WHEN\s+\$9::numeric\s*>\s*0\s+THEN\s+\$9::numeric\s+ELSE\s+land_freight_cost\s+END/i,
    'forwarder-projects.js must not overwrite existing land_freight_cost on partial sync'
  );
  assert.match(
    forwarderProjectsSource,
    /land_freight_sale\s*=\s*CASE\s+WHEN\s+\$10::numeric\s*>\s*0\s+THEN\s+\$10::numeric\s+ELSE\s+land_freight_sale\s+END/i,
    'forwarder-projects.js must not overwrite existing land_freight_sale on partial sync'
  );
});

test('4. sync-road.ts endpoint receives, parses, and defensively updates services JSONB and financial fields', () => {
  assert.match(
    syncRoadSource,
    /ALTER\s+TABLE\s+forwarder_projects\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+services\s+JSONB/i,
    'sync-road.ts must auto-migrate schema to include services JSONB column'
  );
  assert.match(
    syncRoadSource,
    /services\s*=\s*CASE\s+WHEN\s+\$10::jsonb\s+IS\s+NOT\s+NULL\s+AND\s+jsonb_array_length\(\$10::jsonb\)\s*>\s*0\s+THEN\s+\$10::jsonb\s+ELSE\s+services\s+END/i,
    'sync-road.ts must not overwrite existing services if incoming payload is partial or empty'
  );
  assert.match(
    syncRoadSource,
    /land_freight_sale\s*=\s*CASE\s+WHEN\s+\$11::numeric\s*>\s*0\s+THEN\s+\$11::numeric\s+ELSE\s+land_freight_sale\s+END/i,
    'sync-road.ts must preserve land_freight_sale if incoming value is not positive'
  );
});

test('5. dataBridgeSyncService buildRoadSyncPayload includes services and land_freight_sale when provided', () => {
  assert.match(
    dataBridgeSyncSource,
    /payload\.services\s*=\s*rawServices/,
    'buildRoadSyncPayload must assign services to payload'
  );
  assert.match(
    dataBridgeSyncSource,
    /payload\.land_freight_sale\s*=\s*land_freight_sale/,
    'buildRoadSyncPayload must assign land_freight_sale to payload'
  );
});

test('6. ForwarderWorkspace protects against services blanking and sale freight reverting to base on sync-road or Data Bridge reload', () => {
  // In handleSyncDataBridge: preserves existing services if incoming payload does not have services
  assert.match(
    forwarderWorkspaceSource,
    /const\s+srvs\s*=\s*\(Array\.isArray\(updated\.services\)\s*&&\s*updated\.services\.length\s*>\s*0\)\s*\?\s*updated\.services\s*:\s*\(\(Array\.isArray\(updated\.line_items\)\s*&&\s*updated\.line_items\.length\s*>\s*0\)\s*\?\s*updated\.line_items\s*:\s*\(activeProject\?\.line_items\s*\|\|\s*activeProject\?\.services\s*\|\|\s*\[\]\)\)/,
    'handleSyncDataBridge must defensively preserve existing services if sync response is partial'
  );

  // In handleSyncDataBridge: sale price preserves persisted land_freight_sale or services total sale
  assert.match(
    forwarderWorkspaceSource,
    /withSrvs\.land_freight_sale\s*\|\|\s*withSrvs\.targetSalePrice\s*\|\|\s*withSrvs\.sale\s*\|\|\s*\(withSrvs\.line_items\s*\|\|\s*\[\]\)\.reduce\(/,
    'handleSyncDataBridge must prioritize persisted land_freight_sale or line items sale sum'
  );
});

test('7. db/schema.ts forwarderProjects table definition includes services, land_freight_sale, and valor_total_mercancia_usd', () => {
  assert.match(
    schemaSource,
    /services:\s*jsonb\("services"\)\.default\(\[\]\)/,
    'schema.ts must define services JSONB column'
  );
  assert.match(
    schemaSource,
    /landFreightSale:\s*numeric\("land_freight_sale",\s*\{\s*mode:\s*"number"\s*\}\)/,
    'schema.ts must define landFreightSale numeric column'
  );
  assert.match(
    schemaSource,
    /valorTotalMercanciaUsd:\s*numeric\("valor_total_mercancia_usd",\s*\{\s*mode:\s*"number"\s*\}\)/,
    'schema.ts must define valorTotalMercanciaUsd numeric column'
  );
});
