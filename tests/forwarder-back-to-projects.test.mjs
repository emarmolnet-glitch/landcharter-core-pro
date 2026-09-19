import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentSource = await readFile(
  new URL("../src/components/ForwarderWorkspace.jsx", import.meta.url),
  "utf8"
);

test("1. ForwarderWorkspace preserves '← Volver a Proyectos' and '⚡ Sync DataBridge' at NIVEL SUPERIOR", () => {
  assert.match(componentSource, /← Volver a Proyectos/);
  assert.match(componentSource, /setActiveProject\(null\)/);
  assert.match(componentSource, /id="btn-sync-databridge"/);
});

test("2. NIVEL MEDIO (Lista de Empaque): header is clean and does NOT contain '← Volver a Proyectos' or 'Sync DataBridge'", () => {
  // Finds the section of Lista de Empaque header flex container
  const packingListHeaderMatch = componentSource.match(
    /<div className="flex justify-between items-center">\s*<h3 className="text-sm font-black text-blue-600 uppercase tracking-wider">1\. Lista de Empaque[\s\S]*?<\/h3>\s*<div className="flex items-center gap-2">([\s\S]*?)<\/div>\s*<\/div>/
  );
  assert.ok(packingListHeaderMatch, "Packing list header container must exist");
  const packingListHeader = packingListHeaderMatch[1];

  assert.doesNotMatch(
    packingListHeader,
    /← Volver a Proyectos/,
    "Packing list header must be clean and NOT contain '← Volver a Proyectos'"
  );
  assert.doesNotMatch(
    packingListHeader,
    /Sync DataBridge/,
    "Packing list header must be clean and NOT contain 'Sync DataBridge'"
  );
  assert.match(packingListHeader, /Importar PDF\/Excel/);
  assert.match(packingListHeader, /top-cargo-category/);
  assert.match(packingListHeader, /\+ Añadir Pieza/);
  assert.match(packingListHeader, /btn-recalculate-cargo/);
});

test("3. NIVEL INFERIOR: bottom container under HERRAMIENTAS COMERCIALES Y REGULATORIAS includes both buttons", () => {
  const bottomSectionMatch = componentSource.match(
    /aria-label="Herramientas Comerciales y Regulatorias"[\s\S]*?<\/section>\s*<div className="flex flex-wrap items-center justify-start gap-3 mt-6 mb-8">([\s\S]*?)<\/div>/
  );
  assert.ok(bottomSectionMatch, "Bottom container with class 'flex flex-wrap items-center justify-start gap-3 mt-6 mb-8' must exist under Herramientas Comerciales");
  const bottomContent = bottomSectionMatch[1];

  assert.match(bottomContent, /← Volver a Proyectos/);
  assert.match(bottomContent, /⚡ Sync DataBridge/);
  assert.match(bottomContent, /setActiveProject\(null\)/);
  assert.match(bottomContent, /handleSyncDataBridge/);
});

test("4. Fix de Estado Fantasma: strict truck hours guard sets 2h and cleans route on !activeProject or totalWeightKg === 0", () => {
  assert.match(
    componentSource,
    /if\s*\(!activeProject\s*\|\|\s*totalWeightKg\s*===\s*0\)\s*\{\s*setLoadTime\(2\);\s*setDischargeTime\(2\);\s*setOrigin\(''\);\s*setDestination\(''\);/
  );
  assert.match(componentSource, /const\s+setLoadTime\s*=\s*setLoadingRate/);
  assert.match(componentSource, /const\s+setDischargeTime\s*=\s*setDischargingRate/);
});

test("5. Route inputs deduplication: single structured row with 5 fields and no duplicate Origen/Destino inputs", () => {
  // Must have single 5-column row
  const routeSectionMatch = componentSource.match(
    /Ruta Terrestre, Tiempos de Almacén y Gestión de Paralizaciones[\s\S]*?<\/section>/
  );
  assert.ok(routeSectionMatch, "Route section must exist");
  const routeSection = routeSectionMatch[0];

  // Must only have exactly 1 occurrence of id="input-pol" and id="input-pod"
  const polMatches = routeSection.match(/id="input-pol"/g) || [];
  const podMatches = routeSection.match(/id="input-pod"/g) || [];
  assert.equal(polMatches.length, 1, "There must only be 1 Origen input");
  assert.equal(podMatches.length, 1, "There must only be 1 Destino input");

  // Verify fields in the structured row
  assert.match(routeSection, /Origen \(Carga\)/);
  assert.match(routeSection, /Destino \(Entrega\)/);
  assert.match(routeSection, /Distancia Ruta \(KM\)/);
  assert.match(routeSection, /Tiempo Carga \(H\)/);
  assert.match(routeSection, /Tiempo Descarga \(H\)/);
});

test("6. RESTAURACIÓN SUPERIOR ABSOLUTA: top button container above 1. Lista de Empaque contains both controls", () => {
  const topContainerMatch = componentSource.match(
    /<div className="flex flex-wrap items-center justify-start gap-3 mb-6">([\s\S]*?)<\/div>\s*<section className="space-y-4">\s*<div className="flex justify-between items-center">\s*<h3 className="text-sm font-black text-blue-600 uppercase tracking-wider">1\. Lista de Empaque/
  );
  assert.ok(
    topContainerMatch,
    "Top container with class 'flex flex-wrap items-center justify-start gap-3 mb-6' must be injected right above '1. Lista de Empaque'"
  );
  const topContent = topContainerMatch[1];
  assert.match(topContent, /← Volver a Proyectos/);
  assert.match(topContent, /⚡ Sync DataBridge/);
  assert.match(topContent, /setIsCargoModalOpen\(false\)/);
  assert.match(topContent, /setActiveProject\(null\)/);
  assert.match(topContent, /handleSyncDataBridge/);
});
