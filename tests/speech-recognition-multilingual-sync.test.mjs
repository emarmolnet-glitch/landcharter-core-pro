import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const seaAssistantSource = readFileSync(new URL('../src/sea-assistant-entry.js', import.meta.url), 'utf8');
const widgetSource = readFileSync(new URL('../src/components/AgenteProyectosWidget.jsx', import.meta.url), 'utf8');

// Evaluate speech language helpers from sea-assistant-entry.js
function createSeaAssistantContext(options = {}) {
  const windowObj = {
    currentLanguage: options.window?.currentLanguage ?? 'es',
    localStorage: options.window?.localStorage ?? { getItem: () => 'es' },
    document: options.window?.document ?? {
      documentElement: { lang: options.window?.currentLanguage ?? 'es' },
      getElementById: () => null,
    },
  };
  const sandbox = {
    window: windowObj,
    document: windowObj.document,
    navigator: options.navigator ?? options.window?.navigator ?? { language: 'es-ES' },
  };
  vm.createContext(sandbox);

  const helpersSnippet = seaAssistantSource.slice(
    seaAssistantSource.indexOf('export const SPEECH_LANG_MAP ='),
    seaAssistantSource.indexOf('const ASSISTANT_I18N =')
  )
    .replaceAll('export const ', 'const ')
    .replaceAll('export function ', 'function ');

  const fullCode = `
    let iaActiva = 'cerebro';
    function getAppUiLanguage() {
      if (typeof window !== 'undefined') {
        if (window.currentLanguage) return window.currentLanguage;
        const stored = window.localStorage?.getItem('seacharter_lang') || window.localStorage?.getItem('rodahmar_lang');
        if (stored && stored !== 'auto') return stored;
        const select = typeof document !== 'undefined' ? document.getElementById('language-selector') : null;
        if (select?.value && select.value !== 'auto') return select.value;
        if (typeof document !== 'undefined' && document.documentElement?.lang) return document.documentElement.lang;
      }
      return 'es';
    }
    ${helpersSnippet}
    globalThis.SPEECH_LANG_MAP = SPEECH_LANG_MAP;
    globalThis.detectBrowserSpeechLanguage = detectBrowserSpeechLanguage;
    globalThis.getSpeechRecognitionLanguage = getSpeechRecognitionLanguage;
  `;

  vm.runInContext(fullCode, sandbox);
  return sandbox;
}

test('1. BCP-47 Mapping: maps all selector languages exactly as required', () => {
  const ctx = createSeaAssistantContext();
  const { getSpeechRecognitionLanguage } = ctx;

  const expectedMappings = {
    es: 'es-ES',
    en: 'en-US',
    fr: 'fr-FR',
    ar: 'ar-SA',
    pt: 'pt-PT',
    de: 'de-DE',
    it: 'it-IT',
    tr: 'tr-TR',
    zh: 'zh-CN',
    'zh-CN': 'zh-CN',
  };

  for (const [shortCode, expectedBcp47] of Object.entries(expectedMappings)) {
    const result = getSpeechRecognitionLanguage(shortCode);
    assert.equal(
      result,
      expectedBcp47,
      `Language "${shortCode}" must map to BCP-47 code "${expectedBcp47}", received "${result}"`
    );
  }
});

test('2. AUTO mode: detects base browser language and applies mapping', () => {
  const browserTests = [
    { navLang: 'fr-FR', expected: 'fr-FR' },
    { navLang: 'fr', expected: 'fr-FR' },
    { navLang: 'en-GB', expected: 'en-US' },
    { navLang: 'en', expected: 'en-US' },
    { navLang: 'es-MX', expected: 'es-ES' },
    { navLang: 'es', expected: 'es-ES' },
    { navLang: 'pt-BR', expected: 'pt-PT' },
    { navLang: 'de-AT', expected: 'de-DE' },
    { navLang: 'it-CH', expected: 'it-IT' },
    { navLang: 'tr-TR', expected: 'tr-TR' },
    { navLang: 'zh-TW', expected: 'zh-CN' },
    { navLang: 'zh-CN', expected: 'zh-CN' },
    { navLang: 'ja-JP', expected: 'en-US' }, // unsupported browser lang falls back to en-US
    { navLang: '', expected: 'en-US' },      // empty falls back to en-US
  ];

  for (const { navLang, expected } of browserTests) {
    const ctx = createSeaAssistantContext({
      navigator: { language: navLang },
    });
    const result = ctx.getSpeechRecognitionLanguage('auto');
    assert.equal(
      result,
      expected,
      `AUTO mode with navigator.language="${navLang}" must resolve to "${expected}", got "${result}"`
    );
  }
});

test('3. UI reactive state: resolves current UI language from DOM / window when called without arguments', () => {
  // Test French from window.currentLanguage
  const ctxFrench = createSeaAssistantContext({
    window: {
      currentLanguage: 'fr',
      document: {
        getElementById: () => ({ value: 'fr' }),
        documentElement: { lang: 'fr' },
      },
    },
  });
  assert.equal(ctxFrench.getSpeechRecognitionLanguage(), 'fr-FR');

  // Test English from select element
  const ctxEnglish = createSeaAssistantContext({
    window: {
      currentLanguage: 'en',
      document: {
        getElementById: () => ({ value: 'en' }),
        documentElement: { lang: 'en' },
      },
    },
  });
  assert.equal(ctxEnglish.getSpeechRecognitionLanguage(), 'en-US');
});

test('4. sea-assistant-entry.js: assigns recognition.lang dynamically before recognition.start() and handles reactivity', () => {
  assert.match(
    seaAssistantSource,
    /export\s+const\s+SPEECH_LANG_MAP\s*=/,
    'sea-assistant-entry must export SPEECH_LANG_MAP'
  );
  assert.match(
    seaAssistantSource,
    /export\s+function\s+getSpeechRecognitionLanguage/,
    'sea-assistant-entry must export getSpeechRecognitionLanguage'
  );
  assert.match(
    seaAssistantSource,
    /recognition\.lang\s*=\s*getSpeechRecognitionLanguage\(\);[\s\S]*?recognition\.start\(\)/,
    'sea-assistant-entry must update recognition.lang dynamically before calling recognition.start()'
  );
  assert.match(
    seaAssistantSource,
    /const\s+onLanguageChange\s*=\s*\(\)\s*=>\s*\{[\s\S]*?recognition\.lang\s*=\s*getSpeechRecognitionLanguage\(\);?[\s\S]*?\}/,
    'sea-assistant-entry must update recognition.lang reactively on language change events'
  );
});

test('5. AgenteProyectosWidget.jsx: assigns recognition.lang dynamically before recognition.start() and handles reactivity', () => {
  assert.match(
    widgetSource,
    /export\s+const\s+SPEECH_LANG_MAP\s*=/,
    'AgenteProyectosWidget must export SPEECH_LANG_MAP'
  );
  assert.match(
    widgetSource,
    /export\s+function\s+getSpeechRecognitionLanguage/,
    'AgenteProyectosWidget must export getSpeechRecognitionLanguage'
  );
  assert.match(
    widgetSource,
    /recognitionRef\.current\.lang\s*=\s*getSpeechRecognitionLanguage\(uiLanguage\);[\s\S]*?recognitionRef\.current\.start\(\)/,
    'AgenteProyectosWidget must update recognitionRef.current.lang dynamically before calling start()'
  );
  assert.match(
    widgetSource,
    /handleLangChange\s*=\s*\(e\)\s*=>\s*\{[\s\S]*?recognitionRef\.current\.lang\s*=\s*getSpeechRecognitionLanguage\(newLang\);?[\s\S]*?\}/,
    'AgenteProyectosWidget must update recognitionRef.current.lang reactively on language change events'
  );
});
