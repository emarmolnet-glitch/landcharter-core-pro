import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const indexHtmlPath = resolve('index.html');

test('1. Cabecera, Iconografía y Unidades: Título ferroviario e iconos fa-train / fa-truck condicionales', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Verifica que existe la lógica condicional para el título del reporte ferroviario
  assert.match(
    indexSource,
    /REPORTE EJECUTIVO DE TRANSPORTE FERROVIARIO/,
    'Debe definir el título REPORTE EJECUTIVO DE TRANSPORTE FERROVIARIO para modo tren'
  );

  // Verifica reemplazo de iconos fa-truck por fa-train cuando isRail es true
  assert.match(
    indexSource,
    /isRail[\s\S]*?fa-solid fa-train[\s\S]*?fa-solid fa-truck-moving/,
    'Debe alternar entre fa-train y fa-truck-moving en la cabecera'
  );
  assert.match(
    indexSource,
    /isRail[\s\S]*?fa-solid fa-train[\s\S]*?fa-solid fa-truck/,
    'Debe alternar entre fa-train y fa-truck en Especificaciones de Carga y Flota'
  );
});

test('2. Distancia Imperial: Respeta unidad del sistema en mi sin forzar conversión a km', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Verifica lógica de detección imperial y formateo en mi
  assert.match(
    indexSource,
    /const\s+distUnit\s*=\s*isImperial\s*\?\s*['"]mi['"]\s*:\s*['"]km['"]/,
    'Debe establecer la unidad dinámica distUnit como mi en modo imperial'
  );
  assert.match(
    indexSource,
    /effectiveDistance[\s\S]*?1\.60934/,
    'Debe calcular la distancia precisa en millas en modo imperial'
  );
  assert.match(
    indexSource,
    /isImperial[\s\S]*?mi[\s\S]*?km/,
    'Debe imprimir la distancia con mi en modo imperial sin forzar km'
  );
});

test('3. Especificaciones de Flota y Costes: Vagones vs Camiones y ocultación de consumo homologado', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Verifica término vagones condicional
  assert.match(
    indexSource,
    /isRail\s*\?\s*['"]Vagones Necesarios:['"]\s*:\s*['"]Camiones Necesarios:['"]/,
    'Debe alternar entre Vagones Necesarios y Camiones Necesarios'
  );
  assert.match(
    indexSource,
    /isRail\s*\?\s*\(unitsNeeded === 1 \? 'vagón' : 'vagones'\)/,
    'Debe usar vagón/vagones para trenes'
  );

  // Verifica ocultación de Consumo Homologado en RAIL
  assert.match(
    indexSource,
    /\$\{isRail\s*\?\s*''\s*:\s*`[\s\S]*?Consumo Homologado:/,
    'Debe ocultar Consumo Homologado en modo RAIL'
  );

  // Verifica ocultación de peajes, dietas y coste fijo de chófer en Estructura de Costes (RAIL)
  assert.match(
    indexSource,
    /\$\{isRail\s*\?\s*`[\s\S]*?Tracción Ferroviaria[\s\S]*?`\s*:\s*`[\s\S]*?Peajes de autopista:[\s\S]*?Dietas conductor[\s\S]*?Coste fijo diario \/ chófer/,
    'Debe ocultar Peajes de autopista, Dietas y Coste fijo de chófer en Estructura de Costes de RAIL'
  );

  // Verifica label "Coste Total Tracción (Convoy)"
  assert.match(
    indexSource,
    /isRail\s*\?\s*['"]Coste Total Tracción \(Convoy\):['"]\s*:\s*`Coste Total Transportista/,
    'Debe etiquetar el total como Coste Total Tracción (Convoy)'
  );
});

test('4. Panel de Riesgos Inteligente: Riesgo Tacógrafo sin CE 561/2006 en modo RAIL', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Extrae función renderExecutiveRiskSections
  const fnStart = indexSource.indexOf('function renderExecutiveRiskSections(');
  assert.ok(fnStart !== -1, 'renderExecutiveRiskSections debe existir');
  const fnEnd = indexSource.indexOf('function printExecutiveScreenReport', fnStart);
  const fnBody = indexSource.slice(fnStart, fnEnd);

  // Verifica texto exacto para tacógrafo en RAIL
  assert.match(
    fnBody,
    /Operación de convoy continuo por relevos\.\s*Sin restricciones de tacógrafo vial\./,
    'Debe indicar "Operación de convoy continuo por relevos. Sin restricciones de tacógrafo vial."'
  );
  assert.match(
    fnBody,
    /RELEVOS CONTINUOS/,
    'Debe mostrar badge RELEVOS CONTINUOS en RAIL'
  );
});

test('5. Panel de Riesgos Inteligente: Riesgo Fronterizo Dinámico (Norteamérica vs Europa)', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  const fnStart = indexSource.indexOf('function renderExecutiveRiskSections(');
  const fnEnd = indexSource.indexOf('function printExecutiveScreenReport', fnStart);
  const fnBody = indexSource.slice(fnStart, fnEnd);

  // Detección geográfica Norteamérica (US / USA / Estados Unidos)
  assert.match(
    fnBody,
    /\(United States\|USA\|Estados Unidos\)/i,
    'Debe analizar presencia de United States, USA o Estados Unidos'
  );

  // Texto para RAIL y geografía Norteamérica
  assert.match(
    fnBody,
    /Corredor Ferroviario US \(Doméstico\):\s*<\/strong>\s*Tránsito interestatal libre de aduanas\./,
    'Debe indicar "Corredor Ferroviario US (Doméstico): Tránsito interestatal libre de aduanas."'
  );

  // Texto para RAIL y geografía Europea/Otra
  assert.match(
    fnBody,
    /Corredor Ferroviario EU\/Internacional:\s*<\/strong>\s*Sujeto a normativas de interoperabilidad \(ancho de vía, señalización ERTMS\) y controles aduaneros según pasos fronterizos\./,
    'Debe indicar la normativa de interoperabilidad y ERTMS para Europa'
  );
});

test('6. Ejecución funcional de renderExecutiveRiskSections en entorno simulado', async () => {
  const indexSource = await readFile(indexHtmlPath, 'utf8');

  // Extrae e inyecta la función getLatestExecutiveRiskReportData y renderExecutiveRiskSections
  const riskFnStart = indexSource.indexOf('function getLatestExecutiveRiskReportData()');
  const riskFnEnd = indexSource.indexOf('function printExecutiveScreenReport');
  const riskCode = indexSource.slice(riskFnStart, riskFnEnd);

  const sandboxContext = {
    State: {
      pol: 'Chicago, USA',
      pod: 'Houston, USA',
      totalKilometers: 1400,
      cargoType: 'Carga General',
      globalTransportMode: 'RAIL',
      isRail: true
    },
    document: {
      getElementById: (id) => null
    },
    window: {
      globalTransportMode: 'RAIL'
    },
    evaluateRoadOperationalRisks: () => ({
      hasBorderRisk: false,
      hasTachographRisk: false,
      hasAdrRisk: false,
      riskLevel: 'BAJO',
      tachographDays: 1
    })
  };

  const runner = new Function(
    'State',
    'document',
    'window',
    'evaluateRoadOperationalRisks',
    `
      ${riskCode}
      return renderExecutiveRiskSections;
    `
  );

  const testRender = runner(
    sandboxContext.State,
    sandboxContext.document,
    sandboxContext.window,
    sandboxContext.evaluateRoadOperationalRisks
  );

  // Caso A: RAIL en USA
  const htmlUSRail = testRender({ isRail: true, isUSGeography: true });
  assert.ok(htmlUSRail.includes('Corredor Ferroviario US (Doméstico):'), 'Debe incluir Corredor Ferroviario US');
  assert.ok(htmlUSRail.includes('Tránsito interestatal libre de aduanas.'), 'Debe incluir libre de aduanas');
  assert.ok(htmlUSRail.includes('Operación de convoy continuo por relevos. Sin restricciones de tacógrafo vial.'), 'Debe incluir relevos continuos');
  assert.ok(!htmlUSRail.includes('CE 561/2006'), 'No debe incluir mención a CE 561/2006 en RAIL');

  // Caso B: RAIL en Europa (Madrid -> Berlín)
  const htmlEURail = testRender({ isRail: true, isUSGeography: false, origin: 'Madrid, España', destination: 'Berlín, Alemania' });
  assert.ok(htmlEURail.includes('Corredor Ferroviario EU/Internacional:'), 'Debe incluir Corredor Ferroviario EU/Internacional');
  assert.ok(htmlEURail.includes('normativas de interoperabilidad'), 'Debe incluir normativas de interoperabilidad');
  assert.ok(htmlEURail.includes('señalización ERTMS'), 'Debe incluir ERTMS');
  assert.ok(htmlEURail.includes('Operación de convoy continuo por relevos. Sin restricciones de tacógrafo vial.'), 'Debe incluir relevos continuos');
  assert.ok(!htmlEURail.includes('CE 561/2006'), 'No debe incluir mención a CE 561/2006 en RAIL');

  // Caso C: ROAD (Carretera) estándar
  const htmlRoad = testRender({ isRail: false, isUSGeography: false, origin: 'Madrid', destination: 'París' });
  assert.ok(htmlRoad.includes('Riesgo Fronterizo'), 'Debe contener Riesgo Fronterizo');
  assert.ok(htmlRoad.includes('Riesgo Tacógrafo'), 'Debe contener Riesgo Tacógrafo');
  assert.ok(htmlRoad.includes('Reglamento CE 561/2006') || htmlRoad.includes('Dentro de límites legales'), 'Debe usar lógica estándar de carretera');
});
