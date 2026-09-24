/**
 * Metadata and specifications for the 4 core vehicle profiles in Land Charter.
 */
export const TRUCK_PROFILES_METADATA = {
  TAUTLINER: {
    code: 'TAUTLINER',
    title: 'Semirremolque Estándar Lona Corredera (Tautliner)',
    standardLengthM: 13.6,
    defaultPayloadKg: 24000,
    category: 'LONA CORREDERA',
    badge: '13.6m Carrozado Cerrado',
    description: 'Tractora + Semirremolque cerrado con lonas laterales corredizas y techo.'
  },
  PLATAFORMA_ABIERTA: {
    code: 'PLATAFORMA_ABIERTA',
    title: 'Plataforma Abierta Portuaria (Flatbed)',
    standardLengthM: 13.6,
    defaultPayloadKg: 24000,
    category: 'FLATBED',
    badge: 'Project Cargo / OOG Ready',
    description: 'Tractora + Semirremolque plataforma plana sin arquillos ni lonas para cargas sobredimensionadas.'
  },
  GONDOLA: {
    code: 'GONDOLA',
    title: 'Góndola Especial de Cama Rebajada (Lowbed / Tie-Boy)',
    standardLengthM: 13.6,
    defaultPayloadKg: 32000,
    category: 'LOWBED / TIE-BOY',
    badge: 'Cargas Extrapesadas / Multi-Eje',
    description: 'Semirremolque con cuello de cisne y cama rebajada para carga pesada y gálibo especial.'
  },
  RIGIDO: {
    code: 'RIGIDO',
    title: 'Camión Rígido / Furgón (Chasis Único)',
    standardLengthM: 8.0,
    defaultPayloadKg: 12000,
    category: 'RÍGIDO / FURGÓN',
    badge: 'Chasis Único (Sin Articulación)',
    description: 'Vehículo monobloque con caja cerrada o furgón integrado sobre bastidor continuo.'
  }
};

/**
 * Normalizes input string for robust matching
 */
function normalizeText(val) {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Classifies a vehicle type into one of the 4 conditional profiles:
 * - TAUTLINER (default for lona / standard trailer)
 * - PLATAFORMA_ABIERTA (flatbed / open deck)
 * - GONDOLA (lowbed / tie-boy / cama rebajada)
 * - RIGIDO (furgón / rígido / chasis continuo)
 */
export function getTruckProfile(vehicleTypeName) {
  const norm = normalizeText(vehicleTypeName);

  if (!norm) return 'TAUTLINER';

  // 1. Góndola / Lowbed / Tie-Boy
  if (
    norm.includes('gondola') ||
    norm.includes('lowbed') ||
    norm.includes('low-bed') ||
    norm.includes('tie-boy') ||
    norm.includes('tie boy') ||
    norm.includes('tieboy') ||
    norm.includes('cama rebajada') ||
    norm.includes('extrapesada')
  ) {
    return 'GONDOLA';
  }

  // 2. Rígido / Furgón
  if (
    norm.includes('rigido') ||
    norm.includes('furgon') ||
    norm.includes('furgoneta') ||
    norm.includes('chasis unico') ||
    norm.includes('sin articulacion') ||
    norm.includes('camion 2 ejes') ||
    norm.includes('camion 3 ejes')
  ) {
    return 'RIGIDO';
  }

  // 3. Plataforma abierta / Flatbed
  if (
    norm.includes('plataforma abierta') ||
    norm.includes('flatbed') ||
    norm.includes('plataforma plana') ||
    norm.includes('open flatbed') ||
    norm.includes('sin grua') ||
    norm.includes('project cargo open') ||
    (norm.includes('plataforma') && !norm.includes('lona'))
  ) {
    return 'PLATAFORMA_ABIERTA';
  }

  // 4. Default: Tautliner / Lona corredera
  return 'TAUTLINER';
}

export function resolveTruckProfile(vehicleTypeName) {
  const profileKey = getTruckProfile(vehicleTypeName);
  return TRUCK_PROFILES_METADATA[profileKey] || TRUCK_PROFILES_METADATA.TAUTLINER;
}
