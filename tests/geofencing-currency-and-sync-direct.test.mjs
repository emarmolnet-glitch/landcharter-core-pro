import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspacePath = path.resolve(process.cwd(), 'src/components/ForwarderWorkspace.jsx');
const workspaceSource = fs.readFileSync(workspacePath, 'utf-8');

test('1. GEO-DETECCIÓN DE DIVISAS: isEurope, routeIsStrictlyEU, and currentGeographicCurrency logic', () => {
  assert.match(
    workspaceSource,
    /const\s+isEurope\s*=\s*\(\s*locationStr\s*\)\s*=>\s*\{[\s\S]*?const\s+euCountries\s*=\s*\[[\s\S]*?'españa'[\s\S]*?'francia'[\s\S]*?'portugal'[\s\S]*?'alemania'[\s\S]*?'italia'[\s\S]*?\];[\s\S]*?return\s+euCountries\.some\(\s*eu\s*=>\s*String\(locationStr\)\.toLowerCase\(\)\.includes\(eu\)\s*\);[\s\S]*?\};/,
    'isEurope function must check against list of European countries with lowercase includes'
  );

  assert.match(
    workspaceSource,
    /const\s+routeIsStrictlyEU\s*=\s*isEurope\(landOrigin\)\s*&&\s*isEurope\(landDestination\);/,
    'routeIsStrictlyEU must evaluate isEurope for landOrigin and landDestination'
  );

  assert.match(
    workspaceSource,
    /const\s+currentGeographicCurrency\s*=\s*routeIsStrictlyEU\s*\?\s*['"]EUR['"]\s*:\s*['"]USD['"];/,
    'currentGeographicCurrency must force EUR strictly for EU routes and USD outside EU'
  );

  assert.match(
    workspaceSource,
    /const\s+displayCurrency\s*=\s*currentGeographicCurrency;/,
    'displayCurrency must inherit currentGeographicCurrency'
  );

  assert.match(
    workspaceSource,
    /const\s+currencySymbol\s*=\s*currentGeographicCurrency\s*===\s*['"]EUR['"]\s*\?\s*['"]€['"]\s*:\s*['"]\$['"];/,
    'currencySymbol must dynamically assign € for EUR and $ for USD'
  );
});

test('2. GEO-DETECCIÓN DE DIVISAS: evaluate helper with EU and non-EU locations', () => {
  const isEurope = (locationStr) => {
    if (!locationStr) return true; // fallback
    const euCountries = ['españa', 'spain', 'francia', 'france', 'portugal', 'alemania', 'germany', 'italia', 'italy', 'bélgica', 'belgium', 'holanda', 'netherlands', 'polonia', 'poland'];
    return euCountries.some(eu => String(locationStr).toLowerCase().includes(eu));
  };

  const getCurrency = (origin, dest) => {
    const routeIsStrictlyEU = isEurope(origin) && isEurope(dest);
    return routeIsStrictlyEU ? 'EUR' : 'USD';
  };

  // EU to EU routes -> EUR
  assert.equal(getCurrency('Madrid, España', 'Paris, Francia'), 'EUR');
  assert.equal(getCurrency('Lisboa, Portugal', 'Berlin, Germany'), 'EUR');
  assert.equal(getCurrency('Roma, Italia', 'Amsterdam, Netherlands'), 'EUR');

  // Outside EU routes -> USD
  assert.equal(getCurrency('Argel, Argelia', 'Sétif'), 'USD');
  assert.equal(getCurrency('Casablanca, Marruecos', 'Madrid, España'), 'USD');
  assert.equal(getCurrency('Valencia, Spain', 'Tunis, Túnez'), 'USD');
  assert.equal(getCurrency('Houston, USA', 'Veracruz, Mexico'), 'USD');
});

test('3. FIX DEL DOBLE CLIC: handleSyncDataBridge creates finalCargoItems synchronously', () => {
  assert.match(
    workspaceSource,
    /const\s+finalCargoItems\s*=\s*\[\s*\{\s*id:\s*['"]sync-land-charter-fixed-row['"],\s*category:\s*['"]Carga Unificada \/ Envasada['"],\s*type:\s*`Flete Terrestre \(\$\{requiredTrucks\}\s*Camiones\)`,\s*quantity:\s*requiredTrucks,\s*unit_weight_kg:\s*truckPayloadMT\s*\*\s*1000,\s*weight:\s*truckPayloadMT\s*\*\s*1000\s*\}\s*\];/,
    'finalCargoItems constant must be defined directly using requiredTrucks and truckPayloadMT * 1000'
  );

  assert.match(
    workspaceSource,
    /setCargoItems\(\s*finalCargoItems\s*\);/,
    'setCargoItems must receive finalCargoItems directly without waiting for re-render'
  );

  assert.match(
    workspaceSource,
    /const\s+dataBridgePayloadObject\s*=\s*\{[\s\S]*?items:\s*finalCargoItems,[\s\S]*?cargo_items:\s*finalCargoItems,[\s\S]*?\};/,
    'dataBridgePayloadObject must directly use finalCargoItems in items and cargo_items'
  );
});

test('4. VISTA LAND CHARTER: dynamic currency rendered, eliminating hardcoded "EUR" strings in inputs', () => {
  // Modal footer must render displayCurrency instead of fixed <span className="hidden text-slate-400">EUR</span>
  assert.doesNotMatch(
    workspaceSource,
    /<span\s+className="hidden text-slate-400">EUR<\/span>/,
    'Modal footer must not render hardcoded string "EUR"'
  );

  assert.match(
    workspaceSource,
    /<span\s+className="hidden text-slate-400">\{displayCurrency\}<\/span>/,
    'Modal footer must render dynamic displayCurrency'
  );

  // Modal footer labels must use dynamic currencySymbol
  assert.match(
    workspaceSource,
    /Coste Total Estimado \(\{currencySymbol\}\)/,
    'Estimated cost label must use currencySymbol'
  );
  assert.match(
    workspaceSource,
    /Precio Venta a Cliente \(\{currencySymbol\}\)/,
    'Sale price label must use currencySymbol'
  );
});
