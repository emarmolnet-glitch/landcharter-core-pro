import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const fileContent = await readFile(new URL('../src/components/GlobalMadreDrawer.jsx', import.meta.url), 'utf8');

// Extraer constante o función
function extractCode(src, name) {
  const constMatch = src.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(\\{[\\s\\S]*?\\n\\});`));
  if (constMatch) return `const ${name} = ${constMatch[1]};`;

  const fnMatch = src.match(new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}[\\s\\S]*?\\n\\}`));
  if (fnMatch) return fnMatch[0].replace(/export\s+/, '');

  throw new Error(`Symbol ${name} not found in source`);
}

test('1. Inyección de Diccionario: LANDCHARTER_DOM_DICTIONARY exportado con la estructura exacta requerida', async () => {
  const globalDrawerContent = fileContent;
  const indexHtmlContent = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  // Verificar presencia en GlobalMadreDrawer.jsx
  assert.match(globalDrawerContent, /export\s+const\s+LANDCHARTER_DOM_DICTIONARY\s*=\s*\{/, 'Debe exportar LANDCHARTER_DOM_DICTIONARY');
  
  // Módulos requeridos
  for (const mod of ['flota', 'rutas', 'calculadora', 'proyectos', 'decisiones']) {
    assert.ok(globalDrawerContent.includes(`"${mod}":`), `Debe incluir clave "${mod}" en GlobalMadreDrawer`);
    assert.ok(indexHtmlContent.includes(`"${mod}":`), `Debe incluir clave "${mod}" en index.html`);
  }

  // Verificar selectores específicos
  assert.ok(globalDrawerContent.includes('"#view-matching"'));
  assert.ok(globalDrawerContent.includes('"#vehicle_type"'));
  assert.ok(globalDrawerContent.includes('"#val-dss-cadencia-camiones-dia"'));

  assert.ok(globalDrawerContent.includes('"#view-map"'));
  assert.ok(globalDrawerContent.includes('"#map-port-pol"'));
  assert.ok(globalDrawerContent.includes('"#sync-miles-card"'));

  assert.ok(globalDrawerContent.includes('"#view-estimator"'));
  assert.ok(globalDrawerContent.includes('"#port-pol"'));
  assert.ok(globalDrawerContent.includes('"#exec-buy-freight-total"'));

  assert.ok(globalDrawerContent.includes('"#view-forwarders"'));
  assert.ok(globalDrawerContent.includes('"#top-cargo-category"'));
  assert.ok(globalDrawerContent.includes('"#financial-breakdown-card"'));

  assert.ok(globalDrawerContent.includes('"#view-decisiones"'));
  assert.ok(globalDrawerContent.includes('"#input-fleteEstimado"'));
  assert.ok(globalDrawerContent.includes('"#val-transito-estimado"'));
});

test('2. Motor de Captura: captureScreenDOM extrae inputs y metricas usando LANDCHARTER_DOM_DICTIONARY y añade [Métricas Clave]:', async () => {
  const dictCode = extractCode(fileContent, 'LANDCHARTER_DOM_DICTIONARY');
  const detectCode = extractCode(fileContent, 'detectCurrentModule');
  const captureCode = extractCode(fileContent, 'captureScreenDOM');

  const elementsMap = new Map([
    ['#view-estimator', { classList: { contains: (cls) => cls === 'active-block' }, style: { display: 'block' }, querySelectorAll: () => [] }],
    ['#port-pol', { value: 'Valencia Port' }],
    ['#port-pod', { value: 'Madrid Dry Port' }],
    ['#dist-laden', { value: '355' }],
    ['#nombre-buque-calculadora', { value: 'Volvo FH 500' }],
    ['#truckPayloadCapacity', { value: '24' }],
    ['#cargo-qty', { value: '22' }],
    ['#cargo-type', { value: 'Contenedores' }],
    ['#tacografo-speed', { value: '82' }],
    ['#price-sea', { value: '1.45' }],
    ['#opex-daily', { value: '280' }],
    ['#exec-buy-freight-total', { textContent: '780 €' }],
    ['#exec-sell-freight-total', { textContent: '980 €' }],
    ['#res-cost-bunker', { textContent: '210 €' }],
    ['#res-cost-opex', { textContent: '150 €' }],
    ['#res-cost-pda', { textContent: '65 €' }],
    ['#res-cost-base-break-even', { textContent: '1.25 €/km' }],
    ['#res-breakeven', { textContent: '425 €' }],
    ['#res-net-profit-owner', { textContent: '200 €' }],
    ['#res-net-profit-charterer', { textContent: '200 €' }]
  ]);

  const mockDocument = {
    querySelector: (selector) => elementsMap.get(selector) || null
  };

  const sandbox = {
    document: mockDocument,
    window: { currentView: 'calculadora', State: {} },
    console: { warn: () => {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${dictCode}
    ${detectCode}
    ${captureCode}
    globalThis.captureScreenDOM = captureScreenDOM;
  `, sandbox);

  const result = sandbox.captureScreenDOM('calculadora');
  assert.equal(result.suite, 'Land Charter', 'Debe incluir suite: Land Charter');
  assert.equal(result.modulo_actual, 'calculadora', 'Debe detectar modulo_actual: calculadora');

  // Validar bloque [Métricas Clave]:
  assert.ok(result.elementos_visibles.includes('[Métricas Clave]:'), 'Debe incluir sección [Métricas Clave]: en elementos_visibles');
  assert.ok(result.elementos_visibles.includes('#exec-buy-freight-total: 780 €'), 'Debe extraer valor de métrica #exec-buy-freight-total');
  assert.ok(result.elementos_visibles.includes('#exec-sell-freight-total: 980 €'), 'Debe extraer valor de métrica #exec-sell-freight-total');
  assert.ok(result.elementos_visibles.includes('#res-cost-bunker: 210 €'), 'Debe extraer valor de métrica #res-cost-bunker');

  // Validar inputs
  assert.equal(result.inputs['#port-pol'], 'Valencia Port');
  assert.equal(result.inputs['#port-pod'], 'Madrid Dry Port');
  assert.equal(result.inputs['#cargo-qty'], '22');
});

test('3. Etiquetar Payload: sendToMadreChat envía obligatoriamente suite: "Land Charter" y modulo_actual en el body', async () => {
  const dictCode = extractCode(fileContent, 'LANDCHARTER_DOM_DICTIONARY');
  const detectCode = extractCode(fileContent, 'detectCurrentModule');
  const sendCode = extractCode(fileContent, 'sendToMadreChat');

  let interceptedBody = null;

  const mockFetch = async (url, options) => {
    interceptedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        success: true,
        reply: "Operación de prueba validada"
      })
    };
  };

  const sandbox = {
    DATA_BRIDGE_URL: 'https://calm-shortbread-55bcfc.netlify.app',
    fetch: mockFetch,
    document: { querySelector: () => null },
    window: { currentView: 'rutas', State: {} },
    console: { error: () => {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${dictCode}
    ${detectCode}
    ${sendCode}
    globalThis.sendToMadreChat = sendToMadreChat;
  `, sandbox);

  // Llamada con módulo específico
  await sandbox.sendToMadreChat({
    modulo_actual: "proyectos",
    mensajeUsuario: "Auditar proyecto de prueba"
  });

  assert.ok(interceptedBody, 'Debe interceptar el body de fetch');
  assert.equal(interceptedBody.suite, 'Land Charter', 'El body debe contener obligatoriamente suite: "Land Charter"');
  assert.equal(interceptedBody.modulo_actual, 'proyectos', 'El body debe contener obligatoriamente modulo_actual: "proyectos"');

  // Llamada sin especificar módulo (debe auto-detectar desde window.currentView)
  await sandbox.sendToMadreChat({
    mensajeUsuario: "Calcular ruta"
  });

  assert.equal(interceptedBody.suite, 'Land Charter', 'El body debe contener suite: "Land Charter"');
  assert.equal(interceptedBody.modulo_actual, 'rutas', 'El body debe contener modulo_actual: "rutas"');
});
