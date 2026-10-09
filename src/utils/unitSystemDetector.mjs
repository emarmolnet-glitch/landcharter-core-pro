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

    // 5. Notificar a través de CustomEvent
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('land-charter:unit-system-changed', {
          detail: { unitSystem: newSystem, isImperial, origin, destination: dest }
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
    detectUnitSystem,
    convertDistance,
    formatDistance,
    getUnitLabels,
    setupLandCharterUnitObserver,
    KM_TO_MILES
  };
}
