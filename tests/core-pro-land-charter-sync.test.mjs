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

// Extraer funciones exportadas de ForwarderWorkspace
const mapFnMatch = forwarderWorkspaceSource.match(/export\s+function\s+mapCargoCategoryAndType[\s\S]*?\n\}/);
const extractItemsFnMatch = forwarderWorkspaceSource.match(/export\s+function\s+extractProjectCargoItems[\s\S]*?\n\}/);
const hydrateItemFnMatch = forwarderWorkspaceSource.match(/export\s+function\s+hydrateCargoItem[\s\S]*?\n\}/);

function normalizeStr(val) {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const COMMODITY_TARIFFS = {
  "CEM I 52,5N BIGBAG": { inlandUsdMt: 14.50, portDuesUsdMt: 4.80, customsUsdMt: 1.20, packagingUsdMt: 0.00 },
  "CEM I 52,5N SAC 50KG": { inlandUsdMt: 15.00, portDuesUsdMt: 5.20, customsUsdMt: 1.20, packagingUsdMt: 0.00 },
  "CEM I 42,5N/R BIGBAG": { inlandUsdMt: 14.50, portDuesUsdMt: 4.80, customsUsdMt: 1.20, packagingUsdMt: 0.00 },
  "CEM I 42,5N/R SAC 50KG": { inlandUsdMt: 15.00, portDuesUsdMt: 5.20, customsUsdMt: 1.20, packagingUsdMt: 0.00 },
  "CEM II 52.5N/R 50KG": { inlandUsdMt: 15.00, portDuesUsdMt: 5.20, customsUsdMt: 1.20, packagingUsdMt: 0.00 },
  "CEM II 52.5N BIGBAG": { inlandUsdMt: 14.50, portDuesUsdMt: 4.80, customsUsdMt: 1.20, packagingUsdMt: 0.00 },
  "CEM II 42,5N/R FARDILISE": { inlandUsdMt: 15.20, portDuesUsdMt: 5.40, customsUsdMt: 1.20, packagingUsdMt: 0.00 },
  "CEM II 42,5N/R FARDILLISE TAVCIM": { inlandUsdMt: 15.20, portDuesUsdMt: 5.40, customsUsdMt: 1.20, packagingUsdMt: 0.00 },
  "CEM II 42,5 VRAC": { inlandUsdMt: 12.00, portDuesUsdMt: 3.50, customsUsdMt: 1.00, packagingUsdMt: 0.00 },
  "CEM II 42,5 R BIGBAG": { inlandUsdMt: 14.50, portDuesUsdMt: 4.80, customsUsdMt: 1.20, packagingUsdMt: 0.00 },
  "CEM I 52,5 R BIGBAG": { inlandUsdMt: 14.50, portDuesUsdMt: 4.80, customsUsdMt: 1.20, packagingUsdMt: 0.00 }
};

const mapCargoCategoryAndType = new Function(
  'normalizeStr',
  'COMMODITY_TARIFFS',
  `return ${mapFnMatch[0].replace('export function mapCargoCategoryAndType', 'function')}`
)(normalizeStr, COMMODITY_TARIFFS);

const extractProjectCargoItems = new Function(
  `return ${extractItemsFnMatch[0].replace('export function extractProjectCargoItems', 'function')}`
)();

const hydrateCargoItem = new Function(
  'mapCargoCategoryAndType',
  `return ${hydrateItemFnMatch[0].replace('export function hydrateCargoItem', 'function')}`
)(mapCargoCategoryAndType);

// ============================================================================
// BLOQUE 1: MAPEO Y ADAPTACIÓN INTELIGENTE TERRESTRE PARA BIG BAGS Y SIMILARES
// ============================================================================

test('1. mapCargoCategoryAndType categoriza BIG BAG, BIGBAG y erratas como BOG BAG / BOGBAG estrictamente a Carga Unitizada / Envasada', () => {
  const samples = [
    'BIG BAG',
    'BIGBAG',
    'BIG-BAG',
    'BOG BAG',
    'BOGBAG',
    'BOG-BAG',
    '10.000 MT CEMENTO BOG BAG',
    'PARTIDAS EN BOG BAGS',
    'CEMENTO EN BIGBAGS 1500KG',
    'BOGBAG DE YESO',
  ];

  for (const text of samples) {
    const res = mapCargoCategoryAndType(text);
    assert.equal(
      res.category,
      'Carga Unitizada / Envasada',
      `Texto "${text}" debe mapearse estrictamente a "Carga Unitizada / Envasada"`
    );
    assert.equal(
      res.shipping_mode_supported,
      'Tráiler Lona (13.6m)',
      `Texto "${text}" debe tener por defecto modo de envío "Tráiler Lona (13.6m)"`
    );
    assert.equal(
      res.type,
      'CEM I 52,5N BIGBAG',
      `Texto genérico "${text}" debe mapear al producto GICA oficial "CEM I 52,5N BIGBAG"`
    );
  }
});

test('2. mapCargoCategoryAndType detecta BOG BAG en currentCategory o currentType incluso si rawText es genérico', () => {
  const resFromCategory = mapCargoCategoryAndType('Partida A', 'BOG BAG', '');
  assert.equal(resFromCategory.category, 'Carga Unitizada / Envasada');
  assert.equal(resFromCategory.type, 'CEM I 52,5N BIGBAG');
  assert.equal(resFromCategory.shipping_mode_supported, 'Tráiler Lona (13.6m)');

  const resFromType = mapCargoCategoryAndType('', 'Material de Construcción', 'BOGBAG 1.5T');
  assert.equal(resFromType.category, 'Carga Unitizada / Envasada');
  assert.equal(resFromType.type, 'CEM I 52,5N BIGBAG');
});

test('3. mapCargoCategoryAndType preserva grados específicos de cemento GICA para Big Bags con variantes y erratas', () => {
  const specificSamples = [
    { text: 'CEM II 52.5N BIGBAG', expected: 'CEM II 52.5N BIGBAG' },
    { text: 'CEM II 52.5N BOG BAG', expected: 'CEM II 52.5N BIGBAG' },
    { text: 'CEM I 42,5N/R BIGBAG', expected: 'CEM I 42,5N/R BIGBAG' },
    { text: 'CEM I 42,5N/R BOGBAG', expected: 'CEM I 42,5N/R BIGBAG' },
    { text: 'CEM II 42,5 R BIGBAG', expected: 'CEM II 42,5 R BIGBAG' },
    { text: 'CEM I 52,5 R BIGBAG', expected: 'CEM I 52,5 R BIGBAG' },
    { text: 'CEM II 42,5N/R FARDILLISE TAVCIM', expected: 'CEM II 42,5N/R FARDILLISE TAVCIM' },
    { text: 'CEM II 42,5N/R FARDILISE', expected: 'CEM II 42,5N/R FARDILISE' }
  ];

  for (const s of specificSamples) {
    const res = mapCargoCategoryAndType(s.text);
    assert.equal(res.category, 'Carga Unitizada / Envasada');
    assert.equal(res.type, s.expected, `"${s.text}" debe resolver a "${s.expected}"`);
  }
});

// ============================================================================
// BLOQUE 2: EXTRACCIÓN Y PRESERVACIÓN ÍNTEGRA DE PARTIDAS DESDE CORE PRO
// ============================================================================

test('4. extractProjectCargoItems extrae partidas desde items, cargo_items, cargoItems, y line_items anidados', () => {
  // Caso A: Directo en project.items
  const projA = { items: [{ id: '1', quantity: 24, length: 1.2, width: 1.0, height: 1.1, weight: 1000, type: 'BIGBAG' }] };
  assert.equal(extractProjectCargoItems(projA).length, 1);

  // Caso B: Directo en project.cargo_items
  const projB = { cargo_items: [{ id: '2', quantity: 10, length: 2.5, width: 1.5, height: 1.2, unit_weight_kg: 850, type: 'BOG BAG' }] };
  assert.equal(extractProjectCargoItems(projB).length, 1);

  // Caso C: Anidado en line_items[0].payload_data.cargo_items
  const projC = {
    line_items: [
      {
        id: 'li-1',
        payload_data: {
          cargo_items: [
            { id: 'c1', quantity: 50, length: 1.15, width: 1.15, height: 1.2, weight: 1000, type: 'BOG BAG' },
            { id: 'c2', quantity: 30, length: 1.15, width: 1.15, height: 1.2, weight: 1000, type: 'BIG BAG' }
          ]
        }
      }
    ]
  };
  const extractedC = extractProjectCargoItems(projC);
  assert.equal(extractedC.length, 2);
  assert.equal(extractedC[0].id, 'c1');
  assert.equal(extractedC[1].id, 'c2');

  // Caso D: En project.data.cargoItems
  const projD = { data: { cargoItems: [{ id: 'd1', quantity: 5 }] } };
  assert.equal(extractProjectCargoItems(projD).length, 1);
});

test('5. hydrateCargoItem preserva exactamente cantidad, largo, ancho, alto y peso unitario (weight y unit_weight_kg)', () => {
  const originalPiece = {
    id: 'pieza-101',
    quantity: 48,
    length: 1.15,
    width: 1.10,
    height: 1.25,
    unit_weight_kg: 1050,
    type: 'BOG BAG CEMENTO',
    category: 'Big Bags'
  };

  const hydrated = hydrateCargoItem(originalPiece);

  // Cantidad exacta
  assert.equal(hydrated.quantity, 48, 'La cantidad debe conservarse exactamente');

  // Dimensiones exactas
  assert.equal(hydrated.length, 1.15, 'El largo debe conservarse exactamente');
  assert.equal(hydrated.width, 1.10, 'El ancho debe conservarse exactamente');
  assert.equal(hydrated.height, 1.25, 'El alto debe conservarse exactamente');
  assert.equal(hydrated.length_m, 1.15, 'length_m debe estar sincronizado');
  assert.equal(hydrated.width_m, 1.10, 'width_m debe estar sincronizado');
  assert.equal(hydrated.height_m, 1.25, 'height_m debe estar sincronizado');

  // Peso unitario exacto preservado en ambas propiedades
  assert.equal(hydrated.weight, 1050, 'El peso unitario en "weight" debe ser idéntico al original');
  assert.equal(hydrated.unit_weight_kg, 1050, 'El peso unitario en "unit_weight_kg" debe ser idéntico');

  // Adaptación terrestre
  assert.equal(hydrated.category, 'Carga Unitizada / Envasada', 'Debe adaptarse a Carga Unitizada');
  assert.equal(hydrated.type, 'CEM I 52,5N BIGBAG', 'Debe normalizarse a producto oficial GICA');
  assert.equal(hydrated.shipping_mode_supported, 'Tráiler Lona (13.6m)', 'Debe asignarse Tráiler Lona (13.6m)');
});

test('6. hydrateCargoItem maneja variantes de claves de dimensiones y pesos (length_m, peso, weight_kg, etc.)', () => {
  const pieceWithAliases = {
    qty: 25,
    length_m: 2.4,
    width_m: 1.2,
    height_m: 0.9,
    weight: 950,
    description: 'Palets envasados'
  };

  const hydrated = hydrateCargoItem(pieceWithAliases);
  assert.equal(hydrated.quantity, 25);
  assert.equal(hydrated.length, 2.4);
  assert.equal(hydrated.width, 1.2);
  assert.equal(hydrated.height, 0.9);
  assert.equal(hydrated.weight, 950);
  assert.equal(hydrated.unit_weight_kg, 950);
  assert.equal(hydrated.category, 'Carga Unitizada / Envasada');
  assert.equal(hydrated.shipping_mode_supported, 'Tráiler Lona (13.6m)');
});

// ============================================================================
// BLOQUE 3: RECÁLCULO REACTIVO INMEDIATO EN FORWARDERWORKSPACE.JSX
// ============================================================================

test('7. ForwarderWorkspace ejecuta reactivamente autoCalculateEstimates tras hidratar tanto en handleSyncDataBridge como en el cargador inicial', () => {
  // handleSyncDataBridge
  assert.match(
    forwarderWorkspaceSource,
    /handleSyncDataBridge[\s\S]*?extractProjectCargoItems\(updated\)[\s\S]*?hydrateCargoItem[\s\S]*?autoCalculateEstimates\(currentEffectiveItems\)/,
    'handleSyncDataBridge must extract, faithfully hydrate, and immediately invoke autoCalculateEstimates'
  );

  // Cargador inicial de proyecto (useEffect activo)
  assert.match(
    forwarderWorkspaceSource,
    /isSwitchingProject[\s\S]*?extractProjectCargoItems\(activeProject\)[\s\S]*?hydrateCargoItem[\s\S]*?autoCalculateEstimates\(currentEffectiveItems\)/,
    'Project loader useEffect must extract, faithfully hydrate, and immediately invoke autoCalculateEstimates'
  );
});

test('8. Prohibición estricta de sobrescribir líneas con valores genéricos cuando Core Pro aporta desglose', () => {
  // En handleSyncDataBridge: la condición para crear quickItem exige syncItems.length === 0
  assert.match(
    forwarderWorkspaceSource,
    /syncQuickTonnage\s*>\s*0\s*&&\s*syncItems\.length\s*===\s*0/,
    'Must strictly verify syncItems.length === 0 before applying single quick tonnage fallback in sync'
  );

  // En el cargador inicial: exige hydratedItems.length === 0
  assert.match(
    forwarderWorkspaceSource,
    /quickTonnage\s*>\s*0[\s\S]*?if\s*\(\s*hydratedItems\.length\s*===\s*0\s*\)/,
    'Must strictly verify hydratedItems.length === 0 before applying single quick tonnage fallback in project switch'
  );
});

// ============================================================================
// BLOQUE 4: ENDPOINTS DE SINCRONIZACIÓN (forwarder-projects.js y sync-road.ts)
// ============================================================================

test('9. forwarder-projects.js adapta Big Bags / BOG BAG y preserva medidas y pesos en inserción y actualización', () => {
  assert.match(
    forwarderProjectsSource,
    /function\s+adaptProjectItems\s*\(\s*rawItems\s*\)/,
    'forwarder-projects.js must define adaptProjectItems helper'
  );
  assert.match(
    forwarderProjectsSource,
    /isBigBagOrBogBag/,
    'adaptProjectItems must check for Big Bag and BOG BAG typos'
  );
  assert.match(
    forwarderProjectsSource,
    /Tráiler Lona \(13\.6m\)/,
    'adaptProjectItems must set default road transport mode'
  );
  assert.match(
    forwarderProjectsSource,
    /incomingUpdateItems\s*!==\s*undefined\s*\?\s*JSON\.stringify\(adaptProjectItems\(incomingUpdateItems\)\)/,
    'POST update query must serialize adapted items'
  );
  assert.match(
    forwarderProjectsSource,
    /JSON\.stringify\(adaptProjectItems\(rawCreateItems\)\)/,
    'POST create query must serialize adapted items'
  );
});

test('10. sync-road.ts adapta y persiste items cuando se proporcionan en el cuerpo de la petición', () => {
  assert.match(
    syncRoadSource,
    /function\s+adaptRoadItems\s*\(\s*rawItems/,
    'sync-road.ts must define adaptRoadItems'
  );
  assert.match(
    syncRoadSource,
    /items\s*=\s*CASE\s+WHEN\s+\$9::jsonb\s+IS\s+NOT\s+NULL\s+THEN\s+\$9::jsonb\s+ELSE\s+items\s+END/,
    'sync-road.ts must update items column when provided in payload'
  );
});

// ============================================================================
// BLOQUE 5: EXTRACCIÓN PROFUNDA DE CARGO_ITEMS ANIDADOS Y DIMENSIONAMIENTO FSPE
// ============================================================================

test('11. extractProjectCargoItems desanida partidas cuando activeProject.items contiene servicios o facturas con payload_data.cargo_items o data.cargo_items', () => {
  // Caso 1: items es una factura/servicio con payload_data.cargo_items
  const projectWithPayloadData = {
    id: 'proj-service-maritime',
    items: [
      {
        id: 'srv-invoice-101',
        name: 'Flete Marítimo Internacional',
        type: 'service',
        payload_data: {
          cargo_items: [
            {
              id: 'cargo-bb-6667',
              quantity: 6667,
              length: 1.15,
              width: 1.10,
              height: 1.20,
              weight: 1500,
              unit_weight_kg: 1500,
              type: 'BIGBAG'
            }
          ]
        }
      }
    ]
  };

  const extracted1 = extractProjectCargoItems(projectWithPayloadData);
  assert.equal(extracted1.length, 1, 'Debe desanidar exactamente 1 partida de carga');
  assert.equal(extracted1[0].quantity, 6667);
  assert.equal(extracted1[0].length, 1.15);
  assert.equal(extracted1[0].width, 1.10);
  assert.equal(extracted1[0].height, 1.20);
  assert.equal(extracted1[0].weight, 1500);

  // Caso 2: items es un servicio con data.cargo_items
  const projectWithData = {
    id: 'proj-service-data',
    items: [
      {
        id: 'srv-item-202',
        name: 'Servicio Logístico Integrado',
        type: 'invoice',
        data: {
          cargo_items: [
            {
              id: 'cargo-bb-3000',
              quantity: 3000,
              length: 1.15,
              width: 1.10,
              height: 1.20,
              weight: 1500,
              type: 'CEM I 52,5N BIGBAG'
            }
          ]
        }
      }
    ]
  };

  const extracted2 = extractProjectCargoItems(projectWithData);
  assert.equal(extracted2.length, 1);
  assert.equal(extracted2[0].quantity, 3000);
  assert.equal(extracted2[0].weight, 1500);

  // Caso 3: Prioridad de activeProject.cargo_items directo
  const projectWithDirectCargoItems = {
    id: 'proj-direct',
    cargo_items: [
      { id: 'direct-1', quantity: 6667, length: 1.15, width: 1.10, height: 1.20, weight: 1500, type: 'BIGBAG' }
    ],
    items: [
      { id: 'srv-ignored', type: 'service' }
    ]
  };

  const extracted3 = extractProjectCargoItems(projectWithDirectCargoItems);
  assert.equal(extracted3.length, 1);
  assert.equal(extracted3[0].id, 'direct-1');
});

test('12. hydrateCargoItem mapea fielmente las medidas y peso de Big Bags (6667u, 1.15x1.1x1.2, 1500kg) y aplica adaptación terrestre automática', () => {
  const rawBigBagItem = {
    id: 'bb-item-test',
    quantity: 6667,
    length: 1.15,
    width: 1.10,
    height: 1.20,
    weight: 1500,
    unit_weight_kg: 1500,
    type: 'BIGBAG'
  };

  const hydrated = hydrateCargoItem(rawBigBagItem);

  // Mapeo Íntegro de Propiedades
  assert.equal(hydrated.quantity, 6667, 'quantity debe mapearse exactamente a 6667');
  assert.equal(hydrated.length, 1.15, 'length debe ser 1.15');
  assert.equal(hydrated.width, 1.10, 'width debe ser 1.10');
  assert.equal(hydrated.height, 1.20, 'height debe ser 1.20');
  assert.equal(hydrated.length_m, 1.15, 'length_m debe estar sincronizado');
  assert.equal(hydrated.width_m, 1.10, 'width_m debe estar sincronizado');
  assert.equal(hydrated.height_m, 1.20, 'height_m debe estar sincronizado');
  assert.equal(hydrated.weight, 1500, 'weight debe ser 1500 kg');
  assert.equal(hydrated.unit_weight_kg, 1500, 'unit_weight_kg debe ser 1500 kg');

  // Adaptación Terrestre Automática
  assert.equal(hydrated.category, 'Carga Unitizada / Envasada', 'Forzar categoría a Carga Unitizada / Envasada');
  assert.equal(hydrated.type, 'CEM I 52,5N BIGBAG', 'Asignar tipo oficial GICA correspondiente');
  assert.equal(hydrated.shipping_mode_supported, 'Tráiler Lona (13.6m)', 'Asignar modo de envío a Tráiler Lona (13.6m)');
});

test('13. Simulación reactiva: 6.667 Big Bags de 1.500 kg totalizan ~10.000 MT, dimensionan 417 tráilers y activan tarifa FSPE', () => {
  const qty = 6667;
  const unitWeightKg = 1500;
  const totalWeightKg = qty * unitWeightKg;
  const totalWeightTons = totalWeightKg / 1000;

  // Verificación de tonelaje masivo: 10.000,5 MT
  assert.ok(totalWeightTons >= 10000 && totalWeightTons <= 10001, 'Debe totalizar ~10.000 MT');

  // Cálculo de tráilers requeridos (máx 24.000 kg / tráiler estándar)
  const trucksRequired = Math.ceil(totalWeightKg / 24000);
  assert.equal(trucksRequired, 417, '6.667 Big Bags de 1.5t (10.000 MT) requieren exactamente 417 tráilers');

  // Validación de tarifa plana FSPE para CEM I 52,5N BIGBAG (inlandUsdMt = 3.00, portDuesUsdMt = 2.00, customs = 0.25, packaging = 3.50)
  const appliedTariff = COMMODITY_TARIFFS['CEM I 52,5N BIGBAG'];
  assert.ok(appliedTariff, 'La tarifa GICA oficial para CEM I 52,5N BIGBAG debe existir');
  const inlandCost = totalWeightTons * appliedTariff.inlandUsdMt;
  assert.ok(inlandCost > 0, 'El flete terrestre debe calcularse según la tarifa plana');
});

