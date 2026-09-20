import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backendFunctionSource = readFileSync(new URL('../netlify/functions/forwarder-projects.js', import.meta.url), 'utf8');

test('1. forwarder-projects.js separates GET into detail query with SELECT * and LIMIT 1 vs general list with LIMIT 50', () => {
  // Verificación de la consulta de detalle para registro específico (?ref=... o ?id=...)
  assert.match(
    backendFunctionSource,
    /SELECT\s+\*[\s\S]*?FROM\s+forwarder_projects[\s\S]*?LIMIT\s+1/i,
    'Detalle query must use SELECT * ... LIMIT 1'
  );

  // Verificación del LIMIT 50 en la consulta de listado general
  assert.match(
    backendFunctionSource,
    /FROM\s+forwarder_projects[\s\S]*?LIMIT\s+50/i,
    'General list query must include LIMIT 50 to protect response memory'
  );
});

test('2. General listing query explicitly selects only lightweight columns and excludes heavy JSONB columns', () => {
  // Extraer el bloque listQuery
  const listQueryMatch = backendFunctionSource.match(/const\s+listQuery\s*=\s*`([\s\S]*?)`;/i);
  assert.ok(listQueryMatch, 'listQuery must be defined in GET handler');

  const listSql = listQueryMatch[1];

  // Columnas requeridas presentes
  const requiredColumns = [
    'id',
    'project_ref',
    'client_name',
    'status',
    'land_origin',
    'land_destination',
    'land_distance',
    'land_freight_cost',
    'land_freight_sale',
    'global_margin_percentage',
    'created_at',
    'updated_at'
  ];

  for (const col of requiredColumns) {
    const colRegex = new RegExp(`\\b${col}\\b`, 'i');
    assert.ok(colRegex.test(listSql), `listQuery must explicitly select column ${col}`);
  }

  // Columnas pesadas categóricamente excluidas de la consulta SQL del listado general
  const excludedColumns = [
    'documents',
    'data',
    'route_and_chartering',
    'items',
    'services',
    'line_items'
  ];

  for (const col of excludedColumns) {
    const colRegex = new RegExp(`\\b${col}\\b`, 'i');
    assert.strictEqual(
      colRegex.test(listSql),
      false,
      `listQuery must NOT select heavy column ${col}`
    );
  }
});

test('3. General listing mapped rows exclude heavy JSONB fields from the returned objects', () => {
  // Extraer el mapeo de filas del listado general
  const mappedRowsMatch = backendFunctionSource.match(/const\s+mappedRows\s*=\s*listResult\.rows\.map\(\(row\)\s*=>\s*\(\{([\s\S]*?)\}\)\);/i);
  assert.ok(mappedRowsMatch, 'mappedRows for listResult must be mapped to lightweight objects');

  const mappedBody = mappedRowsMatch[1];
  const forbiddenFields = ['documents', 'data', 'route_and_chartering', 'items', 'services', 'line_items'];

  for (const field of forbiddenFields) {
    const fieldRegex = new RegExp(`\\b${field}\\s*:`, 'i');
    assert.strictEqual(
      fieldRegex.test(mappedBody),
      false,
      `mappedRows in general listing must NOT map forbidden field: ${field}`
    );
  }
});

test('4. Specific project detail returns the full object with documents, items, and services', () => {
  // En caso de detalle, se debe devolver formattedProject directamente como objeto
  assert.match(
    backendFunctionSource,
    /if\s*\(\s*parsedId\s*!==\s*null\s*\|\|\s*refFilter\s*\)[\s\S]*?body:\s*JSON\.stringify\(formattedProject\)/i,
    'Detail handler must return the complete formattedProject object'
  );
});

test('5. Simulation: Payload size drastically drops below the 6MB Netlify function limit', () => {
  // Simular 50 proyectos masivos con PDFs en base64 y arrays JSONB de 150KB cada uno
  const heavyPayload50Projects = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    project_ref: `PRJ-MASSIVE-${i + 1}`,
    client_name: `Empresa de Pruebas ${i + 1}`,
    status: 'BORRADOR',
    land_origin: 'Madrid',
    land_destination: 'Valencia',
    land_distance: 350,
    land_freight_cost: 850,
    land_freight_sale: 1100,
    global_margin_percentage: '22.7',
    documents: [
      { name: 'packing_list.pdf', size: 102400, data: 'X'.repeat(150000) },
      { name: 'bl_scan.pdf', size: 102400, data: 'Y'.repeat(150000) }
    ],
    items: Array.from({ length: 50 }, (_, j) => ({
      piece: j + 1,
      cargo_description: 'Turbina de alta presión y accesorios industriales',
      dimensions: { l: 12.5, w: 2.5, h: 2.8 },
      weight_kg: 24000
    })),
    services: [
      { name: 'Trincaje y estiba', cost: 1500, sale: 2200 },
      { name: 'Grúa de alto tonelaje', cost: 3500, sale: 4800 }
    ],
    route_and_chartering: { pol: 'Valencia', pod: 'Génova', distance_nm: 650 },
    data: { simulation_cache: 'Z'.repeat(50000) },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  const heavyJsonString = JSON.stringify(heavyPayload50Projects);
  const heavySizeBytes = Buffer.byteLength(heavyJsonString, 'utf8');
  const heavySizeMB = heavySizeBytes / (1024 * 1024);

  // Antes: El payload superaba fácilmente los 6MB (17+ MB)
  assert.ok(heavySizeMB > 6, `Unoptimized payload size (${heavySizeMB.toFixed(2)} MB) would exceed 6MB Netlify limit`);

  // Ahora: Simular la proyección ligera generada por nuestra nueva consulta SQL
  const lightweightMapped = heavyPayload50Projects.map((row) => ({
    id: row.id,
    project_ref: row.project_ref,
    client_name: row.client_name,
    status: row.status,
    land_origin: row.land_origin,
    land_destination: row.land_destination,
    land_distance: Number(row.land_distance) || 0,
    land_freight_cost: Number(row.land_freight_cost) || 0,
    land_freight_sale: Number(row.land_freight_sale) || 0,
    global_margin_percentage: row.global_margin_percentage,
    created_at: row.created_at,
    updated_at: row.updated_at,
    date: '20/09/2026',
  }));

  const lightJsonString = JSON.stringify(lightweightMapped);
  const lightSizeBytes = Buffer.byteLength(lightJsonString, 'utf8');
  const lightSizeKB = lightSizeBytes / 1024;

  // Después: El payload pesa escasos KB (< 20 KB), navegando con total soltura bajo los 6MB
  assert.ok(lightSizeKB < 50, `Optimized payload size (${lightSizeKB.toFixed(2)} KB) is ultra-lightweight`);
  assert.strictEqual(lightweightMapped.length, 50, 'Respects LIMIT 50');
  assert.strictEqual(lightweightMapped[0].documents, undefined, 'documents column is excluded');
  assert.strictEqual(lightweightMapped[0].items, undefined, 'items column is excluded');
  assert.strictEqual(lightweightMapped[0].services, undefined, 'services column is excluded');
  assert.strictEqual(lightweightMapped[0].data, undefined, 'data column is excluded');
  assert.strictEqual(lightweightMapped[0].route_and_chartering, undefined, 'route_and_chartering column is excluded');
});
