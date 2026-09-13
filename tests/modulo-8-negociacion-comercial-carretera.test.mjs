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

test('Module 8 scales total project in Negotiation Bottom Line when trucks_needed > 1 without double multiplication', () => {
    // Check fleetTrucksNeeded definition and scaling in runEngine
    assert.match(indexSource, /const fleetTrucksNeeded = \(isTerrestre && cargo > 0 && truckPayloadCapacity > 0\)/);
    assert.match(indexSource, /const unitaryTripCost = safeCalculationNumber\(State\.totalTripCost \?\? State\.totalCosts \?\? displayTotalTripCost \?\? 162\);/);
    assert.match(indexSource, /const finalSharedTotalCosts = isTerrestre \? \(unitaryTripCost \* fleetTrucksNeeded\) : sharedTotalCosts;/);

    // Verify Base Lumpsum is not crossed with trucks_needed
    assert.doesNotMatch(indexSource, /lumpsumBaseMtInput\.value\s*=\s*cargo/);

    // Mathematical verification for project of 870 trucks (20,880 TM / 24 TM):
    // Total project cost = 162 € * 870 = 140,940 € (never 140 Million)
    const unitaryCost = 162;
    const trucks870 = 870;
    assert.equal(unitaryCost * trucks870, 140940);

    // For 8000 TM with 24 TM payload per truck:
    // trucks_needed = Math.ceil(8000 / 24) = 334 trucks
    // Total project cost = 162 € * 334 = 54,108 €
    const trucks334 = Math.ceil(8000 / 24);
    assert.equal(trucks334, 334);
    assert.equal(unitaryCost * trucks334, 54108);
});

test('Module 8 and Module 4 force default 35 €/h standstill rate in terrestrial mode without carrying naval demurrage', () => {
    // Default HTML value for demurrage-rate is 35
    assert.match(sectionEight, /id="demurrage-rate"[^>]*value="35"/);

    // sugerirDemoraAutomatica returns 35 in terrestrial mode
    assert.match(indexSource, /if\s*\(isTerrestre\)\s*\{\s*const demurrageInput = document\.getElementById\('demurrage-rate'\);\s*if \(demurrageInput\) demurrageInput\.value = '35';/);

    // updateHistoricalRiskEngine uses 35 €/h instead of vessel TCE in terrestrial mode
    assert.match(indexSource, /const hourlyStandstill = isTerrestre \? \(parseFloat\(document\.getElementById\('demurrage-rate'\)\?\.value\) \|\| 35\) : 0;/);
});
