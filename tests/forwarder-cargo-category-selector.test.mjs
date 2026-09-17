import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forwarderSource = readFileSync(new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url), 'utf8');

test('1. ForwarderWorkspace defines cargoCategory and setCargoCategory state hooks', () => {
  assert.match(
    forwarderSource,
    /const\s*\[\s*cargoCategory\s*,\s*setCargoCategory\s*\]\s*=\s*useState\(/,
    'ForwarderWorkspace must declare cargoCategory state hook with useState'
  );
});

test('2. Cargo Category selector is positioned before "+ Añadir Pieza" in Packing List action bar', () => {
  const packingListSectionMatch = forwarderSource.match(/1\.\s*Lista de Empaque[\s\S]*?<\/thead>/);
  assert.ok(packingListSectionMatch, 'Packing list section 1 must exist');

  const actionSection = packingListSectionMatch[0];

  assert.match(
    actionSection,
    /Importar PDF\/Excel[\s\S]*?id="top-cargo-category"[\s\S]*?\+\s*Añadir Pieza/,
    'Cargo category selector must be injected before "+ Añadir Pieza" and after "Importar PDF/Excel"'
  );
});

test('3. Cargo Category selector includes all required options matching Core PRO', () => {
  const selectMatch = forwarderSource.match(/<select[\s\S]*?id="top-cargo-category"[\s\S]*?<\/select>/);
  assert.ok(selectMatch, 'Select element with id="top-cargo-category" must exist');

  const selectMarkup = selectMatch[0];
  const requiredOptions = [
    'Carga Paletizada',
    'Sling Bags',
    'Sacos',
    'Carga General',
    'Graneles Sólidos / Minerales',
    'Mercancía Ensacada / Dry Bulk',
    'Carga de Proyecto / Heavy Lift'
  ];

  for (const opt of requiredOptions) {
    assert.match(
      selectMarkup,
      new RegExp(`<option\\s+value="${opt}">\\s*${opt}\\s*<\\/option>`),
      `Option "${opt}" must be present in the selector`
    );
  }
});

test('4. Cargo Category selector strictly adheres to Tailwind design system and labeling', () => {
  const containerMatch = forwarderSource.match(/<div className="flex items-center gap-1\.5 bg-slate-50 border border-slate-200 rounded-lg px-2\.5 py-1">[\s\S]*?<\/div>/);
  assert.ok(containerMatch, 'Outer container must use designated flex and border styling');

  assert.match(
    forwarderSource,
    /<label htmlFor="top-cargo-category" className="text-\[11px\] font-bold text-slate-600">Categoría Carga:<\/label>/,
    'Label must have htmlFor="top-cargo-category" and appropriate styling'
  );

  assert.match(
    forwarderSource,
    /className="text-xs font-bold bg-white border border-slate-300 rounded px-2 py-0\.5 text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none cursor-pointer"/,
    'Select element must use exact style classes'
  );
});
