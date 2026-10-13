import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const indexHtmlPath = resolve('index.html');

test('1. Invertir la Cabeza Tractora (Vía CSS pura): contenedor tractor-cab con -scale-x-100 y transform scaleX(-1)', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Verificar que el elemento tractor-cab tiene la clase utilitaria -scale-x-100 o transform scaleX(-1)
  assert.match(
    indexSource,
    /<g\s+id="tractor-cab"[^>]*class="[^"]*-scale-x-100[^"]*"[^>]*style="[^"]*scaleX\(-1\)[^"]*"/,
    'El contenedor tractor-cab debe incluir la clase -scale-x-100 y transform: scaleX(-1)'
  );

  // Verificar que existe la regla CSS de inversión en la hoja de estilos
  assert.match(
    indexSource,
    /#tractor-cab\s*\{[\s\S]*?transform:\s*scaleX\(-1\)/,
    'Debe existir regla CSS para #tractor-cab con scaleX(-1)'
  );
});

test('2. Limpieza de Paleta Oscura: Hero card y cabeceras de tablas luminosas (bg-slate-50 / bg-white) y texto text-slate-800', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Hero card contenedor debe usar bg-slate-50 y text-slate-800
  assert.match(
    indexSource,
    /class="executive-vehicle-hero-card[^"]*bg-slate-50[^"]*text-slate-800/,
    'El contenedor del hero debe usar bg-slate-50 y text-slate-800'
  );

  // Hero card regla CSS en light-mode debe usar fondo claro #f8fafc
  assert.match(
    indexSource,
    /#ai-modal\.light-mode\s+\.executive-vehicle-hero-card\s*\{[\s\S]*?background-color:\s*#f8fafc/i,
    'La regla CSS de executive-vehicle-hero-card en light mode debe usar fondo claro'
  );

  // Cabeceras de tabla en modal / comparativas deben usar fondo luminoso y texto oscuro
  assert.match(
    indexSource,
    /<thead[^>]*class="[^"]*bg-slate-50[^"]*text-slate-800/,
    'Las cabeceras de tabla deben usar bg-slate-50 y text-slate-800'
  );
  assert.match(
    indexSource,
    /#ai-modal\.light-mode\s+table\s+thead\s+tr[\s\S]*?background-color:\s*#f8fafc/i,
    'Las cabeceras de tabla en modal light-mode deben sobreescribirse a fondo claro'
  );
});

test('3. Texto Dinámico del Remolque: Variable dinámica con fallback "Mercancía General"', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // No debe quedar el texto estático hardcodeado
  assert.doesNotMatch(
    indexSource,
    /<text[^>]*>CARGA GENERAL \/ PALETS \(13\.6 LDM\)<\/text>/,
    'No debe existir el texto estático hardcodeado CARGA GENERAL / PALETS (13.6 LDM)'
  );

  // Extraer función buildExecutiveVehicleHeroSVG para ejecución en entorno simulado
  const heroFnMatch = indexSource.match(/function buildExecutiveVehicleHeroSVG\([\s\S]*?\n\s*\}\s*window\.buildExecutiveVehicleHeroSVG\s*=\s*buildExecutiveVehicleHeroSVG;/);
  assert.ok(heroFnMatch, 'buildExecutiveVehicleHeroSVG debe estar definida');

  const sandbox = {
    window: {},
    document: {
      getElementById: () => null
    },
    State: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(heroFnMatch[0], sandbox);

  // Caso Fallback: sin mercancía definida -> "Mercancía General"
  const defaultHtml = sandbox.window.buildExecutiveVehicleHeroSVG({
    isRail: false,
    trucksNeeded: 2,
    unitsNeeded: 2
  });
  assert.ok(
    defaultHtml.includes('Mercancía General'),
    'Debe mostrar el fallback "Mercancía General" cuando no hay mercancía'
  );

  // Caso Dinámico con cargoName
  const cargoNameHtml = sandbox.window.buildExecutiveVehicleHeroSVG({
    isRail: false,
    trucksNeeded: 3,
    unitsNeeded: 3,
    cargoName: 'Bobinas de Acero'
  });
  assert.ok(
    cargoNameHtml.includes('Bobinas de Acero'),
    'Debe mostrar el nombre de la mercancía dinámico "Bobinas de Acero"'
  );

  // Caso Dinámico con cargo_category
  const cargoCategoryHtml = sandbox.window.buildExecutiveVehicleHeroSVG({
    isRail: false,
    trucksNeeded: 4,
    unitsNeeded: 4,
    cargo_category: 'Automoción y Componentes'
  });
  assert.ok(
    cargoCategoryHtml.includes('Automoción y Componentes'),
    'Debe mostrar la categoría de carga dinámica "Automoción y Componentes"'
  );
});

test('4. Erradicación Total de Fondos Oscuros: SVG transparente y bloque Cotización Comercial con bg-white y border-slate-200', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // 1. En el SVG no debe existir el rect de fondo oscuro #0b1329
  assert.doesNotMatch(
    indexSource,
    /<rect\s+x="0"\s+y="0"\s+width="760"\s+height="140"\s+fill="#0b1329"/,
    'El SVG no debe tener el rect de fondo oscuro #0b1329 (debe ser transparente)'
  );

  // 2. El bloque Cotización Comercial y Precio de Venta Sugerido debe tener fondo claro y borde border-slate-200
  assert.match(
    indexSource,
    /class="bg-white\s+p-5\s+rounded-xl\s+border\s+border-slate-200\s+shadow-sm\s+text-slate-800"[\s\S]*?Cotización Comercial y Precio de Venta Sugerido \(Flete Final\)/,
    'El bloque de cotización debe usar bg-white, border-slate-200 y text-slate-800'
  );

  // 3. Las tarjetas internas dentro de la cotización comercial deben usar fondos claros bg-slate-50
  assert.doesNotMatch(
    indexSource,
    /bg-slate-950\/70\s+p-4\s+rounded-xl\s+border\s+border-slate-800[\s\S]*?Precio de Venta Sugerido/,
    'Las tarjetas de precio de venta no deben tener fondos oscuros bg-slate-950/70'
  );
});

test('5. Remolque Dinámico Seguro (Tauliner vs Plataforma): isPlatform condicional y renderizado visual', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  const heroFnMatch = indexSource.match(/function buildExecutiveVehicleHeroSVG\([\s\S]*?\n\s*\}\s*window\.buildExecutiveVehicleHeroSVG\s*=\s*buildExecutiveVehicleHeroSVG;/);
  assert.ok(heroFnMatch, 'buildExecutiveVehicleHeroSVG debe estar definida');

  const sandbox = {
    window: {},
    document: {
      getElementById: () => null
    },
    State: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(heroFnMatch[0], sandbox);

  // A. Caso Tauliner (Lona cerrada): vehicleType estándar
  const taulinerHtml = sandbox.window.buildExecutiveVehicleHeroSVG({
    isRail: false,
    trucksNeeded: 2,
    unitsNeeded: 2,
    vehicleType: 'Tráiler Tauliner (13.6m)'
  });
  assert.ok(taulinerHtml.includes('trailer-tauliner'), 'Debe renderizar grupo trailer-tauliner');
  assert.ok(!taulinerHtml.includes('trailer-platform'), 'NO debe renderizar trailer-platform para Tauliner');
  assert.ok(taulinerHtml.includes('fill="#1e293b"'), 'El texto dinámico debe usar color oscuro fill="#1e293b"');

  // B. Caso Plataforma: vehicleType "Plataforma"
  const platformVehicleHtml = sandbox.window.buildExecutiveVehicleHeroSVG({
    isRail: false,
    trucksNeeded: 2,
    unitsNeeded: 2,
    vehicleType: 'Camión Plataforma'
  });
  assert.ok(platformVehicleHtml.includes('trailer-platform'), 'Debe renderizar grupo trailer-platform');
  assert.ok(!platformVehicleHtml.includes('trailer-tauliner'), 'NO debe renderizar trailer-tauliner para Plataforma');
  assert.ok(platformVehicleHtml.includes('fill="#cbd5e1"'), 'Debe incluir bloques de carga descubierta con fill="#cbd5e1"');
  assert.ok(platformVehicleHtml.includes('fill="#1e293b"'), 'El texto dinámico debe usar color oscuro fill="#1e293b"');

  // C. Caso Flatbed: vehicleType "Flatbed"
  const flatbedHtml = sandbox.window.buildExecutiveVehicleHeroSVG({
    isRail: false,
    trucksNeeded: 2,
    unitsNeeded: 2,
    vehicleType: 'Flatbed Semi-Trailer'
  });
  assert.ok(flatbedHtml.includes('trailer-platform'), 'Flatbed debe activar trailer-platform');

  // D. Caso Big Bag: cargoName "Big Bags de Cemento"
  const bigBagHtml = sandbox.window.buildExecutiveVehicleHeroSVG({
    isRail: false,
    trucksNeeded: 2,
    unitsNeeded: 2,
    cargoName: 'Big Bags de Cemento'
  });
  assert.ok(bigBagHtml.includes('trailer-platform'), 'Carga con Big Bag debe activar trailer-platform');
  assert.ok(bigBagHtml.includes('Big Bags de Cemento'), 'Debe mostrar el nombre de la mercancía');

  // E. Caso Granel: cargoDesc "Granel Mineral"
  const granelHtml = sandbox.window.buildExecutiveVehicleHeroSVG({
    isRail: false,
    trucksNeeded: 2,
    unitsNeeded: 2,
    cargoName: 'Granel Mineral'
  });
  assert.ok(granelHtml.includes('trailer-platform'), 'Carga a granel debe activar trailer-platform');
});
