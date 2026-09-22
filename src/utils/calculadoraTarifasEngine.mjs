/**
 * Utilitarios y lógica de cálculo para la Calculadora Universal de Tarifas Terrestres
 */

export const DEFAULT_CURRENCIES = [
  { code: 'DZD', name: 'Dinar Argelino (DZD)', symbol: 'DA', defaultRateToEur: 0.0068 },
  { code: 'TRY', name: 'Lira Turca (TRY)', symbol: '₺', defaultRateToEur: 0.027 },
  { code: 'MAD', name: 'Dírham Marroquí (MAD)', symbol: 'DH', defaultRateToEur: 0.093 },
  { code: 'EUR', name: 'Euro (EUR)', symbol: '€', defaultRateToEur: 1.0 },
  { code: 'USD', name: 'Dólar USA (USD)', symbol: '$', defaultRateToEur: 0.92 },
  { code: 'GBP', name: 'Libra Esterlina (GBP)', symbol: '£', defaultRateToEur: 1.17 }
];

/**
 * Plantilla por defecto con los 5 conceptos oficiales del tarifario Excel base:
 * 1. "Precio Base" (en divisa local, ej. DZD)
 * 2. "Envase (Big Bag / Sac)" (en divisa internacional USD/EUR directa)
 * 3. "Logística Inland" (en divisa internacional USD/EUR directa, o FSPE/Mercado)
 * 4. "Gastos de tránsito" (en divisa internacional USD/EUR directa)
 * 5. "Gastos portuarios" (en divisa internacional USD/EUR directa)
 */
export const DEFAULT_TARIFF_COST_ITEMS = [
  { id: 'item-base', concepto: "Precio Base", valorLocal: 0, isBasePrice: true, isLocalCurrency: true },
  { id: 'item-envase', concepto: "Envase (Big Bag / Sac)", valorLocal: 0, isDirectInternational: true },
  { id: 'item-inland', concepto: "Logística Inland", valorLocal: 0, isInlandLogistics: true, isDirectInternational: true },
  { id: 'item-transito', concepto: "Gastos de tránsito", valorLocal: 0, isTransit: true, isDirectInternational: true },
  { id: 'item-portuarios', concepto: "Gastos portuarios", valorLocal: 0, isPort: true, isDirectInternational: true }
];

export function getDefaultCostItems() {
  return DEFAULT_TARIFF_COST_ITEMS.map(item => ({ ...item }));
}

/**
 * Calcula el importe total según la modalidad comercial (FOB o EXW),
 * el toggle de convenio FSPE vs Mercado y el modelo de divisas mixtas:
 * - Precio Base: Viene en moneda local (DZD), se le aplica el Factor Descuento (Rabais) y el tipo de cambio a USD/EUR.
 * - Costes periféricos (Envase, Logística Inland, Tránsito, Puertos): Vienen ya en divisa internacional fija (USD/EUR).
 * - En modalidad EXW: se omiten por completo los gastos de tránsito y portuarios.
 * - Con FSPE vs Sin FSPE: si se activa FSPE, utiliza la logística subvencionada (flete FSPE); si es mercado, flete estándar.
 */
export function calculateCommercialTotal({
  items = [],
  discountFactor = 0.85,
  exchangeRate = 0.0068,
  commercialModality = 'FOB', // 'FOB' | 'EXW'
  useFspe = true,
  logisticaFspeVal = null,
  logisticaMercadoVal = null
}) {
  if (!Array.isArray(items)) return 0;
  const factor = Number(discountFactor) || 0;
  const rate = Number(exchangeRate) || 0;
  const isExw = String(commercialModality).toUpperCase() === 'EXW';

  let basePriceLocal = 0;
  let hasExplicitBase = false;
  let internationalSum = 0;

  items.forEach((item, index) => {
    const concepto = String(item.concepto || '').trim().toLowerCase();
    const isBase = item.isBasePrice || item.isLocalCurrency || index === 0 || concepto === 'precio base';
    const isTransit = item.isTransit || concepto.includes('transito') || concepto.includes('tránsito');
    const isPort = item.isPort || concepto.includes('portuario') || concepto.includes('puerto');
    const isInland = item.isInlandLogistics || concepto.includes('logistica') || concepto.includes('logística') || concepto.includes('inland');

    // Si es EXW, desactiva / excluye los gastos de tránsito y portuarios
    if (isExw && (isTransit || isPort)) {
      return;
    }

    if (isBase && !hasExplicitBase) {
      basePriceLocal = Number(item.valorLocal) || 0;
      hasExplicitBase = true;
      return;
    }

    let itemValue = Number(item.valorLocal) || 0;

    // Si es la fila de logística inland y se han provisto valores diferenciales FSPE vs Mercado
    if (isInland) {
      if (useFspe && logisticaFspeVal !== null && logisticaFspeVal !== undefined) {
        itemValue = Number(logisticaFspeVal) || itemValue;
      } else if (!useFspe && logisticaMercadoVal !== null && logisticaMercadoVal !== undefined) {
        itemValue = Number(logisticaMercadoVal) || itemValue;
      }
    }

    // Los costes periféricos ya vienen en divisa internacional (USD/EUR)
    internationalSum += itemValue;
  });

  // Base convertida a USD/EUR tras aplicar el factor de descuento (Rabais)
  const convertedBase = (basePriceLocal * factor) * rate;

  return Math.round((convertedBase + internationalSum) * 100) / 100;
}

/**
 * Cálculo FOB retrocompatible
 */
export function calculateFobTotal(items, discountFactor = 0.85) {
  if (!Array.isArray(items)) return 0;
  const factor = Number(discountFactor) || 0;

  let basePrice = 0;
  let hasExplicitBase = false;
  let otherSummables = 0;

  items.forEach((item, index) => {
    const val = Number(item.valorLocal) || 0;
    const isBase = item.isBasePrice || index === 0 || String(item.concepto || '').trim().toLowerCase() === 'precio base';
    if (isBase && !hasExplicitBase) {
      basePrice = val;
      hasExplicitBase = true;
    } else {
      otherSummables += val;
    }
  });

  return (basePrice * factor) + otherSummables;
}
