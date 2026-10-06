import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('1. Limpieza del Header: Eliminación total del Chat Global y Voice Toggle en Land Charter', async () => {
  const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  // No debe existir el toggle del header
  assert.doesNotMatch(indexHtml, /id="toggle-madre-btn"/, 'El botón o interruptor toggle-madre-btn no debe existir en el Header');
  
  // No debe existir el widget flotante ni la interfaz conversacional
  assert.doesNotMatch(indexHtml, /id="madre-panel"/, 'El panel de chat flotante madre-panel no debe existir');
  assert.doesNotMatch(indexHtml, /id="madre-chat-form"/, 'El formulario de chat madre-chat-form no debe existir');
  assert.doesNotMatch(indexHtml, /madre-hal\.css/, 'No debe cargarse la hoja de estilos de chat madre-hal.css');
});

test('2. Integración en el Módulo Decisiones: Botón secundario (outline) "Auditoría MADRE (Terrestre)"', async () => {
  const dssSource = await readFile(new URL('../src/DecisionSupportModule.js', import.meta.url), 'utf8');
  const decisionesHtml = await readFile(new URL('../decisiones.html', import.meta.url), 'utf8');

  for (const [name, content] of [['DecisionSupportModule.js', dssSource], ['decisiones.html', decisionesHtml]]) {
    // Verificar existencia del botón con ID específico
    assert.match(content, /id="btn-auditoria-madre"/, `[${name}] debe contener id="btn-auditoria-madre"`);
    // Verificar texto visible
    assert.match(content, /Auditoría MADRE \(Terrestre\)/, `[${name}] debe mostrar el texto "Auditoría MADRE (Terrestre)"`);
    // Verificar estilo outline secundario
    assert.match(content, /bg-transparent/, `[${name}] debe tener fondo transparente (estilo outline)`);
    assert.match(content, /border-indigo-400/, `[${name}] debe tener borde outline`);
    // Verificar handler de click
    assert.match(content, /onclick="ejecutarAuditoriaMadre\(\)"/, `[${name}] debe invocar ejecutarAuditoriaMadre()`);
  }
});

test('3. Backend Handler: Validación del payload con modulo: land_charter, vista_activa: decisiones y contexto_ui completo', async () => {
  const madreBackendSource = await readFile(new URL('../netlify/functions/madre-ia.js', import.meta.url), 'utf8');
  const madreBackendModule = await import(`data:text/javascript;base64,${Buffer.from(madreBackendSource).toString('base64')}`);
  const handler = madreBackendModule.default;

  const sampleContextoUi = {
    porte: {
      fleteEstimado: 2100,
      breakEven: 1750,
      margenBruto: 16.6,
      tipoCarga: "Carga Paletizada Industrial",
      pesoKg: 22000
    },
    ruta: {
      origen: "Barcelona (ZAL)",
      destino: "Lyon (Francia)",
      distanciaKm: 640
    },
    ldm: 13.6,
    costes: {
      costeTotal: 1750,
      breakEvenKm: 1750,
      combustible: 680,
      dietas: 150
    },
    peajes: 220
  };

  const req = new Request('http://localhost/.netlify/functions/madre-ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modulo: "land_charter",
      vista_activa: "decisiones",
      contexto_ui: sampleContextoUi,
      mensajeUsuario: "Auditoría estratégica terrestre para porte actual"
    })
  });

  const res = await handler(req);
  assert.equal(res.status, 200, 'Debe devolver código HTTP 200');
  const data = await res.json();

  // Veredicto general estructurado
  assert.ok(data.veredicto_general, 'Debe contener veredicto_general');
  assert.ok(
    data.veredicto_general.includes('🟢') || data.veredicto_general.includes('🟡') || data.veredicto_general.includes('🔴'),
    'El veredicto debe ser 🟢, 🟡 o 🔴'
  );

  // Reporte estratégico adaptado
  assert.ok(typeof data.reporte_estrategico === 'string', 'reporte_estrategico debe ser un string');
  assert.ok(data.reporte_estrategico.includes('Barcelona') || data.reporte_estrategico.includes('Lyon') || data.reporte_estrategico.includes('Terrestre'), 'El reporte debe reflejar la operativa terrestre');

  // Variables perjudiciales
  assert.ok(Array.isArray(data.variables_perjudiciales), 'variables_perjudiciales debe ser un array');
  assert.ok(data.variables_perjudiciales.length >= 2, 'Debe incluir al menos 2 variables perjudiciales detectadas');

  // Recomendaciones con tipo pro y contra
  assert.ok(Array.isArray(data.recomendaciones), 'recomendaciones debe ser un array');
  assert.ok(data.recomendaciones.some(r => r.tipo === 'pro'), 'Debe incluir recomendaciones pro');
  assert.ok(data.recomendaciones.some(r => r.tipo === 'contra'), 'Debe incluir recomendaciones contra');

  // Modificaciones Recap para Orden de Carga
  assert.ok(data.modificaciones_recap, 'Debe incluir modificaciones_recap');
  assert.ok(data.modificaciones_recap.clausulaParalizacion, 'Debe incluir cláusula de paralización');
});

test('4. UI Nivel 1: Bloque / Tarjeta Inferior de Resultados con Veredicto General, Fondo Blanco y "Ver Auditoría Completa"', async () => {
  const dssSource = await readFile(new URL('../src/DecisionSupportModule.js', import.meta.url), 'utf8');

  // Tarjeta de Nivel 1 en el DOM: fondo blanco, borde gray-200, shadow-sm
  assert.match(dssSource, /id="madre-audit-level1-card"/, 'Debe existir la tarjeta inferior id="madre-audit-level1-card"');
  assert.match(dssSource, /id="madre-audit-level1-card"[^>]*bg-white/, 'La tarjeta de Nivel 1 debe tener fondo blanco (bg-white)');
  assert.match(dssSource, /id="madre-audit-level1-card"[^>]*border-gray-200/, 'La tarjeta de Nivel 1 debe tener borde border-gray-200');
  assert.match(dssSource, /id="madre-audit-level1-card"[^>]*shadow-sm/, 'La tarjeta de Nivel 1 debe tener sombra ligera shadow-sm');
  assert.doesNotMatch(dssSource, /id="madre-audit-level1-card"[^>]*bg-slate-800/, 'No debe tener fondo azul oscuro');

  // Texto del resumen gris oscuro y botón con margen
  assert.match(dssSource, /id="madre-audit-resumen-texto"[^>]*text-gray-800/, 'El texto de resumen debe ser gris oscuro (text-gray-800)');
  assert.match(dssSource, /id="madre-audit-veredicto-badge"/, 'Debe existir el elemento para el badge de veredicto_general');
  assert.match(dssSource, /id="btn-ver-auditoria-completa"/, 'Debe existir el botón id="btn-ver-auditoria-completa"');
  assert.match(dssSource, /id="btn-ver-auditoria-completa"[^>]*ml-4/, 'El botón debe tener margen visible (ml-4)');
  assert.match(dssSource, /Ver Auditoría Completa/, 'El botón de Nivel 1 debe tener la etiqueta "Ver Auditoría Completa"');
  assert.match(dssSource, /onclick="abrirAuditoriaMadreOffcanvas\(\)"/, 'Al pulsar debe abrir el panel lateral Nivel 2');
});

test('5. UI Nivel 2 (Offcanvas): Panel amplio con padding p-6, diseño estrictamente corporativo (bg-white, text-slate-900, sin modo oscuro)', async () => {
  const dssSource = await readFile(new URL('../src/DecisionSupportModule.js', import.meta.url), 'utf8');

  // Estricto fondo blanco, textos oscuros y mayor anchura
  assert.match(dssSource, /id="madre-audit-offcanvas"[^>]*bg-white/, 'El panel offcanvas debe tener clase bg-white');
  assert.match(dssSource, /id="madre-audit-offcanvas"[^>]*text-slate-900/, 'El panel offcanvas debe tener clase text-slate-900');
  assert.match(dssSource, /id="madre-audit-offcanvas"[^>]*max-w-2xl/, 'El panel offcanvas debe ser amplio (max-w-2xl)');
  assert.match(dssSource, /id="madre-audit-offcanvas"[\s\S]*?<div class="[^"]*p-6[^"]*"/, 'El contenedor interno debe tener padding generoso p-6');
  
  // No debe tener clases de modo oscuro en el panel
  const offcanvasSnippet = dssSource.slice(dssSource.indexOf('id="madre-audit-offcanvas"'), dssSource.indexOf('</aside>'));
  assert.doesNotMatch(offcanvasSnippet, /\bdark:/, 'El panel offcanvas no debe contener clases con prefijo dark:');

  // Secciones requeridas: Reporte, Variables Perjudiciales con Badges, y Recomendaciones con Pro/Contra
  assert.match(dssSource, /id="offcanvas-reporte-estrategico"/, 'Debe contener id="offcanvas-reporte-estrategico"');
  assert.match(dssSource, /id="offcanvas-variables-container"/, 'Debe contener id="offcanvas-variables-container"');
  assert.match(dssSource, /id="offcanvas-recomendaciones-container"/, 'Debe contener id="offcanvas-recomendaciones-container"');
  assert.match(dssSource, /fa-triangle-exclamation/, 'Debe utilizar badges de alerta con icono fa-triangle-exclamation');
});

test('6. Botón de Cierre: Sticky footer con "Generar Orden de Carga Estratégica (Opción B)" destacado (w-full, bg-teal-700, text-white)', async () => {
  const dssSource = await readFile(new URL('../src/DecisionSupportModule.js', import.meta.url), 'utf8');

  // Botón final del panel en footer anclado/sticky
  assert.match(dssSource, /id="btn-generar-orden-carga-estrategica"/, 'Debe existir id="btn-generar-orden-carga-estrategica"');
  assert.match(dssSource, /Generar Orden de Carga Estratégica \(Opción B\)/, 'El botón debe decir "Generar Orden de Carga Estratégica (Opción B)"');
  assert.match(dssSource, /<footer class="[^"]*sticky[^"]*bottom-0/, 'El footer debe ser sticky bottom-0');
  assert.match(dssSource, /id="btn-generar-orden-carga-estrategica"[^>]*w-full/, 'El botón final debe tener ancho completo w-full');
  assert.match(dssSource, /id="btn-generar-orden-carga-estrategica"[^>]*bg-teal-700/, 'El botón final debe usar el color primario de Land Charter (bg-teal-700)');
  assert.match(dssSource, /id="btn-generar-orden-carga-estrategica"[^>]*text-white/, 'El botón final debe tener texto blanco (text-white)');
  
  // No debe decir Fixture Recap en el botón de cierre del panel
  const footerSnippet = dssSource.slice(dssSource.indexOf('id="madre-audit-offcanvas"'), dssSource.indexOf('</aside>'));
  assert.doesNotMatch(footerSnippet, /id="btn-generar-orden-carga-estrategica"[^>]*Fixture Recap/);

  // Funciones de Reverse Sync y Generador de PDF
  assert.match(dssSource, /export async function aplicarModificacionesYGenerarOrdenCarga/, 'Debe existir aplicarModificacionesYGenerarOrdenCarga');
  assert.match(dssSource, /export async function generateOrdenDeCargaPDF/, 'Debe exportar generateOrdenDeCargaPDF');
  assert.match(dssSource, /export function buildOrdenDeCargaHTMLTemplate/, 'Debe exportar buildOrdenDeCargaHTMLTemplate');
  assert.match(dssSource, /ORDEN DE CARGA Y CONTRATO DE TRANSPORTE TERRESTRE/, 'La plantilla HTML debe ser de orden de carga terrestre');
});

test('7. Componente React: DecisionesMadreAudit.jsx existe y exporta la arquitectura requerida con UI pulida', async () => {
  const reactSource = await readFile(new URL('../src/components/DecisionesMadreAudit.jsx', import.meta.url), 'utf8');

  assert.match(reactSource, /export default function DecisionesMadreAudit/, 'Debe exportar el componente por defecto');
  assert.match(reactSource, /Auditoría MADRE \(Terrestre\)/, 'Debe incluir el botón Auditoría MADRE (Terrestre)');
  assert.match(reactSource, /Ver Auditoría Completa/, 'Debe incluir el botón Ver Auditoría Completa');
  assert.match(reactSource, /Generar Orden de Carga Estratégica \(Opción B\)/, 'Debe incluir el botón Generar Orden de Carga Estratégica (Opción B)');
  assert.match(reactSource, /bg-white/, 'Debe respetar el fondo blanco corporativo');
  assert.match(reactSource, /text-slate-900/, 'Debe respetar el texto oscuro');
  assert.match(reactSource, /bg-teal-700/, 'Debe usar el botón primario teal-700');
  assert.match(reactSource, /max-w-2xl/, 'Debe ser espacioso max-w-2xl');
});
