import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderSource = readFileSync(new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url), 'utf8');

test('1. "Recalcular" button is correctly positioned in the Packing List action bar next to "+ Añadir Pieza" and "Importar PDF/Excel"', () => {
  // Verifies the button is in Section 1 (Lista de Empaque)
  const packingListSectionMatch = forwarderSource.match(/1\.\s*Lista de Empaque[\s\S]*?<\/thead>/);
  assert.ok(packingListSectionMatch, 'Packing list section must exist');

  const actionSection = packingListSectionMatch[0];

  // Verifies order and alignment: Volver -> Importar -> Añadir Pieza -> Recalcular
  assert.match(
    actionSection,
    /Importar PDF\/Excel[\s\S]*?\+\s*Añadir Pieza[\s\S]*?id="btn-recalculate-cargo"[\s\S]*?Recalcular/,
    'Recalcular button must be aligned next to "+ Añadir Pieza" and "Importar PDF/Excel"'
  );
});

test('2. "Recalcular" button strictly respects UI/UX and design system (Tailwind classes, borders, padding, Lucide icon)', () => {
  const btnMatch = forwarderSource.match(/<button[\s\S]*?id="btn-recalculate-cargo"[\s\S]*?>[\s\S]*?<\/button>/);
  assert.ok(btnMatch, 'btn-recalculate-cargo must be present in markup');
  const btnMarkup = btnMatch[0];

  // Type button
  assert.match(btnMarkup, /type="button"/, 'Must explicitly declare type="button"');

  // Click handler
  assert.match(btnMarkup, /onClick=\{handleRecalculate\}/, 'Must call handleRecalculate on click');

  // Tailwind classes compliance: rounded-lg, px-4 py-2, text-xs font-bold, cursor-pointer, shadow-sm
  assert.match(btnMarkup, /rounded-lg/, 'Must use rounded-lg border radius consistent with neighboring buttons');
  assert.match(btnMarkup, /px-4\s+py-2/, 'Must use px-4 py-2 padding');
  assert.match(btnMarkup, /text-xs\s+font-bold/, 'Must use text-xs font-bold typography');
  assert.match(btnMarkup, /cursor-pointer/, 'Must have cursor-pointer');
  assert.match(btnMarkup, /shadow-sm/, 'Must have shadow-sm');

  // Corporate palette coherence (emerald / cyan palette family)
  assert.match(btnMarkup, /bg-emerald-50/, 'Must use emerald-50 background');
  assert.match(btnMarkup, /border-emerald-200/, 'Must use border-emerald-200');
  assert.match(btnMarkup, /text-emerald-700/, 'Must use text-emerald-700');

  // Lucide React reload / refresh-cw SVG icon
  assert.match(btnMarkup, /<svg[\s\S]*?viewBox="0 0 24 24"[\s\S]*?<\/svg>/, 'Must contain coherent reload SVG icon');
  assert.match(btnMarkup, /isRecalculating\s*\?\s*['"]animate-spin['"]\s*:\s*['"]['"]/, 'Icon must spin during recalculation');
  assert.match(btnMarkup, /\{isRecalculating\s*\?\s*['"]Recalculando\.\.\.['"]\s*:\s*['"]Recalcular['"]\}/, 'Label must reflect recalculating state');
});

test('3. handleRecalculate logic performs local truck calculation, checks 24t / 13.6 LDM overload, and updates road pricing without remote fetch', () => {
  // Verifies handleRecalculate function declaration
  assert.match(forwarderSource, /const\s+handleRecalculate\s*=\s*async\s*\(\)\s*=>/, 'handleRecalculate function must exist');

  // Verifies reading and sanitizing cargoItems (quantity, length, width, height, weight)
  assert.match(forwarderSource, /cargoItems[\s\S]*?item\.quantity[\s\S]*?item\.length[\s\S]*?item\.width[\s\S]*?item\.height[\s\S]*?item\.weight/, 'Must read current row dimensions and weights');

  // Verifies calculation of truck weights (kg), volume (m3), and LDM
  assert.match(forwarderSource, /totalWeightKg\s*=\s*currentItems\.reduce/, 'Must compute total weight in kg');
  assert.match(forwarderSource, /totalVolumeM3\s*=\s*currentItems\.reduce/, 'Must compute total volume in m3');
  assert.match(forwarderSource, /totalLdm\s*=/, 'Must compute total LDM');

  // Verifies trailer overload threshold check for 24,000 kg or 13.6 LDM with red warning
  assert.match(forwarderSource, /totalWeightKg\s*>\s*24000\s*\|\|\s*totalLdm\s*>\s*13\.6/, 'Must check 24,000 kg or 13.6 LDM trailer threshold');
  assert.match(forwarderSource, /Exceso de capacidad para un Tráiler Estándar/, 'Must show standard trailer capacity overload warning');

  // Verifies local road pricing formula: (Distancia_km * Tarifa_km) + Peajes + Dietas + Penalizaciones_Almacén
  assert.match(forwarderSource, /runningCost\s*\+\s*peajes\s*\+\s*dietas\s*\+\s*penalizacionesAlmacen/, 'Must compute local road transport pricing formula');

  // Verifies NO remote fetch in handleRecalculate
  const handleRecalculateMatch = forwarderSource.match(/const\s+handleRecalculate[\s\S]*?finally\s*\{[\s\S]*?\};/);
  assert.ok(handleRecalculateMatch, 'handleRecalculate function body must exist');
  assert.doesNotMatch(handleRecalculateMatch[0], /fetch\(/, 'handleRecalculate must not execute remote fetch');
});

test('4. Subtle and fast visual feedback is displayed upon successful recalculation', () => {
  // Verifies visual feedback badge exists
  assert.match(forwarderSource, /recalculateFeedback\s*&&/, 'Must conditionally render recalculateFeedback message');
  assert.match(forwarderSource, /id="recalculate-feedback-badge"/, 'Feedback badge must have ID recalculate-feedback-badge');
  assert.match(forwarderSource, /setRecalculateFeedback\(\s*['"]Cálculos actualizados['"]\s*\)/, 'Must display confirmation message');
  assert.match(forwarderSource, /setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]*?setRecalculateFeedback\(null\)/, 'Must automatically clear feedback after a fast timeout');
});
