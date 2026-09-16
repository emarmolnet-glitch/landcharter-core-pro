import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('1. index.html contains latent navigation button #tab-btn-auditor with hidden class and style display: none', () => {
    assert.match(indexHtml, /<button[^>]*id="tab-btn-auditor"[^>]*class="[^"]*hidden[^"]*"[^>]*style="[^"]*display:\s*none;?[^"]*"/, 'tab-btn-auditor must have class hidden and style display: none in HTML');
    assert.match(indexHtml, /data-module-id="auditor"/, 'tab-btn-auditor must retain data-module-id');
});

test('2. CSS rules hide auditor tab and view container with display: none !important', () => {
    assert.match(indexHtml, /#tab-btn-auditor[\s\S]*?#view-auditor\s*\{\s*display:\s*none\s*!important;?\s*\}/, 'CSS must enforce display: none !important for auditor tabs and view');
});

test('3. index.html defines main container #view-auditor with class hidden and style display: none', () => {
    assert.match(indexHtml, /<div[^>]*id="view-auditor"[^>]*class="[^"]*hidden[^"]*"[^>]*style="[^"]*display:\s*none;?[^"]*"/, '#view-auditor must have class hidden and style display: none');
});

test('4. createModuleButton hides auditor tab dynamically without removing it', () => {
    const fnStart = indexHtml.indexOf('function createModuleButton(moduleConfig');
    const fnEnd = indexHtml.indexOf('function getPrimaryNavigationModules()', fnStart);
    const fnSource = indexHtml.slice(fnStart, fnEnd);

    assert.match(fnSource, /if\s*\(moduleConfig\.id\s*===\s*'auditor'\)\s*\{/, 'createModuleButton must check for auditor module');
    assert.match(fnSource, /button\.classList\.add\('hidden'\)/, 'createModuleButton must add hidden class for auditor');
    assert.match(fnSource, /button\.style\.display\s*=\s*'none'/, 'createModuleButton must set display none style for auditor');
});

test('5. JavaScript audit functions contain defensive null checks for DOM elements', () => {
    // finishAuditSession defensive check
    const finishStart = indexHtml.indexOf('function finishAuditSession()');
    const finishEnd = indexHtml.indexOf('function escapeHtml', finishStart);
    const finishSource = indexHtml.slice(finishStart, finishEnd);
    assert.match(finishSource, /const recapInputEl = document\.getElementById\('recapInput'\);\s*if\s*\(recapInputEl\)/, 'finishAuditSession must check recapInput');

    // runCommercialNlpMotor defensive check
    const nlpStart = indexHtml.indexOf('async function runCommercialNlpMotor()');
    const nlpEnd = indexHtml.indexOf('function printCommercialNlpReport()', nlpStart);
    const nlpSource = indexHtml.slice(nlpStart, nlpEnd);
    assert.match(nlpSource, /if\s*\(!recapInputEl\)\s*return;/, 'runCommercialNlpMotor must defend against null recapInput');

    // analyzeDocument defensive check
    const analyzeStart = indexHtml.indexOf('async function analyzeDocument()');
    const analyzeEnd = indexHtml.indexOf('function descargarExcelLaytime()', analyzeStart);
    const analyzeSource = indexHtml.slice(analyzeStart, analyzeEnd);
    assert.match(analyzeSource, /if\s*\(!recapInputEl\)\s*return;/, 'analyzeDocument must defend against null recapInput');

    // copyEmail defensive check
    const copyStart = indexHtml.indexOf('function copyEmail()');
    const copyEnd = indexHtml.indexOf('// --- REAL-TIME AIS MARKET INTELLIGENCE LAYER ---', copyStart);
    const copySource = indexHtml.slice(copyStart, copyEnd);
    assert.match(copySource, /if\s*\(!resEmail\)\s*return;/, 'copyEmail must defend against null resEmail');
});
