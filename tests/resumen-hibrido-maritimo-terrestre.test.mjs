import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderWorkspaceSource = readFileSync(
  new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url),
  'utf8'
);

test('1. ForwarderWorkspace define extracción segura de variables marítimas desde activeProject', () => {
  // Origen marítimo con fallback 'N/A'
  assert.match(
    forwarderWorkspaceSource,
    /const\s+seaOrigin\s*=\s*activeProject\?\.items\?\.\[0\]\?\.payload_data\?\.route_and_chartering\?\.pol\s*\|\|\s*activeProject\?\.route_and_chartering\?\.pol\s*\|\|\s*activeProject\?\.pol\s*\|\|\s*['"]N\/A['"]/,
    'Debe definir seaOrigin con extracción exhaustiva desde items[0].payload_data o route_and_chartering, fallback "N/A"'
  );

  // Destino marítimo con fallback 'N/A'
  assert.match(
    forwarderWorkspaceSource,
    /const\s+seaDest\s*=\s*activeProject\?\.items\?\.\[0\]\?\.payload_data\?\.route_and_chartering\?\.pod\s*\|\|\s*activeProject\?\.route_and_chartering\?\.pod\s*\|\|\s*activeProject\?\.pod\s*\|\|\s*['"]N\/A['"]/,
    'Debe definir seaDest con extracción exhaustiva desde items[0].payload_data o route_and_chartering, fallback "N/A"'
  );

  // Millas marítimas con fallback 0
  assert.match(
    forwarderWorkspaceSource,
    /const\s+seaMiles\s*=\s*Number\(activeProject\?\.items\?\.\[0\]\?\.payload_data\?\.route_and_chartering\?\.distance_nm\)/,
    'Debe definir seaMiles con extracción exhaustiva desde items[0].payload_data o route_and_chartering, fallback 0'
  );

  // Toneladas marítimas con cálculo por items o fallback
  assert.match(
    forwarderWorkspaceSource,
    /const\s+seaTons\s*=\s*Number\(activeProject\?\.total_weight_tons\)/,
    'Debe definir seaTons extrayendo total_weight_tons o sumando el peso de los items'
  );

  // Variable de flete marítimo venta
  assert.match(
    forwarderWorkspaceSource,
    /ocean_freight_sale/,
    'Debe identificar la variable ocean_freight_sale'
  );
  assert.match(
    forwarderWorkspaceSource,
    /target_freight/,
    'Debe contemplar target_freight'
  );
  assert.match(
    forwarderWorkspaceSource,
    /seaFreightSale/,
    'Debe almacenar el flete marítimo venta en una variable dedicada'
  );
});

test('2. ForwarderWorkspace renderiza el Banner Marítimo (Nivel 1) con título y estilos requeridos', () => {
  // Título oficial requerido
  assert.match(
    forwarderWorkspaceSource,
    /🚢\s*CONTEXTO MARÍTIMO \(CORE PRO\)/,
    'Debe incluir el título exacto "🚢 CONTEXTO MARÍTIMO (CORE PRO)"'
  );

  // Bloque visual con fondo sutil azul y borde azul claro
  assert.match(
    forwarderWorkspaceSource,
    /bg-blue-50\/50\s+border\s+border-blue-200/,
    'El banner debe contar con estilos bg-blue-50/50 y border-blue-200'
  );

  // Cuadrícula de 4 o 5 columnas
  assert.match(
    forwarderWorkspaceSource,
    /grid\s+grid-cols-1\s+sm:grid-cols-2\s+lg:grid-cols-4/,
    'El banner marítimo debe organizarse en una cuadrícula de columnas responsiva'
  );

  // Contenido de las 4 tarjetas
  assert.match(
    forwarderWorkspaceSource,
    /\{seaOrigin\}\s*<span[^>]*>➔<\/span>\s*\{seaDest\}/,
    'Debe mostrar la ruta marítima {seaOrigin} ➔ {seaDest}'
  );
  assert.match(
    forwarderWorkspaceSource,
    /\{Number\(seaMiles\)\.toLocaleString\('es-ES'\)\}\s*<span[^>]*>NM<\/span>/,
    'Debe mostrar las millas náuticas {seaMiles} NM'
  );
  assert.match(
    forwarderWorkspaceSource,
    /Number\(seaTons\)\.toLocaleString[\s\S]*?Toneladas/,
    'Debe mostrar el tonelaje {seaTons} Toneladas'
  );
  assert.match(
    forwarderWorkspaceSource,
    /formattedSeaFreightSale/,
    'Debe mostrar el Flete Marítimo (Venta) formateado en moneda'
  );
});

test('3. ForwarderWorkspace conserva intacto el Resumen Terrestre (Nivel 2) bajo el banner marítimo', () => {
  // Verificación de la cuadrícula terrestre completa con sus 5 métricas
  assert.match(
    forwarderWorkspaceSource,
    /<span[^>]*>Ruta Terrestre<\/span>/,
    'Debe conservar la tarjeta de Ruta Terrestre'
  );
  assert.match(
    forwarderWorkspaceSource,
    /<span[^>]*>Distancia \(km\)<\/span>/,
    'Debe conservar la tarjeta de Distancia (km)'
  );
  assert.match(
    forwarderWorkspaceSource,
    /<span[^>]*>Tipo de Camión<\/span>/,
    'Debe conservar la tarjeta de Tipo de Camión'
  );
  assert.match(
    forwarderWorkspaceSource,
    /<span[^>]*>Metros Lineales \(LDM\)<\/span>/,
    'Debe conservar la tarjeta de Metros Lineales (LDM)'
  );
  assert.match(
    forwarderWorkspaceSource,
    /<span[^>]*>Flete Terrestre vs\. Venta<\/span>/,
    'Debe conservar la tarjeta de Flete Terrestre vs. Venta'
  );

  // Mantiene los cálculos provisionales de LDM y Flete Terrestre vs Venta con regla de distancia cero
  assert.match(
    forwarderWorkspaceSource,
    /const\s+rLdm\s*=\s*Number\(/,
    'Debe mantener el cálculo provisional de LDM'
  );
  assert.match(
    forwarderWorkspaceSource,
    /const\s+rCostEur\s*=\s*isZeroDist\s*\?\s*0\s*:\s*\(Number\(projectCost\)/,
    'Debe mantener el cálculo provisional del coste terrestre con blindaje de distancia cero'
  );
  assert.match(
    forwarderWorkspaceSource,
    /const\s+rSaleEur\s*=\s*isZeroDist\s*\?\s*0\s*:\s*\(Number\(projectSale\)/,
    'Debe mantener el cálculo provisional de la venta terrestre con blindaje de distancia cero'
  );
});

test('4. Inyección de Visual Health Checks (OK / Vacío / Faltan datos) en Banner Marítimo y Nivel 2', () => {
  // Validación de Ruta Marítima
  assert.match(
    forwarderWorkspaceSource,
    /seaOrigin\s*!==\s*['"]N\/A['"]\s*&&\s*seaDest\s*!==\s*['"]N\/A['"]\s*\?\s*[\s\S]*?✅ OK[\s\S]*?:\s*[\s\S]*?⚠️ Faltan datos/,
    'Debe renderizar ✅ OK o ⚠️ Faltan datos en la ruta marítima'
  );

  // Validación de Distancia Marítima
  assert.match(
    forwarderWorkspaceSource,
    /seaMiles\s*>\s*0\s*\?\s*[\s\S]*?✅ OK[\s\S]*?:\s*[\s\S]*?⚠️ Vacío/,
    'Debe renderizar ✅ OK o ⚠️ Vacío en la distancia marítima'
  );

  // Validación de Flete Marítimo Venta
  assert.match(
    forwarderWorkspaceSource,
    /seaFreightSale\s*>\s*0\s*\?\s*[\s\S]*?✅ OK[\s\S]*?:\s*[\s\S]*?⚠️ Vacío/,
    'Debe renderizar ✅ OK o ⚠️ Vacío en el flete marítimo venta'
  );

  // Validación de Ruta Terrestre
  assert.match(
    forwarderWorkspaceSource,
    /\(?rOrigin\s*&&\s*rDestination\)?\s*\?\s*[\s\S]*?✅ OK[\s\S]*?:\s*[\s\S]*?⚠️ Faltan datos/,
    'Debe renderizar ✅ OK o ⚠️ Faltan datos en la ruta terrestre'
  );

  // Validación de Distancia Terrestre
  assert.match(
    forwarderWorkspaceSource,
    /rDistKm\s*>\s*0\s*\?\s*[\s\S]*?✅ OK[\s\S]*?:\s*[\s\S]*?⚠️ Vacío/,
    'Debe renderizar ✅ OK o ⚠️ Vacío en la distancia terrestre'
  );

  // Labels de Inputs Terrestres
  assert.match(
    forwarderWorkspaceSource,
    /Origen \(Carga\) \* \{landOrigin \?[\s\S]*?✅ OK[\s\S]*?:[\s\S]*?⚠️ Vacío[\s\S]*?\}/,
    'Label de Origen debe mostrar validador visual'
  );
  assert.match(
    forwarderWorkspaceSource,
    /Destino \(Entrega\) \* \{landDestination \?[\s\S]*?✅ OK[\s\S]*?:[\s\S]*?⚠️ Vacío[\s\S]*?\}/,
    'Label de Destino debe mostrar validador visual'
  );
  assert.match(
    forwarderWorkspaceSource,
    /Distancia Ruta \(KM\) \* \{distanceKm > 0 \?[\s\S]*?✅ OK[\s\S]*?:[\s\S]*?⚠️ Vacío[\s\S]*?\}/,
    'Label de Distancia KM debe mostrar validador visual'
  );
});

test('5. Simulación funcional: cálculo y formateo de datos marítimos', () => {
  // Caso 1: Proyecto con campos directos de Core PRO
  const projectA = {
    pol: 'Valencia Port',
    pod: 'Rotterdam Port',
    distance_nm: 1850,
    total_weight_tons: 24000,
    ocean_freight_sale: 450000,
  };

  const seaOriginA = projectA?.pol || projectA?.origin || 'N/A';
  const seaDestA = projectA?.pod || projectA?.destination || 'N/A';
  const seaMilesA = projectA?.distance_nm || projectA?.distance || 0;
  const seaTonsA = projectA?.total_weight_tons || 0;
  const seaFreightSaleA = Number(projectA?.ocean_freight_sale ?? projectA?.target_freight ?? 0);
  const formattedSaleA = `${seaFreightSaleA.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  assert.strictEqual(seaOriginA, 'Valencia Port');
  assert.strictEqual(seaDestA, 'Rotterdam Port');
  assert.strictEqual(seaMilesA, 1850);
  assert.strictEqual(seaTonsA, 24000);
  assert.strictEqual(formattedSaleA, '450.000,00 €');

  // Caso 2: Proyecto con campos alternativos (origin, destination, distance, cálculo de peso por items, target_freight)
  const projectB = {
    origin: 'Algeciras',
    destination: 'Genoa',
    distance: 820,
    items: [
      { quantity: 10, unit_weight_kg: 5000 }, // 50t
      { quantity: 5, unit_weight_kg: 2000 },  // 10t
    ],
    target_freight: 125000,
  };

  const seaOriginB = projectB?.pol || projectB?.origin || 'N/A';
  const seaDestB = projectB?.pod || projectB?.destination || 'N/A';
  const seaMilesB = projectB?.distance_nm || projectB?.distance || 0;
  const calculatedTonsB = projectB.items.reduce((acc, it) => acc + (it.quantity * it.unit_weight_kg), 0) / 1000;
  const seaTonsB = projectB?.total_weight_tons || calculatedTonsB || 0;
  const seaFreightSaleB = Number(projectB?.ocean_freight_sale ?? projectB?.target_freight ?? 0);
  const formattedSaleB = `${seaFreightSaleB.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  assert.strictEqual(seaOriginB, 'Algeciras');
  assert.strictEqual(seaDestB, 'Genoa');
  assert.strictEqual(seaMilesB, 820);
  assert.strictEqual(seaTonsB, 60);
  assert.strictEqual(formattedSaleB, '125.000,00 €');

  // Caso 3: Proyecto vacío o sin datos (resiliencia y valores por defecto)
  const projectC = {};
  const seaOriginC = projectC?.route_and_chartering?.pol || projectC?.data?.pol || projectC?.pol || 'N/A';
  const seaDestC = projectC?.route_and_chartering?.pod || projectC?.data?.pod || projectC?.pod || 'N/A';
  const seaMilesC = projectC?.route_and_chartering?.distance_nm || projectC?.distance_nm || projectC?.data?.distance_nm || 0;
  const seaTonsC = projectC?.total_weight_tons || 0;
  const seaFreightSaleC = Number(projectC?.ocean_freight_sale ?? projectC?.target_freight ?? 0);
  const formattedSaleC = seaFreightSaleC > 0
    ? `${seaFreightSaleC.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
    : '0,00 €';

  assert.strictEqual(seaOriginC, 'N/A');
  assert.strictEqual(seaDestC, 'N/A');
  assert.strictEqual(seaMilesC, 0);
  assert.strictEqual(seaTonsC, 0);
  assert.strictEqual(formattedSaleC, '0,00 €');

  // Caso 4: Proyecto con propiedades anidadas en route_and_chartering y data (Neon Deep Extraction)
  const projectD = {
    route_and_chartering: {
      pol: 'Bilbao Port',
      pod: 'Antwerp Port',
      distance_nm: 650,
    },
    data: {
      pol: 'Fallback Port',
      pod: 'Fallback Dest',
      distance_nm: 999,
    },
  };
  const seaOriginD = projectD?.route_and_chartering?.pol || projectD?.data?.pol || projectD?.pol || 'N/A';
  const seaDestD = projectD?.route_and_chartering?.pod || projectD?.data?.pod || projectD?.pod || 'N/A';
  const seaMilesD = projectD?.route_and_chartering?.distance_nm || projectD?.distance_nm || projectD?.data?.distance_nm || 0;
  assert.strictEqual(seaOriginD, 'Bilbao Port');
  assert.strictEqual(seaDestD, 'Antwerp Port');
  assert.strictEqual(seaMilesD, 650);

  // Caso 5: Proyecto con propiedades anidadas en data (fallback de route_and_chartering)
  const projectE = {
    data: {
      pol: 'Barcelona',
      pod: 'Marseille',
      distance_nm: 220,
    },
  };
  const seaOriginE = projectE?.route_and_chartering?.pol || projectE?.data?.pol || projectE?.pol || 'N/A';
  const seaDestE = projectE?.route_and_chartering?.pod || projectE?.data?.pod || projectE?.pod || 'N/A';
  const seaMilesE = projectE?.route_and_chartering?.distance_nm || projectE?.distance_nm || projectE?.data?.distance_nm || 0;
  assert.strictEqual(seaOriginE, 'Barcelona');
  assert.strictEqual(seaDestE, 'Marseille');
  assert.strictEqual(seaMilesE, 220);
});
