import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_TARIFF_COST_ITEMS,
  getDefaultCostItems,
  calculateFobTotal,
  calculateCommercialTotal
} from '../src/utils/calculadoraTarifasEngine.mjs';

const engineSource = readFileSync(new URL('../src/utils/calculadoraTarifasEngine.mjs', import.meta.url), 'utf8');
const widgetSource = readFileSync(new URL('../src/components/CalculadoraTarifasWidget.jsx', import.meta.url), 'utf8');
const widgetCssSource = readFileSync(new URL('../src/components/CalculadoraTarifasWidget.css', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('../src/components/ForwarderWorkspace.jsx', import.meta.url), 'utf8');
const parserBackendSource = readFileSync(new URL('../netlify/functions/parse-tariff.js', import.meta.url), 'utf8');
const sidebarAliasSource = readFileSync(new URL('../src/components/ProviderTariffSidebar.jsx', import.meta.url), 'utf8');

test('1. CalculadoraTarifasWidget defines official 5 default concepts from base Excel tariff', () => {
  assert.equal(DEFAULT_TARIFF_COST_ITEMS.length, 5);
  assert.equal(DEFAULT_TARIFF_COST_ITEMS[0].concepto, "Precio Base");
  assert.equal(DEFAULT_TARIFF_COST_ITEMS[1].concepto, "Envase (Big Bag / Sac)");
  assert.equal(DEFAULT_TARIFF_COST_ITEMS[2].concepto, "Logística Inland");
  assert.equal(DEFAULT_TARIFF_COST_ITEMS[3].concepto, "Gastos de tránsito");
  assert.equal(DEFAULT_TARIFF_COST_ITEMS[4].concepto, "Gastos portuarios");

  assert.match(widgetSource, /const\s+\[costes,\s*setCostes\]\s*=\s*useState\(\s*(?:initialCostes\s*\|\|\s*)?getDefaultCostItems\(\)/);
});

test('2. Strict translation persistence: forbidden legacy French strings do NOT exist in the widget code or engine', () => {
  assert.doesNotMatch(widgetSource, /Frais Transit/i);
  assert.doesNotMatch(widgetSource, /Frais Port/i);
  assert.doesNotMatch(engineSource, /Frais Transit/i);
  assert.doesNotMatch(engineSource, /Frais Port/i);

  assert.match(engineSource, /"Gastos de tránsito"/);
  assert.match(engineSource, /"Gastos portuarios"/);
});

test('3. Separated Discount Factor (Rabais) with default 0.85 outside summable rows', () => {
  assert.match(widgetSource, /id=["']input-factor-descuento["']/);
  assert.match(widgetSource, /Factor de Descuento \(Rabais\)/);
  assert.match(widgetSource, /const\s+\[factorDescuento,\s*setFactorDescuento\]\s*=\s*useState\(/);
  assert.match(widgetSource, /0\.85/);
});

test('4. Mixed Currencies calculation and Commercial Modality (FOB vs EXW): EXW excludes transit and port costs', () => {
  const mixedCostItems = [
    { concepto: "Precio Base", valorLocal: 10000, isBasePrice: true, isLocalCurrency: true }, // 10000 DZD * 0.85 * 0.0068 = 57.80 USD
    { concepto: "Envase (Big Bag / Sac)", valorLocal: 5.30, isDirectInternational: true }, // 5.30 USD
    { concepto: "Logística Inland", valorLocal: 3.00, isInlandLogistics: true, isDirectInternational: true }, // 3.00 USD
    { concepto: "Gastos de tránsito", valorLocal: 0.50, isTransit: true, isDirectInternational: true }, // 0.50 USD
    { concepto: "Gastos portuarios", valorLocal: 2.00, isPort: true, isDirectInternational: true } // 2.00 USD
  ];

  // FOB Total: 57.80 + 5.30 + 3.00 + 0.50 + 2.00 = 68.60 USD
  const fobResult = calculateCommercialTotal({
    items: mixedCostItems,
    discountFactor: 0.85,
    exchangeRate: 0.0068,
    commercialModality: 'FOB',
    useFspe: true
  });
  assert.equal(fobResult, 68.6);

  // EXW Total: excludes transit (0.50) and ports (2.00) => 57.80 + 5.30 + 3.00 = 66.10 USD
  const exwResult = calculateCommercialTotal({
    items: mixedCostItems,
    discountFactor: 0.85,
    exchangeRate: 0.0068,
    commercialModality: 'EXW',
    useFspe: true
  });
  assert.equal(exwResult, 66.1);
});

test('5. Toggles bar: renders [FOB | EXW] and [Con FSPE | Sin FSPE] and connects to commercialModality and useFspe state', () => {
  // State variables declared
  assert.match(widgetSource, /const\s+\[commercialModality,\s*setCommercialModality\]\s*=\s*useState\(['"]FOB['"]\)/);
  assert.match(widgetSource, /const\s+\[useFspe,\s*setUseFspe\]\s*=\s*useState\(true\)/);

  // Buttons rendered
  assert.match(widgetSource, /id=["']btn-toggle-fob["']/);
  assert.match(widgetSource, /id=["']btn-toggle-exw["']/);
  assert.match(widgetSource, /id=["']btn-toggle-con-fspe["']/);
  assert.match(widgetSource, /id=["']btn-toggle-sin-fspe["']/);

  // Button handlers toggle state
  assert.match(widgetSource, /setCommercialModality\(['"]FOB['"]\)/);
  assert.match(widgetSource, /setCommercialModality\(['"]EXW['"]\)/);
  assert.match(widgetSource, /handleToggleFspe\(true\)/);
  assert.match(widgetSource, /handleToggleFspe\(false\)/);
});

test('6. Dynamic submit button and project payload adapts to commercial modality (FOB / EXW)', () => {
  assert.match(widgetSource, /ENVIAR AL PROYECTO \(\{commercialModality\}\)/);
  assert.match(widgetSource, /commercialModality,/);
  assert.match(widgetSource, /useFspe,/);
});

test('7. Dropzone & File Upload: accepts .xlsx, .csv, .pdf and renders prominent "Subir Tarifa (Excel / PDF)" button', () => {
  assert.match(widgetSource, /className=\{`tariff-calc-dropzone/);
  assert.match(widgetSource, /Subir Tarifa \(Excel \/ PDF\)/);
  assert.match(widgetSource, /accept=["']\.xlsx,\.xls,\.csv,\.pdf["']/);
});

test('8. Dropdown for imported products: stores full array, renders select and applies discount (Rabais)', () => {
  assert.match(widgetSource, /const\s+\[tarifasImportadas,\s*setTarifasImportadas\]\s*=\s*useState/);
  assert.match(widgetSource, /<label[^>]*>Seleccionar Producto:<\/label>/);
  assert.match(widgetSource, /onChange=\{handleMaterialChange\}/);
  assert.match(widgetSource, /value=\{selectedMaterialId\}/);
  assert.match(widgetSource, /\{tarifasImportadas\.map\(\(item,\s*idx\)\s*=>\s*\(/);
  assert.match(widgetSource, /<option\s+key=\{idx\}\s+value=\{item\.id\}>\{item\.Produit\s*\|\|\s*item\.name\}<\/option>/);
});

test('9. ProviderTariffSidebar alias exists and exports CalculadoraTarifasWidget', () => {
  assert.match(sidebarAliasSource, /import\s+CalculadoraTarifasWidget\s+from\s+['"]\.\/CalculadoraTarifasWidget(?:\.jsx)?['"]/);
  assert.match(sidebarAliasSource, /export\s+default\s+CalculadoraTarifasWidget/);
});

test('10. UI/UX: Positioned on the LEFT (left: 24px) avoiding Agent collision, and LIGHT corporate theme', () => {
  assert.match(widgetSource, /position,\s*setPosition\]\s*=\s*useState\(\{\s*x:\s*24/);
  assert.match(widgetCssSource, /\.tariff-calc-container\s*\{[\s\S]*?background:\s*#ffffff;/);
  assert.match(widgetCssSource, /\.tariff-calc-toggles-bar\s*\{/);
  assert.match(widgetCssSource, /\.tariff-calc-launcher-btn\s*\{[\s\S]*?left:\s*24px;/);
});
