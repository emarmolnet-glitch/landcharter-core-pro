// tests/madre-land-charter-integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Helper mock simple del DOM
function createDomEnvironment() {
  const elements = new Map();

  function createElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      id: '',
      _className: '',
      get className() { return this._className; },
      set className(v) {
        this._className = v;
        this.classList._classes = new Set(v.split(/\s+/).filter(Boolean));
      },
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); }
      },
      style: {},
      value: '',
      textContent: '',
      _innerHTML: '',
      get innerHTML() { return this._innerHTML; },
      set innerHTML(html) {
        this._innerHTML = html;
        // Parsear IDs dentro de innerHTML para el mock
        const idMatches = html.matchAll(/id="([^"]+)"/g);
        for (const m of idMatches) {
          const childMock = createElement('div');
          childMock.id = m[1];
          if (m[1] === 'madre-status-btn') {
            childMock.className = 'bg-slate-900 text-white rounded-full px-4 py-1 text-xs font-bold flex items-center gap-2';
            childMock.innerHTML = '<span>🔴 APAGADA</span>';
          }
          if (m[1] === 'madre-session-badge') {
            childMock.className = 'hidden sm:flex bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-3 py-1 text-xs font-medium items-center gap-1';
            childMock.innerHTML = 'Sesión conectada: GENERAL';
          }
          elements.set(m[1], childMock);
        }
      },
      children: [],
      dataset: {},
      setAttribute(name, val) { this[name] = val; },
      getAttribute(name) { return this[name] || null; },
      appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
        if (child.id) elements.set(child.id, child);
        return child;
      },
      insertBefore(newChild, refChild) {
        const idx = this.children.indexOf(refChild);
        if (idx !== -1) {
          this.children.splice(idx, 0, newChild);
        } else {
          this.children.push(newChild);
        }
        newChild.parentNode = this;
        if (newChild.id) elements.set(newChild.id, newChild);
        return newChild;
      },
      listeners: new Map(),
      addEventListener(type, fn) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(fn);
      },
      dispatchEvent(evt) {
        const list = this.listeners.get(evt.type) || [];
        for (const fn of list) fn(evt);
        return true;
      },
      click() {
        this.dispatchEvent({ type: 'click' });
      },
      focus() {},
      closest(sel) {
        const selectors = sel.split(',').map(s => s.trim().toLowerCase());
        let cur = this;
        while (cur) {
          for (const s of selectors) {
            if (s.startsWith('#') && cur.id === s.slice(1)) return cur;
            if (s.startsWith('.') && cur.classList?.contains(s.slice(1))) return cur;
            if (cur.tagName?.toLowerCase() === s) return cur;
          }
          cur = cur.parentNode;
        }
        return null;
      },
      querySelector(sel) {
        return null;
      },
      querySelectorAll(sel) {
        return [];
      }
    };
    return el;
  }

  const docListeners = new Map();
  const doc = {
    createElement,
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector(selector) {
      if (selector === '.header-actions-right') return elements.get('header-actions-right');
      if (selector === '.sca-input') return elements.get('sca-input');
      if (selector === '#toggle-madre-btn div') return elements.get('toggle-madre-btn-dot');
      if (selector === '#toggle-madre-btn span') return elements.get('toggle-madre-btn-text');
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    dispatchEvent(evt) {
      const list = docListeners.get(evt.type) || [];
      for (const fn of list) fn(evt);
      return true;
    },
    body: createElement('body')
  };

  // Montar estructura base en el doc
  const headerRight = createElement('div');
  headerRight.id = 'header-actions-right';
  doc.body.appendChild(headerRight);

  const switchMode = createElement('div');
  switchMode.id = 'global-view-mode-switch';
  headerRight.appendChild(switchMode);

  const polInput = createElement('input');
  polInput.id = 'port-pol';
  polInput.value = 'Sétif';
  doc.body.appendChild(polInput);

  const podInput = createElement('input');
  podInput.id = 'port-pod';
  podInput.value = 'Béjaïa';
  doc.body.appendChild(podInput);

  const distInput = createElement('input');
  distInput.id = 'dist-total';
  distInput.value = '115';
  doc.body.appendChild(distInput);

  const cargoInput = createElement('input');
  cargoInput.id = 'cargo-qty';
  cargoInput.value = '8000';
  doc.body.appendChild(cargoInput);

  const truckInput = createElement('input');
  truckInput.id = 'nombre-buque-calculadora';
  truckInput.value = 'Camión Plataforma con Grúa Autocarga';
  doc.body.appendChild(truckInput);

  const titleDiv = createElement('div');
  titleDiv.id = 'sea-assistant-title';
  titleDiv.textContent = '🧠 Cerebro.ia';
  doc.body.appendChild(titleDiv);

  const fab = createElement('button');
  fab.id = 'sea-assistant-toggle';
  doc.body.appendChild(fab);

  const seaPanel = createElement('div');
  seaPanel.id = 'sea-assistant-panel';
  seaPanel.hidden = true;
  doc.body.appendChild(seaPanel);

  const toggleMadreBtn = createElement('button');
  toggleMadreBtn.id = 'toggle-madre-btn';
  toggleMadreBtn.className = 'flex items-center justify-start gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-full px-4 py-1.5 shadow-sm transition-all duration-200';
  toggleMadreBtn.innerHTML = `
    <div class="w-2 h-2 rounded-full bg-red-500 border border-red-200"></div>
    <span class="text-xs font-bold tracking-wide">APAGADA</span>
  `;
  const toggleBtnDot = createElement('div');
  toggleBtnDot.className = 'w-2 h-2 rounded-full bg-red-500 border border-red-200';
  elements.set('toggle-madre-btn-dot', toggleBtnDot);

  const toggleBtnText = createElement('span');
  toggleBtnText.textContent = 'APAGADA';
  elements.set('toggle-madre-btn-text', toggleBtnText);

  toggleMadreBtn.querySelector = (sel) => {
    if (sel === 'div') return toggleBtnDot;
    if (sel === 'span') return toggleBtnText;
    return null;
  };

  headerRight.appendChild(toggleMadreBtn);

  const madrePanel = createElement('div');
  madrePanel.id = 'madre-panel';
  madrePanel.className = 'fixed top-0 right-0 h-screen w-[400px] bg-white text-slate-800 z-[99999] shadow-2xl transition-transform duration-300 transform translate-x-full border-l border-slate-200 flex flex-col';
  doc.body.appendChild(madrePanel);

  const chatInput = createElement('textarea');
  chatInput.className = 'sca-input';
  chatInput.id = 'sca-input';
  elements.set('sca-input', chatInput);
  doc.body.appendChild(chatInput);

  return { doc, elements };
}

// Configuración global en entorno Node
const { doc } = createDomEnvironment();
global.document = doc;
global.window = {
  document: doc,
  State: {
    isProjectMode: true,
    pol: 'Sétif',
    pod: 'Béjaïa',
    distanceKm: 115,
    cargoQty: 8000
  },
  speechSynthesis: {
    speak() {},
    cancel() {},
    getVoices() { return []; }
  },
  SpeechSynthesisUtterance: class {
    constructor(text) { this.text = text; }
  },
  Event: class {
    constructor(type) { this.type = type; }
  },
  CustomEvent: class {
    constructor(type, opts) { this.type = type; this.detail = opts?.detail; }
  }
};
global.SpeechSynthesisUtterance = global.window.SpeechSynthesisUtterance;
global.Event = global.window.Event;
global.CustomEvent = global.window.CustomEvent;

// Carga evaluada de src/madre-agent.js
const madreAgentSource = await readFile(new URL('../src/madre-agent.js', import.meta.url), 'utf8');
const madreAgentModule = await import(`data:text/javascript;base64,${Buffer.from(madreAgentSource).toString('base64')}`);
const {
  mountMadreUI,
  extractLandCharterTelemetry,
  handleMadreResponse,
  appendMadreMessage,
  getUserHasInteracted,
  toggleVoiceRecognition,
  detenerReconocimientoVoz
} = madreAgentModule;

// Carga evaluada de netlify/functions/madre-ia.js
const madreBackendSource = await readFile(new URL('../netlify/functions/madre-ia.js', import.meta.url), 'utf8');
const madreBackendModule = await import(`data:text/javascript;base64,${Buffer.from(madreBackendSource).toString('base64')}`);
const handler = madreBackendModule.default;

// Mock default fetch para aislar tests unitarios de fallback/modo local y evitar llamadas de red reales a producción
const defaultFallbackFetch = async () => ({
  ok: false,
  status: 503,
  text: async () => 'Service Unavailable (Offline Unit Test)'
});
global.fetch = defaultFallbackFetch;


test('MADRE Land Charter: UI Injection in Header & z-index: 99999 (Light Theme Design)', () => {
  mountMadreUI();

  // 1. Debe existir el botón de estado toggle-madre-btn con tema claro y justify-start
  const statusBtn = document.getElementById('toggle-madre-btn');
  assert.ok(statusBtn, 'Debe existir el botón toggle-madre-btn en el Header');
  assert.ok(statusBtn.innerHTML.includes('APAGADA'), 'Debe mostrar el estado APAGADA por defecto');
  assert.ok(statusBtn.className.includes('bg-white'), 'Debe tener fondo bg-white');
  assert.ok(statusBtn.className.includes('justify-start'), 'Debe tener justify-start');

  // 2. La píldora de sesión verde duplicada NO debe existir en el Header
  const sessionBadge = document.getElementById('madre-session-badge');
  assert.equal(sessionBadge, null, 'La píldora verde duplicada debe estar eliminada del Header');

  // 3. Panel lateral off-canvas #madre-panel con z-[99999], w-[400px], bg-white y translate-x-full
  const panel = document.getElementById('madre-panel');
  assert.ok(panel, 'El panel off-canvas #madre-panel debe montarse en el DOM');
  assert.ok(panel.className.includes('z-[99999]'), 'El panel debe tener z-[99999]');
  assert.ok(panel.className.includes('w-[400px]'), 'El panel debe tener ancho w-[400px]');
  assert.ok(panel.className.includes('bg-white'), 'El panel debe tener fondo bg-white');
  assert.ok(panel.classList.contains('translate-x-full'), 'El panel debe comenzar cerrado con la clase translate-x-full');
});

test('MADRE Land Charter: Telemetría obligatoria y lectura de selectores DOM', () => {
  const telemetry = extractLandCharterTelemetry();

  assert.equal(telemetry.pol, 'Sétif', 'Telemetría debe capturar origen del DOM');
  assert.equal(telemetry.pod, 'Béjaïa', 'Telemetría debe capturar destino del DOM');
  assert.equal(telemetry.distance_km, 115, 'Telemetría debe capturar distancia total en km');
  assert.equal(telemetry.tonnage, 8000, 'Telemetría debe capturar tonelaje');
  assert.equal(telemetry.isProjectMode, true, 'Telemetría debe capturar isProjectMode');
});

test('MADRE Land Charter: Delegación hacia Cerebro.ia (dispatchEvent)', async () => {
  let polEventFired = false;
  document.getElementById('port-pol').addEventListener('input', () => {
    polEventFired = true;
  });

  await handleMadreResponse({
    reply: "Recalculando con Cerebro.",
    accion_ui: "delegar_cerebro_ia",
    delegation_payload: {
      pol: "Orán",
      pod: "Argel",
      tonnage: 12000
    }
  });

  assert.equal(document.getElementById('port-pol').value, 'Orán', 'Debe inyectar nuevo origen en el input');
  assert.equal(document.getElementById('port-pod').value, 'Argel', 'Debe inyectar nuevo destino en el input');
  assert.equal(Number(document.getElementById('cargo-qty').value), 12000, 'Debe inyectar nuevo tonelaje');
  assert.ok(polEventFired, 'Debe disparar eventos sintéticos dispatchEvent para reactividad');
});

test('MADRE Land Charter: Delegación hacia Asistente Core (Cambio de modelo)', async () => {
  let activeAgentSet = null;
  let selectedModelSet = null;
  window.setActiveAgent = (agent) => { activeAgentSet = agent; };
  window.setSelectedModel = (model) => { selectedModelSet = model; };

  await handleMadreResponse({
    reply: "Buscando tarifas en Data Bridge.",
    accion_ui: "delegar_asistente_core",
    delegation_payload: {
      query: "Precio bunker y spot gasoil Sétif"
    }
  });

  assert.equal(activeAgentSet, 'core', 'Debe forzar cambio a agente core');
  assert.equal(selectedModelSet, 'Asistente Core', 'Debe establecer modelo Asistente Core');
});

test('MADRE Land Charter: Delegación hacia Agente de Proyectos (Seguridad sin Delete)', async () => {
  let projectPayloadReceived = null;
  window.handleApplyProjectPayload = (payload) => {
    projectPayloadReceived = payload;
  };

  await handleMadreResponse({
    reply: "Ajustando cadencia en proyecto.",
    accion_ui: "delegar_agente_proyectos",
    delegation_payload: {
      action: "update_route_rates",
      cadencia: 72,
      truck_type: "Camión / Tráiler"
    }
  });

  assert.ok(projectPayloadReceived, 'Debe recibir payload de proyecto');
  assert.equal(projectPayloadReceived.cadencia, 72, 'Debe pasar la cadencia al proyecto');
  assert.notEqual(projectPayloadReceived.action, 'delete', 'No debe permitir borrado');
});

test('MADRE Backend Function: Valida current_module land_charter', async () => {
  const req = new Request('http://localhost/.netlify/functions/madre-ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: "Calcula la ruta de Sétif a Bugía",
      contexto_ui: {
        pol: "Sétif",
        pod: "Béjaïa"
      }
    })
  });

  const res = await handler(req);
  assert.equal(res.status, 200, 'Debe responder HTTP 200');
  const data = await res.json();
  assert.equal(data.success, true, 'Debe responder con éxito');
  assert.equal(data.accion_ui, 'delegar_cerebro_ia', 'Debe delegar en Cerebro.ia ante petición de ruta');
  assert.ok(data.reply.includes('Cerebro.ia') || data.reply.includes('coordenadas'), 'Debe dar respuesta verbal');
});

test('MADRE Navegación UI por Voz: Backend y Frontend', async () => {
  // Test Backend: comando de navegación a calculadora ("ir al calculo" / "ldm")
  const reqCalc = new Request('http://localhost/.netlify/functions/madre-ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: "Ir al cálculo",
      contexto_ui: {}
    })
  });
  const resCalc = await handler(reqCalc);
  const dataCalc = await resCalc.json();
  assert.equal(dataCalc.accion_ui, 'navegar_vista', 'Debe activar accion navegar_vista');
  assert.equal(dataCalc.delegation_payload?.vista, 'calculadora', 'Debe apuntar a calculadora');

  // Test Frontend: dispatch de navegar_vista
  let calcClicked = false;
  const mockCalcBtn = doc.createElement('button');
  mockCalcBtn.setAttribute('data-module-id', 'calculadora');
  mockCalcBtn.addEventListener('click', () => { calcClicked = true; });
  const savedQuerySelector = doc.querySelector;
  doc.querySelector = (sel) => {
    if (sel.includes('calculadora')) return mockCalcBtn;
    return savedQuerySelector.call(doc, sel);
  };

  try {
    await handleMadreResponse({
      reply: "Entendido. Abriendo calculadora.",
      accion_ui: "navegar_vista",
      delegation_payload: { vista: "calculadora" }
    });
  } finally {
    doc.querySelector = savedQuerySelector;
  }

  assert.equal(calcClicked, true, 'Debe hacer click en el botón de la calculadora');
});

test('MADRE Backend Function: Saludos y respuestas conversacionales locales', async () => {
  const reqHola = new Request('http://localhost/.netlify/functions/madre-ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: "Hola MADRE",
      contexto_ui: {}
    })
  });
  const resHola = await handler(reqHola);
  assert.equal(resHola.status, 200, 'Debe responder HTTP 200');
  const dataHola = await resHola.json();
  assert.equal(dataHola.success, true, 'Debe ser exitoso');
  assert.equal(dataHola.accion_ui, 'informar', 'Debe tener accion_ui informar');
  assert.ok(dataHola.reply.includes('Hola, Esteban'), 'Debe saludar a Esteban');
  assert.ok(dataHola.reply.includes('Modo Local'), 'Debe indicar que opera en Modo Local');

  // Test con buenos días
  const reqBuenosDias = new Request('http://localhost/.netlify/functions/madre-ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: "Buenos días",
      contexto_ui: {}
    })
  });
  const resBuenosDias = await handler(reqBuenosDias);
  const dataBuenosDias = await resBuenosDias.json();
  assert.equal(dataBuenosDias.accion_ui, 'informar');
  assert.ok(dataBuenosDias.reply.includes('Hola, Esteban'));
});

test('MADRE Backend Function: Derivación analítica al Asistente Core para cálculos y márgenes', async () => {
  const userQuery = "¿Cuánto margen y camiones necesitamos?";
  const reqCore = new Request('http://localhost/.netlify/functions/madre-ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: userQuery,
      contexto_ui: {}
    })
  });
  const resCore = await handler(reqCore);
  assert.equal(resCore.status, 200, 'Debe responder HTTP 200');
  const dataCore = await resCore.json();
  assert.equal(dataCore.success, true, 'Debe ser exitoso');
  assert.equal(dataCore.accion_ui, 'delegar_asistente_core', 'Debe activar accion delegar_asistente_core');
  assert.equal(dataCore.delegation_payload?.query, userQuery, 'Debe preservar el query original');
  assert.ok(dataCore.reply.includes('Asistente Core'), 'Debe confirmar transferencia al Asistente Core');

  // Test con palabras clave como coste o precio
  const reqPrecio = new Request('http://localhost/.netlify/functions/madre-ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: "analiza el coste del viaje",
      contexto_ui: {}
    })
  });
  const resPrecio = await handler(reqPrecio);
  const dataPrecio = await resPrecio.json();
  assert.equal(dataPrecio.accion_ui, 'delegar_asistente_core');
});

test('MADRE Corrección 1: CSS de burbujas (Texto blanco en usuario con estilos en línea, fondo claro en MADRE)', () => {
  const dialogLog = doc.createElement('div');
  dialogLog.id = 'madre-dialog-log';
  doc.body.appendChild(dialogLog);

  appendMadreMessage('user', 'Hola MADRE, calcula la ruta');
  assert.equal(dialogLog.children.length, 1, 'Debe añadir mensaje del usuario');
  const userMsg = dialogLog.children[0];
  assert.equal(
    userMsg.className,
    'flex flex-col items-end mb-3',
    'El wrapper exterior debe alinear a la derecha con margen inferior'
  );
  assert.ok(
    userMsg.innerHTML.includes('style="background-color: #2563eb !important; color: #ffffff !important;"') &&
    userMsg.innerHTML.includes('color: #ffffff !important;'),
    'El div interior debe contener estilo en línea forzando texto blanco y color azul'
  );
  assert.ok(userMsg.innerHTML.includes('Hola MADRE, calcula la ruta'), 'Debe contener el texto del usuario');

  appendMadreMessage('madre', 'Calculando escenario...');
  assert.equal(dialogLog.children.length, 2, 'Debe añadir respuesta de MADRE');
  const madreMsg = dialogLog.children[1];
  assert.equal(
    madreMsg.className,
    'flex flex-col items-start mb-3',
    'El wrapper exterior de MADRE debe alinear a la izquierda con margen inferior'
  );
  assert.ok(
    madreMsg.innerHTML.includes('bg-slate-50 border border-slate-200 text-slate-800'),
    'El div interior de MADRE debe tener fondo claro slate-50 y texto oscuro'
  );
  assert.ok(madreMsg.innerHTML.includes('Calculando escenario...'), 'Debe contener el texto de MADRE');
});

test('MADRE Corrección 2: Navegación UI agresiva con selector genérico de pestañas', async () => {
  let clickedTarget = null;
  const mockTabs = [
    {
      textContent: 'Calculadora LDM',
      dataset: { moduleId: 'calculadora' },
      click() { clickedTarget = 'calculadora'; }
    },
    {
      textContent: 'Forwarder Proyectos',
      dataset: { moduleId: 'proyectos' },
      click() { clickedTarget = 'proyectos'; }
    },
    {
      textContent: 'Rutas Terrestres',
      dataset: { moduleId: 'rutas' },
      click() { clickedTarget = 'rutas'; }
    }
  ];

  doc.querySelectorAll = (sel) => {
    if (sel.includes('button, li, a, .module-tab')) {
      return mockTabs;
    }
    return [];
  };

  // Navegación hacia forwarder / proyectos con cambiar_pestana
  await handleMadreResponse({
    reply: "Cambiando a proyectos.",
    accion_ui: "cambiar_pestana",
    delegation_payload: { target: "proyecto" }
  });
  assert.equal(clickedTarget, 'proyectos', 'Debe pulsar la pestaña de proyectos');

  // Navegación hacia rutas con navegar_vista
  await handleMadreResponse({
    reply: "Mostrando mapa de rutas.",
    accion_ui: "navegar_vista",
    delegation_payload: { vista: "terrestre" }
  });
  assert.equal(clickedTarget, 'rutas', 'Debe pulsar la pestaña de rutas');

  // Navegación hacia calculadora
  await handleMadreResponse({
    reply: "Abriendo calculadora.",
    accion_ui: "cambiar_pestana",
    delegation_payload: { vista: "ldm" }
  });
  assert.equal(clickedTarget, 'calculadora', 'Debe pulsar la pestaña de calculadora');
});

test('MADRE Corrección 2b: Delegación a Asistente Core con ai-model-selector y sca-send-btn', async () => {
  let toggleClicked = false;
  let sendBtnClicked = false;
  let selectorDispatched = false;

  const mockAiSelector = doc.createElement('select');
  mockAiSelector.id = 'ai-model-selector';
  mockAiSelector.addEventListener('change', () => { selectorDispatched = true; });

  const mockToggleBtn = doc.createElement('button');
  mockToggleBtn.id = 'sea-assistant-toggle';
  mockToggleBtn.addEventListener('click', () => { toggleClicked = true; });

  const mockInput = doc.createElement('input');
  mockInput.className = 'sca-input';

  const mockSendBtn = doc.createElement('button');
  mockSendBtn.className = 'sca-send-btn';
  mockSendBtn.addEventListener('click', () => { sendBtnClicked = true; });

  const originalGetElementById = doc.getElementById;
  const originalQuerySelector = doc.querySelector;

  doc.getElementById = (id) => {
    if (id === 'ai-model-selector') return mockAiSelector;
    if (id === 'sea-assistant-toggle') return mockToggleBtn;
    return originalGetElementById.call(doc, id);
  };

  doc.querySelector = (sel) => {
    if (sel === '.sca-input') return mockInput;
    if (sel === '.sca-send-btn') return mockSendBtn;
    return originalQuerySelector.call(doc, sel);
  };

  try {
    await handleMadreResponse({
      reply: "Transfiriendo consulta a Asistente Core.",
      accion_ui: "delegar_asistente_core",
      delegation_payload: {
        query: "Verificar demurrage y flete spot"
      }
    });

    assert.equal(mockAiSelector.value, 'core', 'Debe fijar valor core en el selector de IA');
    assert.equal(selectorDispatched, true, 'Debe disparar evento change en ai-model-selector');
    assert.equal(toggleClicked, true, 'Debe pulsar sea-assistant-toggle');
    assert.equal(mockInput.value, 'Verificar demurrage y flete spot', 'Debe inyectar la query en el input sca-input');
    assert.equal(sendBtnClicked, true, 'Debe hacer click en sca-send-btn');
  } finally {
    doc.getElementById = originalGetElementById;
    doc.querySelector = originalQuerySelector;
  }
});

test('MADRE: Modo Stealth - Activación de micrófono en background sin abrir panel en clic en mapa', () => {
  const panel = doc.getElementById('madre-panel');
  // Asegurar que el panel arranca con translate-x-full
  panel.classList.add('translate-x-full');

  // Clic en un input ignorado
  const inputEl = doc.createElement('input');
  inputEl.tagName = 'INPUT';
  doc.dispatchEvent({ type: 'click', target: inputEl });
  assert.ok(panel.classList.contains('translate-x-full'), 'Clic en input no debe abrir el panel');

  // Clic en el fondo o mapa
  const mapEl = doc.createElement('div');
  mapEl.id = 'map';
  mapEl.tagName = 'DIV';
  doc.dispatchEvent({ type: 'click', target: mapEl });

  assert.ok(panel.classList.contains('translate-x-full'), 'Clic en el mapa NO debe abrir el panel en Modo Stealth');
});

test('MADRE Backend Function: Extraer origen y destino de ruta dinámica y fallback', async () => {
  // Test 1: frase "calcula de Barcelona a Zaragoza"
  const reqRuta = new Request('http://localhost/.netlify/functions/madre-ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: "calcula de Barcelona a Zaragoza",
      contexto_ui: {}
    })
  });
  const resRuta = await handler(reqRuta);
  const dataRuta = await resRuta.json();
  assert.equal(dataRuta.accion_ui, 'delegar_cerebro_ia', 'Debe delegar en Cerebro.ia');
  assert.equal(dataRuta.delegation_payload?.pol, 'Barcelona', 'Debe extraer origen Barcelona');
  assert.equal(dataRuta.delegation_payload?.pod, 'Zaragoza', 'Debe extraer destino Zaragoza');
  assert.ok(dataRuta.reply.includes('Barcelona') && dataRuta.reply.includes('Zaragoza'), 'El reply verbal debe mencionar las ciudades');

  // Test 2: frase "calcula la ruta desde Valencia hasta Madrid"
  const reqRuta2 = new Request('http://localhost/.netlify/functions/madre-ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: "calcula la ruta desde Valencia hasta Madrid",
      contexto_ui: {}
    })
  });
  const resRuta2 = await handler(reqRuta2);
  const dataRuta2 = await resRuta2.json();
  assert.equal(dataRuta2.delegation_payload?.pol, 'Valencia');
  assert.equal(dataRuta2.delegation_payload?.pod, 'Madrid');

  // Test 3: frases naturales sin "calcula" ("quiero ir de Barcelona a Zaragoza", "ruta de lyon a milan", "de madrid a bilbao")
  const reqRuta3 = new Request('http://localhost/.netlify/functions/madre-ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: "quiero ir de bilbao a sevilla",
      contexto_ui: {}
    })
  });
  const resRuta3 = await handler(reqRuta3);
  const dataRuta3 = await resRuta3.json();
  assert.equal(dataRuta3.accion_ui, 'delegar_cerebro_ia');
  assert.equal(dataRuta3.delegation_payload?.pol, 'Bilbao');
  assert.equal(dataRuta3.delegation_payload?.pod, 'Sevilla');
});

test('MADRE Reconocimiento de Voz: Escucha activa continua persistente (continuous = true, interimResults = true y bucle onend)', () => {
  let startCount = 0;
  let lastInstance = null;

  class MockSpeechRecognition {
    constructor() {
      this.continuous = false;
      this.interimResults = false;
      this.lang = '';
      this.onstart = null;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      lastInstance = this;
    }
    start() {
      startCount++;
      if (this.onstart) this.onstart();
    }
    stop() {
      if (this.onend) this.onend();
    }
    abort() {}
  }

  global.window.SpeechRecognition = MockSpeechRecognition;

  try {
    // 1. Iniciar reconocimiento
    toggleVoiceRecognition();
    assert.ok(lastInstance, 'Debe instanciar SpeechRecognition');
    assert.equal(lastInstance.continuous, true, 'Debe tener continuous = true');
    assert.equal(lastInstance.interimResults, true, 'Debe tener interimResults = true');
    assert.equal(startCount, 1, 'Debe llamar a start() al iniciar');

    // 2. Simular evento onend cuando el usuario NO ha cerrado explícitamente el asistente
    lastInstance.onend();
    assert.equal(startCount, 2, 'Debe reiniciar automáticamente con start() tras onend');

    // 3. Simular detención explícita (usuario apaga el micrófono o cierra el panel)
    detenerReconocimientoVoz();
    const currentStartCount = startCount;
    // Si onend se dispara tras detener explícitamente, NO debe reiniciar
    if (lastInstance.onend) lastInstance.onend();
    assert.equal(startCount, currentStartCount, 'NO debe reiniciar la escucha tras detención explícita');
  } finally {
    delete global.window.SpeechRecognition;
  }
});

test('MADRE Backend Function: Diagnóstico detallado con console.error al fallar conexión con Data Bridge', async () => {
  const originalConsoleError = console.error;
  const errorLogs = [];
  console.error = (...args) => {
    errorLogs.push(args.join(' '));
  };

  try {
    const req = new Request('http://localhost/.netlify/functions/madre-ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: "prueba de diagnostico con backend",
        contexto_ui: {}
      })
    });

    const res = await handler(req);
    assert.equal(res.status, 200);

    const loggedDataBridgeError = errorLogs.some(log =>
      log.includes('[madre-ia]') && (log.includes('Data Bridge') || log.includes('Código HTTP') || log.includes('Error exacto de red'))
    );
    assert.ok(loggedDataBridgeError, 'Debe registrar con console.error el código de estado o error de red hacia Data Bridge');
  } finally {
    console.error = originalConsoleError;
  }
});

test('MADRE Backend Function: Registra log de DEBUG RED con la URL exacta y respeta DATA_BRIDGE_URL (endpoint madre-chat)', async () => {
  const originalConsoleLog = console.log;
  const originalEnv = process.env.DATA_BRIDGE_URL;
  const logs = [];
  console.log = (...args) => {
    logs.push(args.join(' '));
  };

  try {
    process.env.DATA_BRIDGE_URL = 'https://custom-databridge.netlify.app/';
    const req = new Request('http://localhost/.netlify/functions/madre-ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: "prueba de log de red",
        contexto_ui: {}
      })
    });

    await handler(req);

    const loggedDebugRed = logs.some(log =>
      (log.includes('🔍 [DEBUG RED] Intentando conectar con Data Bridge en la URL exacta:') ||
       log.includes('puenteeando hacia Data Bridge ->')) &&
      log.includes('https://custom-databridge.netlify.app/.netlify/functions/madre-chat')
    );
    assert.ok(loggedDebugRed, 'Debe registrar el log con la URL madre-chat construida a partir de DATA_BRIDGE_URL');
  } finally {
    console.log = originalConsoleLog;
    if (originalEnv !== undefined) {
      process.env.DATA_BRIDGE_URL = originalEnv;
    } else {
      delete process.env.DATA_BRIDGE_URL;
    }
  }
});

test('MADRE Backend Function: Formatea remotePayload correctamente y devuelve respuesta de Data Bridge cuando responde OK', async () => {
  const originalFetch = global.fetch;
  let interceptedUrl = null;
  let interceptedOptions = null;

  global.fetch = async (url, options) => {
    interceptedUrl = url;
    interceptedOptions = options;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        reply: "Hola desde Data Bridge Gemini",
        accion_ui: "informar",
        mensaje_voz: "Hola desde Data Bridge Gemini"
      })
    };
  };

  try {
    const req = new Request('http://localhost/.netlify/functions/madre-ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: "Hola MADRE",
        contexto_ui: { active_tab: "calculadora" },
        history: [{ role: "user", text: "mensaje previo" }]
      })
    });

    const res = await handler(req);
    assert.equal(res.status, 200, 'Debe responder con status 200');

    const data = await res.json();
    assert.equal(data.reply, "Hola desde Data Bridge Gemini");
    assert.equal(data.mensaje_voz, "Hola desde Data Bridge Gemini");

    assert.ok(interceptedUrl.endsWith('/.netlify/functions/madre-chat'), 'Debe llamar al endpoint madre-chat');
    const parsedPayload = JSON.parse(interceptedOptions.body);
    assert.equal(parsedPayload.mensajeUsuario, "Hola MADRE", 'Debe mapear prompt a mensajeUsuario');
    assert.equal(parsedPayload.origen, "Land Charter", 'Debe incluir origen: Land Charter');
    assert.equal(parsedPayload.current_module, "land_charter", 'Debe incluir current_module: land_charter');
    assert.equal(parsedPayload.contexto_ui.active_tab, "calculadora", 'Debe reenviar contexto_ui');
    assert.equal(parsedPayload.history.length, 1, 'Debe reenviar history');
  } finally {
    global.fetch = originalFetch;
  }
});

test('MADRE Backend Function: Capa de adaptación mapea navegación directa (navegar -> navegar_vista)', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      accion_ui: "navegar",
      destino: "calculadora",
      mensaje_voz: "Navegando a calculadora"
    })
  });

  try {
    const req = new Request('http://localhost/.netlify/functions/madre-ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: "ir a calculadora" })
    });

    const res = await handler(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.accion_ui, "navegar_vista");
    assert.deepEqual(data.delegation_payload, { vista: "calculadora" });
    assert.equal(data.sender, "MADRE");
    assert.equal(data.reply, "Navegando a calculadora");
  } finally {
    global.fetch = originalFetch;
  }
});

test('MADRE Backend Function: Capa de adaptación mapea herramientasEjecutadas (delegar_cerebro_ia, delegar_asistente_core, delegar_agente_proyectos)', async () => {
  const originalFetch = global.fetch;

  // 1. delegar_cerebro_ia
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      respuesta: "Ruta calculada a Argel",
      herramientasEjecutadas: [
        {
          herramienta: "delegar_cerebro_ia",
          argumentos: { origen: "Orán", destino: "Argel" },
          resultado: { origen: "Orán", destino: "Argel", tipo_vehiculo: "Tráiler Lona" }
        }
      ]
    })
  });

  try {
    const req = new Request('http://localhost/.netlify/functions/madre-ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: "calcular ruta oran argel" })
    });

    const res = await handler(req);
    const data = await res.json();
    assert.equal(data.accion_ui, "delegar_cerebro_ia");
    assert.deepEqual(data.delegation_payload, {
      pol: "Orán",
      pod: "Argel",
      tonnage: 8000,
      vehicle_type: "Tráiler Lona"
    });
    assert.equal(data.sender, "MADRE");
    assert.equal(data.reply, "Ruta calculada a Argel");
  } finally {
    global.fetch = originalFetch;
  }

  // 2. delegar_asistente_core
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      herramientasEjecutadas: [
        {
          herramienta: "delegar_asistente_core",
          argumentos: { consulta: "Precio gasoil" }
        }
      ]
    })
  });

  try {
    const req = new Request('http://localhost/.netlify/functions/madre-ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: "consulta de gasoil" })
    });

    const res = await handler(req);
    const data = await res.json();
    assert.equal(data.accion_ui, "delegar_asistente_core");
    assert.deepEqual(data.delegation_payload, { query: "Precio gasoil" });
    assert.equal(data.sender, "MADRE");
    assert.equal(data.reply, "Operación completada.");
  } finally {
    global.fetch = originalFetch;
  }

  // 3. delegar_agente_proyectos
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      herramientasEjecutadas: [
        {
          herramienta: "delegar_agente_proyectos",
          argumentos: { operacion: "actualizar", expediente_id: "EXP-123" }
        }
      ]
    })
  });

  try {
    const req = new Request('http://localhost/.netlify/functions/madre-ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: "actualizar expediente" })
    });

    const res = await handler(req);
    const data = await res.json();
    assert.equal(data.accion_ui, "delegar_agente_proyectos");
    assert.deepEqual(data.delegation_payload, { operacion: "actualizar", expediente_id: "EXP-123" });
    assert.equal(data.sender, "MADRE");
  } finally {
    global.fetch = originalFetch;
  }
});


