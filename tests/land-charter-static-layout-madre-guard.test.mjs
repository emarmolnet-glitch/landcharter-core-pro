import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const madreAgentJs = await readFile(new URL('../src/madre-agent.js', import.meta.url), 'utf8');
const appJsx = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
}

test('1. Limpieza estructural: No existe invocación activa a modo enfoque o apertura de MADRE en el workflow de ruta', () => {
  const routeWorkflowStart = indexHtml.indexOf('async function runOnDemandMapRouteWorkflow');
  const routeWorkflowEnd = indexHtml.indexOf('function redrawCurrentRoute', routeWorkflowStart);
  assert.ok(routeWorkflowStart > -1 && routeWorkflowEnd > routeWorkflowStart, 'Debe delimitarse runOnDemandMapRouteWorkflow en index.html');
  
  const rawBlock = indexHtml.slice(routeWorkflowStart, routeWorkflowEnd);
  const executableBlock = stripComments(rawBlock);
  
  // Verificar que NO se ejecutan llamadas a modo enfoque o MADRE
  assert.doesNotMatch(
    executableBlock,
    /setHeaderVisibility\s*\(\s*false\s*\)/,
    'runOnDemandMapRouteWorkflow no debe ejecutar setHeaderVisibility(false)'
  );
  assert.doesNotMatch(
    executableBlock,
    /toggleSidebar\s*\(\s*true\s*\)/,
    'runOnDemandMapRouteWorkflow no debe ejecutar toggleSidebar(true)'
  );
  assert.doesNotMatch(
    executableBlock,
    /toggleMadreDrawer\s*\(\s*\)/,
    'runOnDemandMapRouteWorkflow no debe forzar la apertura del drawer de MADRE'
  );
  assert.match(
    rawBlock,
    /\[ESTRUCTURAL\]: LIMPIEZA DE MODO ENFOQUE Y APERTURA DE MADRE/,
    'Debe contener la directriz estructural explícita documentando la eliminación del modo enfoque y de MADRE'
  );
});

test('2. Limpieza estructural: Cálculo maestro y flete garantizan layout 100% estático', () => {
  const masterValidationStart = indexHtml.indexOf('async function handleMasterValidationAndCalculate');
  const masterValidationEnd = indexHtml.indexOf('function handleDWTChange', masterValidationStart);
  assert.ok(masterValidationStart > -1 && masterValidationEnd > masterValidationStart, 'Debe delimitarse handleMasterValidationAndCalculate en index.html');

  const rawMasterBlock = indexHtml.slice(masterValidationStart, masterValidationEnd);
  const executableMasterBlock = stripComments(rawMasterBlock);
  
  // Garantía de layout estático
  assert.doesNotMatch(
    executableMasterBlock,
    /setHeaderVisibility\s*\(\s*false\s*\)/,
    'handleMasterValidationAndCalculate no debe ejecutar setHeaderVisibility(false)'
  );
  assert.doesNotMatch(
    executableMasterBlock,
    /toggleSidebar\s*\(\s*true\s*\)/,
    'handleMasterValidationAndCalculate no debe ejecutar toggleSidebar(true)'
  );
  assert.doesNotMatch(
    executableMasterBlock,
    /toggleMadreDrawer\s*\(\s*\)/,
    'handleMasterValidationAndCalculate no debe forzar la apertura de MADRE'
  );
  assert.match(
    rawMasterBlock,
    /\[ESTRUCTURAL\]: GARANTÍA DE LAYOUT ESTÁTICO TRAS CÁLCULO MAESTRO/,
    'handleMasterValidationAndCalculate debe contener la garantía de layout estático'
  );
});

test('3. MADRE Drawer solo responde a petición explícita del usuario (clic o voz)', () => {
  assert.match(
    indexHtml,
    /window\.toggleMadreDrawer\s*=\s*function\s*\(\s*forceState,\s*isUserAction\s*=\s*true\s*\)/,
    'toggleMadreDrawer debe aceptar el parámetro isUserAction con valor por defecto true'
  );
  assert.match(
    indexHtml,
    /if\s*\(\s*forceState\s*===\s*true\s*&&\s*isUserAction\s*===\s*false\s*\)\s*\{\s*console\.warn/,
    'toggleMadreDrawer debe bloquear aperturas automáticas/no solicitadas por el usuario'
  );
});

test('4. MADRE Agent (toggleMadrePanel) bloquea aperturas automáticas sin acción del usuario', () => {
  assert.match(
    madreAgentJs,
    /export function toggleMadrePanel\s*\(\s*forceState,\s*isUserAction\s*=\s*true\s*\)/,
    'toggleMadrePanel debe aceptar isUserAction'
  );
  assert.match(
    madreAgentJs,
    /if\s*\(\s*forceState\s*===\s*true\s*&&\s*isUserAction\s*===\s*false\s*\)\s*\{\s*console\.warn/,
    'toggleMadrePanel debe bloquear aperturas forzadas sin interacción de usuario'
  );
});

test('5. React App.jsx mantiene el layout 100% estático al recibir osrm:route-updated', () => {
  assert.match(
    appJsx,
    /\[LIMPIEZA ESTRUCTURAL\]: El layout principal de LandCharter/,
    'App.jsx debe documentar la regla de layout estático en el listener de ruta'
  );
  const executableAppJsx = stripComments(appJsx);
  assert.doesNotMatch(
    executableAppJsx,
    /handleRouteUpdated[\s\S]*?setHeaderVisibility\s*\(\s*false\s*\)/,
    'handleRouteUpdated no debe llamar a setHeaderVisibility(false)'
  );
});
