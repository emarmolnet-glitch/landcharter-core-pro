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
      querySelector(sel) {
        return null;
      },
      querySelectorAll(sel) {
        return [];
      }
    };
    return el;
  }

  const doc = {
    createElement,
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector(selector) {
      if (selector === '.header-actions-right') return elements.get('header-actions-right');
      if (selector === '.sca-input') return elements.get('sca-input');
      return null;
    },
    querySelectorAll() {
      return [];
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
const { mountMadreUI, extractLandCharterTelemetry, handleMadreResponse } = madreAgentModule;

// Carga evaluada de netlify/functions/madre-ia.js
const madreBackendSource = await readFile(new URL('../netlify/functions/madre-ia.js', import.meta.url), 'utf8');
const madreBackendModule = await import(`data:text/javascript;base64,${Buffer.from(madreBackendSource).toString('base64')}`);
const handler = madreBackendModule.default;

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
  // Test Backend: comando "llévame a la calculadora"
  const reqCalc = new Request('http://localhost/.netlify/functions/madre-ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: "Llévame a la calculadora",
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
  doc.querySelector = (sel) => {
    if (sel.includes('calculadora')) return mockCalcBtn;
    return null;
  };

  await handleMadreResponse({
    reply: "Entendido. Abriendo calculadora.",
    accion_ui: "navegar_vista",
    delegation_payload: { vista: "calculadora" }
  });

  assert.equal(calcClicked, true, 'Debe hacer click en el botón de la calculadora');
});
