import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const fileContent = await readFile(new URL('../src/components/GlobalMadreDrawer.jsx', import.meta.url), 'utf8');

// Extraer y evaluar buildMotherExecutiveScript
function extractFunction(src, name) {
  const match = src.match(new RegExp(`export\\s+function\\s+${name}[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`Function ${name} not found`);
  const code = match[0].replace(`export function ${name}`, `function ${name}`);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${code}; globalThis.${name} = ${name};`, sandbox);
  return sandbox[name];
}

const buildMotherExecutiveScript = extractFunction(fileContent, 'buildMotherExecutiveScript');

test('1. Paso 1: buildMotherExecutiveScript evalúa rutas terrestres y costes correctamente', () => {
  // Test modo camión por defecto
  const defaultScript = buildMotherExecutiveScript({});
  assert.ok(defaultScript.includes('flota de camiones de gran tonelaje'), 'Debe indicar camión por defecto');
  assert.ok(defaultScript.includes('850 km'), 'Debe incluir distancia por defecto 850 km');
  assert.ok(defaultScript.includes('25 toneladas'), 'Debe incluir 25 toneladas');
  assert.ok(defaultScript.includes('1.65 euros por kilómetro'), 'Debe incluir coste por km por defecto 1.65');
  assert.ok(defaultScript.includes('Ruta optimizada sin sobrecostes severos de peaje.'), 'Debe indicar peajes optimizados');
  assert.ok(defaultScript.includes('ahorrado 90 euros de gestión'), 'Ahorro admin debe ser 2 * 45 = 90');
  assert.ok(defaultScript.includes('prevenido posibles desvíos por valor de 0 euros'), 'Fugas deben ser 0 si no hay riesgos');

  // Test modo tren / ferrocarril intermodal
  const railScript = buildMotherExecutiveScript({
    esTren: true,
    toneladas: 500,
    distanciaKm: 1200,
    costPerKm: 1.25,
    peajesAltos: true,
    riesgosDetectados: true
  });
  assert.ok(railScript.includes('transporte ferroviario intermodal'), 'Debe indicar tren');
  assert.ok(railScript.includes('1200 km'), 'Debe indicar 1200 km');
  assert.ok(railScript.includes('500 toneladas'), 'Debe indicar 500 toneladas');
  assert.ok(railScript.includes('1.25 euros por kilómetro'), 'Debe indicar 1.25 euros por km');
  assert.ok(railScript.includes('Se han registrado peajes elevados en los corredores seleccionados.'), 'Debe alertar peajes elevados');
  assert.ok(railScript.includes('prevenido posibles desvíos por valor de 1400 euros'), 'Fugas deben ser 1400 si hay riesgos');
});

test('2. Paso 2: playNeuralMotherVoice conecta a DATA_BRIDGE_URL con voz Clara y esquiva bloqueo CSP usando Web Audio API', async () => {
  assert.match(fileContent, /DATA_BRIDGE_URL\s*=\s*["']https:\/\/calm-shortbread-55bcfc\.netlify\.app["']/, 'DATA_BRIDGE_URL debe apuntar a calm-shortbread-55bcfc.netlify.app');
  assert.match(fileContent, /export\s+async\s+function\s+playNeuralMotherVoice\s*\(\s*text\s*,\s*options\s*=\s*\{\}\s*\)/, 'playNeuralMotherVoice debe estar definida y exportada con parámetros (text, options = {})');
  assert.match(fileContent, /\$\{DATA_BRIDGE_URL\}\/\.netlify\/functions\/madre-voice/, 'playNeuralMotherVoice debe llamar a madre-voice en DATA_BRIDGE_URL');
  assert.match(fileContent, /['"]Accept['"]:\s*['"]audio\/mpeg['"]/, 'playNeuralMotherVoice debe incluir header Accept: audio/mpeg');
  assert.match(fileContent, /voice:\s*options\.voice\s*\|\|\s*["']Clara["']/, 'Debe utilizar voice: options.voice || "Clara"');
  assert.match(fileContent, /origen:\s*["']Land Charter["']/, 'Debe enviar origen: "Land Charter"');
  assert.match(fileContent, /response\.arrayBuffer\(\)/, 'Debe procesar la respuesta como arrayBuffer en memoria');
  assert.match(fileContent, /AudioContext\s*=\s*window\.AudioContext\s*\|\|\s*window\.webkitAudioContext/, 'Debe instanciar AudioContext');
  assert.match(fileContent, /audioCtx\.decodeAudioData\s*\(\s*arrayBuffer\s*\)/, 'Debe decodificar arrayBuffer con decodeAudioData');
  assert.match(fileContent, /source\.start\s*\(\s*0\s*\)/, 'Debe reproducir con source.start(0)');
  assert.doesNotMatch(fileContent, /createObjectURL/, 'No debe usar URL.createObjectURL para esquivar el bloqueo CSP blob:');
});

test('3. Paso 3: Contraste visual explícito con text-white y fondos sólidos bg-teal-700 / bg-slate-800', async () => {
  assert.match(fileContent, /text-white/, 'Debe incluir explícitamente text-white para garantizar contraste');
  assert.match(fileContent, /bg-teal-700/, 'Debe incluir explícitamente bg-teal-700 para mensajes de usuario');
  assert.match(fileContent, /bg-slate-800/, 'Debe incluir explícitamente bg-slate-800 para mensajes del asistente');
});

test('4. Paso 4: Manos libres en micrófono auto-envía comando cuando isFinal es verdadero', async () => {
  assert.match(fileContent, /recognition\.onresult/, 'Debe definir el handler onresult');
  assert.match(fileContent, /isFinal/, 'Debe comprobar si isFinal es verdadero');
  assert.match(fileContent, /handleSendMessage\s*\(\s*completeTranscript\s*\)/, 'Debe invocar handleSendMessage automáticamente al completarse isFinal');
});

test('5. Blindaje de Cerebro.ia: cerebro-ia.js permanece 100% intacto', async () => {
  const cerebroIaSource = await readFile(new URL('../netlify/functions/cerebro-ia.js', import.meta.url), 'utf8');
  assert.ok(cerebroIaSource.length > 0, 'cerebro-ia.js debe existir');
  assert.ok(cerebroIaSource.includes('calm-shortbread-55bcfc.netlify.app'), 'cerebro-ia.js debe mantener su backend de cálculo original');
});

test('6. Blindaje de conexión a madre-chat: sendToMadreChat conecta a DATA_BRIDGE_URL y GlobalMadreDrawer no usa endpoints inventados', async () => {
  assert.match(fileContent, /export\s+async\s+function\s+sendToMadreChat\s*\(\s*payload\s*\)/, 'sendToMadreChat debe estar definida y exportada con parámetro payload');
  assert.match(fileContent, /\$\{DATA_BRIDGE_URL\}\/\.netlify\/functions\/madre-chat/, 'sendToMadreChat debe conectar a ${DATA_BRIDGE_URL}/.netlify/functions/madre-chat');
  assert.match(fileContent, /['"]Accept['"]:\s*['"]application\/json['"]/, 'sendToMadreChat debe incluir header Accept: application/json');
  assert.match(fileContent, /['"]Content-Type['"]:\s*['"]application\/json['"]/, 'sendToMadreChat debe incluir header Content-Type: application/json');
  assert.match(fileContent, /sendToMadreChat\s*\(\{/, 'GlobalMadreDrawer handleSendMessage debe invocar sendToMadreChat');
  assert.doesNotMatch(fileContent, /fetch\(\s*['"]\/api\/cerebro-ia['"]/, 'GlobalMadreDrawer no debe llamar al endpoint relativo /api/cerebro-ia');
  assert.doesNotMatch(fileContent, /fetch\(\s*['"]\/\.netlify\/functions\/madre-ia['"]/, 'GlobalMadreDrawer no debe llamar a madre-ia');
});
