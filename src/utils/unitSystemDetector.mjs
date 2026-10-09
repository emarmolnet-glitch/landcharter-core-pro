/**
 * Land Charter Core PRO - unitSystemDetector.mjs
 * Módulo de Auto-Detección Geográfica del Sistema Imperial vs Métrico.
 * 
 * Capa de presentación visual (UI):
 * - Estados Unidos (país US, estado o ciudad americana) -> IMPERIAL (millas, libras, dólares).
 * - Resto del mundo (Europa, LatAm, África, Asia, etc.) -> METRIC (km, kg/toneladas, euros).
 * 
 * Factor de conversión matemático oficial:
 * km * 0.621371 (exclusivamente para visualización en pantalla en modo imperial).
 * 
 * Preservación estricta de motores Core:
 * OSRM, tacógrafo y directivas DSS operan internamente en unidades normalizadas.
 */

export const KM_TO_MILES = 0.621371;

/**
 * Lista exhaustiva de estados de EE. UU. (nombres completos en minúsculas).
 */
const US_STATES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
  'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
  'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
  'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire',
  'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
  'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia',
  'wisconsin', 'wyoming', 'district of columbia', 'puerto rico'
];

/**
 * Códigos postales de 2 letras de estados de EE. UU.
 */
const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'US', 'USA'
]);

/**
 * Principales ciudades y centros logísticos metropolitanos de Estados Unidos.
 */
const US_CITIES = [
  'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
  'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
  'fort worth', 'columbus', 'charlotte', 'san francisco', 'indianapolis',
  'seattle', 'denver', 'washington dc', 'washington d.c.', 'boston', 'el paso',
  'nashville', 'detroit', 'oklahoma city', 'portland', 'las vegas', 'memphis',
  'louisville', 'baltimore', 'milwaukee', 'albuquerque', 'tucson', 'fresno',
  'sacramento', 'mesa', 'kansas city', 'atlanta', 'omaha', 'colorado springs',
  'raleigh', 'long beach', 'virginia beach', 'miami', 'oakland', 'minneapolis',
  'tulsa', 'bakersfield', 'tampa', 'wichita', 'arlington', 'new orleans',
  'cleveland', 'honolulu', 'anaheim', 'orlando', 'pittsburgh', 'cincinnati',
  'st. louis', 'saint louis', 'newark', 'anchorage', 'corpus christi', 'lexington',
  'laredo', 'savannah', 'norfolk', 'charleston', 'tacoma'
];

/**
 * Lista exhaustiva de países europeos (en español, inglés y variantes).
 */
export const EUROPEAN_COUNTRIES = [
  'españa', 'spain', 'espagne', 'espanha', 'spanien',
  'francia', 'france', 'frankreich',
  'alemania', 'germany', 'deutschland',
  'italia', 'italy', 'italien',
  'portugal',
  'bélgica', 'belgica', 'belgium', 'belgique',
  'países bajos', 'paises bajos', 'netherlands', 'holanda', 'pays-bas',
  'polonia', 'poland', 'pologne',
  'austria', 'österreich', 'autriche',
  'irlanda', 'ireland', 'irlande',
  'grecia', 'greece', 'grèce',
  'dinamarca', 'denmark', 'danemark',
  'finlandia', 'finland', 'finlande',
  'suecia', 'sweden', 'suède',
  'chequia', 'czechia', 'república checa', 'republica checa', 'czech republic',
  'rumanía', 'rumania', 'romania', 'roumanie',
  'bulgaria',
  'hungría', 'hungria', 'hungary', 'hongrie',
  'eslovaquia', 'slovakia', 'slovaquie',
  'croacia', 'croatia', 'croatie',
  'lituania', 'lithuania', 'lituanie',
  'eslovenia', 'slovenia', 'slovénie',
  'letonia', 'latvia', 'lettonie',
  'estonia', 'estonie',
  'chipre', 'cyprus', 'chypre',
  'luxemburgo', 'luxembourg',
  'malta',
  'reino unido', 'united kingdom', 'uk', 'gran bretaña', 'gran bretana', 'great britain', 'england', 'inglaterra', 'scotland', 'escocia', 'wales', 'gales',
  'noruega', 'norway', 'norvège',
  'suiza', 'switzerland', 'suisse', 'schweiz',
  'islandia', 'iceland',
  'albania', 'andorra', 'bosnia', 'montenegro', 'serbia', 'macedonia',
  'moldavia', 'moldova', 'ucrania', 'ukraine', 'mónaco', 'monaco',
  'liechtenstein', 'san marino', 'vaticano', 'vatican'
];

/**
 * Códigos ISO-2 de países del continente europeo (UE + EFTA + Reino Unido + Balcanes).
 */
export const EUROPEAN_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'GB', 'UK', 'NO',
  'CH', 'IS', 'AL', 'AD', 'BA', 'ME', 'MK', 'RS', 'MD', 'UA',
  'BY', 'LI', 'MC', 'SM', 'VA'
]);

/**
 * Indicadores léxicos de ubicaciones no europeas.
 */
export const NON_EUROPEAN_INDICATORS = [
  'estados unidos', 'united states', 'usa', 'u.s.a', 'u.s.', 'ee.uu', 'eeuu',
  'argelia', 'algeria', 'alger', 'setif', 'sétif', 'bugia', 'bugía', 'bejaia', 'oran', 'orán', 'annaba', 'constantine',
  'marruecos', 'morocco', 'maroc', 'casablanca', 'tanger', 'tánger', 'tangier', 'rabat', 'nador', 'agadir',
  'tunez', 'túnez', 'tunisia', 'tunis',
  'egipto', 'egypt', 'el cairo', 'cairo', 'alejandria', 'alexandria',
  'libia', 'libya', 'tripoli',
  'turquia', 'turquía', 'turkey', 'istanbul', 'estambul', 'ankara', 'izmir', 'mersin',
  'china', 'beijing', 'shanghai', 'shenzhen', 'guangzhou',
  'japon', 'japón', 'japan', 'tokyo',
  'brasil', 'brazil', 'sao paulo', 'rio de janeiro', 'santos',
  'mexico', 'méxico', 'monterrey', 'guadalajara', 'veracruz',
  'colombia', 'bogota', 'medellin',
  'argentina', 'buenos aires',
  'chile', 'santiago', 'valparaiso',
  'peru', 'perú', 'lima', 'callao',
  'canada', 'canadá', 'toronto', 'montreal', 'vancouver',
  'australia', 'sydney', 'melbourne',
  'india', 'mumbai', 'delhi',
  'dubai', 'emiratos', 'uae', 'abu dhabi',
  'singapur', 'singapore'
];

/**
 * Ciudades europeas destacadas para resolución de geolocalización directa.
 */
export const EUROPEAN_CITIES = [
  'madrid', 'barcelona', 'valencia', 'sevilla', 'seville', 'zaragoza', 'malaga', 'málaga', 'bilbao',
  'paris', 'parís', 'marseille', 'marsella', 'lyon', 'toulouse', 'nice', 'niza', 'bordeaux', 'burdeos', 'lille',
  'berlin', 'berlín', 'hamburg', 'hamburgo', 'munich', 'múnich', 'cologne', 'colonia', 'frankfurt', 'stuttgart',
  'rome', 'roma', 'milan', 'milán', 'naples', 'nápoles', 'turin', 'turín', 'genoa', 'génova', 'florence', 'florencia',
  'lisbon', 'lisboa', 'porto', 'oporto',
  'brussels', 'bruselas', 'antwerp', 'amberes', 'ghent', 'gante',
  'amsterdam', 'ámsterdam', 'rotterdam', 'utrecht',
  'warsaw', 'varsovia', 'krakow', 'cracovia', 'gdansk',
  'vienna', 'viena',
  'dublin', 'dublín', 'cork',
  'athens', 'atenas',
  'copenhagen', 'copenhague',
  'helsinki',
  'stockholm', 'estocolmo', 'gothenburg', 'gotemburgo',
  'prague', 'praga', 'brno',
  'bucharest', 'bucarest',
  'budapest',
  'bratislava',
  'zagreb',
  'vilnius', 'vilna',
  'ljubljana', 'liubliana',
  'riga',
  'tallinn', 'tallin',
  'london', 'londres', 'birmingham', 'manchester', 'liverpool', 'edinburgh', 'edimburgo',
  'oslo', 'bergen',
  'zurich', 'zúrich', 'geneva', 'ginebra', 'basel', 'basilea',
  'reykjavik', 'reikiavik',
  'belgrade', 'belgrado',
  'sarajevo'
];

/**
 * Países extranjeros para desambiguación defensiva ante colisiones de nombres.
 */
const FOREIGN_COUNTRIES = [
  'españa', 'spain', 'francia', 'france', 'portugal', 'alemania', 'germany',
  'italia', 'italy', 'bélgica', 'belgium', 'holanda', 'netherlands', 'polonia',
  'poland', 'reino unido', 'united kingdom', 'uk', 'argelia', 'algeria',
  'marruecos', 'morocco', 'méxico', 'mexico', 'colombia', 'argentina',
  'chile', 'perú', 'peru', 'brasil', 'brazil', 'canadá', 'canada', 'china', 'japón', 'japan'
];

/**
 * Evalúa si una cadena de texto (origen o destino) corresponde a una ubicación en Estados Unidos.
 *
 * @param {string} locationStr - Nombre de ciudad, estado, país o código postal.
 * @returns {boolean} true si pertenece a EE. UU.
 */
export function isUSLocation(locationStr) {
  if (!locationStr || typeof locationStr !== 'string') return false;
  const raw = locationStr.trim();
  if (!raw) return false;

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Si incluye explícitamente un país extranjero sin mencionar US/USA, es resto del mundo
  const hasForeign = FOREIGN_COUNTRIES.some(fc => normalized.includes(fc));
  const hasUSExplicit = /\b(usa|u\.s\.a|u\.s\.|united states|estados unidos|ee\.?uu\.?)\b/i.test(raw);
  if (hasForeign && !hasUSExplicit) {
    return false;
  }

  if (hasUSExplicit) {
    return true;
  }

  // Detección por nombre completo de estado
  if (US_STATES.some(state => new RegExp(`\\b${state}\\b`, 'i').test(normalized))) {
    return true;
  }

  // Detección por ciudad americana
  if (US_CITIES.some(city => new RegExp(`\\b${city}\\b`, 'i').test(normalized))) {
    return true;
  }

  // Detección por código postal de 2 letras (ej: "Houston, TX", "Miami, FL", "NY 10001", "TX")
  const stateCodeMatch = raw.match(/(?:,\s*|\s+|^)([A-Za-z]{2})(?:\s+\d{5}|\s*,|\s*$)/);
  if (stateCodeMatch) {
    const code = stateCodeMatch[1].toUpperCase();
    if (US_STATE_CODES.has(code)) {
      return true;
    }
  }

  // Detección por prefijo/sufijo de código US de 2 caracteres aislado con coma (ej: "Dallas, TX")
  const commaStateMatch = raw.match(/,\s*([A-Za-z]{2})\b/);
  if (commaStateMatch) {
    const code = commaStateMatch[1].toUpperCase();
    if (US_STATE_CODES.has(code)) {
      return true;
    }
  }

  return false;
}

/**
 * Evalúa si una cadena de texto (origen o destino) corresponde a una ubicación en Europa.
 *
 * @param {string} locationStr - Nombre de ciudad, región o país.
 * @param {string} [countryCode] - Código ISO de país opcional.
 * @returns {boolean} true si pertenece a Europa.
 */
export function isEuropeanLocation(locationStr, countryCode) {
  if (countryCode && typeof countryCode === 'string') {
    const code = countryCode.trim().toUpperCase();
    if (EUROPEAN_COUNTRY_CODES.has(code)) return true;
    if (['US', 'USA', 'DZ', 'MA', 'TN', 'EG', 'CN', 'BR', 'MX', 'CA', 'AU', 'IN', 'RU', 'TR', 'AE', 'SG'].includes(code)) {
      return false;
    }
  }

  if (!locationStr || typeof locationStr !== 'string') return true;
  const raw = locationStr.trim();
  if (!raw) return true;

  // Si es explícitamente Estados Unidos, no es Europa
  if (isUSLocation(raw)) return false;

  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Si contiene indicadores no europeos explícitos
  if (NON_EUROPEAN_INDICATORS.some(ind => normalized.includes(ind))) {
    return false;
  }

  // Si contiene un país europeo explícito
  if (EUROPEAN_COUNTRIES.some(ec => normalized.includes(ec))) {
    return true;
  }

  // Si contiene una ciudad europea destacada
  if (EUROPEAN_CITIES.some(city => normalized.includes(city))) {
    return true;
  }

  // Por defecto en el contexto operativo de la plataforma
  return true;
}

/**
 * Evalúa si una ruta completa (origen y destino) transcurre estrictamente dentro de Europa.
 *
 * @param {string} origin
 * @param {string} destination
 * @param {string} [originCountry]
 * @param {string} [destCountry]
 * @returns {boolean}
 */
export function isEuropeanRoute(origin, destination, originCountry, destCountry) {
  const pol = String(origin || '').trim();
  const pod = String(destination || '').trim();

  // Si ambos campos están vacíos (estado inicial), default europeo
  if (!pol && !pod) return true;

  const originEU = pol ? isEuropeanLocation(pol, originCountry) : true;
  const destEU = pod ? isEuropeanLocation(pod, destCountry) : true;

  return originEU && destEU;
}

/**
 * Determina universalmente la divisa y la unidad de distancia según la geografía.
 * - Europa (origen y destino en Europa) -> Moneda: € (EUR).
 * - Resto del Mundo / EE.UU. -> Moneda: $ (USD).
 * - EE. UU. -> Unidad de distancia: mi (millas).
 * - Resto del Mundo / Europa -> Unidad de distancia: km (kilómetros).
 *
 * @param {string} origin
 * @param {string} destination
 * @param {string} [originCountry]
 * @param {string} [destCountry]
 * @returns {{ currency: string, unit: string, isEuropeanRoute: boolean, isUSRoute: boolean }}
 */
export function detectCurrencyAndUnit(origin, destination, originCountry, destCountry) {
  const isUS = Boolean(
    (origin && isUSLocation(origin)) ||
    (destination && isUSLocation(destination)) ||
    ['US', 'USA'].includes(String(originCountry || '').trim().toUpperCase()) ||
    ['US', 'USA'].includes(String(destCountry || '').trim().toUpperCase())
  );

  const isEU = isEuropeanRoute(origin, destination, originCountry, destCountry);
  const currency = isEU ? '€' : '$';
  const unit = isUS ? 'mi' : 'km';

  return {
    currency,
    unit,
    isEuropeanRoute: isEU,
    isUSRoute: isUS
  };
}

/**
 * Propagación forzosa de la moneda y unidad dinámica en los paneles del Modo Técnico.
 *
 * @param {string} currency - Símbolo de divisa ('$' o '€').
 * @param {string} unit - Símbolo de distancia ('mi' o 'km').
 * @param {boolean} [isImperial=false]
 */
export function updateTechnicalWorkspaceUI(currency = '€', unit = 'km', isImperial = false) {
  if (typeof document === 'undefined') return;

  // 1. Sección 3: Estructura de Costes (Diésel, Peajes, Dietas)
  const labelPriceDiesel = document.getElementById('label-price-diesel');
  if (labelPriceDiesel) {
    labelPriceDiesel.textContent = `PRECIO DIÉSEL (${currency}/L)`;
  }
  const priceSeaInput = document.getElementById('price-sea');
  if (priceSeaInput) {
    priceSeaInput.placeholder = `${currency}/L`;
  }
  const labelPriceAdblue = document.getElementById('label-price-adblue');
  if (labelPriceAdblue) {
    labelPriceAdblue.textContent = `PRECIO ADBLUE (${currency}/L)`;
  }
  const priceIfoInput = document.getElementById('price-ifo');
  if (priceIfoInput) {
    priceIfoInput.placeholder = `${currency}/L`;
  }
  const labelPdaPol = document.getElementById('label-pda-pol');
  if (labelPdaPol) {
    const isRail = labelPdaPol.textContent && (labelPdaPol.textContent.includes('Ferroviarios') || labelPdaPol.textContent.includes('Vía'));
    labelPdaPol.textContent = isRail ? `Cánones Ferroviarios / Uso de Vía (${currency})` : `Peajes (${currency})`;
  }
  const labelPdaPod = document.getElementById('label-pda-pod');
  if (labelPdaPod) {
    labelPdaPod.textContent = `Dietas / Pernocta Chófer (${currency})`;
  }
  const labelStevedoring = document.getElementById('label-stevedoring');
  if (labelStevedoring) {
    labelStevedoring.textContent = `Carga / Descarga (${currency})`;
  }
  const labelPdaMisc = document.getElementById('label-pda-misc');
  if (labelPdaMisc) {
    labelPdaMisc.textContent = `Extras / Gastos de Ruta (${currency})`;
  }
  const labelCargoSurcharge = document.getElementById('label-cargo-surcharge');
  if (labelCargoSurcharge) {
    labelCargoSurcharge.textContent = `Recargo Carga/Especial (${currency})`;
  }
  const labelTrincaje = document.getElementById('label-trincaje');
  if (labelTrincaje) {
    labelTrincaje.textContent = `Coste Trincaje (${currency})`;
  }
  const labelManiobraEspecial = document.getElementById('label-maniobra-especial');
  if (labelManiobraEspecial) {
    labelManiobraEspecial.textContent = `Coste por Maniobra Especial (${currency})`;
  }
  const labelOpexAuto = document.getElementById('label-opex-auto-estimated');
  if (labelOpexAuto) {
    labelOpexAuto.textContent = `Autocalculado: media operativa terrestre 350 ${currency} / día`;
  }

  // 2. Sección 4: Ajustes Operativos
  const resRiskImpact = document.getElementById('res-risk-impact');
  if (resRiskImpact && resRiskImpact.textContent) {
    resRiskImpact.textContent = resRiskImpact.textContent.replace(/[€$]\s*\(Total\)/g, `${currency} (Total)`);
  }

  // 3. Sección 5: Simulador de Negociación y Spread
  const negOwnerCurrency = document.getElementById('negotiation-owner-currency-symbol');
  if (negOwnerCurrency) negOwnerCurrency.textContent = currency;
  const negOwnerUnit = document.getElementById('negotiation-owner-unit-label');
  if (negOwnerUnit) negOwnerUnit.textContent = `/${unit}`;

  const negChartererCurrency = document.getElementById('negotiation-charterer-currency-symbol');
  if (negChartererCurrency) negChartererCurrency.textContent = currency;
  const negChartererUnit = document.getElementById('negotiation-charterer-unit-label');
  if (negChartererUnit) negChartererUnit.textContent = `/${unit}`;

  const negSpreadPmt = document.getElementById('negotiation-spread-pmt');
  if (negSpreadPmt && negSpreadPmt.textContent) {
    negSpreadPmt.textContent = negSpreadPmt.textContent.replace(/[€$]\s*\/(?:Km|km|mi|MI)/g, `${currency} /${unit}`);
  }
  const negTotalSavings = document.getElementById('negotiation-total-savings');
  if (negTotalSavings && negTotalSavings.textContent) {
    negTotalSavings.textContent = negTotalSavings.textContent.replace(/[€$]/g, currency);
  }
  const negBreakEven = document.getElementById('negotiation-break-even');
  if (negBreakEven && negBreakEven.textContent) {
    negBreakEven.textContent = negBreakEven.textContent.replace(/[€$]\s*\/(?:Km|km|mi|MI)/g, `${currency} /${unit}`);
  }
  const negTargetDelta = document.getElementById('negotiation-target-delta');
  if (negTargetDelta && negTargetDelta.textContent) {
    negTargetDelta.textContent = negTargetDelta.textContent.replace(/[€$]/g, currency);
  }
  const negContingencySummary = document.getElementById('negotiation-contingency-summary');
  if (negContingencySummary && negContingencySummary.textContent) {
    negContingencySummary.textContent = negContingencySummary.textContent.replace(/[€$]/g, currency);
  }
  const negDemurrageSummary = document.getElementById('negotiation-demurrage-summary');
  if (negDemurrageSummary && negDemurrageSummary.textContent) {
    negDemurrageSummary.textContent = negDemurrageSummary.textContent.replace(/[€$]/g, currency);
  }
  const negOwnerTce = document.getElementById('negotiation-owner-tce');
  if (negOwnerTce && negOwnerTce.textContent) {
    negOwnerTce.textContent = negOwnerTce.textContent.replace(/[€$]/g, currency);
  }
  const negTargetTce = document.getElementById('negotiation-target-tce');
  if (negTargetTce && negTargetTce.textContent) {
    negTargetTce.textContent = negTargetTce.textContent.replace(/[€$]/g, currency);
  }
  const negAiSuggestion = document.getElementById('negotiation-ai-suggestion');
  if (negAiSuggestion && negAiSuggestion.textContent) {
    negAiSuggestion.textContent = negAiSuggestion.textContent.replace(/[€$]\s*\/\s*(?:Km|km|mi|MI)/g, `${currency} / ${unit}`);
  }

  // 4. Sección 6, 7 y 8: Comercial y Auditoría Financiera
  const costPlusFixedBtn = document.getElementById('cost-plus-margin-fixed');
  if (costPlusFixedBtn) costPlusFixedBtn.textContent = currency;
  const costPlusBoxTitle = document.getElementById('cost-plus-box-title');
  if (costPlusBoxTitle) {
    costPlusBoxTitle.textContent = `COSTE POR ${unit.toUpperCase()} Y PRECIO TOTAL DEL VIAJE (COST-PLUS)`;
  }
  const costPlusMinFreight = document.getElementById('cost-plus-min-freight-rate');
  if (costPlusMinFreight && costPlusMinFreight.textContent) {
    costPlusMinFreight.textContent = costPlusMinFreight.textContent.replace(/[€$]\s*\/(?:Km|km|mi|MI)/g, `${currency} /${unit}`);
  }
  const labelDemurrageRate = document.getElementById('label-demurrage-rate');
  if (labelDemurrageRate) {
    labelDemurrageRate.textContent = `PARALIZACIONES (${currency}/H)`;
  }
  const labelBuyingFreight = document.getElementById('label-buying-freight');
  if (labelBuyingFreight) {
    labelBuyingFreight.textContent = `Coste Compra Transportista (Precio por Tonelada - ${currency}/ton)`;
  }
  const labelSellingFreight = document.getElementById('label-selling-freight');
  if (labelSellingFreight) {
    labelSellingFreight.textContent = `Precio Venta Cliente (Precio por Tonelada - ${currency}/ton)`;
  }

  // Resumen de rentabilidad de la flota
  const netProfitOwnerEl = document.getElementById('res-net-profit-owner');
  if (netProfitOwnerEl && netProfitOwnerEl.textContent) {
    netProfitOwnerEl.textContent = netProfitOwnerEl.textContent.replace(/[€$]/g, currency);
  }
  const netProfitOwnerDailyEl = document.getElementById('res-net-profit-owner-daily');
  if (netProfitOwnerDailyEl && netProfitOwnerDailyEl.textContent) {
    netProfitOwnerDailyEl.textContent = netProfitOwnerDailyEl.textContent.replace(/[€$]/g, currency);
  }
  const resTceLabel = document.getElementById('res-tce-label');
  if (resTceLabel && resTceLabel.textContent) {
    resTceLabel.textContent = resTceLabel.textContent.replace(/[€$]/g, currency);
  }
  const netProfitChartererEl = document.getElementById('res-net-profit-charterer');
  if (netProfitChartererEl && netProfitChartererEl.textContent) {
    netProfitChartererEl.textContent = netProfitChartererEl.textContent.replace(/[€$]/g, currency);
  }
  const baseCostBreakEvenEl = document.getElementById('res-cost-base-break-even');
  if (baseCostBreakEvenEl && baseCostBreakEvenEl.textContent) {
    baseCostBreakEvenEl.textContent = baseCostBreakEvenEl.textContent
      .replace(/[€$]/g, currency)
      .replace(/\/(?:Km|km|mi|MI)/g, `/${unit}`);
  }
  const resCostTotal = document.getElementById('res-cost-total');
  if (resCostTotal && resCostTotal.textContent) {
    resCostTotal.textContent = resCostTotal.textContent.replace(/[€$]/g, currency);
  }
  const resBreakeven = document.getElementById('res-breakeven');
  if (resBreakeven && resBreakeven.textContent) {
    resBreakeven.textContent = resBreakeven.textContent
      .replace(/[€$]/g, currency)
      .replace(/\/(?:Km|km|mi|MI)/g, `/${unit}`);
  }

  // Tarjeta 3 de salud financiera si existe
  const valCosteBaseKm = document.getElementById('val-coste-base-km');
  if (valCosteBaseKm && valCosteBaseKm.textContent) {
    valCosteBaseKm.textContent = valCosteBaseKm.textContent
      .replace(/[€$]/g, currency)
      .replace(/\/(?:km|mi)/gi, `/${unit}`);
  }
  const valMargenNetoProyecto = document.getElementById('val-margen-neto-proyecto');
  if (valMargenNetoProyecto && valMargenNetoProyecto.textContent) {
    valMargenNetoProyecto.textContent = valMargenNetoProyecto.textContent.replace(/[€$]/g, currency);
  }
  const valBeneficioNetoCamion = document.getElementById('val-beneficio-neto-camion');
  if (valBeneficioNetoCamion && valBeneficioNetoCamion.textContent) {
    valBeneficioNetoCamion.textContent = valBeneficioNetoCamion.textContent.replace(/[€$]/g, currency);
  }
}

/**
 * Determina dinámicamente si la ruta debe procesarse visualmente en IMPERIAL o METRIC.
 *
 * @param {string} origin - Texto de origen.
 * @param {string} destination - Texto de destino.
 * @returns {'IMPERIAL' | 'METRIC'} Sistema de unidades correspondiente.
 */
export function detectUnitSystem(origin, destination) {
  const isUS = Boolean(
    (origin && isUSLocation(origin)) ||
    (destination && isUSLocation(destination))
  );
  return isUS ? 'IMPERIAL' : 'METRIC';
}

/**
 * Convierte una distancia en kilómetros al valor correspondiente según el sistema.
 * Aplica exclusivamente km * 0.621371 si el sistema es IMPERIAL.
 *
 * @param {number|string} km - Distancia en kilómetros retornada por el motor OSRM.
 * @param {'IMPERIAL'|'METRIC'} unitSystem - Sistema de unidades activo.
 * @returns {number} Distancia convertida.
 */
export function convertDistance(km, unitSystem = 'METRIC') {
  const num = Number(km) || 0;
  if (num <= 0) return 0;
  return unitSystem === 'IMPERIAL' ? num * KM_TO_MILES : num;
}

/**
 * Formatea una distancia para visualización en pantalla con su unidad respectiva.
 *
 * @param {number|string} km - Distancia en kilómetros.
 * @param {'IMPERIAL'|'METRIC'} unitSystem - Sistema de unidades.
 * @param {number} [digits=0] - Decimales a mostrar (0 por defecto).
 * @returns {string} Cadena formateada (ej. "621 mi" o "1.000 km").
 */
export function formatDistance(km, unitSystem = 'METRIC', digits = 0) {
  const converted = convertDistance(km, unitSystem);
  const formatted = digits > 0
    ? converted.toFixed(digits)
    : String(Math.round(converted)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted} ${unitSystem === 'IMPERIAL' ? 'mi' : 'km'}`;
}

/**
 * Retorna las etiquetas y símbolos de visualización para un sistema dado.
 *
 * @param {'IMPERIAL'|'METRIC'} unitSystem
 * @returns {object} Metadatos de visualización para la UI.
 */
export function getUnitLabels(unitSystem = 'METRIC') {
  const isImperial = unitSystem === 'IMPERIAL';
  return {
    unitSystem: isImperial ? 'IMPERIAL' : 'METRIC',
    isImperial,
    distanceUnit: isImperial ? 'mi' : 'km',
    distanceUnitUpper: isImperial ? 'MI' : 'KM',
    distanceLabel: isImperial ? 'Millas (mi)' : 'Kilómetros (km)',
    weightUnit: isImperial ? 'lbs' : 'kg',
    weightTonsUnit: isImperial ? 'lbs' : 'Tons',
    weightInputLabel: isImperial ? 'Libras (lbs)' : 'Toneladas / Kilos',
    currencySymbol: isImperial ? '$' : '€',
    costPerDistanceLabel: isImperial ? 'Coste / mi (Base + Fuel)' : 'Coste / km (Base + Fuel)',
    costPerDistanceUnit: isImperial ? '$/mi' : '€/km'
  };
}

/**
 * Hook de React para auto-detección y suscripción reactiva al sistema de unidades.
 *
 * @param {string} origin - Origen actual de la ruta.
 * @param {string} destination - Destino actual de la ruta.
 * @returns {object} Estado y funciones de utilidad visual.
 */
export function useUnitSystem(origin, destination) {
  const system = detectUnitSystem(origin, destination);
  const labels = getUnitLabels(system);

  return {
    unitSystem: system,
    isImperial: system === 'IMPERIAL',
    ...labels,
    convertDistance: (km) => convertDistance(km, system),
    formatDistance: (km, digits = 0) => formatDistance(km, system, digits)
  };
}

/**
 * Observador de DOM para entornos Vanilla JS (Land Charter index.html / road engine).
 * Escucha eventos de input y change en campos de origen y destino, detecta el mercado
 * y actualiza de manera no intrusiva las etiquetas y resultados visuales en pantalla.
 *
 * @param {Function} [onSystemChange] - Callback opcional invocado ante cambio de sistema.
 * @returns {Function} Función de limpieza para desuscribir observadores.
 */
export function setupLandCharterUnitObserver(onSystemChange) {
  if (typeof document === 'undefined') return () => {};

  const getOriginValue = () => {
    const el = document.getElementById('port-pol')
      || document.getElementById('map-port-pol')
      || document.getElementById('input-pol');
    return el ? (el.value || '') : '';
  };

  const getDestinationValue = () => {
    const el = document.getElementById('port-pod')
      || document.getElementById('map-port-pod')
      || document.getElementById('input-pod');
    return el ? (el.value || '') : '';
  };

  let currentSystem = 'METRIC';

  const updateUI = () => {
    const origin = getOriginValue();
    const dest = getDestinationValue();
    const newSystem = detectUnitSystem(origin, dest);
    currentSystem = newSystem;
    const isImperial = newSystem === 'IMPERIAL';

    if (typeof window !== 'undefined') {
      window.LandCharterUnitSystem = newSystem;
      window.LandCharterIsImperial = isImperial;
    }

    // 1. Adaptar etiquetas de distancia
    const labelBallast = document.getElementById('label-dist-ballast');
    if (labelBallast) {
      labelBallast.textContent = isImperial ? 'Distancia en Vacío (mi)' : 'Distancia en Vacío (km)';
    }

    const labelLaden = document.getElementById('label-dist-laden');
    if (labelLaden) {
      labelLaden.textContent = isImperial ? 'Distancia en Carga (mi)' : 'Distancia en Carga (km)';
    }

    const labelTotal = document.getElementById('label-dist-total');
    if (labelTotal) {
      labelTotal.textContent = isImperial ? 'Total Millas (mi)' : 'Total Kilómetros (km)';
    }

    const syncCard = document.getElementById('sync-miles-card');
    if (syncCard) {
      const headerSpan = syncCard.querySelector('span');
      if (headerSpan) {
        headerSpan.textContent = isImperial ? 'Millas' : 'Kilómetros';
      }
    }

    // 2. Adaptar etiquetas de carga / peso
    const labelCargoQty = document.getElementById('label-cargo-qty');
    if (labelCargoQty) {
      labelCargoQty.textContent = isImperial ? 'Libras (lbs)' : 'Peso Bruto (KG) / Carga (TM)';
    }

    const labelGrabCap = document.getElementById('label-grab-capacity');
    if (labelGrabCap) {
      labelGrabCap.textContent = isImperial ? 'Libras (lbs)' : 'Peso Bruto (KG)';
    }

    const labelPesoPieza = document.getElementById('label-peso-pieza');
    if (labelPesoPieza) {
      labelPesoPieza.textContent = isImperial ? 'Libras (lbs)' : 'Peso por pieza (MT)';
    }

    const labelLcl = document.querySelector('label[for="lcl-weight-tons"]');
    if (labelLcl) {
      labelLcl.textContent = isImperial ? 'Libras (lbs)' : 'Peso (Toneladas)';
    }

    const labelCostPlus = document.querySelector('label[for="cost-plus-cargo-volume"]');
    if (labelCostPlus) {
      labelCostPlus.textContent = isImperial ? 'Libras (lbs)' : 'Toneladas carga';
    }

    // 3. Actualizar visualización de distancia si ya existe cálculo activo
    const kmValue = (typeof window !== 'undefined' && window.LandData && (window.LandData.totalKilometers || window.LandData.distanceKm)) ||
      (typeof window !== 'undefined' && window.State && (window.State.distanceKm || window.State.totalKilometers));
    if (kmValue && Number(kmValue) > 0) {
      const numKm = Number(kmValue);
      const converted = isImperial ? Math.round(numKm * KM_TO_MILES) : Math.round(numKm);
      const unit = isImperial ? 'mi' : 'km';
      const formatted = `${converted.toLocaleString('es-ES')} ${unit}`;

      const syncMilesLabel = document.getElementById('sync-miles-label');
      if (syncMilesLabel) syncMilesLabel.textContent = formatted;

      const syncMilesBreakdown = document.getElementById('sync-miles-breakdown');
      if (syncMilesBreakdown) syncMilesBreakdown.textContent = formatted;

      const tacoEl = document.getElementById('tacografo-distance-display');
      if (tacoEl) tacoEl.value = formatted;
    }

    // 4. Si el panel de itinerario OSRM está disponible y con datos, refrescarlo
    if (typeof window !== 'undefined' && window.LandData && typeof window.renderRouteItineraryRightPanel === 'function') {
      try {
        window.renderRouteItineraryRightPanel(window.LandData);
      } catch (_) {}
    }

    // 5. Adaptar paneles de costes (LADO DEL TRANSPORTISTA y LADO DE LA AGENCIA) en Calculadora LDM
    const isUSRoute = isImperial || isUSLocation(origin) || isUSLocation(dest);
    const isEU = isEuropeanRoute(origin, dest);
    const currency = isEU ? '€' : '$';
    const distUnit = isUSRoute ? 'mi' : 'km';

    if (typeof window !== 'undefined') {
      window.LandCharterCurrency = currency;
      window.LandCharterUnit = distUnit;
      window.LandCharterIsEuropean = isEU;
      window.LandCharterIsImperial = isUSRoute;
      if (window.State) {
        window.State.currency = currency;
        window.State.unit = distUnit;
      }
    }

    const purchaseTitle = document.getElementById('exec-carrier-purchase-title');
    if (purchaseTitle) {
      purchaseTitle.textContent = `Tarifa Cerrada de Compra (${currency})`;
    }
    const rateUnitLabel = document.getElementById('exec-carrier-rate-unit-label');
    if (rateUnitLabel) {
      rateUnitLabel.textContent = `Tarifa/${distUnit}:`;
    }

    // 6. Propagar y actualizar paneles del Modo Técnico
    updateTechnicalWorkspaceUI(currency, distUnit, isUSRoute);

    // Re-sincronizar Vista Ejecutiva si el motor está disponible
    const syncExecutiveDashboard = (typeof window !== 'undefined' && (window.updateExecutiveDashboard || window.SeaCharterVoyageCostEngine?.updateExecutiveDashboard));
    if (typeof syncExecutiveDashboard === 'function' && typeof window !== 'undefined') {
      const stateToSync = window.CalculatedState && Object.keys(window.CalculatedState).length > 0
        ? window.CalculatedState
        : (window.State && Object.keys(window.State).length > 0 ? window.State : null);
      if (stateToSync) {
        try {
          syncExecutiveDashboard({
            ...stateToSync,
            pol: origin || stateToSync.pol,
            pod: dest || stateToSync.pod,
            isUSRoute,
            isEuropeanRoute: isEU,
            currency,
            distanceUnit: distUnit,
            unitSystem: newSystem,
            isImperial
          });
        } catch (_) {}
      }
    }

    // 7. Notificar a través de CustomEvent
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('land-charter:unit-system-changed', {
          detail: { unitSystem: newSystem, isImperial, isEuropeanRoute: isEU, isUSRoute, currency, unit: distUnit, origin, destination: dest }
        }));
      } catch (_) {}
    }

    if (typeof onSystemChange === 'function') {
      onSystemChange(newSystem, isImperial);
    }
  };

  const candidateIds = ['port-pol', 'port-pod', 'map-port-pol', 'map-port-pod', 'input-pol', 'input-pod'];
  const attachedElements = [];

  candidateIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateUI);
      el.addEventListener('change', updateUI);
      attachedElements.push(el);
    }
  });

  // Ejecución inicial
  updateUI();

  return () => {
    attachedElements.forEach(el => {
      el.removeEventListener('input', updateUI);
      el.removeEventListener('change', updateUI);
    });
  };
}

// Exposición global defensiva en navegador
if (typeof window !== 'undefined') {
  window.UnitSystemDetector = {
    isUSLocation,
    isEuropeanLocation,
    isEuropeanRoute,
    detectCurrencyAndUnit,
    updateTechnicalWorkspaceUI,
    detectUnitSystem,
    convertDistance,
    formatDistance,
    getUnitLabels,
    setupLandCharterUnitObserver,
    KM_TO_MILES
  };
}
