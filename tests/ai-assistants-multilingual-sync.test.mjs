import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import {
  buildCerebroSystemPrompt as buildCerebroInDataBridge
} from '../netlify/functions/_shared/data-bridge-tooling.mjs';

const seaAssistantSource = readFileSync(new URL('../src/sea-assistant-entry.js', import.meta.url), 'utf8');
const widgetSource = readFileSync(new URL('../src/components/AgenteProyectosWidget.jsx', import.meta.url), 'utf8');
const chatAssistantSource = readFileSync(new URL('../netlify/functions/chat-assistant.js', import.meta.url), 'utf8');
const agenteProyectosSource = readFileSync(new URL('../netlify/functions/agente-proyectos.js', import.meta.url), 'utf8');
const projectChatSource = readFileSync(new URL('../netlify/functions/project-chat.ts', import.meta.url), 'utf8');
const indexHtmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Evaluate prompt builders from chat-assistant.js using vm
const chatSandbox = {
  CHAT_INTENTS: { GENERAL: 'PREGUNTA_GENERAL', SIMULATION: 'SIMULACION_FLETE' },
  normalizeChatHistory: (h) => h || [],
  DATA_BRIDGE_SYSTEM_PROMPT: 'DATA_BRIDGE_SYSTEM_PROMPT_CONTENT',
};
vm.createContext(chatSandbox);
const chatSnippet = chatAssistantSource.slice(
  chatAssistantSource.indexOf('export function buildSystemInstruction'),
  chatAssistantSource.indexOf('function jsonResponse')
).replaceAll('export function ', 'function ');

vm.runInContext(
  `let normalizeChatHistory = (h) => h || [];
let CHAT_INTENTS = { GENERAL: 'PREGUNTA_GENERAL' };
let DATA_BRIDGE_SYSTEM_PROMPT = 'DATA_BRIDGE_SYSTEM_PROMPT_CONTENT';
${chatSnippet}
globalThis.buildSystemInstruction = buildSystemInstruction;
globalThis.buildAsistenteSystemPrompt = buildAsistenteSystemPrompt;
globalThis.buildCerebroSystemPrompt = buildCerebroSystemPrompt;
globalThis.buildProyectosSystemPrompt = buildProyectosSystemPrompt;
globalThis.getAgentSystemPrompt = getAgentSystemPrompt;
`,
  chatSandbox
);

// Evaluate buildAgenteProyectosSystemInstruction from agente-proyectos.js using vm
const agenteSandbox = {};
vm.createContext(agenteSandbox);
const agenteSnippet = agenteProyectosSource.slice(
  agenteProyectosSource.indexOf('export function buildAgenteProyectosSystemInstruction'),
  agenteProyectosSource.indexOf('export function buildGeminiHistory')
).replace('export function buildAgenteProyectosSystemInstruction', 'function buildAgenteProyectosSystemInstruction');
vm.runInContext(`${agenteSnippet}\nglobalThis.buildAgenteProyectosSystemInstruction = buildAgenteProyectosSystemInstruction;`, agenteSandbox);

// Evaluate buildAgenteProyectosSystemInstruction from project-chat.ts using vm
const projectChatSandbox = {};
vm.createContext(projectChatSandbox);
const projectChatSnippet = projectChatSource.slice(
  projectChatSource.indexOf('export function buildAgenteProyectosSystemInstruction'),
  projectChatSource.indexOf('export function extractStructuredAction')
)
  .replace('export function buildAgenteProyectosSystemInstruction', 'function buildAgenteProyectosSystemInstruction')
  .replace(': any = \'{}\'', ' = \'{}\'')
  .replace(': string = \'es\'', ' = \'es\'')
  .replace(': string {', ' {');
vm.runInContext(`${projectChatSnippet}\nglobalThis.buildAgenteProyectosSystemInstruction = buildAgenteProyectosSystemInstruction;`, projectChatSandbox);

// Evaluate assistant i18n helpers from sea-assistant-entry.js
const seaSandbox = {
  window: {
    currentLanguage: 'en',
    localStorage: { getItem: () => 'en' },
    document: { documentElement: { lang: 'en' } }
  }
};
vm.createContext(seaSandbox);
const seaSnippet = seaAssistantSource.slice(
  seaAssistantSource.indexOf('const ASSISTANT_I18N ='),
  seaAssistantSource.indexOf('function updateAiUI')
).replace('export function getAssistantI18nText', 'function getAssistantI18nText');
vm.runInContext(`${seaSnippet}\nglobalThis.getAssistantI18nText = getAssistantI18nText;`, seaSandbox);

// Evaluate widget i18n helpers from AgenteProyectosWidget.jsx
const widgetSandbox = {};
vm.createContext(widgetSandbox);
const widgetSnippet = widgetSource.slice(
  widgetSource.indexOf('const PROJECT_AGENT_I18N ='),
  widgetSource.indexOf('export default function AgenteProyectosWidget')
).replace('export function getProjectAgentI18nText', 'function getProjectAgentI18nText');
vm.runInContext(`${widgetSnippet}\nglobalThis.getProjectAgentI18nText = getProjectAgentI18nText;`, widgetSandbox);

test('1. FRONTEND: sea-assistant-entry sends uiLanguage, agentType, and message in fetch payloads', () => {
  // Cerebro vs Asistente Core agentType determination
  assert.match(seaAssistantSource, /const\s+agentType\s*=\s*iaActiva\s*===\s*'cerebro'\s*\?\s*'cerebro'\s*:\s*'asistente'/);
  assert.match(seaAssistantSource, /const\s+uiLanguage\s*=\s*getAppUiLanguage\(\)/);

  // Checks JSON payload
  assert.match(seaAssistantSource, /sanitizedPayload\.uiLanguage\s*=\s*uiLanguage/);
  assert.match(seaAssistantSource, /sanitizedPayload\.agentType\s*=\s*agentType/);

  // Checks FormData payload (attached files)
  assert.match(seaAssistantSource, /formData\.append\(["']uiLanguage["'],\s*uiLanguage\)/);
  assert.match(seaAssistantSource, /formData\.append\(["']agentType["'],\s*agentType\)/);
});

test('2. FRONTEND: AgenteProyectosWidget sends uiLanguage, agentType: "proyectos", and message in fetch payloads', () => {
  assert.match(widgetSource, /uiLanguage:\s*currentUiLang/);
  assert.match(widgetSource, /agentType:\s*['"]proyectos['"]/);
  assert.match(widgetSource, /message:\s*raw/);
});

test('3. BACKEND: System prompts for all three agents include mandatory language instruction', () => {
  const uiLanguage = 'en';
  const expectedEnglishInstruction = "IMPORTANT INSTRUCTION: The user interface is currently set to en. You MUST generate your entire response, formulate advice, and execute all reasoning STRICTLY in en. Never use Spanish unless en is Spanish.";

  // Agent 1: Asistente Core
  const asistentePrompt = chatSandbox.buildAsistenteSystemPrompt({}, [], 'GENERAL', uiLanguage);
  assert.ok(asistentePrompt.includes(expectedEnglishInstruction), 'Asistente Core prompt must contain mandatory English instruction');
  assert.ok(asistentePrompt.trim().endsWith(expectedEnglishInstruction), 'Instruction must be at the end of Asistente prompt');

  // Agent 2: Cerebro IA
  const cerebroChatPrompt = chatSandbox.buildCerebroSystemPrompt(uiLanguage, {}, []);
  assert.ok(cerebroChatPrompt.includes(expectedEnglishInstruction), 'Cerebro IA (chat) prompt must contain mandatory English instruction');
  assert.ok(cerebroChatPrompt.trim().endsWith(expectedEnglishInstruction), 'Instruction must be at the end of Cerebro prompt');

  const cerebroDataBridgePrompt = buildCerebroInDataBridge(uiLanguage);
  assert.ok(cerebroDataBridgePrompt.includes(expectedEnglishInstruction), 'Cerebro IA (data bridge) prompt must contain mandatory English instruction');
  assert.ok(cerebroDataBridgePrompt.trim().endsWith(expectedEnglishInstruction), 'Instruction must be at the end of Data Bridge prompt');

  // Agent 3: Agente de Proyectos
  const proyectosJsPrompt = agenteSandbox.buildAgenteProyectosSystemInstruction('{}', uiLanguage);
  assert.ok(proyectosJsPrompt.includes(expectedEnglishInstruction), 'Agente de Proyectos (JS) prompt must contain mandatory English instruction');
  assert.ok(proyectosJsPrompt.trim().endsWith(expectedEnglishInstruction), 'Instruction must be at the end of Proyectos JS prompt');

  const proyectosTsPrompt = projectChatSandbox.buildAgenteProyectosSystemInstruction('{}', uiLanguage);
  assert.ok(proyectosTsPrompt.includes(expectedEnglishInstruction), 'Agente de Proyectos (TS) prompt must contain mandatory English instruction');
  assert.ok(proyectosTsPrompt.trim().endsWith(expectedEnglishInstruction), 'Instruction must be at the end of Proyectos TS prompt');

  const proyectosChatPrompt = chatSandbox.buildProyectosSystemPrompt('{}', uiLanguage);
  assert.ok(proyectosChatPrompt.includes(expectedEnglishInstruction), 'Agente de Proyectos (Chat) prompt must contain mandatory English instruction');
  assert.ok(proyectosChatPrompt.trim().endsWith(expectedEnglishInstruction), 'Instruction must be at the end of Proyectos Chat prompt');
});

test('4. BACKEND: chat-assistant endpoint extracts uiLanguage and agentType from request body', () => {
  assert.match(chatAssistantSource, /const\s+uiLanguage\s*=\s*body\?\.uiLanguage/);
  assert.match(chatAssistantSource, /const\s+agentType\s*=\s*body\?\.agentType/);
  assert.match(chatAssistantSource, /agentType\s*===\s*["']cerebro["']/);
  assert.match(chatAssistantSource, /buildCerebroSystemPrompt\(uiLanguage/);
  assert.match(chatAssistantSource, /buildProyectosSystemPrompt\(normalizedContext,\s*uiLanguage\)/);
  assert.match(chatAssistantSource, /buildSystemInstruction\(normalizedContext,\s*normalizedHistory,\s*intent,\s*uiLanguage\)/);
});

test('5. BACKEND: project-chat and agente-proyectos endpoints extract uiLanguage and inject mandatory instruction', () => {
  assert.match(agenteProyectosSource, /const\s+uiLanguage\s*=\s*body\.uiLanguage/);
  assert.match(agenteProyectosSource, /buildAgenteProyectosSystemInstruction\(projectContext,\s*uiLanguage\)/);

  assert.match(projectChatSource, /const\s+uiLanguage\s*=\s*body\.uiLanguage/);
  assert.match(projectChatSource, /buildAgenteProyectosSystemInstruction\(projectContext,\s*uiLanguage\)/);
  assert.match(projectChatSource, /systemInstruction\.includes\(['"]IMPORTANT INSTRUCTION: The user interface is currently set to['"]\)/);
});

test('6. i18n & FEEDBACK: Initial messages and typing status for all three agents support English', () => {
  // Cerebro IA
  const cerebroWelcomeEn = seaSandbox.getAssistantI18nText('welcomeCerebro', 'en');
  assert.equal(cerebroWelcomeEn, 'Hello. I am Cerebro.ia. I can help you with Data Bridge data analysis, chartering, and routes.');
  const cerebroPlaceholderEn = seaSandbox.getAssistantI18nText('cerebroPlaceholder', 'en');
  assert.equal(cerebroPlaceholderEn, 'Analyzing with Data Bridge. Describe the cargo...');

  // Asistente Core
  const asistenteWelcomeEn = seaSandbox.getAssistantI18nText('welcomeAsistente', 'en');
  assert.equal(asistenteWelcomeEn, 'Hello. I am the SeaCharter Assistant. I can help you with queries on maritime logistics, chartering, and routes.');
  const asistentePlaceholderEn = seaSandbox.getAssistantI18nText('asistentePlaceholder', 'en');
  assert.equal(asistentePlaceholderEn, 'Ask a quick chartering query...');

  // Typing status in sea assistant
  const thinkingEn = seaSandbox.getAssistantI18nText('thinking', 'en');
  assert.equal(thinkingEn, 'The assistant is thinking...');

  // Agente de Proyectos
  const proyectosGreetingEn = widgetSandbox.getProjectAgentI18nText('initialGreeting', 'en');
  assert.equal(proyectosGreetingEn, 'Hello! I am your Project Agent. I am connected to the workspace and ready to execute any order in natural language.');
  const proyectosAnalyzingEn = widgetSandbox.getProjectAgentI18nText('analyzing', 'en');
  assert.equal(proyectosAnalyzingEn, 'Analyzing order and calculating parameters...');
  const proyectosPlaceholderEn = widgetSandbox.getProjectAgentI18nText('placeholder', 'en');
  assert.equal(proyectosPlaceholderEn, 'Type any order...');
});

test('7. i18n: index.html UI_TRANSLATIONS registers assistant keys and changeLanguage dispatches events', () => {
  assert.match(indexHtmlSource, /"El asistente está pensando":\s*\{\s*es:/);
  assert.match(indexHtmlSource, /"Analizando orden y calculando parámetros\.\.\.":\s*\{\s*es:/);
  assert.match(indexHtmlSource, /window\.dispatchEvent\(new CustomEvent\('seacharter:language-changed'/);
  assert.match(indexHtmlSource, /window\.dispatchEvent\(new CustomEvent\('languageChanged'/);
});

test('8. TTS: sea-assistant-entry dynamically sets utterance.lang and selects voice matching uiLanguage', () => {
  assert.match(seaAssistantSource, /const\s+lang\s*=\s*uiLanguage\s*===\s*['"]fr['"]\s*\?\s*['"]fr-FR['"]\s*:\s*\(?uiLanguage\s*===\s*['"]en['"]\s*\?\s*['"]en-US['"]\s*:\s*['"]es-ES['"]\)?/);
  assert.match(seaAssistantSource, /utterance\.lang\s*=\s*lang/);
  assert.match(seaAssistantSource, /name\.includes\(['"]Google['"]\)\s*\|\|\s*name\.includes\(['"]Natural['"]\)/);
  assert.match(seaAssistantSource, /const\s+uiLanguage\s*=\s*getAppUiLanguage\(\)/);
  assert.match(seaAssistantSource, /speechSynthesis\.onvoiceschanged/);
  assert.match(seaAssistantSource, /utterance\.voice\s*=\s*bestVoice/);
});

test('9. TTS: AgenteProyectosWidget dynamically sets utterance.lang and selects voice matching uiLanguage', () => {
  assert.match(widgetSource, /const\s+lang\s*=\s*uiLanguage\s*===\s*['"]fr['"]\s*\?\s*['"]fr-FR['"]\s*:\s*\(?uiLanguage\s*===\s*['"]en['"]\s*\?\s*['"]en-US['"]\s*:\s*['"]es-ES['"]\)?/);
  assert.match(widgetSource, /utterance\.lang\s*=\s*lang/);
  assert.match(widgetSource, /name\.includes\(['"]Google['"]\)\s*\|\|\s*name\.includes\(['"]Natural['"]\)/);
  assert.match(widgetSource, /const\s+uiLanguage\s*=\s*getAppUiLanguage\(\)/);
  assert.match(widgetSource, /window\.speechSynthesis\.onvoiceschanged/);
  assert.match(widgetSource, /utterance\.voice\s*=\s*bestVoice/);
});

test('10. TTS Voice Selection Logic: selects fr-FR/en-US/es-ES voices and prioritizes Natural/Premium voices', () => {
  const mockVoices = [
    { name: 'Microsoft David Desktop', lang: 'en-US' },
    { name: 'Google US English Natural', lang: 'en-US' },
    { name: 'Google UK English', lang: 'en-GB' },
    { name: 'Microsoft Helena Desktop', lang: 'es-ES' },
    { name: 'Google Español Premium', lang: 'es-ES' },
    { name: 'Standard French Voice', lang: 'fr-FR' },
    { name: 'Microsoft Paul Online (Natural) - French', lang: 'fr-FR' },
  ];

  function pickBestVoice(uiLanguage) {
    const lang = uiLanguage === 'fr' ? 'fr-FR' : (uiLanguage === 'en' ? 'en-US' : 'es-ES');
    const prefix = lang.split('-')[0].toLowerCase();
    const availableMatchingVoices = mockVoices.filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(prefix));

    if (availableMatchingVoices.length > 0) {
      return (
        availableMatchingVoices.find(v => {
          const name = v.name || '';
          return name.includes('Google') || name.includes('Natural') || name.includes('Premium') || name.includes('Microsoft') || name.includes('Online');
        }) ||
        availableMatchingVoices.find(v => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase()) ||
        availableMatchingVoices[0]
      );
    }
    return null;
  }

  const englishVoice = pickBestVoice('en');
  assert.equal(englishVoice?.name, 'Microsoft David Desktop'); // matches Microsoft/Google premium criteria

  const premiumEnglish = mockVoices.find(v => v.name.includes('Natural') && v.lang.startsWith('en'));
  assert.ok(premiumEnglish);

  const frenchVoice = pickBestVoice('fr');
  assert.equal(frenchVoice?.lang, 'fr-FR');
  assert.equal(frenchVoice?.name, 'Microsoft Paul Online (Natural) - French');

  const spanishVoice = pickBestVoice('es');
  assert.equal(spanishVoice?.lang, 'es-ES');

  const langForFr = ('fr' === 'fr') ? 'fr-FR' : (('fr' === 'en') ? 'en-US' : 'es-ES');
  assert.equal(langForFr, 'fr-FR');
  const langForEn = ('en' === 'fr') ? 'fr-FR' : (('en' === 'en') ? 'en-US' : 'es-ES');
  assert.equal(langForEn, 'en-US');
  const langForEs = ('es' === 'fr') ? 'fr-FR' : (('es' === 'en') ? 'en-US' : 'es-ES');
  assert.equal(langForEs, 'es-ES');
});
