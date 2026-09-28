import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const distIndexSource = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');

test('index.html and dist/index.html contain language selector with es, en, fr options', () => {
  for (const html of [indexSource, distIndexSource]) {
    assert.match(html, /id="language-selector"/);
    assert.match(html, /value="es"[^>]*>(?:ES\s*-\s*)?Español/);
    assert.match(html, /value="en"[^>]*>(?:EN\s*-\s*)?English/);
    assert.match(html, /value="fr"[^>]*>(?:FR\s*-\s*)?Français/);
  }
});

test('index.html contains all 10 configured languages in selector: auto, es, en, fr, ar, pt, de, it, tr, zh-CN', () => {
  const options = ['auto', 'es', 'en', 'fr', 'ar', 'pt', 'de', 'it', 'tr', 'zh-CN'];
  for (const opt of options) {
    assert.match(indexSource, new RegExp(`value="${opt}"`));
  }
  assert.match(indexSource, />🌐 AUTO</);
  assert.match(indexSource, />ES - Español</);
  assert.match(indexSource, />EN - English</);
  assert.match(indexSource, />FR - Français</);
  assert.match(indexSource, />AR - العربية</);
  assert.match(indexSource, />PT - Português</);
  assert.match(indexSource, />DE - Deutsch</);
  assert.match(indexSource, />IT - Italiano</);
  assert.match(indexSource, />TR - Türkçe</);
  assert.match(indexSource, />ZH - 中文</);
});

test('index.html integrates Google Translate script with pageLanguage es and autoDisplay false', () => {
  assert.match(indexSource, /translate\.google\.com\/translate_a\/element\.js/);
  assert.match(indexSource, /pageLanguage:\s*['"]es['"]/);
  assert.match(indexSource, /autoDisplay:\s*false/);
});

test('index.html hides Google Translate top banner completely via CSS', () => {
  assert.match(indexSource, /\.goog-te-banner-frame,\s*\.skiptranslate iframe\s*\{\s*display:\s*none\s*!important;\s*\}/);
  assert.match(indexSource, /body\s*\{\s*top:\s*0px\s*!important;\s*\}/);
});

test('index.html manages rodahmar_lang, detects browser language and sets googtrans cookie', () => {
  assert.match(indexSource, /localStorage\.getItem\(['"]rodahmar_lang['"]\)/);
  assert.match(indexSource, /localStorage\.setItem\(['"]rodahmar_lang['"],/);
  assert.match(indexSource, /navigator\.language\s*\|\|\s*navigator\.userLanguage\s*\|\|\s*['"]es['"]/);
  assert.match(indexSource, /browserLang\.startsWith\(['"]zh['"]\)\s*\?\s*['"]zh-CN['"]\s*:\s*browserLang\.split\(['"]-['"]\)\[0\]/);
  assert.match(indexSource, /googtrans=/);
  assert.match(indexSource, /\.goog-te-combo/);
});

test('index.html applies notranslate and translate="no" protections to inputs, REF and acronyms', () => {
  assert.match(indexSource, /id="header-voyage-ref-container"[^>]*translate="no"/);
  assert.match(indexSource, /id="header-voyage-ref-container"[^>]*class="[^"]*notranslate/);
  assert.match(indexSource, /id="quick-ref"[^>]*translate="no"/);
  assert.match(indexSource, /id="quick-ref"[^>]*class="[^"]*notranslate/);
  assert.match(indexSource, /function applyNotranslateProtections\(\)/);
  assert.match(indexSource, /['"]POL['"],\s*['"]POD['"],\s*['"]MT['"],\s*['"]NM['"],\s*['"]DWT['"],\s*['"]TCE['"],\s*['"]LDM['"],\s*['"]OWN['"],\s*['"]CHR['"],\s*['"]CRM['"],\s*['"]LOG['"]/);
});

test('UI_TRANSLATIONS dictionary contains accurate maritime technical terminology in ES, EN, and FR', () => {
  for (const html of [indexSource, distIndexSource]) {
    // Spanish keys to EN/FR translations
    assert.match(html, /"Puerto de Carga \(POL\)":\s*\{\s*en:\s*"Port of Loading \(POL\)"/);
    assert.match(html, /"Puerto de Descarga \(POD\)":\s*\{\s*en:\s*"Port of Discharge \(POD\)"/);
    assert.match(html, /"Días de plancha"|Laydays/);
    assert.match(html, /"Demurrage"|Surestaries/);
    assert.match(html, /"Break-Even"|Seuil de Rentabilité/);
    assert.match(html, /"Bulk Carrier"|Navire Vraquier/);

    // French maritime terms
    assert.match(html, /Port de chargement/);
    assert.match(html, /Port de déchargement/);
    assert.match(html, /Jours de planche/);
    assert.match(html, /Taux de Fret/);
    assert.match(html, /Surestaries/);
    assert.match(html, /Seuil de Rentabilité/);
    assert.match(html, /Navire Vraquier/);
  }
});

test('i18n engine manages seacharter_lang in localStorage and updates html lang attribute', () => {
  for (const html of [indexSource, distIndexSource]) {
    assert.match(html, /localStorage\.setItem\('seacharter_lang',\s*lang\)/);
    assert.match(html, /localStorage\.getItem\('seacharter_lang'\)/);
    assert.match(html, /document\.documentElement\.lang\s*=\s*/);
    assert.match(html, /function changeLanguage\(lang\)/);
    assert.match(html, /function translatePage\(lang\)/);
    assert.match(html, /window\.changeLanguage\s*=\s*changeLanguage/);
  }
});

test('FAQ modal openFaqModal triggers translatePage for active language before showing modal', () => {
  for (const html of [indexSource, distIndexSource]) {
    assert.match(html, /function openFaqModal\(\)/);
    assert.match(html, /translatePage\(currentLang\)/);
    assert.match(html, /function exportFaqToPdf\(\)/);
  }
});
