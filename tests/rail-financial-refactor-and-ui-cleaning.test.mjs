import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const rootDir = resolve(process.cwd());
const indexHtmlPath = resolve(rootDir, 'index.html');
const voyageCostEnginePath = resolve(rootDir, 'voyage-cost-engine.js');

const require = createRequire(import.meta.url);
const voyageCostEngine = require(voyageCostEnginePath);

test('1. Sincronización Financiera RAIL (Venta y Margen Lump Sum en index.html)', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Comprueba que clientSaleUnit en RAIL se calcula con Margen de Agencia sobre la compra cerrada
  assert.match(
    indexSource,
    /const\s+clientSaleUnit\s*=\s*\(isGlobalRailMode\s*\|\|\s*isRail\)\s*\?\s*\(carrierPurchaseUnit\s*\*\s*agencyMarkupMultiplier\)/,
    'clientSaleUnit debe calcularse como carrierPurchaseUnit * agencyMarkupMultiplier en modo RAIL'
  );

  // Beneficio/Spread DEBE ser Precio de Venta Total - Tarifa Cerrada de Compra
  assert.match(
    indexSource,
    /const\s+agencyNetProfit\s*=\s*\(isGlobalRailMode\s*\|\|\s*isRail\)\s*\?\s*\(clientSaleUnit\s*-\s*carrierPurchaseUnit\)/,
    'agencyNetProfit debe ser exactamente clientSaleUnit - carrierPurchaseUnit en modo RAIL'
  );

  // finalGrossRevCharterer, finalGrossRevOwner y finalNetProfitCharterer en RAIL
  assert.match(
    indexSource,
    /const\s+finalGrossRevCharterer\s*=\s*\(isGlobalRailMode\s*\|\|\s*isRail\)\s*\?\s*clientSaleUnit/,
    'finalGrossRevCharterer debe ser directamente clientSaleUnit en modo RAIL'
  );
  assert.match(
    indexSource,
    /const\s+finalGrossRevOwner\s*=\s*\(isGlobalRailMode\s*\|\|\s*isRail\)\s*\?\s*carrierPurchaseUnit/,
    'finalGrossRevOwner debe ser directamente carrierPurchaseUnit en modo RAIL'
  );
  assert.match(
    indexSource,
    /const\s+finalNetProfitCharterer\s*=\s*\(isGlobalRailMode\s*\|\|\s*isRail\)\s*\?\s*\(clientSaleUnit\s*-\s*carrierPurchaseUnit\)/,
    'finalNetProfitCharterer debe ser clientSaleUnit - carrierPurchaseUnit en modo RAIL erradicando márgenes negativos'
  );
});

test('2. Sincronización Financiera RAIL en voyage-cost-engine.js (Lump Sum y sin $/km para el total)', () => {
  const fakeElements = new Map();
  const createFakeEl = () => ({
    textContent: '',
    innerText: '',
    value: '',
    className: '',
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    closest() { return null; }
  });
  const getOrCreate = (id) => {
    if (!fakeElements.has(id)) fakeElements.set(id, createFakeEl());
    return fakeElements.get(id);
  };
  const fakeDoc = {
    getElementById: (id) => getOrCreate(id),
    querySelector: () => null,
    querySelectorAll: () => []
  };

  const compraCerrada = 12000;
  const margenAgencia = 15; // 15%
  const ventaEsperada = Math.round(compraCerrada * (1 + (margenAgencia / 100))); // 13.800 €
  const beneficioEsperado = Math.round(ventaEsperada - compraCerrada); // 1.800 €

  voyageCostEngine.updateExecutiveDashboard({
    isRail: true,
    globalTransportMode: 'RAIL',
    vehicleType: 'Tren Tolva',
    pol: 'Zaragoza',
    pod: 'Barcelona',
    cargoQty: 1000,
    totalKm: 500,
    buyFreightTotal: compraCerrada,
    agencyMargin: margenAgencia
  }, {}, fakeDoc);

  const buyTotalText = fakeElements.get('exec-buy-freight-total')?.textContent || '';
  const sellTotalText = fakeElements.get('exec-sell-freight-total')?.textContent || '';
  const profitText = fakeElements.get('exec-charterer-profit')?.textContent || '';

  // Quitar símbolos de moneda y espacios
  const cleanNum = (str) => parseFloat(str.replace(/[^0-9,-]/g, '').replace(',', '.'));

  assert.equal(cleanNum(buyTotalText), compraCerrada, 'Tarifa Cerrada de Compra debe ser 12.000 €');
  assert.equal(cleanNum(sellTotalText), ventaEsperada, 'Precio de Venta Total debe ser 13.800 €');
  assert.equal(cleanNum(profitText), beneficioEsperado, 'Beneficio/Spread Agencia debe ser 1.800 €');
});

test('3. Erradicación de Terminología de Carretera en UI (Tacógrafo 561/2006, Insight Comercial, Ritmo de Carga, Diésel)', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Tiempos de tránsito: tacografo-normativa-warning oculto en modo RAIL
  assert.match(
    indexSource,
    /id="tacografo-normativa-warning"/,
    'El contenedor de la advertencia normativa debe tener id tacografo-normativa-warning'
  );
  assert.match(
    indexSource,
    /tacoWarn\.style\.display\s*=\s*isRail\s*\?\s*['"]none['"]\s*:\s*['"]['"]/,
    'La advertencia del Reglamento CE 561/2006 debe ocultarse en modo RAIL'
  );

  // Insight Comercial: texto exacto para modo RAIL
  const expectedInsight = 'Operación Ferroviaria Block Train. Tiempos de tránsito continuos sin restricciones de tacógrafo vial.';
  assert.ok(
    indexSource.includes(expectedInsight),
    'index.html debe contener el texto de insight comercial ferroviario exacto'
  );

  // voyage-cost-engine evaluateRoadOperationalRisks insight
  const roadRisksRail = voyageCostEngine.evaluateRoadOperationalRisks({
    isRail: true,
    globalTransportMode: 'RAIL',
    drivingHours: 20,
    totalKm: 1500
  });
  assert.equal(roadRisksRail.hasTachographRisk, false, 'hasTachographRisk debe ser false en modo RAIL');
  assert.ok(
    roadRisksRail.insights.includes(expectedInsight),
    'evaluateRoadOperationalRisks debe emitir el insight comercial ferroviario'
  );

  // Ritmo de Carga: etiqueta cambia a "t/h (Granel Continuo)" en modo RAIL
  assert.match(
    indexSource,
    /loadingRateUnitEl\.textContent\s*=\s*isRail\s*\?\s*['"]t\/h \(Granel Continuo\)['"]\s*:\s*['"]pallets\/h o t\/h['"]/,
    'loadingRateUnitEl debe alternar a "t/h (Granel Continuo)" en modo RAIL'
  );

  // Costes Operativos: renombrar Consumo Diésel a "Consumo Locomotora (Galones)"
  assert.match(
    indexSource,
    /labelConsSea\.textContent\s*=\s*isRail\s*\?\s*['"]Consumo Locomotora \(Galones\)['"]\s*:\s*['"]Consumo Diésel \(L\/100km\)['"]/,
    'labelConsSea debe renombrarse a "Consumo Locomotora (Galones)" en modo RAIL'
  );
});

test('4. Simulador de Negociación ("Bottom Line") en bloque Lump Sum sin márgenes negativos', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Verificar que updateChartererNegotiationSimulator maneja isRail con lógica Lump Sum
  assert.match(
    indexSource,
    /const\s+railBuyTotal\s*=\s*isRail\s*\?\s*Math\.max\(0,\s*Number\(State\.carrierPurchaseUnit/,
    'Simulador debe tomar carrierPurchaseUnit como tarifa cerrada de compra'
  );
  assert.match(
    indexSource,
    /const\s+railSellTotal\s*=\s*isRail\s*\?\s*\(railBuyTotal\s*\*\s*\(1\s*\+\s*\(railMarginPct\s*\/\s*100\)\)\)/,
    'Simulador debe calcular precio de venta como compra * (1 + margen/100)'
  );
  assert.match(
    indexSource,
    /const\s+spreadPerMt\s*=\s*isRail\s*\?\s*\(chartererTarget\s*-\s*ownerOffer\)\s*:\s*\(ownerOffer\s*-\s*chartererTarget\)/,
    'Spread en RAIL debe ser target - offer (Venta - Compra) erradicando márgenes negativos'
  );
});
