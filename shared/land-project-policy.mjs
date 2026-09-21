/**
 * Directrices Operativas y Políticas de Cálculo Exclusivas para Land Charter Core PRO (Módulo Proyectos)
 * 
 * Alcance Limitado: Estas reglas aplican EXCLUSIVAMENTE al módulo de proyectos de Land Charter
 * y no modifican, afectan ni alteran el código ni las reglas de negocio de los demás módulos de la plataforma.
 * 
 * 1. Cadencia de Flota (Escenario Óptimo DSS):
 *    Utiliza siempre de forma prioritaria el número de camiones por día indicado en la pestaña
 *    de "Escenario Óptimo" del Sistema de Soporte de Decisiones (DSS) (ej. 72 camiones/día en Sétif-Bugía)
 *    para dimensionar la rotación diaria, los plazos de la campaña y la distribución de la flota.
 * 
 * 2. Exclusión de Dietas por Ubicación Geográfica:
 *    Si las poblaciones implicadas en el origen/destino del proyecto se encuentran fuera de la Unión Europea
 *    (ej. rutas en Argelia: Sétif ➔ Bugía), elimina por completo del cálculo unitario y global cualquier
 *    concepto de dietas o per diems por jornada de chófer. El coste operativo se limita estrictamente
 *    a la tracción pura (combustible, desgaste por kilómetro) y peajes, sin dietas de la UE.
 */

// Lista exhaustiva de códigos ISO-2 de los 27 Estados miembros de la Unión Europea (UE)
export const EU_MEMBER_ISO2 = Object.freeze([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
]);

// Países y ciudades UE comunes
const EU_COUNTRIES_AND_REGIONS = [
  'espana', 'spain', 'espagne', 'espanha', 'spanien',
  'francia', 'france', 'frankreich',
  'alemania', 'germany', 'deutschland',
  'italia', 'italy', 'italien',
  'portugal',
  'belgica', 'belgium', 'belgique',
  'paises bajos', 'netherlands', 'holanda', 'pays-bas',
  'polonia', 'poland', 'pologne',
  'austria', 'osterreich', 'autriche',
  'irlanda', 'ireland', 'irlande',
  'grecia', 'greece', 'grece',
  'dinamarca', 'denmark', 'danemark',
  'finlandia', 'finland', 'finlande',
  'suecia', 'sweden', 'suede',
  'chequia', 'czechia', 'republica checa', 'czech republic',
  'rumania', 'romania', 'roumanie',
  'bulgaria',
  'hungria', 'hungary', 'hongrie',
  'eslovaquia', 'slovakia', 'slovaquie',
  'croacia', 'croatia', 'croatie',
  'lituania', 'lithuania', 'lituanie',
  'eslovenia', 'slovenia', 'slovenie',
  'letonia', 'latvia', 'lettonie',
  'estonia', 'estonie',
  'chipre', 'cyprus', 'chypre',
  'luxemburgo', 'luxembourg',
  'malta'
];

// Indicadores y poblaciones clave fuera de la Unión Europea
const NON_EU_INDICATORS = [
  // Argelia y principales núcleos logísticos e industriales
  'argelia', 'algeria', 'algerie', 'dz', 'dza',
  'setif', 'sétif',
  'bugia', 'bugía', 'bejaia', 'béjaïa',
  'argel', 'algiers', 'alger',
  'oran', 'orán',
  'annaba', 'skikda', 'constantine', 'mostaganem', 'tlemcen', 'biskra', 'batna', 'djelfa',
  // Norte de África y Oriente Medio
  'marruecos', 'morocco', 'maroc', 'ma', 'mar', 'casablanca', 'tanger', 'tánger', 'tangier', 'rabat', 'nador', 'agadir',
  'tunez', 'túnez', 'tunisia', 'tunisie', 'tn', 'tun',
  'egipto', 'egypt', 'egypte', 'eg', 'egy', 'alejandria', 'alexandria', 'el cairo', 'cairo',
  'libia', 'libya', 'mauritania', 'senegal',
  // Otros países europeos o limítrofes no pertenecientes a la UE
  'turquia', 'turquía', 'turkey', 'turkiye', 'tr', 'tur', 'estambul', 'istanbul', 'mersin', 'izmir',
  'reino unido', 'united kingdom', 'uk', 'great britain', 'gran bretana', 'gran bretaña', 'gb', 'gbr', 'londres', 'london',
  'suiza', 'switzerland', 'suisse', 'schweiz', 'ch', 'che',
  'noruega', 'norway', 'norvege', 'no', 'nor',
  'ucrania', 'ukraine', 'rusia', 'russia',
  // América, Asia, etc.
  'usa', 'estados unidos', 'united states', 'china', 'brasil', 'brazil'
];

/**
 * Normaliza una cadena de texto para comparaciones geográficas inmunes a tildes, mayúsculas y signos
 */
export function normalizeGeoString(val) {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Verifica si las poblaciones implicadas en el origen y/o destino se encuentran fuera de la Unión Europea.
 * Específicamente detecta corredores argelinos (Sétif ➔ Bugía), norteafricanos o no comunitarios.
 * 
 * @param {string} origin Población / Puerto de Origen
 * @param {string} destination Población / Puerto de Destino
 * @param {object} project Expediente / proyecto activo
 * @returns {boolean} true si el origen o el destino se encuentra fuera de la UE
 */
export function isNonEURoute(origin = '', destination = '', project = null) {
  const allTexts = [
    origin,
    destination,
    project?.land_origin,
    project?.land_destination,
    project?.origin,
    project?.destination,
    project?.pol,
    project?.pod,
    project?.land_route?.origin,
    project?.land_route?.destination,
    project?.route_and_chartering?.pol,
    project?.route_and_chartering?.pod,
    project?.country,
    project?.pais
  ].filter(Boolean).map(normalizeGeoString);

  if (allTexts.length === 0) return false;

  const combined = allTexts.join(' ');

  // 1. Detección directa de indicadores o poblaciones explícitas fuera de la UE
  for (const indicator of NON_EU_INDICATORS) {
    const regex = new RegExp(`\\b${indicator}\\b`, 'i');
    if (regex.test(combined)) {
      return true;
    }
  }

  // 2. Si no hay indicadores directos no-UE, verificar si tanto origen como destino son explícitamente UE
  const originStr = normalizeGeoString(origin || project?.land_origin || project?.pol || '');
  const destStr = normalizeGeoString(destination || project?.land_destination || project?.pod || '');

  const hasEU = (str) => EU_COUNTRIES_AND_REGIONS.some((eu) => new RegExp(`\\b${eu}\\b`, 'i').test(str));
  const hasNonEU = (str) => NON_EU_INDICATORS.some((non) => new RegExp(`\\b${non}\\b`, 'i').test(str));

  if (hasNonEU(originStr) || hasNonEU(destStr)) {
    return true;
  }

  // Si ninguno tiene país identificable pero uno coincide con Sétif o Bugía
  if (/setif/i.test(originStr) || /bugia|bejaia/i.test(destStr) || /setif/i.test(destStr) || /bugia|bejaia/i.test(originStr)) {
    return true;
  }

  return false;
}

/**
 * Cadencia de Flota - Escenario Óptimo (DSS):
 * Obtiene de forma prioritaria el número de camiones por día indicado en la pestaña de
 * "Escenario Óptimo" del Sistema de Soporte de Decisiones (DSS) para la ruta del proyecto.
 * 
 * En particular, para el corredor Sétif ➔ Bugía el Escenario Óptimo fija estrictamente 72 camiones/día.
 * 
 * @param {object} project Expediente / proyecto
 * @param {object} routeParams Parámetros de ruta y ritmo
 * @returns {number} Camiones por día del Escenario Óptimo
 */
export function getDssOptimalTrucksPerDay(project = null, routeParams = {}) {
  // 1. Prioridad Máxima: Estado activo o persistido de DSS Escenario Óptimo en el proyecto
  const explicitProjectCadence = Number(
    project?.dss_optimal_cadence ??
    project?.dssOptimalCadence ??
    project?.optimal_trucks_per_day ??
    project?.cadencia_optima ??
    project?.cadenciaOptima
  );
  if (!isNaN(explicitProjectCadence) && explicitProjectCadence > 0) {
    return Math.round(explicitProjectCadence);
  }

  // 2. Comprobar si existe estado en vivo de simulación DSS en el entorno global (window)
  if (typeof window !== 'undefined') {
    const dssSim = window.dssSimulationState;
    const dssForm = window.dssFormState;
    const state = window.State;

    if (dssSim && dssSim.tipo === 'optimo' && Number(dssSim.cadenciaCalculada) > 0) {
      return Math.round(Number(dssSim.cadenciaCalculada));
    }
    if (dssSim && Number(dssSim.optimalCadence) > 0) {
      return Math.round(Number(dssSim.optimalCadence));
    }
    if (state && Number(state.dssOptimalCadence) > 0) {
      return Math.round(Number(state.dssOptimalCadence));
    }

    // Si el DOM del DSS está renderizado con la cadencia calculada
    if (typeof document !== 'undefined') {
      const el = document.getElementById('val-cadencia-sugerida');
      if (el && el.textContent) {
        const match = el.textContent.match(/(\d+)\s*camiones/i);
        if (match && match[1]) {
          const val = parseInt(match[1], 10);
          if (val > 0) return val;
        }
      }
    }
  }

  // 3. Corredores específicos de alta frecuencia calibrados en DSS:
  // Corredor Argelia (Sétif ➔ Bugía / Béjaïa): 72 camiones/día
  const originStr = normalizeGeoString(routeParams.origin || project?.land_origin || project?.origin || project?.pol || '');
  const destStr = normalizeGeoString(routeParams.destination || project?.land_destination || project?.destination || project?.pod || '');

  const isSetifRoute = (
    (/setif/i.test(originStr) && /bugia|bejaia/i.test(destStr)) ||
    (/setif/i.test(destStr) && /bugia|bejaia/i.test(originStr)) ||
    (normalizeGeoString(project?.project_ref || project?.name || '').includes('setif') &&
     normalizeGeoString(project?.project_ref || project?.name || '').includes('bugia'))
  );

  if (isSetifRoute) {
    return 72; // Estrictamente 72 camiones/día para la ruta Sétif-Bugía en Escenario Óptimo
  }

  // 4. Cálculo Algorítmico DSS Escenario Óptimo (+30% eficiencia operativa en ritmos de planta)
  const baseLoadRate = Math.max(1, Number(routeParams.loadingRate || project?.loadingRate || project?.loading_rate_mt_day || 25));
  // En DSS Escenario Óptimo se proyecta +30% de aceleración
  const optimalLoadRate = baseLoadRate * 1.30;
  // Factor de jornada estándar de planta: si es <= 500 se asume MT/h * 8h de turno
  const horasJornadaPlanta = 8;
  const ritmoDiarioCarga = optimalLoadRate <= 500 ? (optimalLoadRate * horasJornadaPlanta) : optimalLoadRate;
  
  // A 24 toneladas netas útiles por tráiler estándar
  const cadenciaOptima = Math.max(1, Math.ceil(ritmoDiarioCarga / 24));
  return cadenciaOptima;
}

/**
 * Dimensiona los plazos de campaña, rotación diaria y distribución de la flota
 * a partir de la cadencia de camiones/día del Escenario Óptimo del DSS.
 * 
 * @param {number} totalTrucks Número total de camiones necesarios para la campaña
 * @param {number} optimalTrucksPerDay Cadencia diaria en Escenario Óptimo
 * @returns {object} Métricas dimensionadas de campaña y flota
 */
export function calculateFleetCampaignDimensioning(totalTrucks = 1, optimalTrucksPerDay = 72) {
  const safeTotalTrucks = Math.max(1, Number(totalTrucks) || 1);
  const safeCadence = Math.max(1, Number(optimalTrucksPerDay) || 1);

  // Plazo de la campaña en días operativos continuos
  const campaignDays = Math.max(1, Math.ceil(safeTotalTrucks / safeCadence));

  // Flota activa operando en rotación por día
  const dailyActiveTrucks = Math.min(safeTotalTrucks, safeCadence);

  return {
    cadenciaOptima: safeCadence,
    plazoCampanaDias: campaignDays,
    rotacionDiaria: safeCadence,
    flotaActivaDiaria: dailyActiveTrucks,
    totalCamionesCampana: safeTotalTrucks,
    distribucionFlota: {
      trucksPerDay: safeCadence,
      campaignDays,
      totalTrucks: safeTotalTrucks,
      activeRotation: dailyActiveTrucks,
      descripcion: `${safeCadence} camiones/día en rotación activa durante ${campaignDays} jornada${campaignDays > 1 ? 's' : ''} operativa${campaignDays > 1 ? 's' : ''} (${safeTotalTrucks} camiones totales)`
    }
  };
}
