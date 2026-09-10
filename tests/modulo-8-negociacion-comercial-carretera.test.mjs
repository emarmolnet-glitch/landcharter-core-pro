import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

const sectionEightStart = indexSource.indexOf('8. NEGOCIACIÓN COMERCIAL');
const sectionEightEnd = indexSource.indexOf('9. MATRIZ DE RIESGO', sectionEightStart);
const sectionEight = indexSource.slice(sectionEightStart, sectionEightEnd > sectionEightStart ? sectionEightEnd : undefined);

test('Module 8 completely removes AIS and UN Comtrade blocks', () => {
    assert.ok(sectionEightStart > 0, 'Module 8 should exist in index.html');
    assert.doesNotMatch(sectionEight, /id="ais-market-reference-widget"/);
    assert.doesNotMatch(sectionEight, /Referencia de Mercado AIS/);
    assert.doesNotMatch(sectionEight, /id="comtrade-competitiveness-radar"/);
    assert.doesNotMatch(sectionEight, /Radar de Competitividad UN Comtrade/);
});

test('Module 8 purchase conditions purge maritime demurrage and dispatch clause in favor of road standstill rates', () => {
    assert.match(sectionEight, /PARALIZACIONES \(€\/H\)/);
    assert.match(sectionEight, /id="demurrage-rate"/);
    assert.doesNotMatch(sectionEight, /Demurrage \(\$\/d\)/);
    assert.doesNotMatch(sectionEight, /CLÁUSULA DESPACHO/i);
    assert.doesNotMatch(sectionEight, /id="dispatch-clause-active"/);
    assert.doesNotMatch(sectionEight, /id="btn-estimate-demurrage"/);
    assert.doesNotMatch(sectionEight, /asb-delay-hours/);
});

test('Module 8 Bottom Line adapts to road transport agency and carrier terminology in Euros', () => {
    assert.match(sectionEight, /MARGEN NETO TRANSPORTISTA/);
    assert.match(sectionEight, /MARGEN NETO AGENCIA/);
    assert.doesNotMatch(sectionEight, /BENEFICIO ARMADOR/);
    assert.doesNotMatch(sectionEight, /ARBITRAJE COMERCIAL \(FLETADOR\)/);

    // Initial outputs should display Euros (€)
    assert.match(sectionEight, /id="res-net-profit-owner">0 €</);
    assert.match(sectionEight, /id="res-net-profit-charterer">0 €</);
    assert.match(sectionEight, /Margen Neto del Viaje \(€\): 0 €/);
});

test('Module 8 purges maritime Spot, COA and Backhaul market cards and converts units to Euros and €/t', () => {
    assert.doesNotMatch(sectionEight, /Mercado Spot/);
    assert.doesNotMatch(sectionEight, /Mercado COA/);
    assert.doesNotMatch(sectionEight, /Mercado Backhaul/);
    assert.doesNotMatch(sectionEight, /USD \/ MT/);
    assert.doesNotMatch(sectionEight, /\$ \/ MT/);
    assert.match(sectionEight, /€ \/ t/);
});
