import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('1. index.html contiene el bloque exacto de purga de memoria marítima (POL/POD)', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  // Verifica comentario identificador
  assert.match(indexHtml, /\/\/\s*---\s*PURGA DE MEMORIA MARÍTIMA \(POL\/POD\)\s*---/);

  // Verifica el reseteo del estado global con las variables requeridas
  assert.match(indexHtml, /const estado\s*=\s*window\.appState\s*\|\|\s*window\.state\s*\|\|\s*window\.datosGlobales/);
  assert.match(indexHtml, /estado\.pol\s*=\s*'';/);
  assert.match(indexHtml, /estado\.pod\s*=\s*'';/);
  assert.match(indexHtml, /estado\.origen\s*=\s*'';/);
  assert.match(indexHtml, /estado\.destino\s*=\s*'';/);

  // Verifica selectores de inputs geográficos y disparo del evento reactivo
  assert.match(indexHtml, /document\.querySelectorAll\('input\[name="origen"\],\s*input\[name="destino"\],\s*input\[id\*="origen"\],\s*input\[id\*="destino"\]/);
  assert.match(indexHtml, /input\.value\s*=\s*'';/);
  assert.match(indexHtml, /input\.dispatchEvent\(new Event\('input',\s*\{\s*bubbles:\s*true\s*\}\)\);/);

  // Verifica selectores de etiquetas de métricas inferiores y valor TBA
  assert.match(indexHtml, /document\.querySelectorAll\('\.origen-label,\s*#ui-origen,\s*\[data-id="origen-text"\]/);
  assert.match(indexHtml, /document\.querySelectorAll\('\.destino-label,\s*#ui-destino,\s*\[data-id="destino-text"\]/);
  assert.match(indexHtml, /etiquetasOrigen\.forEach\(el\s*=>\s*el\.textContent\s*=\s*'TBA'\);/);
  assert.match(indexHtml, /etiquetasDestino\.forEach\(el\s*=>\s*el\.textContent\s*=\s*'TBA'\);/);
});

test('2. Inputs geográficos en index.html tienen atributos name="origen" y name="destino"', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  assert.match(indexHtml, /<input[^>]*id="map-port-pol"[^>]*name="origen"/);
  assert.match(indexHtml, /<input[^>]*id="map-port-pod"[^>]*name="destino"/);
  assert.match(indexHtml, /<input[^>]*id="port-pol"[^>]*name="origen"/);
  assert.match(indexHtml, /<input[^>]*id="port-pod"[^>]*name="destino"/);
});

test('3. No altera la preservación y anclaje de la referencia del dossier (ej. RDM/2026-X)', async () => {
  const indexHtml = await readFile('index.html', 'utf8');

  assert.match(indexHtml, /window\.anchoredReference\s*=\s*cleanRef/);
  assert.match(indexHtml, /window\.isRefAnchored\s*=\s*true/);
  assert.match(indexHtml, /window\.State\.activeReference\s*=\s*cleanRef/);
});

test('4. Ejecución funcional de la lógica de purga limpia estado, inputs y métricas en entorno simulado', () => {
  let eventDispatched = false;
  const mockInputs = [
    { name: 'origen', value: 'Tampa', dispatchEvent: () => { eventDispatched = true; } },
    { name: 'destino', value: 'Tampa', dispatchEvent: () => { eventDispatched = true; } }
  ];

  const mockLabels = [
    { textContent: 'Tampa' },
    { textContent: 'Tampa' }
  ];

  const mockState = {
    pol: 'Tampa',
    pod: 'Tampa',
    origen: 'Tampa',
    destino: 'Tampa'
  };

  const sandbox = {
    window: {
      appState: mockState,
      state: mockState,
      datosGlobales: mockState
    },
    document: {
      querySelectorAll: (sel) => {
        if (sel.includes('input')) return mockInputs;
        return mockLabels;
      }
    },
    Event: class {
      constructor(type, opts) {
        this.type = type;
        this.opts = opts;
      }
    }
  };

  const code = `
    const estado = window.appState || window.state || window.datosGlobales; 
    if (estado) {
        estado.pol = '';
        estado.pod = '';
        estado.origen = '';
        estado.destino = '';
    }

    const inputsGeograficos = document.querySelectorAll('input[name="origen"], input[name="destino"], input[id*="origen"], input[id*="destino"]');
    inputsGeograficos.forEach(input => {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true })); 
    });

    const etiquetasOrigen = document.querySelectorAll('.origen-label, #ui-origen, [data-id="origen-text"]');
    const etiquetasDestino = document.querySelectorAll('.destino-label, #ui-destino, [data-id="destino-text"]');
    
    etiquetasOrigen.forEach(el => el.textContent = 'TBA');
    etiquetasDestino.forEach(el => el.textContent = 'TBA');
  `;

  vm.runInNewContext(code, sandbox);

  assert.equal(mockState.pol, '');
  assert.equal(mockState.pod, '');
  assert.equal(mockState.origen, '');
  assert.equal(mockState.destino, '');
  assert.equal(mockInputs[0].value, '');
  assert.equal(mockInputs[1].value, '');
  assert.equal(eventDispatched, true);
  assert.equal(mockLabels[0].textContent, 'TBA');
  assert.equal(mockLabels[1].textContent, 'TBA');
});
