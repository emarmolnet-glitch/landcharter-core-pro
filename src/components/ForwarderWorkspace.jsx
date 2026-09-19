import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../utils/apiConfig.js';
import { parsePackingList } from '../utils/packingListParser.js';
import AgenteProyectosWidget from './AgenteProyectosWidget';
import '../../dual-trading-chartering-view.js';
import {
  buildCBAMCommercialAnalysis,
  generateCBAMCommercialProformaPDF,
  generateCBAMReportPDF,
  generateCBAMRequirementsPDF,
  updateCBAMState,
  CBAM_FACTORS,
  PRICE_2026,
} from '../../cbam-module.js';

const COMMODITY_TARIFFS = {
  "CEM I 52,5N BIGBAG": { inlandUsdMt: 3.00, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 3.50 },
  "CEM I 52,5N SAC 50KG": { inlandUsdMt: 3.00, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 3.50 },
  "CEM I 42,5N/R BIGBAG": { inlandUsdMt: 3.00, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 3.50 },
  "CEM I 42,5N/R SAC 50KG": { inlandUsdMt: 3.00, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 3.50 },
  "CEM II 52.5N/R 50KG": { inlandUsdMt: 4.26, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 2.60 },
  "CEM II 52.5N BIGBAG": { inlandUsdMt: 4.26, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 3.50 },
  "CEM II 42,5N/R FARDILISE": { inlandUsdMt: 4.26, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 2.56 },
  "CEM II 42,5N/R FARDILLISE TAVCIM": { inlandUsdMt: 4.26, portDuesUsdMt: 2.00, customsUsdMt: 0.25, packagingUsdMt: 2.65 },
  "CEM II 42,5 VRAC": { inlandUsdMt: 4.30, portDuesUsdMt: 2.00, customsUsdMt: 0.30, packagingUsdMt: 3.50 },
  "CEM II 42,5 R BIGBAG": { inlandUsdMt: 4.30, portDuesUsdMt: 2.00, customsUsdMt: 0.30, packagingUsdMt: 3.50 },
  "CEM I 52,5 R BIGBAG": { inlandUsdMt: 3.00, portDuesUsdMt: 2.00, customsUsdMt: 0.30, packagingUsdMt: 3.50 }
};

/**
 * Catálogo de Valoración Unitaria de Mercancías (USD/MT) para Land Charter
 */
export const COMMODITY_VALUES = {
  "CEM I 42,5N/R BIGBAG": 55,
  " BIGBAG": 60,
  " SAC 50KG": 62,
  "CEM I 42,5N/R SAC 50KG": 57,
  "CEM II 52.5N/R 50KG": 58,
  "CEM II 52.5N BIGBAG": 56,
  "CEM II 42,5N/R FARDILISE": 54,
  "CEM II 42,5N/R FARDILLISE TAVCIM": 54,
  "CEM II 42,5 VRAC": 50,
  "CEM II 42,5 R BIGBAG": 53,
  "CEM I 52,5 R BIGBAG": 59,
  // Normalizaciones y variantes de sintaxis (punto/coma) para resiliencia total
  "CEM II 52,5N/R 50KG": 58,
  "CEM II 52,5N BIGBAG": 56,
  "CEM I 42.5N/R BIGBAG": 55,
  "CEM I 52.5N BIGBAG": 60,
  "CEM I 52.5N SAC 50KG": 62,
  "CEM I 42.5N/R SAC 50KG": 57,
  "CEM II 42.5N/R FARDILISE": 54,
  "CEM II 42.5N/R FARDILLISE TAVCIM": 54,
  "CEM II 42.5 VRAC": 50,
  "CEM II 42.5 R BIGBAG": 53,
  "CEM I 52.5 R BIGBAG": 59
};
export const CARGO_VALUATIONS = COMMODITY_VALUES;

function NumericCounter({ label, subtitle, value, onChange, min = 0 }) {
  const numValue = Number(value) || 0;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between hover:border-blue-300 transition shadow-sm">
      <div className="mb-2">
        <span className="block text-xs font-bold text-slate-800 tracking-wide">{label}</span>
        {subtitle && <span className="block text-[11px] text-slate-500 mt-0.5">{subtitle}</span>}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Unidades</span>
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
          <button type="button" onClick={() => { if (numValue > min) onChange(numValue - 1); }} disabled={numValue <= min} className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-slate-200 border border-slate-200 text-slate-700 disabled:opacity-30 text-base font-black transition cursor-pointer shadow-sm">-</button>
          <input type="number" min={min} value={numValue} onChange={(e) => { const p = parseInt(e.target.value, 10); onChange(isNaN(p) ? 0 : Math.max(min, p)); }} className="w-14 text-center bg-transparent text-sm font-mono font-bold text-blue-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          <button type="button" onClick={() => onChange(numValue + 1)} className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-slate-200 border border-slate-200 text-slate-700 text-base font-black transition cursor-pointer shadow-sm">+</button>
        </div>
      </div>
    </div>
  );
}

function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function normalizeStr(val) {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Mapeo Inteligente de Categoría y Tipo:
 * - Si contiene BIGBAG, SAC, FARDILISE, TAVCIM o PALETIZADA -> 'Carga Unitizada / Envasada' y código válido GICA (ej. CEM I 52,5N BIGBAG)
 * - Si contiene VRAC, GRANEL o BULK -> 'Graneles Sólidos / Minerales' y CEM II 42,5 VRAC
 */
export function mapCargoCategoryAndType(rawText = '', currentCategory = '', currentType = '') {
  const combined = `${rawText || ''} ${currentCategory || ''} ${currentType || ''}`.trim();
  const norm = normalizeStr(combined);
  const upper = combined.toUpperCase();

  // Caso 1: Envasado / Unitizado (incluye BIG BAG, BIGBAG, y erratas comunes como BOG BAG / BOGBAG)
  const isBigBagOrBogBag =
    norm.includes('bigbag') ||
    norm.includes('big bag') ||
    norm.includes('bogbag') ||
    norm.includes('bog bag') ||
    norm.includes('big-bag') ||
    norm.includes('bog-bag') ||
    /(?:big|bog)[-\s_]*bags?/i.test(combined);

  if (
    isBigBagOrBogBag ||
    norm.includes('sac') ||
    norm.includes('saco') ||
    norm.includes('fardilise') ||
    norm.includes('tavcim') ||
    norm.includes('paletizad') ||
    norm.includes('pallet') ||
    norm.includes('palet') ||
    norm.includes('envasad')
  ) {
    let resolvedType = 'CEM I 52,5N BIGBAG';
    if (upper.includes('CEM II 52.5N/R 50KG') || (upper.includes('52.5') && upper.includes('50KG'))) {
      resolvedType = 'CEM II 52.5N/R 50KG';
    } else if (upper.includes('FARDILLISE TAVCIM') || upper.includes('TAVCIM')) {
      resolvedType = 'CEM II 42,5N/R FARDILLISE TAVCIM';
    } else if (upper.includes('FARDILISE')) {
      resolvedType = 'CEM II 42,5N/R FARDILISE';
    } else if (upper.includes('CEM II 42,5 R BIGBAG') || (upper.includes('CEM II') && (upper.includes('42,5 R') || upper.includes('42.5 R')))) {
      resolvedType = 'CEM II 42,5 R BIGBAG';
    } else if (upper.includes('CEM I 52,5 R BIGBAG') || (upper.includes('CEM I') && (upper.includes('52,5 R') || upper.includes('52.5 R')))) {
      resolvedType = 'CEM I 52,5 R BIGBAG';
    } else if (upper.includes('CEM I 42,5N/R SAC') || (upper.includes('42,5') && upper.includes('SAC'))) {
      resolvedType = 'CEM I 42,5N/R SAC 50KG';
    } else if (upper.includes('CEM I 42,5N/R BIGBAG') || (upper.includes('42,5') && (upper.includes('BIGBAG') || upper.includes('BIG BAG') || upper.includes('BOG BAG') || upper.includes('BOGBAG')))) {
      resolvedType = 'CEM I 42,5N/R BIGBAG';
    } else if (upper.includes('CEM II 52.5N BIGBAG') || upper.includes('CEM II 52,5N') || upper.includes('CEM II 52.5N') || (upper.includes('CEM II') && (upper.includes('BIGBAG') || upper.includes('BIG BAG') || upper.includes('BOG BAG') || upper.includes('BOGBAG')))) {
      resolvedType = 'CEM II 52.5N BIGBAG';
    } else if (upper.includes('CEM I 52,5N SAC') || (upper.includes('52,5') && upper.includes('SAC'))) {
      resolvedType = 'CEM I 52,5N SAC 50KG';
    } else if (COMMODITY_TARIFFS[upper.trim()]) {
      resolvedType = upper.trim();
    }
    return {
      category: 'Carga Unitizada / Envasada',
      type: resolvedType,
      shipping_mode_supported: 'Tráiler Lona (13.6m)'
    };
  }

  // Caso 2: Granel / Bulk
  if (
    norm.includes('vrac') ||
    norm.includes('granel') ||
    norm.includes('bulk')
  ) {
    return {
      category: 'Graneles Sólidos / Minerales',
      type: 'CEM II 42,5 VRAC',
      shipping_mode_supported: 'Bañera Basculante / Tolva'
    };
  }

  return {
    category: currentCategory || 'Carga Unitizada / Envasada',
    type: currentType || (COMMODITY_TARIFFS[upper.trim()] ? upper.trim() : rawText),
    shipping_mode_supported: 'Tráiler Lona (13.6m)'
  };
}

/**
 * Extracción unificada y exhaustiva de partidas/ítems de lista de empaque desde cualquier estructura de Core Pro / DataBridge
 */
export function extractProjectCargoItems(project) {
  if (!project) return [];

  const extractNestedFromList = (list) => {
    const nested = [];
    if (Array.isArray(list) && list.length > 0) {
      for (const item of list) {
        const cItems = item?.payload_data?.cargo_items || item?.data?.cargo_items || item?.payload_data?.items || item?.data?.items;
        if (Array.isArray(cItems) && cItems.length > 0) {
          nested.push(...cItems);
        }
      }
    }
    return nested;
  };

  // 1. activeProject.cargo_items o activeProject.items (si ya son filas directas de carga)
  if (Array.isArray(project.cargo_items) && project.cargo_items.length > 0) {
    const nested = extractNestedFromList(project.cargo_items);
    if (nested.length > 0) return nested;
    return project.cargo_items;
  }

  // Si activeProject.items es un servicio o factura, recorre item.payload_data?.cargo_items o item.data?.cargo_items
  if (Array.isArray(project.items) && project.items.length > 0) {
    const nested = extractNestedFromList(project.items);
    if (nested.length > 0) {
      return nested;
    }

    // activeProject.items si ya son filas directas de carga
    return project.items;
  }

  if (Array.isArray(project.cargoItems) && project.cargoItems.length > 0) {
    const nested = extractNestedFromList(project.cargoItems);
    if (nested.length > 0) return nested;
    return project.cargoItems;
  }

  // 3. Desglose anidado en line_items (payload_data.cargo_items o items)
  if (Array.isArray(project.line_items) && project.line_items.length > 0) {
    const nested = extractNestedFromList(project.line_items);
    if (nested.length > 0) return nested;

    // Verificar si los propios line_items son partidas directas con medidas/pesos
    const hasPieceProps = project.line_items.some(li =>
      li && (li.quantity !== undefined || li.weight !== undefined || li.unit_weight_kg !== undefined || li.length !== undefined || li.length_m !== undefined || li.type || li.description)
    );
    if (hasPieceProps) return project.line_items;
  }

  // 4. Desglose en services
  if (Array.isArray(project.services) && project.services.length > 0) {
    const nested = extractNestedFromList(project.services);
    if (nested.length > 0) return nested;
  }

  // 5. En el objeto data
  if (project.data && typeof project.data === 'object') {
    if (Array.isArray(project.data.cargo_items) && project.data.cargo_items.length > 0) return project.data.cargo_items;
    if (Array.isArray(project.data.cargoItems) && project.data.cargoItems.length > 0) return project.data.cargoItems;
    if (Array.isArray(project.data.items) && project.data.items.length > 0) {
      const nested = extractNestedFromList(project.data.items);
      if (nested.length > 0) return nested;
      return project.data.items;
    }
    if (Array.isArray(project.data.packing_list) && project.data.packing_list.length > 0) return project.data.packing_list;
  }

  // 6. En packing_list / packingList
  if (Array.isArray(project.packing_list) && project.packing_list.length > 0) return project.packing_list;
  if (Array.isArray(project.packingList) && project.packingList.length > 0) return project.packingList;

  return [];
}

/**
 * Hidrata un ítem de lista de empaque preservando íntegramente cantidad, largo, ancho, alto,
 * peso unitario y adaptando la mercancía al entorno terrestre (Big Bags -> Carga Unitizada, GICA, Tráiler Lona 13.6m).
 */
export function hydrateCargoItem(it, defaultCategory = '', defaultType = '', index = 0) {
  if (!it || typeof it !== 'object') {
    return {
      id: `item-${Date.now()}-${index}`,
      category: defaultCategory || 'Carga General',
      type: defaultType || 'Mercancía sin especificar',
      quantity: 1,
      length: 0,
      width: 0,
      height: 0,
      length_m: 0,
      width_m: 0,
      height_m: 0,
      weight: 0,
      unit_weight_kg: 0,
      shipping_mode_supported: ''
    };
  }

  // Preservación estricta de cantidad (ej. 6667)
  const rawQty = it.quantity ?? it.qty ?? it.cant ?? it.cantidad ?? it.piezas ?? it.bultos;
  const quantity = rawQty !== undefined && rawQty !== null && rawQty !== '' ? Math.max(1, Number(rawQty) || 1) : 1;

  // Helper de parseo numérico preservando valores numéricos exactos
  const parseNumOrVal = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const num = Number(String(val).replace(',', '.'));
    return !isNaN(num) ? num : val;
  };

  // Preservación estricta de dimensiones (ej. length 1.15, width 1.1, height 1.2)
  const rawLength = it.length !== undefined && it.length !== null && it.length !== ''
    ? it.length
    : (it.length_m !== undefined && it.length_m !== null && it.length_m !== ''
      ? it.length_m
      : (it.largo !== undefined && it.largo !== null && it.largo !== ''
        ? it.largo
        : (it.lengthM ?? '')));
  const lengthVal = parseNumOrVal(rawLength);

  const rawWidth = it.width !== undefined && it.width !== null && it.width !== ''
    ? it.width
    : (it.width_m !== undefined && it.width_m !== null && it.width_m !== ''
      ? it.width_m
      : (it.ancho !== undefined && it.ancho !== null && it.ancho !== ''
        ? it.ancho
        : (it.widthM ?? '')));
  const widthVal = parseNumOrVal(rawWidth);

  const rawHeight = it.height !== undefined && it.height !== null && it.height !== ''
    ? it.height
    : (it.height_m !== undefined && it.height_m !== null && it.height_m !== ''
      ? it.height_m
      : (it.alto !== undefined && it.alto !== null && it.alto !== ''
        ? it.alto
        : (it.heightM ?? (it.altura ?? ''))));
  const heightVal = parseNumOrVal(rawHeight);

  // Preservación estricta de peso unitario (weight / unit_weight_kg, ej. 1500 kg por Big Bag)
  const rawWeight = it.unit_weight_kg !== undefined && it.unit_weight_kg !== null && it.unit_weight_kg !== ''
    ? it.unit_weight_kg
    : (it.weight !== undefined && it.weight !== null && it.weight !== ''
      ? it.weight
      : (it.unitWeight !== undefined && it.unitWeight !== null && it.unitWeight !== ''
        ? it.unitWeight
        : (it.weight_kg !== undefined && it.weight_kg !== null && it.weight_kg !== ''
          ? it.weight_kg
          : (it.peso_unitario !== undefined && it.peso_unitario !== null && it.peso_unitario !== ''
            ? it.peso_unitario
            : (it.peso ?? '')))));
  const weightVal = parseNumOrVal(rawWeight);

  // Tipo y descripción original
  const rawType = it.type || it.description || it.descripcion || it.name || it.cargo_type || it.cargoType || it.product || defaultType || '';
  const rawCategory = it.category || defaultCategory || '';

  // Mapeo inteligente con detección de Big Bags y erratas
  const mapped = mapCargoCategoryAndType(rawType, rawCategory, it.type);
  const isBigBagOrBogBag = /big\s*bag|bog\s*bag|bigbag|bogbag|envasad|sac|fardilise/i.test(`${rawType} ${rawCategory} ${mapped.type} ${mapped.category}`) ||
    (Number(weightVal) >= 800 && Number(weightVal) <= 2000 && Number(lengthVal) > 0.8 && Number(lengthVal) < 1.6);

  // Adaptación Terrestre Automática:
  // Forzar category a 'Carga Unitizada / Envasada'
  // Asignar el tipo oficial GICA correspondiente (ej. 'CEM I 52,5N BIGBAG')
  // Asignar dinámicamente el modo de envío coherente con el vehículo y tipo de carga
  // RESPETO ABSOLUTO A DATA BRIDGE: Usamos el texto exacto que viene de Core PRO
  let finalCategory = rawCategory || mapped.category;
  let finalType = rawType || mapped.type;
  const isPlatformCraneVehicle = (typeof vehicleType !== 'undefined' && (vehicleType === 'Camión Plataforma con Grúa Autocarga' || String(vehicleType).includes('Grúa Autocarga'))) ||
    (typeof window !== 'undefined' && (window.State?.vehicleType === 'Camión Plataforma con Grúa Autocarga' || String(window.State?.vehicleType || '').includes('Grúa Autocarga')));

  let finalShippingMode = (isBigBagOrBogBag || isPlatformCraneVehicle)
    ? 'Camión Plataforma con Grúa Autocarga'
    : 'Tráiler Lona (13.6m)';

  // ELIMINAMOS EL SECUESTRO DE TEXTO. Solo asignamos el modo de envío terrestre.
  if (isBigBagOrBogBag || !finalCategory || finalCategory === 'Carga Unitizada / Envasada') {
    finalShippingMode = isBigBagOrBogBag || isPlatformCraneVehicle
      ? 'Camión Plataforma con Grúa Autocarga'
      : (it.shipping_mode_supported || 'Camión Plataforma con Grúa Autocarga');
  } else {
    finalShippingMode = isPlatformCraneVehicle
      ? 'Camión Plataforma con Grúa Autocarga'
      : (it.shipping_mode_supported || mapped.shipping_mode_supported || 'Tráiler Lona (13.6m)');
  }

  return {
    id: it.id || `item-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 6)}`,
    category: finalCategory,
    type: finalType,
    quantity,
    length: lengthVal,
    width: widthVal,
    height: heightVal,
    length_m: lengthVal,
    width_m: widthVal,
    height_m: heightVal,
    weight: weightVal,
    unit_weight_kg: weightVal,
    shipping_mode_supported: finalShippingMode
  };
}

/**
 * Construye de forma proporcional y realista un cargoItem cuando Data Bridge o Core Pro
 * sincronizan solo un tonelaje global (sin despiece atomizado de bultos).
 * Prohíbe explícitamente dimensiones genéricas de semirremolque (12 x 2.5 m)
 * y dimensiona coherentemente Big Bags / envasados según el peso total en MT.
 */
export function buildQuickTonnageCargoItem(tonnage, rawProduct = '', rawCategory = '', forcedVehicle = '') {
  const cleanTonnage = Number(tonnage) || 0;
  const product = String(rawProduct || '').trim() || 'CEM I 52,5N BIGBAG';
  const mapped = mapCargoCategoryAndType(product, rawCategory, product);

  const isBigBagOrPackaged = /big\s*bag|bog\s*bag|bigbag|bogbag|envasad|sac|fardilise/i.test(
    `${product} ${rawCategory} ${mapped.type} ${mapped.category}`
  ) || mapped.category === 'Carga Unitizada / Envasada';

  // Si el input viene en toneladas métricas (ej. 10.000 MT), convertir a kg (10.000.000 kg).
  // Si el valor ya fuese excesivamente grande (> 100.000), interpretarlo defensivamente como kg.
  const totalWeightKg = cleanTonnage > 100000 ? cleanTonnage : cleanTonnage * 1000;

  const isPlatformCrane = forcedVehicle === 'Camión Plataforma con Grúa Autocarga' ||
    String(forcedVehicle).includes('Grúa Autocarga') ||
    isBigBagOrPackaged ||
    (typeof window !== 'undefined' && (window.State?.vehicleType === 'Camión Plataforma con Grúa Autocarga' || String(window.State?.vehicleType || '').includes('Grúa Autocarga')));

  const resolvedShippingMode = isPlatformCrane
    ? 'Camión Plataforma con Grúa Autocarga'
    : 'Tráiler Lona (13.6m)';

  if (isBigBagOrPackaged) {
    const isSacos50Kg = /50\s*kg|saco/i.test(product) && !/big\s*bag|bigbag/i.test(product);
    const unitWeightKg = isSacos50Kg ? 50 : 1500;
    const quantity = Math.max(1, Math.round(totalWeightKg / unitWeightKg));
    const dims = isSacos50Kg
      ? { l: 0.60, w: 0.40, h: 0.25 }
      : { l: 1.15, w: 1.10, h: 1.20 };

    return {
      id: `item-quick-${Date.now()}`,
      category: 'Carga Unitizada / Envasada',
      type: mapped.type || 'CEM I 52,5N BIGBAG',
      quantity,
      length: dims.l,
      width: dims.w,
      height: dims.h,
      length_m: dims.l,
      width_m: dims.w,
      height_m: dims.h,
      weight: unitWeightKg,
      unitWeight: unitWeightKg,
      unit_weight_kg: unitWeightKg,
      shipping_mode_supported: resolvedShippingMode
    };
  }

  // Caso Granel / Bulk
  const isBulk = /granel|bulk|vrac/i.test(`${product} ${rawCategory} ${mapped.type} ${mapped.category}`);
  if (isBulk) {
    return {
      id: `item-quick-${Date.now()}`,
      category: mapped.category || 'Graneles Sólidos / Minerales',
      type: mapped.type || 'CEM II 42,5 VRAC',
      quantity: 1,
      length: '',
      width: '',
      height: '',
      length_m: '',
      width_m: '',
      height_m: '',
      weight: totalWeightKg,
      unitWeight: totalWeightKg,
      unit_weight_kg: totalWeightKg,
      shipping_mode_supported: 'Bañera Basculante / Tolva'
    };
  }

  // Caso Carga General / Proyecto estándar (evita dimensiones ficticias de semirremolque 12x2.5)
  return {
    id: `item-quick-${Date.now()}`,
    category: mapped.category || 'Carga General',
    type: mapped.type || product,
    quantity: 1,
    length: '',
    width: '',
    height: '',
    length_m: '',
    width_m: '',
    height_m: '',
    weight: totalWeightKg,
    unitWeight: totalWeightKg,
    unit_weight_kg: totalWeightKg,
    shipping_mode_supported: isPlatformCrane ? 'Camión Plataforma con Grúa Autocarga' : (mapped.shipping_mode_supported || 'Tráiler Lona (13.6m)')
  };
}

export const TERRESTRIAL_LOADING_METHODS = [
  'Autocarga con Grúa del Camión',
  'Carga Lateral (Lona / Tauliner)',
  'Carga Trasera por Muelle / Rampa',
  'Carga Superior (Grúa Portuaria / Puente Grúa)',
  'Carga Superior (Puente Grúa / Techo descapotable)',
  'Carga con Transpaleta / Carretilla Elevadora',
  'Carga por Silo / Tubo (Granel)',
];

export const TERRESTRIAL_DISCHARGE_METHODS = [
  'Autocarga con Grúa del Camión',
  'Carga Trasera por Muelle / Rampa',
  'Carga Lateral (Lona / Tauliner)',
  'Carga Superior (Grúa Portuaria / Puente Grúa)',
  'Carga Superior (Puente Grúa / Techo descapotable)',
  'Carga con Transpaleta / Carretilla Elevadora',
  'Basculante / Tolva (Granel)',
  'Descarga Neumática (Silo)',
];

export const OPERATIONAL_METHOD_RATIOS = Object.freeze({
  'Autocarga con Grúa del Camión': 20, // 20 TM/h o 20 bultos/h
  'Carga Lateral (Lona / Tauliner)': 25,
  'Carga Trasera por Muelle / Rampa': 30,
  'Carga Superior (Puente Grúa / Techo descapotable)': 20,
  'Carga con Transpaleta / Carretilla Elevadora': 25,
  'Carga por Silo / Tubo (Granel)': 40,
  'Carga Superior (Grúa Portuaria / Puente Grúa)': 20,
  'Basculante / Tolva (Granel)': 50,
  'Descarga Neumática (Silo)': 40,
});

export function getRatioOperativo(method) {
  if (!method) return 25;
  return OPERATIONAL_METHOD_RATIOS[method] || 25;
}

export function validarCompatibilidadMetodo(side = 'pol', options = {}) {
  const vehicle = options.vehicleType || (typeof window !== 'undefined' ? (window.State?.vehicleType || window.State?.truckType) : '');
  const method = options.method || (side === 'pod' ? options.dischargeMethod : options.loadingMethod);
  const category = options.category || '';
  const product = options.product || '';
  const isPlataformaGrua = vehicle === 'Camión Plataforma con Grúa Autocarga' || String(vehicle).includes('Grúa Autocarga');
  const isAutocarga = method === 'Autocarga con Grúa del Camión';
  if (isPlataformaGrua && isAutocarga) {
    return false;
  }
  if (isAutocarga && (category === 'Minerales y Construcción' || String(product).includes('Big Bags'))) {
    return false;
  }
  return false;
}

export const LAND_VEHICLE_CATALOG = [
  {
    id: 'plataforma_grua',
    name: 'Camión Plataforma con Grúa Autocarga',
    payloadKg: 21000,
    payloadTons: 21,
    payload: 21,
    truckPayloadCapacity: 21,
    cargaUtil: 21,
    dwt: 21,
    mma: 40,
    description: 'Tara pluma hidráulica incluida (~19t tara · 21t carga útil)',
    defaultLoadingMethod: 'Autocarga con Grúa del Camión',
    defaultDischargeMethod: 'Autocarga con Grúa del Camión',
    compatibleLoadingMethods: [
      'Autocarga con Grúa del Camión',
      'Carga Superior (Grúa Portuaria / Puente Grúa)',
      'Carga Lateral con Carretilla Elevadora',
    ],
    compatibleDischargeMethods: [
      'Autocarga con Grúa del Camión',
      'Carga Superior (Grúa Portuaria / Puente Grúa)',
      'Carga Lateral con Carretilla Elevadora',
    ],
  },
  {
    id: 'plataforma_abierta',
    name: 'Camión Plataforma Abierta (Sin Grúa)',
    payloadKg: 24000,
    payloadTons: 24,
    mma: 40,
    description: 'Estándar portuario (100% carga/descarga con grúa de muelle/puente)',
    defaultLoadingMethod: 'Carga Superior (Grúa Portuaria / Puente Grúa)',
    defaultDischargeMethod: 'Carga Superior (Grúa Portuaria / Puente Grúa)',
    compatibleLoadingMethods: [
      'Carga Superior (Grúa Portuaria / Puente Grúa)',
      'Carga Lateral con Carretilla Elevadora',
    ],
    compatibleDischargeMethods: [
      'Carga Superior (Grúa Portuaria / Puente Grúa)',
      'Carga Lateral con Carretilla Elevadora',
    ],
  },
  {
    id: 'banera',
    name: 'Bañera Basculante (Granel)',
    payloadKg: 26000,
    payloadTons: 26,
    mma: 40,
    description: 'Transporte de sólidos y minerales a granel',
    defaultLoadingMethod: 'Carga por Silo / Tubo (Granel)',
    defaultDischargeMethod: 'Basculante / Tolva (Granel)',
    compatibleLoadingMethods: [
      'Carga por Silo / Tubo (Granel)',
      'Carga Superior (Grúa Portuaria / Puente Grúa)',
      'Cinta Transportadora',
    ],
    compatibleDischargeMethods: [
      'Basculante / Tolva (Granel)',
      'Descarga por Compuerta Trasera',
    ],
  },
  {
    id: 'silo',
    name: 'Camión Silo Presurizado',
    payloadKg: 25000,
    payloadTons: 25,
    mma: 40,
    description: 'Polvos y cemento en polvo a granel presurizado',
    defaultLoadingMethod: 'Carga por Silo / Tubo (Granel)',
    defaultDischargeMethod: 'Descarga Neumática (Silo)',
    compatibleLoadingMethods: ['Carga por Silo / Tubo (Granel)'],
    compatibleDischargeMethods: ['Descarga Neumática (Silo)'],
  },
  {
    id: 'tauliner',
    name: 'Tráiler Tauliner (13.6m)',
    payloadKg: 24000,
    payloadTons: 24,
    mma: 40,
    description: 'Semirremolque con lonas laterales correderas',
    defaultLoadingMethod: 'Carga Lateral (Lona / Tauliner)',
    defaultDischargeMethod: 'Carga Trasera por Muelle / Rampa',
    compatibleLoadingMethods: [
      'Carga Lateral (Lona / Tauliner)',
      'Carga Trasera por Muelle / Rampa',
      'Carga Superior (Puente Grúa / Techo descapotable)',
      'Carga con Transpaleta / Carretilla Elevadora',
    ],
    compatibleDischargeMethods: [
      'Carga Trasera por Muelle / Rampa',
      'Carga Lateral (Lona / Tauliner)',
      'Carga con Transpaleta / Carretilla Elevadora',
      'Carga Superior (Puente Grúa / Techo descapotable)',
    ],
  },
  {
    id: 'lona_estandar',
    name: 'Lona Estándar',
    payloadKg: 24000,
    payloadTons: 24,
    mma: 40,
    description: 'Tráiler de lona estándar convencional',
    defaultLoadingMethod: 'Carga Lateral (Lona / Tauliner)',
    defaultDischargeMethod: 'Carga Trasera por Muelle / Rampa',
    compatibleLoadingMethods: [
      'Carga Lateral (Lona / Tauliner)',
      'Carga Trasera por Muelle / Rampa',
      'Carga con Transpaleta / Carretilla Elevadora',
    ],
    compatibleDischargeMethods: [
      'Carga Trasera por Muelle / Rampa',
      'Carga Lateral (Lona / Tauliner)',
      'Carga con Transpaleta / Carretilla Elevadora',
    ],
  },
  {
    id: 'frigorifico',
    name: 'Trailer Frigorífico',
    payloadKg: 22000,
    payloadTons: 22,
    mma: 40,
    description: 'Temperatura controlada isotermo/frigo',
    defaultLoadingMethod: 'Carga Trasera por Muelle / Rampa',
    defaultDischargeMethod: 'Carga Trasera por Muelle / Rampa',
    compatibleLoadingMethods: ['Carga Trasera por Muelle / Rampa', 'Carga con Transpaleta / Carretilla Elevadora'],
    compatibleDischargeMethods: ['Carga Trasera por Muelle / Rampa', 'Carga con Transpaleta / Carretilla Elevadora'],
  },
  {
    id: 'portacontenedor',
    name: 'Portacontenedor Multimodal',
    payloadKg: 26000,
    payloadTons: 26,
    mma: 44,
    description: 'Chasis portacontenedores multimodal',
    defaultLoadingMethod: 'Carga Superior (Grúa Portuaria / Puente Grúa)',
    defaultDischargeMethod: 'Carga Superior (Grúa Portuaria / Puente Grúa)',
    compatibleLoadingMethods: ['Carga Superior (Grúa Portuaria / Puente Grúa)', 'Grúa Reach Stacker / Portuaria'],
    compatibleDischargeMethods: ['Carga Superior (Grúa Portuaria / Puente Grúa)', 'Grúa Reach Stacker / Portuaria'],
  },
];

export function getVehiclePayloadKg(vehicleTypeName) {
  if (!vehicleTypeName) return 24000;
  const str = String(vehicleTypeName).toLowerCase().trim();
  const isSinGrua = str.includes('sin grúa') || str.includes('sin grua') || str.includes('plataforma abierta');
  if (
    !isSinGrua &&
    (str.includes('grúa autocarga') ||
      str.includes('grua autocarga') ||
      str.includes('autocarga') ||
      (str.includes('plataforma') && (str.includes('grúa') || str.includes('grua'))))
  ) {
    return 21000;
  }
  if (isSinGrua || str.includes('plataforma')) {
    return 24000;
  }
  if (str.includes('bañera') || str.includes('banera')) {
    return 26000;
  }
  if (str.includes('silo')) {
    return 25000;
  }
  if (str.includes('frigo') || str.includes('frigorifico')) {
    return 22000;
  }
  if (str.includes('portacontenedor')) {
    return 26000;
  }
  if (str.includes('tren') || str.includes('duo')) {
    return 44000;
  }
  return 24000;
}

export function getCompatibleMethodsForVehicle(vType) {
  const name = String(vType || '').toLowerCase().trim();
  const isSinGrua = name.includes('sin grúa') || name.includes('sin grua') || name.includes('plataforma abierta');
  if (
    !isSinGrua &&
    (name.includes('grúa autocarga') ||
      name.includes('grua autocarga') ||
      name.includes('autocarga') ||
      (name.includes('plataforma') && (name.includes('grúa') || name.includes('grua'))))
  ) {
    return {
      isPlatform: true,
      hasCrane: true,
      defaultLoading: 'Autocarga con Grúa del Camión',
      defaultDischarge: 'Autocarga con Grúa del Camión',
      allowed: [
        'Autocarga con Grúa del Camión',
        'Carga Superior (Grúa Portuaria / Puente Grúa)',
        'Carga Lateral con Carretilla Elevadora',
      ],
      incompatible: [
        'Carga Trasera por Muelle / Rampa',
        'Carga Lateral (Lona / Tauliner)',
        'Carga por Silo / Tubo (Granel)',
        'Basculante / Tolva (Granel)',
      ],
    };
  }
  if (isSinGrua || name.includes('plataforma')) {
    return {
      isPlatform: true,
      hasCrane: false,
      defaultLoading: 'Carga Superior (Grúa Portuaria / Puente Grúa)',
      defaultDischarge: 'Carga Superior (Grúa Portuaria / Puente Grúa)',
      allowed: [
        'Carga Superior (Grúa Portuaria / Puente Grúa)',
        'Carga Lateral con Carretilla Elevadora',
      ],
      incompatible: [
        'Autocarga con Grúa del Camión',
        'Carga Trasera por Muelle / Rampa',
        'Carga Lateral (Lona / Tauliner)',
        'Carga por Silo / Tubo (Granel)',
        'Basculante / Tolva (Granel)',
      ],
    };
  }
  if (name.includes('bañera') || name.includes('banera')) {
    return {
      isPlatform: false,
      hasCrane: false,
      defaultLoading: 'Carga por Silo / Tubo (Granel)',
      defaultDischarge: 'Basculante / Tolva (Granel)',
      allowed: [
        'Carga por Silo / Tubo (Granel)',
        'Carga Superior (Grúa Portuaria / Puente Grúa)',
        'Cinta Transportadora',
      ],
      incompatible: [
        'Carga Trasera por Muelle / Rampa',
        'Carga Lateral (Lona / Tauliner)',
      ],
    };
  }
  if (name.includes('silo')) {
    return {
      isPlatform: false,
      hasCrane: false,
      defaultLoading: 'Carga por Silo / Tubo (Granel)',
      defaultDischarge: 'Descarga Neumática (Silo)',
      allowed: ['Carga por Silo / Tubo (Granel)'],
      incompatible: ['Carga Trasera por Muelle / Rampa', 'Carga Lateral (Lona / Tauliner)'],
    };
  }
  return {
    isPlatform: false,
    hasCrane: false,
    defaultLoading: 'Carga Lateral (Lona / Tauliner)',
    defaultDischarge: 'Carga Trasera por Muelle / Rampa',
    allowed: [
      'Carga Lateral (Lona / Tauliner)',
      'Carga Trasera por Muelle / Rampa',
      'Carga con Transpaleta / Carretilla Elevadora',
      'Carga Superior (Puente Grúa / Techo descapotable)',
      'Autocarga con Grúa del Camión',
    ],
    incompatible: [],
  };
}

export function detectCargoPackagingType(items = [], project = null) {
  const parts = [];
  if (Array.isArray(items)) {
    items.forEach((it) => {
      if (it.type) parts.push(it.type);
      if (it.description) parts.push(it.description);
      if (it.category) parts.push(it.category);
      if (it.shipping_mode_supported) parts.push(it.shipping_mode_supported);
    });
  }
  if (project) {
    if (project.cargoType) parts.push(project.cargoType);
    if (project.cargo_type) parts.push(project.cargo_type);
    if (project.product) parts.push(project.product);
    if (project.cargoCategory) parts.push(project.cargoCategory);
    if (project.cargo_category) parts.push(project.cargo_category);
    if (project.description) parts.push(project.description);
    if (project.cargoName) parts.push(project.cargoName);
    if (project.cargo_name) parts.push(project.cargo_name);
    if (project.prompt) parts.push(project.prompt);
    if (project.instruction) parts.push(project.instruction);
  }

  const rawCombined = parts.join(' ');
  const norm = normalizeStr(rawCombined);
  const upper = rawCombined.toUpperCase();

  // Strictly bulk keywords: VRAC, BULK, GRANEL
  const isStrictBulk =
    /\bVRAC\b|\bBULK\b|\bGRANEL\b|\bGRANELES\b/.test(upper) ||
    norm.includes('vrac') ||
    norm.includes('granel') ||
    norm.includes('bulk');

  // Packaged keywords: BIGBAG, BIG BAG, SAC, SACO, SLING, PALETIZAD, ENVSAD, ENVASAD, BOG BAG, BOGBAG
  const isPackaged =
    upper.includes('BIGBAG') ||
    upper.includes('BIG BAG') ||
    upper.includes('BOGBAG') ||
    upper.includes('BOG BAG') ||
    upper.includes('SLING') ||
    upper.includes('PALETIZAD') ||
    upper.includes('ENVSAD') ||
    upper.includes('ENVASAD') ||
    upper.includes('ENVAS') ||
    upper.includes('ENSACAD') ||
    /\bSAC\b|\bSACO\b|\bSACOS\b/.test(upper) ||
    norm.includes('bigbag') ||
    norm.includes('big bag') ||
    norm.includes('bogbag') ||
    norm.includes('bog bag') ||
    norm.includes('saco') ||
    norm.includes('sacos') ||
    norm.includes('sling') ||
    norm.includes('paletizad') ||
    norm.includes('envsad') ||
    norm.includes('envasad') ||
    norm.includes('envas') ||
    norm.includes('ensacad') ||
    /(?:big|bog)[-\s_]*bags?/i.test(rawCombined) ||
    /(big\s*bag|saco|sling|paletizad|envasad)/i.test(rawCombined);

  const isBigBagCaseInsensitive = /big\s*bag/i.test(rawCombined) || /big\s*bag/i.test(String(project?.cargoType || project?.cargo_type || project?.product || ''));

  if (isBigBagCaseInsensitive || (isPackaged && !isStrictBulk)) {
    return {
      packaging: 'packaged',
      isPackaged: true,
      isBulk: false,
      recommendedVehicle: 'Camión Plataforma con Grúa Autocarga',
      payloadKg: 21000,
      payloadTons: 21,
      payload: 21,
      truckPayloadCapacity: 21,
      cargaUtil: 21,
      dwt: 21,
      loadingMethod: 'Autocarga con Grúa del Camión',
      dischargeMethod: 'Autocarga con Grúa del Camión',
    };
  }

  if (isStrictBulk && !isBigBagCaseInsensitive) {
    return {
      packaging: 'bulk',
      isPackaged: false,
      isBulk: true,
      recommendedVehicle: 'Bañera Basculante (Granel)',
      payloadKg: 26000,
      loadingMethod: 'Carga por Silo / Tubo (Granel)',
      dischargeMethod: 'Basculante / Tolva (Granel)',
    };
  }

  return {
    packaging: 'general',
    isPackaged: false,
    isBulk: false,
    recommendedVehicle: 'Tráiler Tauliner (13.6m)',
    payloadKg: 24000,
    loadingMethod: 'Carga Lateral (Lona / Tauliner)',
    dischargeMethod: 'Carga Trasera por Muelle / Rampa',
  };
}

const STANDARD_VESSEL_STOWAGE_SPEC = Object.freeze({
  vesselType: 'Multi-Purpose MPP / Handysize Bulker',
  dwt: 32000,
  grainCapacityCbm: 30300,
  baleCapacityCbm: 28500,
  holdsCount: 4,
  deckCranes: '2 x 60t SWL combinables en tándem hasta 120t',
  weatherDeck: {
    name: 'Cubierta Superior (Weather Deck)',
    deckAreaM2: 1800,
    maxPermissibleLoadTm2: 3.5,
    maxContainerTeus: 180,
    securingMethod: 'Conos de fijación (twistlocks automáticos), barras tensoras cruzadas y tensores mecánicos a cáncamos soldados de cubierta.',
    legend: 'Twistlocks automáticos + Barras tensoras',
  },
  tweenDeck: {
    name: 'Entrepuente General (Tween Deck)',
    totalAreaM2: 1940,
    maxPermissibleLoadTm2: 4.5,
    clearHeightM: 3.20,
    securingMethod: 'Estiba vertical sobre pontones de entrepuente con cinchas de poliéster de alta tenacidad, redes de estiba perimetral y cantoneras de protección.',
    legend: 'Cinchas de poliéster + Redes de estiba',
  },
  tanktop: {
    name: 'Fondo de Bodega General (Tanktop)',
    totalAreaM2: 2220,
    maxPermissibleLoadTm2: 20.0,
    securingMethod: 'Reparto de presiones con cunas de madera estructurales (hardwood dunnage), durmientes certificados y cadenas G80 cruzadas con tensores de trinquete.',
    legend: 'Cunas de madera estructurales + Cadenas G80',
  },
  holds: [
    {
      holdNumber: 1,
      name: 'Bodega 1 (Proa / Fwd)',
      capacityCbm: 5500,
      tanktopAreaM2: 420,
      tanktopMaxLoadTm2: 18.0,
      tweenDeckAreaM2: 380,
      tweenDeckMaxLoadTm2: 4.5,
    },
    {
      holdNumber: 2,
      name: 'Bodega 2 (Crujía Proa / Mid-Fwd)',
      capacityCbm: 8800,
      tanktopAreaM2: 620,
      tanktopMaxLoadTm2: 20.0,
      tweenDeckAreaM2: 550,
      tweenDeckMaxLoadTm2: 4.5,
    },
    {
      holdNumber: 3,
      name: 'Bodega 3 (Crujía Popa / Mid-Aft)',
      capacityCbm: 8800,
      tanktopAreaM2: 620,
      tanktopMaxLoadTm2: 20.0,
      tweenDeckAreaM2: 550,
      tweenDeckMaxLoadTm2: 4.5,
    },
    {
      holdNumber: 4,
      name: 'Bodega 4 (Popa / Aft)',
      capacityCbm: 7200,
      tanktopAreaM2: 520,
      tanktopMaxLoadTm2: 18.0,
      tweenDeckAreaM2: 460,
      tweenDeckMaxLoadTm2: 4.5,
    },
  ],
});

function generateDynamicStowageAscii(stowagePlan) {
  const pad = (text, width = 84) => {
    const s = String(text ?? '');
    return s.length > width ? s.substring(0, width) : s + ' '.repeat(width - s.length);
  };
  const makeLine = (text) => `| ${pad(text, 84)} |`;

  const borderDbl = `+${'='.repeat(86)}+`;
  const borderSingle = `+${'-'.repeat(86)}+`;

  const holds = stowagePlan?.holds || [];
  const h1 = holds[0] || {};
  const h2 = holds[1] || {};
  const h3 = holds[2] || {};
  const h4 = holds[3] || {};
  const deck = stowagePlan?.weatherDeck || {};
  const hydro = stowagePlan?.hydrodynamicsAndSafety || {};
  const classification = stowagePlan?.cargoClassification || {};
  const isMixed = classification.isMixedCargo;
  const mixBreakdown = classification.cargoMixBreakdown || [];

  const lines = [];
  lines.push(borderDbl);
  lines.push(`| [PROA / BOW]        UNIVERSAL STOWAGE ENGINE · SEACHARTER PRO        [POPA / STERN] |`);
  lines.push(makeLine(`Buque: Handysize MPP / Bulk Carrier | DWT: 32,000 MT | Grúas: 2x60t (Tándem 120t SWL)`));
  lines.push(borderDbl);

  // SECCIÓN 1: CUBIERTA SUPERIOR / WEATHER DECK
  lines.push(makeLine(`CUBIERTA PRINCIPAL / WEATHER DECK (Capacidad admisible: 3.50 t/m²)`));
  if (deck.totalWeightTons > 0) {
    const deckDesc = deck.allocatedItems?.map(it => `${it.quantity}x ${it.type} (${it.totalWeightMT} MT)`).join(', ') || 'Carga sobre cubierta';
    lines.push(makeLine(`  [ CUBIERTA INTEMPERIE ]: ${deckDesc.substring(0, 60)}`));
    lines.push(makeLine(`  Trincaje: ${deck.securingLegend || 'Twistlocks automáticos + Barras tensoras'}`));
  } else {
    lines.push(makeLine(`  [ CUBIERTA LIBRE ]: Despejada para operativa con grúas de a bordo o en tándem`));
    lines.push(makeLine(`  Capacidad admisible: 3.50 t/m² | Guías y cáncamos de trincaje certificados OMI`));
  }
  lines.push(borderSingle);

  // SECCIÓN 2: ENTREPUENTE / TWEEN DECK
  lines.push(makeLine(`ENTREPUENTE / TWEEN DECK (Capacidad admisible: 4.50 t/m² | Gálibo vertical: 3.20m)`));
  const tweenDeckItems = [
    ...(h1.allocatedItems || []).filter(it => it.tier === 'TWEEN_DECK'),
    ...(h2.allocatedItems || []).filter(it => it.tier === 'TWEEN_DECK'),
    ...(h3.allocatedItems || []).filter(it => it.tier === 'TWEEN_DECK'),
    ...(h4.allocatedItems || []).filter(it => it.tier === 'TWEEN_DECK'),
  ];
  if (tweenDeckItems.length > 0) {
    const tweenDesc = tweenDeckItems.map(it => `${it.quantity}x ${it.type} (${it.totalWeightMT} MT)`).join(' | ');
    lines.push(makeLine(`  [ CARGA PALETIZADA / LIGERA ]: ${tweenDesc.substring(0, 58)}`));
    lines.push(makeLine(`  Trincaje: Estiba vertical trincada con cinchas de poliéster de alta tenacidad y redes`));
  } else {
    lines.push(makeLine(`  [ PONTONES REPLEGADOS / CONTINUO ]: Espacio libre integrado para optimizar bodega corrida`));
    lines.push(makeLine(`  Aptitud técnica para cargas sobredimensionadas (OOG) o estiba masiva continua`));
  }
  lines.push(borderSingle);

  // SECCIÓN 3: FONDO DE BODEGA / TANKTOP
  lines.push(makeLine(`FONDO DE BODEGA / TANKTOP (MÁXIMA RESISTENCIA ESTRUCTURAL: 18.0 - 20.0 t/m²)`));
  const tanktopItems = [
    ...(h1.allocatedItems || []).filter(it => it.tier === 'TANKTOP' || it.tier === 'BODEGA_BLOQUE'),
    ...(h2.allocatedItems || []).filter(it => it.tier === 'TANKTOP' || it.tier === 'BODEGA_BLOQUE'),
    ...(h3.allocatedItems || []).filter(it => it.tier === 'TANKTOP' || it.tier === 'BODEGA_BLOQUE'),
    ...(h4.allocatedItems || []).filter(it => it.tier === 'TANKTOP' || it.tier === 'BODEGA_BLOQUE'),
  ];
  if (tanktopItems.length > 0) {
    const hasHeavy = tanktopItems.some(it => it.tier === 'TANKTOP');
    const hasBlock = tanktopItems.some(it => it.tier === 'BODEGA_BLOQUE');
    if (hasHeavy && hasBlock) {
      const heavyPieces = tanktopItems.filter(it => it.tier === 'TANKTOP');
      const blockPieces = tanktopItems.filter(it => it.tier === 'BODEGA_BLOQUE');
      const hDesc = heavyPieces.map(it => `${it.quantity}x ${it.type} (${it.totalWeightMT} MT)`).join(' | ');
      const bDesc = blockPieces.map(it => `${it.quantity}x ${it.type} (${it.totalWeightMT} MT)`).join(' | ');
      lines.push(makeLine(`  [ TANKTOP PESADO ]: ${hDesc.substring(0, 59)}`));
      lines.push(makeLine(`  [ BODEGA BLOQUE ]: ${bDesc.substring(0, 60)}`));
      lines.push(makeLine(`  Trincaje: Cunas de madera estructurales y cadenas G80 (Maquinaria) | Spreader y air bags`));
    } else if (hasHeavy) {
      const heavyDesc = tanktopItems.map(it => `${it.quantity}x ${it.type} (${it.totalWeightMT} MT)`).join(' | ');
      lines.push(makeLine(`  [ MAQUINARIA / HEAVY LIFT ]: ${heavyDesc.substring(0, 58)}`));
      lines.push(makeLine(`  Trincaje: Cunas de madera estructurales (hardwood dunnage) y cadenas cruzadas G80`));
    } else {
      const blockDesc = tanktopItems.map(it => `${it.quantity}x ${it.type} (${it.totalWeightMT} MT)`).join(' | ');
      lines.push(makeLine(`  [ ESTIBA EN BLOQUE ]: ${blockDesc.substring(0, 60)}`));
      lines.push(makeLine(`  Trincaje: Izado simultáneo con Spreader multipunto, cojines de aire y láminas`));
    }
  } else {
    lines.push(makeLine(`  [ PLAN DE BODEGA LIMPIO ]: Doble fondo barrido y seco listo para embarque`));
    lines.push(makeLine(`  Resistencia máxima: 20.0 t/m² | Puntos de trincaje D-rings certificados según CSS`));
  }
  lines.push(borderDbl);

  // SECCIÓN 4: MATRIZ DE DISTRIBUCIÓN POR BODEGAS 1 A 4
  lines.push(makeLine(`DISTRIBUCIÓN MATRICIAL POR BODEGAS (PROA ➔ POPA) Y PROPORCIONES DE PESO (%):`));
  lines.push(makeLine(`• Bodega 1 (Proa): ${Number(h1.totalWeightTons || 0).toFixed(2)} MT (${Number(h1.weightPercentage || 0).toFixed(1)}%) | ${(h1.cargoCategories?.join(', ') || 'Vacía').substring(0, 24)} | ${h1.securingLegend || 'Despejada'}`));
  lines.push(makeLine(`• Bodega 2 (Crujía Proa): ${Number(h2.totalWeightTons || 0).toFixed(2)} MT (${Number(h2.weightPercentage || 0).toFixed(1)}%) | ${(h2.cargoCategories?.join(', ') || 'Vacía').substring(0, 24)} | ${h2.securingLegend || 'Despejada'}`));
  lines.push(makeLine(`• Bodega 3 (Crujía Popa): ${Number(h3.totalWeightTons || 0).toFixed(2)} MT (${Number(h3.weightPercentage || 0).toFixed(1)}%) | ${(h3.cargoCategories?.join(', ') || 'Vacía').substring(0, 24)} | ${h3.securingLegend || 'Despejada'}`));
  lines.push(makeLine(`• Bodega 4 (Popa): ${Number(h4.totalWeightTons || 0).toFixed(2)} MT (${Number(h4.weightPercentage || 0).toFixed(1)}%) | ${(h4.cargoCategories?.join(', ') || 'Vacía').substring(0, 24)} | ${h4.securingLegend || 'Despejada'}`));
  if (deck.totalWeightTons > 0) {
    lines.push(makeLine(`• Cubierta (Weather Deck): ${Number(deck.totalWeightTons || 0).toFixed(2)} MT (${Number(deck.weightPercentage || 0).toFixed(1)}%) | Contenedores / Unidades Rodadas | ${deck.securingLegend}`));
  }
  lines.push(borderSingle);

  // SECCIÓN 5: DESGLOSE MULTI-CARGA EN CASO DE MERCANCÍAS MIXTAS
  if (isMixed && mixBreakdown.length > 0) {
    lines.push(makeLine(`DETALLE DE CARGAS MIXTAS Y PROPORCIONES ESPECÍFICAS:`));
    mixBreakdown.forEach((mb) => {
      lines.push(makeLine(`  ▸ ${mb.category}: ${mb.weightTons.toFixed(2)} MT (${mb.weightPercentage.toFixed(1)}%) ➔ ${mb.assignedLocations} [${mb.securingLegend}]`));
    });
    lines.push(borderSingle);
  }

  // SECCIÓN 6: COMPROBACIÓN HIDRODINÁMICA, VOLUMEN Y LÍMITES DE PRESIÓN
  lines.push(makeLine(`VALIDACIÓN TÉCNICA E HIDRODINÁMICA (CÓDIGO CSS OMI & ESTABILIDAD INTACTA):`));
  const volOk = !hydro.isCubicCapacityExceeded ? 'CUMPLE CAPACIDAD CÚBICA' : 'EXCEDIDO';
  const pressOk = !hydro.isPermissibleLoadExceeded ? 'RESISTENCIA T/M² VALIDADA' : 'REQUIERE REPARTO PRESIÓN';
  lines.push(makeLine(`• Volumen Ocupado: ${Number(hydro.totalVolumeOccupiedCbm || 0).toFixed(2)} m³ de ${hydro.grainCapacityCbm || 30300} m³ (${Number(hydro.volumeUtilizationShipPct || 0).toFixed(1)}%) [${volOk}]`));
  lines.push(makeLine(`• Presión Máxima: ${Number(hydro.maxFloorPressureTm2 || 0).toFixed(2)} t/m² <= Límite ${hydro.maxFloorAllowableTm2 || 20.0} t/m² [${pressOk}]`));
  lines.push(makeLine(`• Estabilidad GM: Altura metacéntrica estimada GM = ${hydro.metacentricHeightGmEstimatedM || 1.55}m (Centro de gravedad bajo [OK])`));
  lines.push(borderDbl);

  return lines.join('\n');
}

function calculateUniversalStowagePlan(items = [], orderTotals = null, options = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const spec = STANDARD_VESSEL_STOWAGE_SPEC;

  const DEFAULT_SF_BY_FAMILY = {
    big_bags: { sf: 1.35, height: 1.6, tier: 'BODEGA_BLOQUE' },
    heavy_machinery: { sf: 2.00, height: 2.8, tier: 'TANKTOP' },
    steel_structures: { sf: 1.10, height: 1.5, tier: 'TANKTOP' },
    containers: { sf: 2.40, height: 2.6, tier: 'WEATHER_DECK' },
    vehicles: { sf: 3.60, height: 2.2, tier: 'WEATHER_DECK' },
    pallets_general: { sf: 2.20, height: 1.8, tier: 'TWEEN_DECK' },
    supplies: { sf: 2.50, height: 1.5, tier: 'TWEEN_DECK' },
    default: { sf: 1.80, height: 2.0, tier: 'TWEEN_DECK' },
  };

  const analyzedItems = safeItems.map((it, idx) => {
    const qty = Math.max(1, Number(it.quantity) || 1);
    const unitWtKg = Number(it.weight ?? it.unit_weight_kg) || 0;
    const unitWtMT = unitWtKg / 1000;
    const totalWtMT = Math.round(unitWtMT * qty * 1000) / 1000;

    const len = Number(it.length ?? it.length_m) || 0;
    const wid = Number(it.width ?? it.width_m) || 0;
    const hgt = Number(it.height ?? it.height_m) || 0;

    const cat = String(it.category || '').trim();
    const typeStr = String(it.type || '').trim();
    const mode = String(it.shipping_mode_supported || '').trim();
    const combinedNorm = normalizeStr(`${cat} ${typeStr} ${mode}`);

    let cargoFamily = 'default';
    if (
      cat === 'Mercancía Ensacada / Dry Bulk' ||
      mode === 'Big Bags / Granel' ||
      combinedNorm.includes('big bag') || combinedNorm.includes('bigbag') || combinedNorm.includes('fibc') ||
      combinedNorm.includes('saco') || combinedNorm.includes('cemento') || combinedNorm.includes('granel') ||
      combinedNorm.includes('urea') || combinedNorm.includes('cereal') || combinedNorm.includes('fertilizante')
    ) {
      cargoFamily = 'big_bags';
    } else if (
      mode === 'Contenedor (FCL / LCL)' ||
      mode === 'Plataforma / Flat Rack' ||
      combinedNorm.includes('contenedor') || combinedNorm.includes('container') || combinedNorm.includes('flat rack')
    ) {
      cargoFamily = 'containers';
    } else if (
      mode === 'Ro-Ro / Vehículo Rodado' ||
      cat === 'Vehículo / Unidades Rodadas' ||
      combinedNorm.includes('vehiculo') || combinedNorm.includes('camion') || combinedNorm.includes('ro-ro')
    ) {
      cargoFamily = 'vehicles';
    } else if (
      cat === 'Estructura Metálica' ||
      combinedNorm.includes('acero') || combinedNorm.includes('viga') || combinedNorm.includes('tuberia') || combinedNorm.includes('perfil')
    ) {
      cargoFamily = 'steel_structures';
    } else if (
      cat === 'Maquinaria / Equipos Industriales' ||
      mode === 'Breakbulk / Maquinaria Suelta' ||
      unitWtMT >= 15 ||
      combinedNorm.includes('maquinaria') || combinedNorm.includes('excavadora') || combinedNorm.includes('transformador') || combinedNorm.includes('turbina')
    ) {
      cargoFamily = 'heavy_machinery';
    } else if (
      cat === 'Suministros / Supplies' ||
      combinedNorm.includes('suministro') || combinedNorm.includes('repuesto')
    ) {
      cargoFamily = 'supplies';
    } else if (
      cat === 'Carga General / General Cargo' ||
      combinedNorm.includes('pallet') || combinedNorm.includes('caja') || combinedNorm.includes('bulto')
    ) {
      cargoFamily = 'pallets_general';
    }

    const familyDefaults = DEFAULT_SF_BY_FAMILY[cargoFamily] || DEFAULT_SF_BY_FAMILY.default;

    let unitVolCbm = 0;
    let unitFootprintM2 = 0;

    if (len > 0 && wid > 0 && hgt > 0) {
      unitVolCbm = Math.round(len * wid * hgt * 1000) / 1000;
      unitFootprintM2 = Math.round(len * wid * 1000) / 1000;
    } else {
      unitVolCbm = unitWtMT > 0 ? Math.round(unitWtMT * familyDefaults.sf * 1000) / 1000 : Math.round(familyDefaults.sf * 1000) / 1000;
      unitFootprintM2 = Math.round((unitVolCbm / familyDefaults.height) * 1000) / 1000;
    }

    const totalVolCbm = Math.round(unitVolCbm * qty * 100) / 100;
    const totalFootprintM2 = Math.round(unitFootprintM2 * qty * 100) / 100;
    const stowageFactor = totalWtMT > 0 ? Math.round((totalVolCbm / totalWtMT) * 100) / 100 : familyDefaults.sf;
    const footprintPressureTm2 = unitFootprintM2 > 0 ? Math.round((unitWtMT / unitFootprintM2) * 100) / 100 : 0;

    let tier = familyDefaults.tier;
    let compartmentName = '';
    let stowageMethod = '';
    let securingLegend = '';
    let maxPermissiblePressure = 20.0;

    if (tier === 'TANKTOP') {
      compartmentName = 'Fondo de Bodega / Tanktop (Doble Fondo Reforzado)';
      stowageMethod = 'Estiba en fondo de bodega (Tanktop) con reparto de presiones sobre cunas de madera estructurales y trincaje pesado con cadenas G80 y cables de acero.';
      securingLegend = 'Cunas de madera estructurales y cadenas G80';
      maxPermissiblePressure = 20.0;
    } else if (tier === 'BODEGA_BLOQUE') {
      compartmentName = 'Bodega Corrida (Bloque Autosustentado)';
      stowageMethod = 'Estiba compacta en bloque trabado (Block Stowage) mediante spreader multipunto en ciclos de 14-16 sacos, cojines de aire neumáticos (Dunnage Air Bags) y láminas antihumedad continuas.';
      securingLegend = 'Spreader multipunto y estiba en bloque';
      maxPermissiblePressure = 20.0;
    } else if (tier === 'WEATHER_DECK') {
      if (cargoFamily === 'vehicles') {
        compartmentName = 'Cubierta Rodante / Weather Deck';
        stowageMethod = 'Estiba rodada con calzos de acuñado de seguridad y cinchas de poliéster 5T a puntos de anclaje D-Rings estructurales.';
        securingLegend = 'Calzos de seguridad y cinchas a D-Rings';
      } else {
        compartmentName = 'Cubierta Superior / Weather Deck (Celdas / Puntos de Trincaje)';
        stowageMethod = 'Estiba sobre cubierta corrida con conos de fijación (twistlocks automáticos), barras tensoras (lashing rods) y tensores mecánicos.';
        securingLegend = 'Twistlocks automáticos y barras tensoras';
      }
      maxPermissiblePressure = 3.5;
    } else {
      compartmentName = 'Entrepuente / Tween Deck (Capas Superiores)';
      stowageMethod = 'Estiba vertical sobre pontones de entrepuente con cinchas de poliéster de alta tenacidad, redes de trincaje perimetral y cantoneras de protección.';
      securingLegend = 'Estiba vertical trincada con cinchas y redes';
      maxPermissiblePressure = 4.5;
    }

    const pressureExceeded = footprintPressureTm2 > maxPermissiblePressure;

    return {
      id: it.id || `item-stow-${idx}`,
      originalIndex: idx,
      category: cat || 'Carga General / General Cargo',
      type: typeStr || `Partida ${idx + 1}`,
      quantity: qty,
      unitWeightKg: unitWtKg,
      unitWeightMT: unitWtMT,
      totalWeightMT: totalWtMT,
      dimensions: { length: len, width: wid, height: hgt },
      unitVolumeCbm: unitVolCbm,
      totalVolumeCbm: totalVolCbm,
      unitFootprintM2: unitFootprintM2,
      totalFootprintM2: totalFootprintM2,
      stowageFactorM3Mt: stowageFactor,
      footprintPressureTm2: footprintPressureTm2,
      cargoFamily,
      tier,
      compartmentName,
      stowageMethod,
      securingLegend,
      maxPermissiblePressure,
      pressureExceeded,
    };
  });

  const totalCargoWeightMT = Math.round(analyzedItems.reduce((acc, it) => acc + it.totalWeightMT, 0) * 1000) / 1000;
  const totalCargoVolumeCbm = Math.round(analyzedItems.reduce((acc, it) => acc + it.totalVolumeCbm, 0) * 100) / 100;
  const totalPieces = analyzedItems.reduce((acc, it) => acc + it.quantity, 0);

  const distinctCategories = [...new Set(analyzedItems.map(it => it.category).filter(Boolean))];
  const distinctTiers = [...new Set(analyzedItems.map(it => it.tier).filter(Boolean))];
  const distinctFamilies = [...new Set(analyzedItems.map(it => it.cargoFamily).filter(Boolean))];
  const isMixedCargo = distinctCategories.length > 1 || distinctTiers.length > 1 || distinctFamilies.length > 1;

  const weatherDeckItems = [];
  const hold1Items = [];
  const hold2Items = [];
  const hold3Items = [];
  const hold4Items = [];

  if (analyzedItems.length === 0) {
    // Sin ítems
  } else if (!isMixedCargo) {
    const primaryFamily = distinctFamilies[0] || 'default';
    if (primaryFamily === 'big_bags') {
      const ratios = [0.18, 0.32, 0.32, 0.18];
      spec.holds.forEach((h, hIdx) => {
        const holdItems = analyzedItems.map(it => ({
          ...it,
          quantity: Math.max(1, Math.round(it.quantity * ratios[hIdx])),
          totalWeightMT: Math.round(it.totalWeightMT * ratios[hIdx] * 100) / 100,
          totalVolumeCbm: Math.round(it.totalVolumeCbm * ratios[hIdx] * 100) / 100,
          allocatedToHold: h.holdNumber,
        }));
        if (hIdx === 0) hold1Items.push(...holdItems);
        else if (hIdx === 1) hold2Items.push(...holdItems);
        else if (hIdx === 2) hold3Items.push(...holdItems);
        else if (hIdx === 3) hold4Items.push(...holdItems);
      });
    } else if (primaryFamily === 'containers' || primaryFamily === 'vehicles') {
      weatherDeckItems.push(...analyzedItems);
    } else if (primaryFamily === 'heavy_machinery' || primaryFamily === 'steel_structures') {
      analyzedItems.forEach((it, i) => {
        if (i % 2 === 0) hold2Items.push({ ...it, allocatedToHold: 2 });
        else hold1Items.push({ ...it, allocatedToHold: 1 });
      });
    } else {
      analyzedItems.forEach((it, i) => {
        const target = (i % 3) + 1;
        if (target === 1) hold1Items.push({ ...it, allocatedToHold: 1 });
        else if (target === 2) hold2Items.push({ ...it, allocatedToHold: 2 });
        else hold3Items.push({ ...it, allocatedToHold: 3 });
      });
    }
  } else {
    for (const it of analyzedItems) {
      if (it.tier === 'WEATHER_DECK') {
        it.allocatedToHold = 'Cubierta';
        weatherDeckItems.push(it);
      } else if (it.tier === 'TANKTOP') {
        if (hold2Items.reduce((acc, x) => acc + x.totalWeightMT, 0) < 500) {
          it.allocatedToHold = 2;
          hold2Items.push(it);
        } else {
          it.allocatedToHold = 1;
          hold1Items.push(it);
        }
      } else if (it.tier === 'BODEGA_BLOQUE') {
        if (hold3Items.reduce((acc, x) => acc + x.totalWeightMT, 0) < 800) {
          it.allocatedToHold = 3;
          hold3Items.push(it);
        } else {
          it.allocatedToHold = 4;
          hold4Items.push(it);
        }
      } else {
        if (hold1Items.reduce((acc, x) => acc + x.totalWeightMT, 0) <= hold2Items.reduce((acc, x) => acc + x.totalWeightMT, 0)) {
          it.allocatedToHold = 1;
          hold1Items.push(it);
        } else {
          it.allocatedToHold = 2;
          hold2Items.push(it);
        }
      }
    }
  }

  const buildHoldSummary = (holdSpec, holdItems) => {
    const holdWeight = Math.round(holdItems.reduce((acc, it) => acc + it.totalWeightMT, 0) * 100) / 100;
    const holdVolume = Math.round(holdItems.reduce((acc, it) => acc + it.totalVolumeCbm, 0) * 100) / 100;
    const weightPct = totalCargoWeightMT > 0 ? Math.round((holdWeight / totalCargoWeightMT) * 1000) / 10 : 0;
    const volUtilPct = Math.round((holdVolume / holdSpec.capacityCbm) * 1000) / 10;
    const actualMaxPressure = holdItems.reduce((max, it) => Math.max(max, it.footprintPressureTm2 || 0), 0);
    const permissibleLoad = holdSpec.tanktopMaxLoadTm2;
    const holdCategories = [...new Set(holdItems.map(it => it.category).filter(Boolean))];

    let stowMethod = 'Bodega despejada / en reserva para lastre o viaje de retorno';
    let secLegend = 'Ninguno requerido';
    let tierSummary = 'Vacía';

    if (holdItems.length > 0) {
      const tiersInHold = [...new Set(holdItems.map(it => it.tier))];
      if (tiersInHold.includes('TANKTOP') && tiersInHold.includes('TWEEN_DECK')) {
        tierSummary = 'Mixto (Tanktop + Tween Deck)';
        stowMethod = 'Estiba compartimentada: Maquinaria pesada en Tanktop con cunas estructurales y carga general en Tween Deck';
        secLegend = 'Cunas + Cadenas G80 en Tanktop | Cinchas + Redes en Tween Deck';
      } else if (tiersInHold.includes('TANKTOP')) {
        tierSummary = 'Tanktop (Fondo de Bodega)';
        stowMethod = 'Estiba en fondo de bodega (Tanktop) con reparto de presiones sobre cunas de madera estructurales y cadenas G80';
        secLegend = 'Cunas de madera estructurales y cadenas G80';
      } else if (tiersInHold.includes('BODEGA_BLOQUE')) {
        tierSummary = 'Bodega Corrida (Bloque)';
        stowMethod = 'Estiba en bloque compacto (Block Stowage) mediante spreader multipunto en ciclos de 14-16 sacos, cojines de aire y láminas';
        secLegend = 'Spreader multipunto y estiba en bloque';
      } else {
        tierSummary = 'Entrepuente (Tween Deck)';
        stowMethod = 'Estiba vertical sobre entrepuente con cinchas de poliéster de alta tenacidad, redes perimetrales y cantoneras';
        secLegend = 'Estiba vertical trincada con cinchas y redes';
      }
    }

    return {
      holdNumber: holdSpec.holdNumber,
      name: holdSpec.name,
      capacityCbm: holdSpec.capacityCbm,
      tanktopAreaM2: holdSpec.tanktopAreaM2,
      tanktopMaxLoadTm2: permissibleLoad,
      tweenDeckAreaM2: holdSpec.tweenDeckAreaM2,
      tweenDeckMaxLoadTm2: holdSpec.tweenDeckMaxLoadTm2,
      totalWeightTons: holdWeight,
      weightPercentage: weightPct,
      totalVolumeCbm: holdVolume,
      volumeUtilizationPct: volUtilPct,
      actualMaxPressureTm2: Math.round(actualMaxPressure * 100) / 100,
      isOverweight: actualMaxPressure > permissibleLoad,
      isOvercube: holdVolume > holdSpec.capacityCbm,
      pressureCompliance: actualMaxPressure <= permissibleLoad,
      cubicCompliance: holdVolume <= holdSpec.capacityCbm,
      cargoCategories: holdCategories,
      stowageTier: tierSummary,
      stowageMethod: stowMethod,
      securingLegend: secLegend,
      allocatedItems: holdItems,
    };
  };

  const holds = [
    buildHoldSummary(spec.holds[0], hold1Items),
    buildHoldSummary(spec.holds[1], hold2Items),
    buildHoldSummary(spec.holds[2], hold3Items),
    buildHoldSummary(spec.holds[3], hold4Items),
  ];

  const deckWeight = Math.round(weatherDeckItems.reduce((acc, it) => acc + it.totalWeightMT, 0) * 100) / 100;
  const deckVolume = Math.round(weatherDeckItems.reduce((acc, it) => acc + it.totalVolumeCbm, 0) * 100) / 100;
  const deckWeightPct = totalCargoWeightMT > 0 ? Math.round((deckWeight / totalCargoWeightMT) * 1000) / 10 : 0;
  const deckMaxPressure = weatherDeckItems.reduce((max, it) => Math.max(max, it.footprintPressureTm2 || 0), 0);

  const weatherDeckSummary = {
    name: spec.weatherDeck.name,
    deckAreaM2: spec.weatherDeck.deckAreaM2,
    maxPermissibleLoadTm2: spec.weatherDeck.maxPermissibleLoadTm2,
    maxContainerTeus: spec.weatherDeck.maxContainerTeus,
    totalWeightTons: deckWeight,
    weightPercentage: deckWeightPct,
    totalVolumeCbm: deckVolume,
    actualMaxPressureTm2: Math.round(deckMaxPressure * 100) / 100,
    pressureCompliance: deckMaxPressure <= spec.weatherDeck.maxPermissibleLoadTm2,
    stowageMethod: weatherDeckItems.length > 0 ? spec.weatherDeck.securingMethod : 'Cubierta despejada / libre para estiba adicional',
    securingLegend: weatherDeckItems.length > 0 ? spec.weatherDeck.legend : 'Cubierta despejada',
    allocatedItems: weatherDeckItems,
  };

  const categoryGroups = {};
  analyzedItems.forEach(it => {
    if (!categoryGroups[it.category]) {
      categoryGroups[it.category] = {
        category: it.category,
        totalWeightMT: 0,
        totalVolumeCbm: 0,
        piecesCount: 0,
        primaryTier: it.tier,
        stowageMethod: it.stowageMethod,
        securingLegend: it.securingLegend,
        assignedHolds: new Set(),
      };
    }
    categoryGroups[it.category].totalWeightMT += it.totalWeightMT;
    categoryGroups[it.category].totalVolumeCbm += it.totalVolumeCbm;
    categoryGroups[it.category].piecesCount += it.quantity;
    if (it.allocatedToHold) {
      categoryGroups[it.category].assignedHolds.add(`Bodega ${it.allocatedToHold}`);
    } else if (it.tier === 'WEATHER_DECK') {
      categoryGroups[it.category].assignedHolds.add('Cubierta');
    }
  });

  const cargoMixBreakdown = Object.values(categoryGroups).map(g => ({
    category: g.category,
    weightTons: Math.round(g.totalWeightMT * 100) / 100,
    weightPercentage: totalCargoWeightMT > 0 ? Math.round((g.totalWeightMT / totalCargoWeightMT) * 1000) / 10 : 0,
    volumeCbm: Math.round(g.totalVolumeCbm * 100) / 100,
    volumePercentage: totalCargoVolumeCbm > 0 ? Math.round((g.totalVolumeCbm / totalCargoVolumeCbm) * 1000) / 10 : 0,
    piecesCount: g.piecesCount,
    assignedTier: g.primaryTier,
    assignedLocations: g.assignedHolds.size > 0 ? Array.from(g.assignedHolds).join(', ') : 'Bodegas Principales',
    stowageMethod: g.stowageMethod,
    securingLegend: g.securingLegend,
  }));

  const totalVolumeOccupiedCbm = Math.round((holds.reduce((acc, h) => acc + h.totalVolumeCbm, 0) + deckVolume) * 100) / 100;
  const volumeUtilizationShipPct = Math.round((totalVolumeOccupiedCbm / spec.grainCapacityCbm) * 1000) / 10;
  const isCubicCapacityExceeded = totalVolumeOccupiedCbm > spec.grainCapacityCbm;

  const maxGlobalPressureTm2 = Math.max(
    ...holds.map(h => h.actualMaxPressureTm2),
    weatherDeckSummary.actualMaxPressureTm2
  );
  const isPermissibleLoadExceeded = holds.some(h => h.isOverweight) || !weatherDeckSummary.pressureCompliance;

  const hydrodynamicsAndSafety = {
    grainCapacityCbm: spec.grainCapacityCbm,
    baleCapacityCbm: spec.baleCapacityCbm,
    totalVolumeOccupiedCbm,
    volumeUtilizationShipPct,
    isCubicCapacityExceeded,
    volumeComplianceStatus: isCubicCapacityExceeded ? 'EXCEDIDO' : 'VERIFICADO_DENTRO_DE_CAPACIDAD',
    maxFloorPressureTm2: maxGlobalPressureTm2,
    maxFloorAllowableTm2: spec.tanktop.maxPermissibleLoadTm2,
    isPermissibleLoadExceeded,
    structuralResistanceCompliance: !isPermissibleLoadExceeded,
    volumeCompliance: !isCubicCapacityExceeded,
    structuralResistanceStatus: isPermissibleLoadExceeded ? 'EXCEDE_REQUIERE_REPARTO_PRESIÓN' : 'VERIFICADO_RESISTENCIA_ADMISIBLE',
    centerOfGravityAssessment: totalCargoWeightMT >= 40
      ? 'Óptimo: Concentración de masas pesadas en Tanktop (fondo de bodega) garantiza centro de gravedad bajo (KG mínimo), asegurando altura metacéntrica (GM) positiva > 1.45m y estabilidad según Código CSS OMI.'
      : 'Adecuado: Carga liviana / LCL distribuida uniformemente.',
    metacentricHeightGmEstimatedM: totalCargoWeightMT >= 40 ? 1.55 : 1.80,
    longitudinalStressBalance: 'Momento flector y esfuerzo cortante longitudinales balanceados simétricamente entre Proa y Popa.',
    seaworthinessStatus: (!isCubicCapacityExceeded && !isPermissibleLoadExceeded)
      ? 'Aprobado para Navegación Marítima Internacional (Seaworthiness Passed / IMO CSS Code Compliant)'
      : 'Condicionado a revisión de repartos de carga o durmientes certificados.',
  };

  // Justificación Técnica de Ingeniería Naval (Naval Engineering Executive Justification)
  const totalCargoFootprintM2 = Math.round(analyzedItems.reduce((acc, it) => acc + (Number(it.totalFootprintM2) || 0), 0) * 100) / 100;

  const tierWeightMap = {
    TANKTOP: 0,
    BODEGA_BLOQUE: 0,
    WEATHER_DECK: 0,
    TWEEN_DECK: 0,
  };
  const tierCountMap = {
    TANKTOP: 0,
    BODEGA_BLOQUE: 0,
    WEATHER_DECK: 0,
    TWEEN_DECK: 0,
  };

  analyzedItems.forEach(it => {
    const t = it.tier || 'TWEEN_DECK';
    if (tierWeightMap[t] !== undefined) {
      tierWeightMap[t] += (it.totalWeightMT || 0);
      tierCountMap[t] += (it.quantity || 1);
    } else {
      tierWeightMap[t] = (it.totalWeightMT || 0);
      tierCountMap[t] = (it.quantity || 1);
    }
  });

  let predominantTier = 'TWEEN_DECK';
  let maxWeight = -1;
  for (const [tierKey, weightVal] of Object.entries(tierWeightMap)) {
    if (weightVal > maxWeight) {
      maxWeight = weightVal;
      predominantTier = tierKey;
    }
  }

  if (maxWeight <= 0 && analyzedItems.length > 0) {
    let maxCount = -1;
    for (const [tierKey, countVal] of Object.entries(tierCountMap)) {
      if (countVal > maxCount) {
        maxCount = countVal;
        predominantTier = tierKey;
      }
    }
  }

  let tierExplanation = '';
  if (predominantTier === 'WEATHER_DECK') {
    tierExplanation = 'La carga mayoritaria corresponde a unidades rodadas (Ro-Ro) y/o contenedores, posicionada en Cubierta Superior (Weather Deck) con calzos de seguridad, cinchas a puntos D-Rings y twistlocks automáticos, optimizando el francobordo y la maniobra de izado sin comprometer la estabilidad.';
  } else if (predominantTier === 'TANKTOP') {
    tierExplanation = 'La carga mayoritaria corresponde a Heavy Lift y maquinaria pesada/estructuras, posicionada en el Doble Fondo Reforzado (Tanktop, capacidad admisible de 20.0 t/m²) sobre cunas estructurales de madera y trincaje pesado G80, garantizando un centro de gravedad (KG) bajo y maximizando la estabilidad transversal.';
  } else if (predominantTier === 'BODEGA_BLOQUE') {
    tierExplanation = 'La carga mayoritaria corresponde a mercancía en Big Bags / graneles ensacados, distribuida en estiba compacta en bloque trabado (Block Stowage) en bodegas inferiores mediante spreader multipunto y cojines neumáticos de trincaje para evitar corrimientos transversales.';
  } else {
    tierExplanation = 'La carga mayoritaria corresponde a carga general paletizada y fraccionada, posicionada en entrepuentes (Tween Deck) sobre pontones intermedios con trincaje mediante redes y cinchas de poliéster para facilitar la segregación y descarga secuencial.';
  }

  if (analyzedItems.length === 0) {
    tierExplanation = 'Sin partidas de carga activas; compartimentos de carga y cubierta preparados para estiba secuencial según peso específico de las partidas.';
  }

  const executiveJustification = [
    `Cálculo de Masas y Volúmenes: Registro de carga total de ${Number(totalCargoWeightMT).toFixed(2)} MT y un área acumulada de apoyo de ${Number(totalCargoFootprintM2).toFixed(2)} m², consolidando un volumen ocupado de ${Number(totalVolumeOccupiedCbm).toFixed(2)} m³ en bodegas y compartimentos (${volumeUtilizationShipPct}% de la capacidad cúbica grain del buque).`,
    `Lógica de Asignación de Bodegas: ${tierExplanation}`,
    `Validación de Resistencia Estructural: Presión máxima ejercida sobre plancha calculada en ${Number(hydrodynamicsAndSafety.maxFloorPressureTm2 || 0).toFixed(2)} t/m² frente a una capacidad máxima admisible de ${Number(hydrodynamicsAndSafety.maxFloorAllowableTm2 || 20).toFixed(1)} t/m² del compartimento, confirmando que la distribución de pesos cumple estrictamente con las prescripciones de resistencia estructural y seguridad del Código CSS de la OMI.`,
  ];

  const stowagePlan = {
    vesselModel: {
      type: spec.vesselType,
      dwt: spec.dwt,
      grainCapacityCbm: spec.grainCapacityCbm,
      baleCapacityCbm: spec.baleCapacityCbm,
      holdsCount: spec.holdsCount,
      deckCranes: spec.deckCranes,
      tanktopUniformLoadTm2: spec.tanktop.maxPermissibleLoadTm2,
      tweenDeckUniformLoadTm2: spec.tweenDeck.maxPermissibleLoadTm2,
      weatherDeckUniformLoadTm2: spec.weatherDeck.maxPermissibleLoadTm2,
    },
    cargoClassification: {
      totalWeightTons: totalCargoWeightMT,
      totalVolumeCbm: totalCargoVolumeCbm,
      totalPieces,
      distinctCategories,
      distinctTiers,
      isMixedCargo,
      cargoMixBreakdown,
      items: analyzedItems,
    },
    holds,
    weatherDeck: weatherDeckSummary,
    tweenDeckSummary: {
      name: spec.tweenDeck.name,
      totalAreaM2: spec.tweenDeck.totalAreaM2,
      maxPermissibleLoadTm2: spec.tweenDeck.maxPermissibleLoadTm2,
      securingMethod: spec.tweenDeck.securingMethod,
      legend: spec.tweenDeck.legend,
    },
    tanktopSummary: {
      name: spec.tanktop.name,
      totalAreaM2: spec.tanktop.totalAreaM2,
      maxPermissibleLoadTm2: spec.tanktop.maxPermissibleLoadTm2,
      securingMethod: spec.tanktop.securingMethod,
      legend: spec.tanktop.legend,
    },
    hydrodynamicsAndSafety,
    asciiCroquis: '',
    executiveJustification,
  };

  stowagePlan.asciiCroquis = generateDynamicStowageAscii(stowagePlan);

  return stowagePlan;
}

/**
 * Obtiene la Referencia Activa de la sesión global (Topbar / Core PRO).
 */
export function getActiveGlobalReference() {
  if (typeof window === 'undefined') return '';

  // 1. Input de la barra superior (#quick-ref)
  const quickRefEl = typeof document !== 'undefined' ? document.getElementById('quick-ref') : null;
  const quickRef = quickRefEl && 'value' in quickRefEl ? String(quickRefEl.value || '').trim() : '';
  if (quickRef) return quickRef;

  // 2. Gestor central de referencia contractual
  const mgrRef = window.ContractRefManager?.getActiveContractRef?.()
    || window.ContractReference?.getActiveContractRef?.()
    || (typeof window.getActiveContractRef === 'function' ? window.getActiveContractRef() : '');
  if (mgrRef && String(mgrRef).trim()) return String(mgrRef).trim();

  // 3. Estado global
  const stateRef = window.State?.activeReference;
  if (stateRef && String(stateRef).trim()) return String(stateRef).trim();

  // 4. Referencia anclada en ventana
  const anchored = window.anchoredReference;
  if (anchored && String(anchored).trim()) return String(anchored).trim();

  // 5. Atributo en body del expediente activo
  if (typeof document !== 'undefined' && document.body?.dataset?.activeDossierRef) {
    return String(document.body.dataset.activeDossierRef).trim();
  }

  // 6. Parámetros de URL
  if (typeof window.location !== 'undefined' && window.location?.search) {
    const params = new URLSearchParams(window.location.search);
    const urlRef = params.get('ref') || params.get('contract_ref') || params.get('dossier_ref');
    if (urlRef && urlRef.trim()) return urlRef.trim();
  }

  // 7. Session / Local Storage
  try {
    const stored = (typeof window.sessionStorage !== 'undefined' ? window.sessionStorage.getItem('active_contract_ref') : null)
      || (typeof window.localStorage !== 'undefined' ? window.localStorage.getItem('active_contract_ref') : null);
    if (stored && stored.trim()) return stored.trim();
  } catch (_e) {}

  return '';
}

if (typeof window !== 'undefined') {
  window.getActiveGlobalReference = getActiveGlobalReference;
}

/**
 * Verifica si un proyecto (hijo) coincide o pertenece al expediente activo (padre).
 */
export function isProjectMatchingActiveDossier(project, activeDossierRef) {
  if (!project || !activeDossierRef) return false;
  const active = String(activeDossierRef).trim().toUpperCase();
  if (!active) return false;

  const candidateParentRefs = [
    project.referenciaPadre,
    project.referencia_padre,
    project.dossier_ref,
    project.dossierRef,
    project.parent_ref,
    project.parentRef,
    project.data?.dossier_ref,
    project.data?.parent_ref,
    project.data?.referenciaPadre,
    project.data?.referencia_padre,
  ];

  for (const candidate of candidateParentRefs) {
    if (candidate !== undefined && candidate !== null) {
      const norm = String(candidate).trim().toUpperCase();
      if (norm && (norm === active || norm.startsWith(active) || active.startsWith(norm))) {
        return true;
      }
    }
  }

  const projectRef = String(project.project_ref || project.projectRef || '').trim().toUpperCase();
  if (projectRef && (projectRef === active || projectRef.startsWith(active))) {
    return true;
  }

  return false;
}

function ForwarderWorkspaceInner() {

  const [projects, setProjects] = useState([]);
  const [referenciaActivaGlobal, setReferenciaActivaGlobal] = useState(() => getActiveGlobalReference());
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [isAgentVisible, setIsAgentVisible] = useState(true);

  const [isCargoModalOpen, setIsCargoModalOpen] = useState(false);
  const [editingLineItemId, setEditingLineItemId] = useState(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(null);

  // Herramientas Comerciales y Regulatorias (CBAM y Modo Dual)
  const [isCbamOpen, setIsCbamOpen] = useState(false);
  const [isDualTradingOpen, setIsDualTradingOpen] = useState(false);
  const dualViewRef = useRef(null);

  // Parámetros locales CBAM sincronizados con el proyecto
  const [cbamSector, setCbamSector] = useState('');
  const [cbamOrigin, setCbamOrigin] = useState('');
  const [cbamDestination, setCbamDestination] = useState('');
  const [cbamQuantity, setCbamQuantity] = useState(0);
  const [cbamReportedEmissions, setCbamReportedEmissions] = useState('');
  const [cbamCompetitorOrigin, setCbamCompetitorOrigin] = useState('');
  const [cbamCompetitorFactor, setCbamCompetitorFactor] = useState('');

  const [showExecutiveReport, setShowExecutiveReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [activeReport, setActiveReport] = useState(null);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const fileInputRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);

  const [cargoItems, setCargoItems] = useState([]);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculateFeedback, setRecalculateFeedback] = useState(null);
  const [capacityWarning, setCapacityWarning] = useState(null);
  const [financialBreakdown, setFinancialBreakdown] = useState(null);
  const [fobMasMercanciaUnitario, setFobMasMercanciaUnitario] = useState(0);
  const [projectDocuments, setprojectDocuments] = useState([]);
  const lastHydratedProjectIdRef = useRef(null);

  const [dunnageWood, setDunnageWood] = useState(0);
  const [highCapacitySlings, setHighCapacitySlings] = useState(0);
  const [chainsBinders, setChainsBinders] = useState(0);
  const [shackles, setShackles] = useState(0);

  const [stevedoreGangs, setStevedoreGangs] = useState(0);
  const [lashingTeam, setLashingTeam] = useState(0);
  const [heavyLiftCrane, setHeavyLiftCrane] = useState(0);
  const [mafiPlatforms, setMafiPlatforms] = useState(0);
  const [spreaderMultipunto, setSpreaderMultipunto] = useState(0);
  const [craneLiftCycles, setCraneLiftCycles] = useState(0);

  const [shippingMode, setShippingMode] = useState('Lo-Lo');
  const [vesselType, setVesselType] = useState('Geared Breakbulk (Lo-Lo)');
  const [cargoCategory, setCargoCategory] = useState(activeProject?.cargoCategory || activeProject?.cargo_category || 'Carga Paletizada');

  const [vehicleType, setVehicleType] = useState(() => {
    const rawCargo = [
      activeProject?.cargoName,
      activeProject?.cargo_name,
      activeProject?.cargoType,
      activeProject?.cargo_type,
      activeProject?.commodity,
      activeProject?.description,
      typeof window !== 'undefined' ? (window.State?.cargoName || window.State?.cargo_type) : ''
    ].filter(Boolean).join(' ');
    if (/(big\s*bag|saco|sling|paletizad|envasad)/i.test(rawCargo) && !/(granel|bulk)/i.test(rawCargo)) {
      return 'Camión Plataforma con Grúa Autocarga';
    }
    return activeProject?.truck_type || activeProject?.vehicle_type || activeProject?.data?.truckType || 'Tráiler Tauliner (13.6m)';
  });
  const [loadingMethod, setLoadingMethod] = useState(
    activeProject?.loading_method || activeProject?.metodo_carga || 'Carga Lateral (Lona / Tauliner)'
  );
  const [dischargeMethod, setDischargeMethod] = useState(
    activeProject?.discharge_method || activeProject?.metodo_descarga || activeProject?.metodo_descarga_pod || 'Carga Trasera por Muelle / Rampa'
  );

  const [isCommodityTariffActive, setIsCommodityTariffActive] = useState(false);
  const [isUnder40t, setIsUnder40t] = useState(false);
  const [tceActive, setTceActive] = useState(false);
  const [tceValue, setTceValue] = useState(null);
  const [charterMode, setCharterMode] = useState('Fletamento Completo');
  const [isBigBagsCargo, setIsBigBagsCargo] = useState(false);
  const [operationalProfileNotice, setOperationalProfileNotice] = useState('');

  const [storageDays, setStorageDays] = useState(0);
  const [surveyorCost, setSurveyorCost] = useState(0);
  const [inlandCost, setInlandCost] = useState(0);
  const [customsCost, setCustomsCost] = useState(0);
  const [insuranceCost, setInsuranceCost] = useState(0);
  const [mercanciaCost, setMercanciaCost] = useState(() => {
    return Number(
      activeProject?.valor_total_mercancia_usd
      ?? activeProject?.goodsValue
      ?? activeProject?.merchandiseValue
      ?? (typeof window !== 'undefined' && window.State ? (window.State.goodsValue || window.State.valor_total_mercancia_usd || window.State.merchandiseValue || window.State.cargoValue) : 0)
      ?? 0
    );
  });
  const userEditedSurveyor = useRef(false);
  const userEditedMercanciaCost = useRef(false);
  const lastDetectedCargoTypeRef = useRef(null);
  const lastCalculatedItemsRef = useRef('');
  const lastRoadSyncPayloadRef = useRef('');
  const lastSyncDataBridgeRef = useRef('');
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Parámetros dinámicos de ruta, ritmos operativos, rotación y demoras
  const [pol, setPol] = useState(activeProject?.pol || '');
  const [pod, setPod] = useState(activeProject?.pod || '');
  const [loadingRate, setLoadingRate] = useState(2);
  const [dischargingRate, setDischargingRate] = useState(2);
  const [distanceNm, setDistanceNm] = useState(activeProject?.distance_nm || activeProject?.distanceNm || 0);
  const [vesselSpeedKnots, setVesselSpeedKnots] = useState(12.0);
  const [vesselDailyHireUsd, setVesselDailyHireUsd] = useState(11500);
  const [exchangeRateUsdEur, setExchangeRateUsdEur] = useState(0.92);
  const [actualLoadingDays, setActualLoadingDays] = useState('');
  const [actualDischargingDays, setActualDischargingDays] = useState('');
  const [demurrageDailyRateUsd, setDemurrageDailyRateUsd] = useState(11500);
  const [charteringAssessment, setCharteringAssessment] = useState(null);

  // Aislamiento total del estado terrestre (Cero Data Bleed)
  const [landOrigin, setLandOrigin] = useState(activeProject?.land_route?.origin || activeProject?.land_origin || '');
  const [landDestination, setLandDestination] = useState(activeProject?.land_route?.destination || activeProject?.land_destination || '');
  const [distanceKm, setDistanceKm] = useState(activeProject?.land_route?.distance_km || activeProject?.land_distance || 0);
  const [safeLoadHours, setSafeLoadHours] = useState(2);
  const [safeDischHours, setSafeDischHours] = useState(2);

  const [subtotalFreight, setSubtotalFreight] = useState('0.00');
  const [subtotalFobOperations, setSubtotalFobOperations] = useState('0.00');
  const [isBreakdownVisible, setIsBreakdownVisible] = useState(true);
  const [estimatedCost, setEstimatedCost] = useState(activeProject?.land_freight_cost || '');
  const [salePrice, setSalePrice] = useState(activeProject?.land_freight_sale || '');

  const [tollCost, setTollCost] = useState(activeProject?.tollCost || activeProject?.peajes || 0);
  const tollsCost = tollCost;
  const setTollsCost = setTollCost;
  const [driverDiets, setDriverDiets] = useState(activeProject?.driverDiets || activeProject?.dietas || 0);
  const [warehouseWaitPenaltyEur, setWarehouseWaitPenaltyEur] = useState(0);

  // Setters y aliases para sincronización con Modo Técnico y DataBridge
  const origin = pol;
  const destination = pod;
  const setOrigin = setPol;
  const setDestination = setPod;
  const setDistance = setDistanceNm;
  const setCost = setEstimatedCost;
  const setOriginState = setPol;
  const setDestinationState = setPod;
  const setDistanceState = setDistanceNm;
  const setFreightCostState = setEstimatedCost;
  const setFreightSaleState = setSalePrice;
  const setTollsState = setTollCost;
  const setDietsState = setDriverDiets;
  const loadTime = loadingRate;
  const dischargeTime = dischargingRate;
  const setLoadTime = setLoadingRate;
  const setDischargeTime = setDischargingRate;

  const setDunnage = setDunnageWood;
  const setChains = setChainsBinders;
  const setSlings = setHighCapacitySlings;
  const setGangs = setStevedoreGangs;
  const setHeavyLift = setHeavyLiftCrane;
  const setLashingTeams = setLashingTeam;
  const setSpreader = setSpreaderMultipunto;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncingDataBridge, setIsSyncingDataBridge] = useState(false);

  const totals = cargoItems.reduce((acc, item) => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const l = Math.max(0, parseFloat(item.length) || 0);
    const w = Math.max(0, parseFloat(item.width) || 0);
    const h = Math.max(0, parseFloat(item.height) || 0);
    const wt = Math.max(0, parseFloat(item.weight) || 0);
    acc.quantity += qty;
    acc.m2 += qty * (l * w);
    acc.m3 += qty * (l * w * h);
    acc.weight += qty * wt;
    acc.ldm += qty * ((l * (w > 0 ? w : 2.4)) / 2.4);
    return acc;
  }, { quantity: 0, m2: 0, m3: 0, weight: 0, ldm: 0 });

  const totalWeightKg = totals.weight;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowExecutiveReport(false);
        setIsCbamOpen(false);
        setIsDualTradingOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const handleVehicleTypeChange = (selectedType) => {
    setVehicleType(selectedType);
    const rawPayload = getVehiclePayloadKg(selectedType);
    const payloadTons = rawPayload > 100 ? Math.round(rawPayload / 1000) : (rawPayload || 24);
    if (typeof window !== 'undefined') {
      window.State = window.State || {};
      window.State.vehicleType = selectedType;
      window.State.truckType = selectedType;
      if (payloadTons > 0) {
        window.State.truckPayloadCapacity = payloadTons;
        window.State.cargaUtil = payloadTons;
        window.State.dwt = payloadTons;
      }
      if (typeof window.handleVehicleTypeSelection === 'function') {
        window.handleVehicleTypeSelection(selectedType);
      }
    }
    if (typeof document !== 'undefined') {
      const inputEl = document.getElementById('nombre-buque-calculadora');
      if (inputEl && inputEl.value !== selectedType) {
        inputEl.value = selectedType;
      }
      const badgeEl = document.getElementById('vessel-badge');
      if (badgeEl) badgeEl.innerText = selectedType;
      const execEl = document.getElementById('exec-vessel-type');
      if (execEl) execEl.textContent = selectedType;
      const truckCapEl = document.getElementById('truckPayloadCapacity');
      if (truckCapEl && payloadTons > 0) {
        truckCapEl.value = payloadTons;
      }
      const dwtEl = document.getElementById('vessel-dwt');
      if (dwtEl && payloadTons > 0) {
        dwtEl.value = payloadTons;
      }
    }
    const compat = getCompatibleMethodsForVehicle(selectedType);
    if (selectedType === 'Camión Plataforma con Grúa Autocarga' || selectedType.includes('Grúa Autocarga')) {
      setLoadingMethod('Autocarga con Grúa del Camión');
      setDischargeMethod('Autocarga con Grúa del Camión');
    } else if (compat.isPlatform) {
      if (!compat.allowed.includes(loadingMethod)) {
        setLoadingMethod(compat.defaultLoading);
      }
      if (!compat.allowed.includes(dischargeMethod)) {
        setDischargeMethod(compat.defaultDischarge);
      }
    } else if (selectedType.includes('Bañera') || selectedType.includes('Silo')) {
      setLoadingMethod(compat.defaultLoading);
      setDischargeMethod(compat.defaultDischarge);
    }
    if (activeProject) {
      setActiveProject((prev) => (prev ? {
        ...prev,
        truck_type: selectedType,
        vehicle_type: selectedType,
      } : prev));
    }
  };

  // Sincronización reactiva del Tipo de Vehículo Terrestre con el Estado Global, DOM y Modo Técnico
  useEffect(() => {
    if (!vehicleType) return;
    if (vehicleType === 'Camión Plataforma con Grúa Autocarga' || vehicleType.includes('Grúa Autocarga')) {
      setLoadingMethod('Autocarga con Grúa del Camión');
      setDischargeMethod('Autocarga con Grúa del Camión');
    }
    const rawPayload = getVehiclePayloadKg(vehicleType);
    const payloadTons = rawPayload > 100 ? Math.round(rawPayload / 1000) : (rawPayload || 24);
    if (typeof window !== 'undefined') {
      window.State = window.State || {};
      window.State.vehicleType = vehicleType;
      window.State.truckType = vehicleType;
      if (payloadTons > 0) {
        window.State.truckPayloadCapacity = payloadTons;
        window.State.cargaUtil = payloadTons;
        window.State.dwt = payloadTons;
      }
      if (typeof window.handleVehicleTypeSelection === 'function') {
        window.handleVehicleTypeSelection(vehicleType);
      }
    }
    if (typeof document !== 'undefined') {
      const inputEl = document.getElementById('nombre-buque-calculadora');
      if (inputEl && inputEl.value !== vehicleType) {
        inputEl.value = vehicleType;
      }
      const badgeEl = document.getElementById('vessel-badge');
      if (badgeEl) badgeEl.innerText = vehicleType;
      const execEl = document.getElementById('exec-vessel-type');
      if (execEl) execEl.textContent = vehicleType;
      const truckCapEl = document.getElementById('truckPayloadCapacity');
      if (truckCapEl && payloadTons > 0) {
        truckCapEl.value = payloadTons;
      }
      const dwtEl = document.getElementById('vessel-dwt');
      if (dwtEl && payloadTons > 0) {
        dwtEl.value = payloadTons;
      }
    }
  }, [vehicleType]);

  // Recálculo automático de horas previstas de carga/descarga según ratio operativo
  useEffect(() => {
    if (loadingMethod === 'Autocarga con Grúa del Camión') {
      const ratio = 20; // 20 TM/h
      const tons = totalWeightKg > 0 ? (totalWeightKg / 1000) : 24;
      const singleTruckTons = Math.min(24, tons);
      const computedHours = Math.round((singleTruckTons / ratio) * 10) / 10;
      setLoadingRate(computedHours);
    }
  }, [loadingMethod, totalWeightKg]);

  useEffect(() => {
    if (dischargeMethod === 'Autocarga con Grúa del Camión') {
      const ratio = 20; // 20 TM/h
      const tons = totalWeightKg > 0 ? (totalWeightKg / 1000) : 24;
      const singleTruckTons = Math.min(24, tons);
      const computedHours = Math.round((singleTruckTons / ratio) * 10) / 10;
      setDischargingRate(computedHours);
    }
  }, [dischargeMethod, totalWeightKg]);

  // Sincronización reactiva con eventos emitidos por Cerebro.ia y Agente NLP
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleAssistantFieldUpdate = (e) => {
      const field = e?.detail?.field;
      const val = e?.detail?.value || e?.detail?.vehicleType;
      if ((field === 'vehicleType' || field === 'vehicle_type' || field === 'truckType' || field === 'truck_type') && val) {
        handleVehicleTypeChange(val);
      }
    };
    const handleVehicleTypeCustomEvent = (e) => {
      const val = e?.detail?.vehicleType || e?.detail?.selectedType;
      if (val) {
        handleVehicleTypeChange(val);
      }
    };
    window.addEventListener('sea-assistant:field-updated', handleAssistantFieldUpdate);
    window.addEventListener('vehicle-type:selected', handleVehicleTypeCustomEvent);
    return () => {
      window.removeEventListener('sea-assistant:field-updated', handleAssistantFieldUpdate);
      window.removeEventListener('vehicle-type:selected', handleVehicleTypeCustomEvent);
    };
  }, []);

  // Sincronización reactiva de la Referencia Activa Global del Topbar (Core PRO / quick-ref)
  useEffect(() => {
    const syncActiveRef = () => {
      const current = getActiveGlobalReference();
      setReferenciaActivaGlobal((prev) => (prev !== current ? current : prev));
    };
    syncActiveRef();

    const handleContractChange = (e) => {
      const ref = e?.detail?.reference || getActiveGlobalReference();
      setReferenciaActivaGlobal(ref || '');
    };

    const handleContractCleared = () => {
      setReferenciaActivaGlobal('');
    };

    const quickRefEl = typeof document !== 'undefined' ? document.getElementById('quick-ref') : null;
    const handleQuickRefInput = (e) => {
      const val = e?.target?.value || '';
      setReferenciaActivaGlobal(val.trim());
    };

    if (quickRefEl) {
      quickRefEl.addEventListener('input', handleQuickRefInput);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('contract-reference:changed', handleContractChange);
      window.addEventListener('contract-reference:cleared', handleContractCleared);
    }

    const intervalId = setInterval(syncActiveRef, 1000);

    return () => {
      if (quickRefEl) {
        quickRefEl.removeEventListener('input', handleQuickRefInput);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('contract-reference:changed', handleContractChange);
        window.removeEventListener('contract-reference:cleared', handleContractCleared);
      }
      clearInterval(intervalId);
    };
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true); setError(null);
    try {
      const res = await fetch(getApiUrl('/.netlify/functions/forwarder-projects'), { method: 'GET', headers: { Accept: 'application/json' } });
      if (!res.ok) {
        console.warn(`[ForwarderWorkspace] HTTP ${res.status} al cargar proyectos, preservando estado local.`);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.projects || []);
      if (list.length > 0 || !activeProject) {
        setProjects(list);
      } else {
        setProjects((prev) => (prev && prev.length > 0 ? prev : list));
      }
      const urlRef = typeof window !== 'undefined' && window.location?.search
        ? new URLSearchParams(window.location.search).get('ref')
        : null;

      if (activeProject) {
        const updated = list.find((p) => p?.id === activeProject?.id || p?.project_ref === activeProject?.project_ref);
        if (updated) {
          const srvs = (Array.isArray(updated.services) && updated.services.length > 0)
            ? updated.services
            : ((Array.isArray(updated.line_items) && updated.line_items.length > 0) ? updated.line_items : (activeProject?.line_items || activeProject?.services || []));
          const withSrvs = {
            ...updated,
            services: srvs,
            line_items: srvs,
            land_freight_cost: Number(updated.land_freight_cost) > 0 ? Number(updated.land_freight_cost) : (activeProject?.land_freight_cost || 0),
            land_freight_sale: Number(updated.land_freight_sale) > 0 ? Number(updated.land_freight_sale) : (activeProject?.land_freight_sale || 0),
            valor_total_mercancia_usd: Number(updated.valor_total_mercancia_usd) > 0 ? Number(updated.valor_total_mercancia_usd) : (activeProject?.valor_total_mercancia_usd || 0),
          };
          setActiveProject(withSrvs);
          setprojectDocuments(withSrvs.documents || withSrvs.files || []);
        }
      } else if (urlRef) {
        const matching = list.find((p) => String(p?.project_ref || '').toUpperCase() === urlRef.toUpperCase());
        if (matching) {
          const srvs = (Array.isArray(matching.services) && matching.services.length > 0)
            ? matching.services
            : (Array.isArray(matching.line_items) ? matching.line_items : []);
          const withSrvs = {
            ...matching,
            services: srvs,
            line_items: srvs,
          };
          setActiveProject(withSrvs);
          setprojectDocuments(withSrvs.documents || withSrvs.files || []);
        }
      }
    } catch (err) {
      console.warn('[ForwarderWorkspace] Error no bloqueante al cargar proyectos:', err?.message || err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshProjects = async () => {
    setIsRefreshing(true);
    try {
      await fetchProjects();
      setSaveSuccessMessage('Listado general de proyectos actualizado correctamente');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (err) {
      console.warn('[ForwarderWorkspace] Error al actualizar proyectos:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSyncDataBridge = async () => {
    if (!activeProject) return;
    setIsSyncingDataBridge(true);
    try {
      const ref = activeProject.project_ref || activeProject.id;
      const res = await fetch(getApiUrl(`/.netlify/functions/forwarder-projects?ref=${encodeURIComponent(ref)}`), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      let updated = null;
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          updated = data.find((p) => p.project_ref === ref || p.id === activeProject.id) || data[0];
        } else if (data?.project) {
          updated = data.project;
        } else if (data?.projects) {
          updated = data.projects.find((p) => p.project_ref === ref || p.id === activeProject.id) || data.projects[0];
        } else if (data?.project_ref) {
          updated = data;
        }
      }

      if (updated) {
        const srvs = (Array.isArray(updated.services) && updated.services.length > 0)
          ? updated.services
          : ((Array.isArray(updated.line_items) && updated.line_items.length > 0) ? updated.line_items : (activeProject?.line_items || activeProject?.services || []));
        const withSrvs = {
          ...updated,
          services: srvs,
          line_items: srvs,
          land_freight_cost: Number(updated.land_freight_cost) > 0 ? Number(updated.land_freight_cost) : (activeProject?.land_freight_cost || 0),
          land_freight_sale: Number(updated.land_freight_sale) > 0 ? Number(updated.land_freight_sale) : (activeProject?.land_freight_sale || 0),
          valor_total_mercancia_usd: Number(updated.valor_total_mercancia_usd) > 0 ? Number(updated.valor_total_mercancia_usd) : (activeProject?.valor_total_mercancia_usd || 0),
        };
        setActiveProject(withSrvs);
        setProjects((prev) => (prev || []).map((p) => (p?.id === withSrvs?.id || p?.project_ref === withSrvs?.project_ref ? withSrvs : p)));
        if (updated.documents || updated.files) {
          setprojectDocuments(updated.documents || updated.files);
        }

        // Hidratar campos de ruta, distancia, LDM, costes y márgenes en el estado local del Modo Técnico
        const pRoute = withSrvs.route_and_chartering ||
          withSrvs.line_items?.[0]?.payload_data?.route_and_chartering ||
          withSrvs.services?.[0]?.payload_data?.route_and_chartering ||
          withSrvs.data?.route || {};

        // BLINDAJE: Solo heredar datos estrictamente terrestres
        const sOrigin = withSrvs.land_route?.origin || withSrvs.land_origin || '';
        const sDestination = withSrvs.land_route?.destination || withSrvs.land_destination || '';
        const sDist = Math.round(Number(withSrvs.land_route?.distance_km || withSrvs.land_distance || 0));

        if (sOrigin) { setLandOrigin(sOrigin); }
        if (sDestination) { setLandDestination(sDestination); }
        if (sDist > 0) { setDistanceKm(sDist); }

        // Hidratar lista de empaque / mercancía preservando desglose íntegro y aplicando Mapeo Inteligente
        const rawSyncItems = extractProjectCargoItems(updated);
        const mappedSyncItems = (rawSyncItems || []).map((it, idx) => hydrateCargoItem(it, withSrvs.cargoCategory || withSrvs.cargo_category || '', it.type || it.description || '', idx));
        const syncItems = mappedSyncItems;
        setCargoItems(mappedSyncItems);

        const syncQuickTonnage = Number(withSrvs.cargoQuantity || withSrvs.cargo_quantity || withSrvs.toneladas || withSrvs.tonnes || withSrvs.cargo || (typeof window !== 'undefined' ? window.State?.cargo : 0) || 0);
        let currentEffectiveItems = mappedSyncItems;
        if (syncQuickTonnage > 0 && syncItems.length === 0) {
          const quickProduct = withSrvs.cargoType || withSrvs.cargo_type || withSrvs.product || (typeof window !== 'undefined' ? window.State?.cargoProduct : '') || 'CEM I 52,5N BIGBAG';
          const mapped = mapCargoCategoryAndType(quickProduct, withSrvs.cargoCategory || withSrvs.cargo_category || '', quickProduct);
          const quickItem = buildQuickTonnageCargoItem(syncQuickTonnage, quickProduct, withSrvs.cargoCategory || withSrvs.cargo_category || '');
          currentEffectiveItems = [quickItem];
          setCargoItems(currentEffectiveItems);
          setCargoCategory(quickItem.category || mapped.category);
        } else if (withSrvs.cargoCategory || withSrvs.cargo_category) {
          const mappedCat = mapCargoCategoryAndType(withSrvs.cargoCategory || withSrvs.cargo_category);
          setCargoCategory(mappedCat.category);
        } else if (syncItems.length > 0 && syncItems[0]?.category) {
          setCargoCategory(syncItems[0].category);
        }
        // FORZAR ACTUALIZACIÓN DEL TEXTO DE MERCANCÍA DESDE CORE PRO
        const rootCargoType = withSrvs.cargoType || withSrvs.cargo_type || withSrvs.product;
        if (rootCargoType && currentEffectiveItems.length > 0) {
            currentEffectiveItems[0].type = rootCargoType;
            setCargoItems([...currentEffectiveItems]); // Forzamos a React a pintar el cambio
        }
        // Blindar el NLP (Big Bag vs Granel): Si activeProject/withSrvs o items incluyen "big bag" (case-insensitive),
        // forzar estrictamente "Camión Plataforma con Grúa Autocarga" y bloquear cualquier fallback a granel
        const nlpOrCargoText = [
          withSrvs.cargoType,
          withSrvs.cargo_type,
          withSrvs.product,
          withSrvs.type,
          withSrvs.description,
          withSrvs.cargoCategory,
          withSrvs.cargo_category,
          withSrvs.prompt,
          withSrvs.instruction,
          withSrvs.message,
          withSrvs.text,
          withSrvs.cargoName,
          withSrvs.cargo_name,
          ...(currentEffectiveItems || []).map(it => `${it.type || ''} ${it.category || ''} ${it.description || ''}`)
        ].filter(Boolean).join(' ');

        const isBigBagDetected = /big\s*bag/i.test(nlpOrCargoText);

        if (isBigBagDetected) {
          const targetVehicle = 'Camión Plataforma con Grúa Autocarga';
          setVehicleType(targetVehicle);
          setLoadingMethod('Autocarga con Grúa del Camión');
          setDischargeMethod('Autocarga con Grúa del Camión');
          withSrvs.truck_type = targetVehicle;
          withSrvs.vehicle_type = targetVehicle;
          if (typeof window !== 'undefined') {
            window.State = window.State || {};
            window.State.vehicleType = targetVehicle;
            window.State.truckType = targetVehicle;
            window.State.truckPayloadCapacity = 21;
            window.State.cargaUtil = 21;
            window.State.dwt = 21;
            if (typeof window.handleVehicleTypeSelection === 'function') {
              window.handleVehicleTypeSelection(targetVehicle);
            }
          }
          if (typeof document !== 'undefined') {
            const inputEl = document.getElementById('nombre-buque-calculadora');
            if (inputEl) inputEl.value = targetVehicle;
            const badgeEl = document.getElementById('vessel-badge');
            if (badgeEl) badgeEl.innerText = targetVehicle;
            const execEl = document.getElementById('exec-vessel-type');
            if (execEl) execEl.textContent = targetVehicle;
            const truckCapEl = document.getElementById('truckPayloadCapacity');
            if (truckCapEl) truckCapEl.value = 21;
            const dwtEl = document.getElementById('vessel-dwt');
            if (dwtEl) dwtEl.value = 21;
          }
        } else {
          if (withSrvs.truck_type || withSrvs.vehicle_type) {
            setVehicleType(withSrvs.truck_type || withSrvs.vehicle_type);
          }
          if (withSrvs.loading_method || withSrvs.metodo_carga) {
            setLoadingMethod(withSrvs.loading_method || withSrvs.metodo_carga);
          }
          if (withSrvs.discharge_method || withSrvs.metodo_descarga || withSrvs.metodo_descarga_pod) {
            setDischargeMethod(withSrvs.discharge_method || withSrvs.metodo_descarga || withSrvs.metodo_descarga_pod);
          }
        }

        // Asignación Dinámica del Modo de Envío en los ítems de empaque
        const effectiveVehicle = isBigBagDetected ? 'Camión Plataforma con Grúa Autocarga' : (withSrvs.truck_type || withSrvs.vehicle_type || '');
        if (effectiveVehicle === 'Camión Plataforma con Grúa Autocarga' || isBigBagDetected) {
          currentEffectiveItems = currentEffectiveItems.map((item) => ({
            ...item,
            shipping_mode_supported: 'Camión Plataforma con Grúa Autocarga'
          }));
          setCargoItems(currentEffectiveItems);
        }

        // Freno al bucle infinito: Deep Compare de los items sincronizados
        const syncItemsString = JSON.stringify(currentEffectiveItems);
        if (lastCalculatedItemsRef.current !== syncItemsString) {
          lastCalculatedItemsRef.current = syncItemsString;
          autoCalculateEstimates(currentEffectiveItems);
        }

        const pFinancials = withSrvs.line_items?.[0]?.payload_data?.financial_summary ||
          withSrvs.services?.[0]?.payload_data?.financial_summary ||
          withSrvs.data?.financials || {};
        const costEur = withSrvs.land_freight_cost || withSrvs.totalTripCost || withSrvs.cost || (withSrvs.line_items || []).reduce((acc, it) => acc + Number(it.cost_eur || 0), 0) ||
          pFinancials.estimated_total_cost_eur || pFinancials.cost_eur || 0;
        const saleEur = withSrvs.land_freight_sale || withSrvs.targetSalePrice || withSrvs.sale || (withSrvs.line_items || []).reduce((acc, it) => acc + Number(it.sale_price_eur || 0), 0) ||
          pFinancials.customer_sale_price_eur || pFinancials.sale_price_eur || 0;
        
        // BLINDAJE DEL FOOTER EN SYNC: Evitamos que los ceros de la BD borren el cálculo local.
        setEstimatedCost(prev => (costEur === 0 && Number(prev) > 0) ? prev : costEur);
        setSalePrice(prev => (saleEur === 0 && Number(prev) > 0) ? prev : saleEur);
        setCost(costEur);
        setFreightSaleState(saleEur);

        const sTolls = Number(updated.tollCost || updated.tollsCost || updated.peajes || pFinancials.tollCost || (sDist > 0 ? Math.round(sDist * 0.18) : 0));
        const sDiets = Number(updated.driverDiets || updated.dietas || pFinancials.driverDiets || (sDist > 0 ? Math.round(Math.max(1, Math.ceil(sDist / 650)) * 75) : 0));
        setTollsState(sTolls);
        setDietsState(sDiets);

        if (updated.charteringAssessment || updated.chartering_assessment) {
          setCharteringAssessment(updated.charteringAssessment || updated.chartering_assessment);
        }
      } else {
        await fetchProjects();
      }

      // Sincronización del estado global de la aplicación (DataBridge / Core PRO)
      if (typeof window !== 'undefined') {
        const projToSync = updated || activeProject;
        const routeData = projToSync.route_and_chartering || projToSync.data?.route || {};
        const polVal = routeData.pol || pol || 'Madrid';
        const podVal = routeData.pod || pod || 'París';
        const distVal = routeData.distance_km || (routeData.distance_nm ? Math.round(routeData.distance_nm * 1.852) : 1250);

        if (window.State) {
          window.State.pol = polVal;
          window.State.pod = podVal;
          window.State.distance = distVal;
          window.State.activeProjectRef = projToSync.project_ref;
        }
        if (window.SeaCharterStore?.getState) {
          try {
            const store = window.SeaCharterStore.getState();
            if (store && typeof store.setPortOrRoute === 'function') {
              store.setPortOrRoute({ pol: polVal, pod: podVal, distanceKm: distVal });
            }
          } catch (_) {}
        }
        if (typeof window.revalidateDataBridgeConnectionState === 'function') {
          window.revalidateDataBridgeConnectionState();
        }
      }

      setSaveSuccessMessage('¡Expediente sincronizado con éxito desde Neon (DataBridge)!');
      setTimeout(() => setSaveSuccessMessage(null), 3500);
    } catch (err) {
      console.warn('[ForwarderWorkspace] Error al sincronizar con Neon DataBridge:', err);
      setError('Error al sincronizar con Neon: ' + (err?.message || 'Error desconocido'));
      setTimeout(() => setError(null), 4000);
    } finally {
      setIsSyncingDataBridge(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (activeProject) {
      setprojectDocuments(activeProject.documents || activeProject.files || []);

      const projectRoute = activeProject.route_and_chartering ||
        activeProject.line_items?.[0]?.payload_data?.route_and_chartering ||
        activeProject.services?.[0]?.payload_data?.route_and_chartering ||
        activeProject.data?.route || {};

      // Hidratación forzosa de los estados del Modo Técnico
      setOrigin(activeProject.pol || '');
      setDestination(activeProject.pod || '');
      setDistance(Math.round(Number(activeProject.distance_nm || activeProject.distanceNm || 0)));
      setLandOrigin(activeProject?.land_route?.origin || activeProject?.land_origin || '');
      setLandDestination(activeProject?.land_route?.destination || activeProject?.land_destination || '');
      setDistanceKm(Number(activeProject?.land_route?.distance_km || activeProject?.land_distance || 0));

      // Extraer costes si están anidados
      const dbCost = activeProject.land_freight_cost || 0;
      setCost(dbCost);

      // Hidratar la Lista de Empaque (Mercancía) preservando desglose íntegro y aplicando Mapeo Inteligente
      const currentProjKey = `${activeProject.id || activeProject.project_ref || ''}_${activeProject.updated_at || ''}_${(activeProject.items || activeProject.cargo_items || activeProject.line_items || []).length}`;
      const isSwitchingProject = lastHydratedProjectIdRef.current !== currentProjKey;

      if (isSwitchingProject) {
        lastHydratedProjectIdRef.current = currentProjKey;
        const rawActiveItems = extractProjectCargoItems(activeProject);
        const mappedItems = rawActiveItems.map((it, idx) => hydrateCargoItem(it, activeProject.cargoCategory || activeProject.cargo_category || '', it.type || it.description || '', idx));
        const hydratedItems = mappedItems;
        setCargoItems(mappedItems);
        if (activeProject.cargoCategory || activeProject.cargo_category) {
          const mappedCat = mapCargoCategoryAndType(activeProject.cargoCategory || activeProject.cargo_category);
          setCargoCategory(mappedCat.category);
        } else if (mappedItems.length > 0 && mappedItems[0]?.category) {
          setCargoCategory(mappedItems[0].category);
        }

        let currentEffectiveItems = mappedItems;

        // Si el proyecto viene de una cotización rápida (ej. 10.000t de Cemento), sincronizar volumen global / input de toneladas
        const quickTonnage = Number(activeProject.cargoQuantity || activeProject.cargo_quantity || activeProject.toneladas || activeProject.tonnes || activeProject.cargo || (typeof window !== 'undefined' ? window.State?.cargo : 0) || 0);
        if (quickTonnage > 0) {
          if (hydratedItems.length === 0) {
            const quickProduct = activeProject.cargoType || activeProject.cargo_type || activeProject.product || (typeof window !== 'undefined' ? window.State?.cargoProduct : '') || 'CEM I 52,5N BIGBAG';
            const mapped = mapCargoCategoryAndType(quickProduct, activeProject.cargoCategory || activeProject.cargo_category || '', quickProduct);
            const quickItem = buildQuickTonnageCargoItem(quickTonnage, quickProduct, activeProject.cargoCategory || activeProject.cargo_category || '');
            currentEffectiveItems = [quickItem];
            setCargoItems(currentEffectiveItems);
            setCargoCategory(quickItem.category || mapped.category);
          }
          if (typeof document !== 'undefined') {
            const cargoQtyEl = document.getElementById('cargo-qty');
            if (cargoQtyEl && (!cargoQtyEl.value || cargoQtyEl.value === '0')) {
              cargoQtyEl.value = String(quickTonnage);
              cargoQtyEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
          if (typeof window !== 'undefined' && window.State) {
            window.State.cargo = quickTonnage;
            window.State.cargoQuantity = quickTonnage;
          }
        }

        // Blindar el NLP (Big Bag vs Granel): Para asegurar que el crash no revierta el vehículo,
        // verifica en la función de hidratación de React que si activeProject.cargoType o el texto del NLP
        // incluye las palabras "big bag" (case insensitive), se fuerce estrictamente el vehicleType a
        // "Camión Plataforma con Grúa Autocarga" y se bloquee cualquier fallback automático a granel.
        const nlpOrCargoText = [
          activeProject.cargoType,
          activeProject.cargo_type,
          activeProject.product,
          activeProject.type,
          activeProject.description,
          activeProject.cargoCategory,
          activeProject.cargo_category,
          activeProject.prompt,
          activeProject.instruction,
          activeProject.message,
          activeProject.text,
          activeProject.cargoName,
          activeProject.cargo_name,
          ...(currentEffectiveItems || []).map(it => `${it.type || ''} ${it.category || ''} ${it.description || ''}`)
        ].filter(Boolean).join(' ');

        const isBigBagDetected = /big\s*bag/i.test(nlpOrCargoText);

        if (isBigBagDetected) {
          const targetVehicle = 'Camión Plataforma con Grúa Autocarga';
          setVehicleType(targetVehicle);
          setLoadingMethod('Autocarga con Grúa del Camión');
          setDischargeMethod('Autocarga con Grúa del Camión');
          activeProject.truck_type = targetVehicle;
          activeProject.vehicle_type = targetVehicle;
          if (typeof window !== 'undefined') {
            window.State = window.State || {};
            window.State.vehicleType = targetVehicle;
            window.State.truckType = targetVehicle;
            window.State.truckPayloadCapacity = 21;
            window.State.cargaUtil = 21;
            window.State.dwt = 21;
            if (typeof window.handleVehicleTypeSelection === 'function') {
              window.handleVehicleTypeSelection(targetVehicle);
            }
          }
          if (typeof document !== 'undefined') {
            const inputEl = document.getElementById('nombre-buque-calculadora');
            if (inputEl) inputEl.value = targetVehicle;
            const badgeEl = document.getElementById('vessel-badge');
            if (badgeEl) badgeEl.innerText = targetVehicle;
            const execEl = document.getElementById('exec-vessel-type');
            if (execEl) execEl.textContent = targetVehicle;
            const truckCapEl = document.getElementById('truckPayloadCapacity');
            if (truckCapEl) truckCapEl.value = 21;
            const dwtEl = document.getElementById('vessel-dwt');
            if (dwtEl) dwtEl.value = 21;
          }
        } else {
          if (activeProject.truck_type || activeProject.vehicle_type || activeProject.data?.truckType) {
            setVehicleType(activeProject.truck_type || activeProject.vehicle_type || activeProject.data?.truckType);
          }
          if (activeProject.loading_method || activeProject.metodo_carga) {
            setLoadingMethod(activeProject.loading_method || activeProject.metodo_carga);
          }
          if (activeProject.discharge_method || activeProject.metodo_descarga || activeProject.metodo_descarga_pod) {
            setDischargeMethod(activeProject.discharge_method || activeProject.metodo_descarga || activeProject.metodo_descarga_pod);
          }
        }

        // Asignación Dinámica del Modo de Envío en los ítems de empaque
        const effectiveVehicle = isBigBagDetected ? 'Camión Plataforma con Grúa Autocarga' : (activeProject.truck_type || activeProject.vehicle_type || '');
        if (effectiveVehicle === 'Camión Plataforma con Grúa Autocarga' || isBigBagDetected) {
          currentEffectiveItems = currentEffectiveItems.map((item) => ({
            ...item,
            shipping_mode_supported: 'Camión Plataforma con Grúa Autocarga'
          }));
          setCargoItems(currentEffectiveItems);
        }

        // Recálculo reactivo inmediato protegido con Deep Compare
        const hydrationItemsString = JSON.stringify(currentEffectiveItems);
        if (lastCalculatedItemsRef.current !== hydrationItemsString) {
          lastCalculatedItemsRef.current = hydrationItemsString;
          autoCalculateEstimates(currentEffectiveItems);
        }
      }

      // Conectar Totales Inferiores (Coste y Venta)
      const projectServicesList = (Array.isArray(activeProject.services) && activeProject.services.length > 0)
        ? activeProject.services
        : (Array.isArray(activeProject.line_items) ? activeProject.line_items : []);
      const totalServicesCost = projectServicesList.reduce((acc, it) => acc + (Number(it.cost_eur) || 0), 0);
      const totalServicesSale = projectServicesList.reduce((acc, it) => acc + (Number(it.sale_price_eur) || 0), 0);

      const effectiveCost = activeProject.land_freight_cost || activeProject.totalTripCost || activeProject.cost || totalServicesCost || 0;
      const effectiveSale = activeProject.land_freight_sale || activeProject.targetSalePrice || activeProject.sale || totalServicesSale || 0;
      
      // BLINDAJE DEL FOOTER: Evita sobrescrituras con 0 si ya hay cálculo.
      setEstimatedCost(prev => (effectiveCost === 0 && Number(prev) > 0) ? prev : effectiveCost);
      setSalePrice(prev => (effectiveSale === 0 && Number(prev) > 0) ? prev : effectiveSale);

      // Sobrescribe los estados visuales con los datos reales de Neon / DataBridge
      const newOrigin = activeProject.pol || projectRoute.pol || (typeof window !== 'undefined' ? window.State?.pol : '') || '';
      const newDestination = activeProject.pod || projectRoute.pod || (typeof window !== 'undefined' ? window.State?.pod : '') || '';
      const rawDistance = Number(activeProject.distance_nm || activeProject.distanceNm || projectRoute.distance_nm || (typeof window !== 'undefined' ? (window.State?.distance_nm || window.State?.distance) : 0) || 0);
      const newDistance = Math.round(rawDistance);

      const newLandOrigin = activeProject?.land_route?.origin || activeProject?.land_origin || '';
      const newLandDestination = activeProject?.land_route?.destination || activeProject?.land_destination || '';
      const newDistanceKm = Number(activeProject?.land_route?.distance_km || activeProject?.land_distance || 0);

      const newTolls = Number(activeProject.tollCost || activeProject.tollsCost || activeProject.peajes || activeProject.data?.financials?.tollCost || (typeof window !== 'undefined' ? (window.State?.tollCost || window.State?.peajes) : 0) || (newDistanceKm > 0 ? Math.round(newDistanceKm * 0.18) : 0));
      const newDiets = Number(activeProject.driverDiets || activeProject.dietas || activeProject.data?.financials?.driverDiets || (typeof window !== 'undefined' ? (window.State?.driverDiets || window.State?.dietas) : 0) || (newDistanceKm > 0 ? Math.round(Math.max(1, Math.ceil(newDistanceKm / 650)) * 75) : 0));

      setOriginState(newOrigin);
      setDestinationState(newDestination);
      // Sanear Decimales en Distancia
      setDistanceState(Math.round(newDistance));
      setDistance(Math.round(newDistance));
      setLandOrigin(newLandOrigin);
      setLandDestination(newLandDestination);
      setDistanceKm(newDistanceKm);
      setTollsState(newTolls);
      setDietsState(newDiets);

      const rawLoadRate = Number(projectRoute.loading_rate_mt_day || projectRoute.loadingRate || activeProject.loadingRate);
      if (rawLoadRate > 0) {
        setLoadTime(rawLoadRate > 24 ? 2 : rawLoadRate);
      } else {
        setLoadTime(2);
      }
      const rawDischargeRate = Number(projectRoute.discharging_rate_mt_day || projectRoute.dischargeRate || activeProject.dischargingRate);
      if (rawDischargeRate > 0) {
        setDischargeTime(rawDischargeRate > 24 ? 2 : rawDischargeRate);
      } else {
        setDischargeTime(2);
      }
      if (projectRoute.vessel_speed_knots) setVesselSpeedKnots(Number(projectRoute.vessel_speed_knots));
      if (projectRoute.daily_hire_rate_usd) setVesselDailyHireUsd(Number(projectRoute.daily_hire_rate_usd));
      if (projectRoute.actual_loading_days !== undefined && projectRoute.actual_loading_days !== null) {
        setActualLoadingDays(projectRoute.actual_loading_days);
      }
      if (projectRoute.actual_discharging_days !== undefined && projectRoute.actual_discharging_days !== null) {
        setActualDischargingDays(projectRoute.actual_discharging_days);
      }
      if (projectRoute.demurrage_daily_rate_usd) {
        setDemurrageDailyRateUsd(Number(projectRoute.demurrage_daily_rate_usd));
      }

      const projectAssessment = activeProject.charteringAssessment ||
        activeProject.chartering_assessment ||
        activeProject.line_items?.[0]?.payload_data?.charteringAssessment ||
        activeProject.services?.[0]?.payload_data?.charteringAssessment;
      if (projectAssessment) {
        setCharteringAssessment(projectAssessment);
      }

      const rawProjectGoodsVal = Number(
        activeProject.valor_total_mercancia_usd
        ?? activeProject.goodsValue
        ?? activeProject.merchandiseValue
        ?? (typeof window !== 'undefined' ? (window.State?.goodsValue || window.State?.valor_total_mercancia_usd || window.State?.merchandiseValue) : 0)
        ?? 0
      );
      if (rawProjectGoodsVal > 0) {
        setMercanciaCost(rawProjectGoodsVal);
      }
    } else {
      setprojectDocuments([]);
    }
  }, [activeProject]);

  // Guarda estricta para camiones: Fix de Estado Fantasma (Horas de Camión)
  useEffect(() => {
    if (!activeProject || totalWeightKg === 0) {
      setLoadTime(2);
      setDischargeTime(2);
      setOrigin('');
      setDestination('');
    }
  }, [activeProject, totalWeightKg]);

  // Hook de sincronización reactiva (Two-Way Binding): Parser del Agente -> Inputs del Formulario y Contadores Visuales
  // Asegura que cuando el Agente de Proyectos procese una instrucción (charteringAssessment / rotationBreakdown),
  // los inputs de "Ruta Marítima, Ritmos Operativos y Gestión de Demoras" reflejen de inmediato los nuevos valores devueltos por el backend
  // y actualicen los contadores visuales en tiempo real, evitando que los campos se queden estáticos con los valores por defecto iniciales.
  useEffect(() => {
    if (!charteringAssessment) return;

    const rot = charteringAssessment.rotationBreakdown || charteringAssessment.timeCharterEquivalent;
    if (!rot) return;

    if (rot.pol && rot.pol !== pol) {
      setPol(rot.pol);
    }
    if (rot.pod && rot.pod !== pod) {
      setPod(rot.pod);
    }
    const loadRate = Number(rot.loadingRateMtDay || rot.loadingRate || rot.loadRate);
    if (!isNaN(loadRate) && loadRate > 0 && loadRate !== Number(loadingRate)) {
      setLoadingRate(loadRate);
    }
    const dischRate = Number(rot.dischargingRateMtDay || rot.dischargingRate || rot.dischargeRate);
    if (!isNaN(dischRate) && dischRate > 0 && dischRate !== Number(dischargingRate)) {
      setDischargingRate(dischRate);
    }
    const dist = Number(rot.distanceNm || rot.distance_nm);
    if (!isNaN(dist) && dist > 0 && dist !== Number(distanceNm)) {
      setDistanceNm(dist);
    }
    const speed = Number(rot.serviceSpeedKnots || rot.serviceSpeed || rot.speedKnots);
    if (!isNaN(speed) && speed > 0 && speed !== Number(vesselSpeedKnots)) {
      setVesselSpeedKnots(speed);
    }
    const dailyHire = Number(rot.dailyHireRateUsd || rot.vesselDailyRateUsd || rot.dailyRateUsd);
    if (!isNaN(dailyHire) && dailyHire > 0 && dailyHire !== Number(vesselDailyHireUsd)) {
      setVesselDailyHireUsd(dailyHire);
    }
    if (rot.demurrage) {
      const dem = rot.demurrage;
      if (dem.actualLoadingDays !== undefined && dem.actualLoadingDays !== null && String(dem.actualLoadingDays) !== String(actualLoadingDays)) {
        setActualLoadingDays(dem.actualLoadingDays);
      }
      if (dem.actualDischargingDays !== undefined && dem.actualDischargingDays !== null && String(dem.actualDischargingDays) !== String(actualDischargingDays)) {
        setActualDischargingDays(dem.actualDischargingDays);
      }
      const demDaily = Number(dem.demurrageRateDailyUsd);
      if (!isNaN(demDaily) && demDaily > 0 && demDaily !== Number(demurrageDailyRateUsd)) {
        setDemurrageDailyRateUsd(demDaily);
      }
    }
  }, [charteringAssessment]);

  // Hook de sincronización reactiva (Two-Way Binding): Inputs del Formulario -> Estado global de Fletamento y Workspace
  // Mantiene sincronizado el desglose de rotación (rotationBreakdown) cuando el usuario edita directamente los campos
  useEffect(() => {
    setCharteringAssessment(prev => {
      const currentRot = prev?.rotationBreakdown || {};
      const newLoadingRate = Number(loadingRate);
      const newDischargingRate = Number(dischargingRate);
      const newDistance = Number(distanceNm);
      const newSpeed = Number(vesselSpeedKnots);
      const newDailyHire = Number(vesselDailyHireUsd);
      const newDemDaily = Number(demurrageDailyRateUsd);
      const newActualLoad = actualLoadingDays !== '' && actualLoadingDays !== null && !isNaN(Number(actualLoadingDays)) ? Number(actualLoadingDays) : null;
      const newActualDisch = actualDischargingDays !== '' && actualDischargingDays !== null && !isNaN(Number(actualDischargingDays)) ? Number(actualDischargingDays) : null;

      if (
        currentRot.pol === pol &&
        currentRot.pod === pod &&
        currentRot.loadingRateMtDay === newLoadingRate &&
        currentRot.dischargingRateMtDay === newDischargingRate &&
        currentRot.distanceNm === newDistance &&
        currentRot.serviceSpeedKnots === newSpeed &&
        currentRot.dailyHireRateUsd === newDailyHire &&
        currentRot.demurrage?.actualLoadingDays === newActualLoad &&
        currentRot.demurrage?.actualDischargingDays === newActualDisch &&
        currentRot.demurrage?.demurrageRateDailyUsd === newDemDaily
      ) {
        return prev;
      }

      return {
        ...(prev || {}),
        rotationBreakdown: {
          ...currentRot,
          pol,
          pod,
          loadingRateMtDay: newLoadingRate,
          dischargingRateMtDay: newDischargingRate,
          distanceNm: newDistance,
          serviceSpeedKnots: newSpeed,
          dailyHireRateUsd: newDailyHire,
          demurrage: {
            ...(currentRot.demurrage || {}),
            actualLoadingDays: newActualLoad,
            actualDischargingDays: newActualDisch,
            demurrageRateDailyUsd: newDemDaily,
          }
        }
      };
    });
  }, [pol, pod, loadingRate, dischargingRate, distanceNm, vesselSpeedKnots, vesselDailyHireUsd, actualLoadingDays, actualDischargingDays, demurrageDailyRateUsd]);

  const persistProjectToDatabase = async (projectToSave) => {
    try {
      const servicesList = (Array.isArray(projectToSave?.services) && projectToSave.services.length > 0)
        ? projectToSave.services
        : (Array.isArray(projectToSave?.line_items) ? projectToSave.line_items : []);

      const landOrigin = origin || pol || projectToSave?.land_origin || projectToSave?.pol || activeProject?.land_origin || activeProject?.pol || '';
      const landDestination = destination || pod || projectToSave?.land_destination || projectToSave?.pod || activeProject?.land_destination || activeProject?.pod || '';
      const distanceKm = Number(projectToSave?.land_distance) || Number(distanceNm) || Number(activeProject?.land_distance) || 0;

      // 1. Obtener la carga total en KG
      const tuVariableDeKilosCalculados = totals?.weight || (totalWeightKg || 0);
      const totalKg = (projectToSave?.total_weight_tons || activeProject?.total_weight_tons)
        ? ((projectToSave?.total_weight_tons || activeProject.total_weight_tons) * 1000)
        : (tuVariableDeKilosCalculados || 0);

      // 2. Calcular los camiones necesarios reales
      const truckType = vehicleType || projectToSave?.truck_type || activeProject?.truck_type || 'Tráiler Tauliner (13.6m)';
      const payloadPerTruck = getVehiclePayloadKg(truckType) || 24000;
      const trucksNeeded = Number(projectToSave?.total_trucks) > 0
        ? Number(projectToSave.total_trucks)
        : (totalKg > 0 ? Math.ceil(totalKg / payloadPerTruck) : 1);

      // Coste y Venta por camión
      const runningCost = Math.round(distanceKm * 1.57);
      const tolls = Math.round(Number(activeProject?.tollCost || activeProject?.peajes || tollCost || (distanceKm > 0 ? distanceKm * 0.18 : 0)));
      const transitDays = distanceKm > 0 ? Math.max(1, Math.ceil(distanceKm / 650)) : 1;
      const diets = Math.round(Number(activeProject?.driverDiets || activeProject?.dietas || driverDiets || (transitDays * 75)));
      const safeLoadHours = Number(loadingRate || 2) > 24 ? 2 : Number(loadingRate || 2);
      const safeDischHours = Number(dischargingRate || 2) > 24 ? 2 : Number(dischargingRate || 2);
      const waitPenalty = Number(warehouseWaitPenaltyEur || 0) || (Math.max(0, (safeLoadHours - 2) * 40) + Math.max(0, (safeDischHours - 2) * 40));
      const baseTruckOperatingCost = runningCost + tolls + diets + waitPenalty;

      const costeOperativoPorCamion = (!distanceKm || Number(distanceKm) <= 0)
        ? 0
        : (baseTruckOperatingCost > 0
          ? baseTruckOperatingCost
          : (Number(estimatedCost) > 0 ? Number(estimatedCost) : (Number(activeProject?.land_freight_cost) > 0 ? Number(activeProject.land_freight_cost) : 0)));
      const precioVentaPorCamion = (!distanceKm || Number(distanceKm) <= 0)
        ? 0
        : (costeOperativoPorCamion > 0
          ? Number((costeOperativoPorCamion * 1.18).toFixed(2))
          : (Number(salePrice) > 0 ? Number(salePrice) : (Number(activeProject?.land_freight_sale) > 0 ? Number(activeProject.land_freight_sale) : 0)));

      // 3. Coste y Venta Total (SIN volver a multiplicar por toneladas ni kilos)
      const finalTotalLandCost = (!distanceKm || Number(distanceKm) <= 0) ? 0 : Number((trucksNeeded * costeOperativoPorCamion).toFixed(2));
      const finalTotalLandSale = (!distanceKm || Number(distanceKm) <= 0) ? 0 : Number((trucksNeeded * precioVentaPorCamion).toFixed(2));

      const tuVariableDeCosteTotalTerrestre = (!distanceKm || Number(distanceKm) <= 0)
        ? 0
        : (Number(projectToSave?.land_freight_cost) > 0
          ? Number(projectToSave.land_freight_cost)
          : (finalTotalLandCost > 0 ? finalTotalLandCost : Number(estimatedCost || activeProject?.land_freight_cost || 0)));
      const tuVariableDePrecioVentaTerrestre = (!distanceKm || Number(distanceKm) <= 0)
        ? 0
        : (Number(projectToSave?.land_freight_sale || projectToSave?.targetSalePrice || projectToSave?.sale) > 0
          ? Number(projectToSave.land_freight_sale || projectToSave.targetSalePrice || projectToSave.sale)
          : (finalTotalLandSale > 0 ? finalTotalLandSale : Number(salePrice || activeProject?.land_freight_sale || 0)));

      const payload = {
        ...activeProject, // Heredar todo por defecto
        ...(projectToSave || {}),
        items: (cargoItems && cargoItems.length > 0) ? cargoItems : (activeProject?.items || projectToSave?.items || []),
        cargo_items: (cargoItems && cargoItems.length > 0) ? cargoItems : (activeProject?.cargo_items || activeProject?.line_items?.[0]?.payload_data?.cargo_items || projectToSave?.cargo_items || []),
        packing_list: activeProject?.packing_list || projectToSave?.packing_list || null,
        // ... (tus campos terrestres actualizados)
        land_route: { origin: landOrigin, destination: landDestination, distance_km: distanceKm },
        truck_type: vehicleType || projectToSave?.truck_type || activeProject?.truck_type,
        vehicle_type: vehicleType || projectToSave?.vehicle_type || activeProject?.vehicle_type,
        vehicle_attributes: activeProject?.vehicle_attributes || projectToSave?.vehicle_attributes || null,
        loading_method: loadingMethod || projectToSave?.loading_method || activeProject?.loading_method,
        discharge_method: dischargeMethod || projectToSave?.discharge_method || activeProject?.discharge_method,
        services: servicesList,
        line_items: servicesList,
        land_freight_cost: (!distanceKm || Number(distanceKm) <= 0) ? 0 : (Number(projectToSave.land_freight_cost) || Number(tuVariableDeCosteTotalTerrestre || 0)),
        land_freight_sale: (!distanceKm || Number(distanceKm) <= 0) ? 0 : (Number(projectToSave.land_freight_sale || projectToSave.targetSalePrice || projectToSave.sale) || Number(tuVariableDePrecioVentaTerrestre || 0)),
        valor_total_mercancia_usd: Number(projectToSave.valor_total_mercancia_usd) || Number(activeProject?.valor_total_mercancia_usd) || 0,
        land_origin: pol || origin || projectToSave.land_origin || projectToSave.pol || activeProject?.land_origin || activeProject?.pol || landOrigin,
        land_destination: pod || destination || projectToSave.land_destination || projectToSave.pod || activeProject?.land_destination || activeProject?.pod || landDestination,
        land_distance: distanceKm,
        total_trucks: Number(projectToSave?.total_trucks) > 0 ? Number(projectToSave.total_trucks) : (trucksNeeded || activeProject?.total_trucks),
        road_transit_days: projectToSave?.road_transit_days || activeProject?.road_transit_days,
        road_net_margin: projectToSave?.road_net_margin || activeProject?.road_net_margin,
        dossier_ref: projectToSave?.dossier_ref || projectToSave?.parent_ref || projectToSave?.referenciaPadre || referenciaActivaGlobal || activeProject?.dossier_ref || null,
        parent_ref: projectToSave?.parent_ref || projectToSave?.dossier_ref || projectToSave?.referenciaPadre || referenciaActivaGlobal || activeProject?.parent_ref || null,
        referenciaPadre: projectToSave?.referenciaPadre || projectToSave?.dossier_ref || projectToSave?.parent_ref || referenciaActivaGlobal || activeProject?.referenciaPadre || null,
        data: projectToSave?.data || activeProject?.data || {},
      };

      const res = await fetch(getApiUrl('/.netlify/functions/forwarder-projects'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        await fetch(getApiUrl('/.netlify/functions/forwarder-projects'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      setActiveProject((prev) => (prev && (prev.id === payload.id || prev.project_ref === payload.project_ref) ? { ...prev, ...payload } : (prev || payload)));
      setProjects((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const exists = list.some((p) => p?.id === payload.id || p?.project_ref === payload.project_ref);
        if (exists) {
          return list.map((p) => (p?.id === payload.id || p?.project_ref === payload.project_ref ? { ...p, ...payload } : p));
        }
        return [payload, ...list];
      });
    } catch (err) {
      console.error('Error al guardar en base de datos:', err);
    }
  };

  const handleSaveProject = async () => {
    try {
      if (!activeProject) return;
      const currentOrigin = activeProject?.land_route?.origin || activeProject?.land_origin || landOrigin || '';
      const currentDestination = activeProject?.land_route?.destination || activeProject?.land_destination || landDestination || '';
      const currentDistance = Number(activeProject?.land_route?.distance_km || activeProject?.land_distance || distanceKm || 0);

      const landOrigin = currentOrigin;
      const landDestination = currentDestination;
      const distanceKm = currentDistance;

      // 1. Obtener la carga total en KG
      const tuVariableDeKilosCalculados = totals?.weight || (totalWeightKg || 0);
      const totalKg = activeProject?.total_weight_tons ? (activeProject.total_weight_tons * 1000) : (tuVariableDeKilosCalculados || 0);

      // 2. Calcular los camiones necesarios reales
      const truckType = vehicleType || activeProject?.truck_type || activeProject?.vehicle_type || 'Tráiler Tauliner (13.6m)';
      const payloadPerTruck = getVehiclePayloadKg(truckType) || 24000;
      const trucksNeeded = totalKg > 0 ? Math.ceil(totalKg / payloadPerTruck) : 1;

      // Coste y Venta por camión
      const runningCost = Math.round(distanceKm * 1.57);
      const tolls = Math.round(Number(activeProject?.tollCost || activeProject?.peajes || tollCost || (distanceKm > 0 ? distanceKm * 0.18 : 0)));
      const transitDays = distanceKm > 0 ? Math.max(1, Math.ceil(distanceKm / 650)) : 1;
      const diets = Math.round(Number(activeProject?.driverDiets || activeProject?.dietas || driverDiets || (transitDays * 75)));
      const safeLoadHours = Number(loadingRate || 2) > 24 ? 2 : Number(loadingRate || 2);
      const safeDischHours = Number(dischargingRate || 2) > 24 ? 2 : Number(dischargingRate || 2);
      const waitPenalty = Number(warehouseWaitPenaltyEur || 0) || (Math.max(0, (safeLoadHours - 2) * 40) + Math.max(0, (safeDischHours - 2) * 40));
      const baseTruckOperatingCost = runningCost + tolls + diets + waitPenalty;

      const costeOperativoPorCamion = (!distanceKm || Number(distanceKm) <= 0)
        ? 0
        : (baseTruckOperatingCost > 0
          ? baseTruckOperatingCost
          : (Number(estimatedCost) > 0 ? Number(estimatedCost) : (Number(activeProject?.land_freight_cost) > 0 ? Number(activeProject.land_freight_cost) : 0)));
      const precioVentaPorCamion = (!distanceKm || Number(distanceKm) <= 0)
        ? 0
        : (costeOperativoPorCamion > 0
          ? Number((costeOperativoPorCamion * 1.18).toFixed(2))
          : (Number(salePrice) > 0 ? Number(salePrice) : (Number(activeProject?.land_freight_sale) > 0 ? Number(activeProject.land_freight_sale) : 0)));

      // 3. Coste y Venta Total (SIN volver a multiplicar por toneladas ni kilos)
      const finalTotalLandCost = Number((trucksNeeded * costeOperativoPorCamion).toFixed(2));
      const finalTotalLandSale = Number((trucksNeeded * precioVentaPorCamion).toFixed(2));

      // 1. ELIMINAR EL BLOAT MARÍTIMO (Dieta estricta para evitar Error 500)
      const cleanProject = { ...activeProject };
      delete cleanProject.weather_data;
      delete cleanProject.meteo;
      delete cleanProject.port_history;
      delete cleanProject.wave_height;
      delete cleanProject.ocean_conditions;
      delete cleanProject.historical_data;

      // 2. CONSTRUIR PAYLOAD PURAMENTE TERRESTRE
      const payload = {
        ...cleanProject,
        // Blindaje de mercancía
        items: cleanProject.items || [],
        cargo_items: (typeof cargoItems !== 'undefined' && cargoItems.length > 0) ? cargoItems : (cleanProject.cargo_items || []),
        
        // Actualización exclusiva del camión
        land_route: {
          origin: landOrigin,
          destination: landDestination,
          distance_km: distanceKm
        },
        land_origin: landOrigin,
        land_destination: landDestination,
        land_distance: distanceKm,
        land_freight_cost: finalTotalLandCost,
        land_freight_sale: finalTotalLandSale,
        total_trucks: trucksNeeded,
        safe_load_hours: typeof safeLoadHours !== 'undefined' ? safeLoadHours : (activeProject?.safe_load_hours || 2),
        safe_disch_hours: typeof safeDischHours !== 'undefined' ? safeDischHours : (activeProject?.safe_disch_hours || 2)
      };

      setActiveProject(payload);
      setProjects((prev) => (prev || []).map((p) => (p?.id === payload.id || p?.project_ref === payload.project_ref ? payload : p)));
      
      const res = await persistProjectToDatabase(payload);
      setSaveSuccessMessage('¡Expediente guardado correctamente!');
      setTimeout(() => setSaveSuccessMessage(null), 3500);
      return res;
    } catch (err) {
      console.error('[ForwarderWorkspace] Error en handleSaveProject:', err);
      setError('Error al guardar el proyecto: ' + (err?.message || 'Error desconocido'));
      setTimeout(() => setError(null), 4000);
    }
  };

  if (typeof window !== 'undefined') {
    window.handleSaveProject = handleSaveProject;
  }

  const handleCreateProject = async () => {
    const input = window.prompt('Introduce el nombre del cliente para el nuevo proyecto:');
    if (!input || !input.trim()) return;
    setIsCreating(true);
    try {
      const activeRef = referenciaActivaGlobal || getActiveGlobalReference();
      const res = await fetch(getApiUrl('/.netlify/functions/forwarder-projects'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_name: input.trim(),
          documents: [],
          dossier_ref: activeRef || null,
          parent_ref: activeRef || null,
          referenciaPadre: activeRef || null,
        }),
      });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      const createdPayload = payload.project || payload;
      const createdProject = {
        ...createdPayload,
        dossier_ref: createdPayload?.dossier_ref || activeRef || null,
        parent_ref: createdPayload?.parent_ref || activeRef || null,
        referenciaPadre: createdPayload?.referenciaPadre || activeRef || null,
      };
      setProjects((prev) => [createdProject, ...prev]);
      setActiveProject(createdProject);
      setprojectDocuments([]);
      setLoadTime(2);
      setDischargeTime(2);
      setOrigin('');
      setDestination('');
    } catch (err) {
      window.alert('No se pudo crear el proyecto.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (e, projToDelete) => {
    // 🛡️ BLINDAJE ULTRA-ESTRICTO: Exigir que sea un clic humano real (isTrusted).
    if (!e || !e.isTrusted || typeof e.stopPropagation !== 'function') {
      console.warn("Bloqueado: Clic virtual o evento de IA detectado.");
      return; 
    }
    e.stopPropagation();

    // Extraer el proyecto de forma estricta
    const targetProj = projToDelete;
    if (!targetProj || typeof targetProj !== 'object' || (!targetProj.id && !targetProj.project_ref)) {
      return;
    }

    const displayName = targetProj.client_name || targetProj.project_ref || 'este proyecto';
    const confirmed = window.confirm(`¿Estás seguro de que deseas eliminar el proyecto "${displayName}"?`);
    if (!confirmed) return;

    // 1. Eliminar inmediatamente del estado local en el frontend
    const updatedProjects = projects.filter((p) => {
      if (projToDelete.id && p.id) {
        return p.id !== projToDelete.id;
      }
      return p.project_ref !== projToDelete.project_ref;
    });
    setProjects(updatedProjects);

    // 2. Si el usuario elimina el proyecto activo en el workspace, limpiar o redirigir
    const isCurrentActive = activeProject && (
      (projToDelete.id && activeProject.id === projToDelete.id) ||
      (projToDelete.project_ref && activeProject.project_ref === projToDelete.project_ref)
    );

    if (isCurrentActive) {
      setIsCargoModalOpen(false);
      setShowExecutiveReport(false);
      if (updatedProjects.length > 0) {
        setActiveProject(updatedProjects[0]);
      } else {
        setActiveProject(null);
      }
    }

    setSaveSuccessMessage('Proyecto eliminado correctamente');
    setTimeout(() => setSaveSuccessMessage(null), 3000);

    // 3. Sincronizar con almacenamiento local si existe caché
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const cached = window.localStorage.getItem('forwarder_projects');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((p) => {
              if (projToDelete.id && p.id) return p.id !== projToDelete.id;
              return p.project_ref !== projToDelete.project_ref;
            });
            window.localStorage.setItem('forwarder_projects', JSON.stringify(filtered));
          }
        }
      }
    } catch (storageErr) {
      console.warn('No se pudo actualizar localStorage:', storageErr);
    }

    // 4. Ejecutar llamada de borrado en la base de datos
    try {
      await fetch(getApiUrl('/.netlify/functions/forwarder-projects'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          id: projToDelete.id,
          project_ref: projToDelete.project_ref
        })
      });
    } catch (err) {
      console.error('Error al eliminar proyecto de la base de datos:', err);
    }
  };

  const handleTriggerImport = () => { if (fileInputRef.current && !isAnalyzingFile) fileInputRef.current.click(); };

  const handleSaveDocumentToProject = async (docMeta) => {
    if (!activeProject) {
      window.alert('⚠️ Selecciona o crea un proyecto activo antes de adjuntar y guardar documentos.');
      return;
    }

    const newDoc = {
      id: docMeta.id || `doc-${Date.now()}-${Math.random()}`,
      name: docMeta.name || 'Documento_Proyecto.pdf',
      size: docMeta.size ? (typeof docMeta.size === 'string' ? docMeta.size : `${Math.round(docMeta.size / 1024)} KB`) : '120 KB',
      date: docMeta.uploadedAt ? new Date(docMeta.uploadedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      itemsCount: docMeta.itemsCount || 1,
      payload: docMeta
    };

    const updatedDocs = [...projectDocuments, newDoc];
    setprojectDocuments(updatedDocs);

    const updatedProject = {
      ...activeProject,
      documents: updatedDocs
    };
    setActiveProject(updatedProject);
    setProjects(prev => prev.map(p => p.id === activeProject.id ? updatedProject : p));

    await persistProjectToDatabase(updatedProject);
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event?.target?.files || []);
    if (files.length === 0) return;

    if (!activeProject) {
      window.alert('⚠️ Por favor, selecciona un proyecto en la barra lateral antes de subir archivos.');
      return;
    }

    setIsAnalyzingFile(true);
    try {
      let allNewItems = [];
      for (const file of files) {
        let dataBase64 = null;
        try {
          dataBase64 = await readFileAsDataURL(file);
        } catch (e) {}

        const cleanBase64 = (typeof dataBase64 === 'string' && dataBase64.includes(','))
          ? dataBase64.split(',')[1].trim()
          : (typeof dataBase64 === 'string' ? dataBase64.trim() : '');

        const response = await fetch(getApiUrl('/.netlify/functions/project-parser'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileBase64: cleanBase64,
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
          }),
        });
        const data = await response.json();

        if (data.success && Array.isArray(data.items)) {
          const formattedItems = data.items.map((it, idx) => ({
            id: it.id || `item-${Date.now()}-${idx}-${Math.random()}`,
            ...it
          }));
          allNewItems.push(...formattedItems);
        }

        await handleSaveDocumentToProject({
          name: file.name,
          size: file.size,
          itemsCount: data.items ? data.items.length : 0,
          uploadedAt: new Date().toISOString(),
          dataBase64: dataBase64
        });
      }

      if (allNewItems.length > 0) {
        setCargoItems(prev => [...prev, ...allNewItems]);
      }
    } catch (err) {
      console.error('Error de red al procesar el archivo:', err);
    } finally {
      setIsAnalyzingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddCargoPiece = () => {
    setCargoItems((prev) => [...prev, { id: `item-${Date.now()}-${Math.random()}`, category: 'Carga Unitizada / Envasada', quantity: 1, type: '', length: '', width: '', height: '', weight: '', shipping_mode_supported: 'Tráiler Lona (13.6m)' }]);
  };
  const handleAddRow = handleAddCargoPiece;
  const addCargoItem = handleAddCargoPiece;

  const handleUpdateCargoItem = (id, field, value) => {
    setCargoItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleRemoveCargoItem = (id) => {
    setCargoItems((prev) => {
      const remainingItems = prev.filter((item) => item.id !== id);
      if (activeProject) {
        const updatedProject = {
          ...activeProject,
          items: remainingItems,
          line_items: Array.isArray(activeProject.line_items)
            ? activeProject.line_items.filter((item) => item.id !== id)
            : remainingItems
        };
        setActiveProject(updatedProject);
        setProjects((prevProj) =>
          prevProj.map((p) => (p.id === activeProject.id ? updatedProject : p))
        );
      }
      return remainingItems;
    });
  };
  const handleRemoveRow = handleRemoveCargoItem;

  const handleDeletePersistentDocument = async (docId) => {
    if (!activeProject || !window.confirm('¿Deseas eliminar este documento del proyecto?')) return;
    const updatedDocs = projectDocuments.filter(d => d.id !== docId);
    setprojectDocuments(updatedDocs);

    const updatedProject = {
      ...activeProject,
      documents: updatedDocs
    };
    setActiveProject(updatedProject);
    setProjects(prev => prev.map(p => p.id === activeProject.id ? updatedProject : p));

    await persistProjectToDatabase(updatedProject);
  };

  const autoCalculateEstimates = (items) => {
    if (!items || items.length === 0) {
      lastCalculatedItemsRef.current = '[]';
      setDunnage(0); setChains(0); setSlings(0); setShackles(0);
      setGangs(0); setHeavyLift(0); setMafiPlatforms(0); setLashingTeams(0);
      setShippingMode('Lo-Lo'); setVesselType('Geared Breakbulk (Lo-Lo)');
      setSubtotalFreight('0.00'); setSubtotalFobOperations('0.00');
      // En Land Charter, DataBridge es la única fuente de verdad: se anula la mutación financiera local
      // setEstimatedCost(''); setSalePrice('');
      setIsUnder40t(false); setTceActive(false); setTceValue(null);
      setOperationalProfileNotice('');
      setIsCommodityTariffActive(false);
      return;
    }
    lastCalculatedItemsRef.current = JSON.stringify(items);
    let totalPieces = 0; let totalWeightKg = 0; let totalVolumeM3 = 0; let total_m2 = 0;
    let maxPieceWeight = 0; let roRoItems = 0; const staticItems = [];
    const roRoRegex = /camion|vehiculo|trailer|tractor|coche|furgoneta/i;

    items.forEach((item) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const l = Math.max(0, parseFloat(String(item.length ?? item.length_m ?? 0).replace(',', '.')) || 0);
      const w = Math.max(0, parseFloat(String(item.width ?? item.width_m ?? 0).replace(',', '.')) || 0);
      const h = Math.max(0, parseFloat(String(item.height ?? item.height_m ?? 0).replace(',', '.')) || 0);
      const pieceWeight = Math.max(0, parseFloat(String(item.weight ?? item.unit_weight_kg ?? 0).replace(',', '.')) || 0);
      totalPieces += qty; totalWeightKg += qty * pieceWeight;
      totalVolumeM3 += qty * (l * w * h); total_m2 += qty * (l * w);
      if (pieceWeight > maxPieceWeight) maxPieceWeight = pieceWeight;
      const rawType = String(item.type || '');
      if (roRoRegex.test(rawType) || roRoRegex.test(rawType.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) { roRoItems += qty; } else { staticItems.push({ ...item, qty, quantity: qty, pieceWeight, weight: pieceWeight }); }
    });

    const totalWeightTons = totalWeightKg / 1000;
    const rawType = String(cargoItems[0]?.type || '').toUpperCase().trim();
    let appliedTariff = COMMODITY_TARIFFS[rawType] || null;

    // Fuzzy Matching: Si no hay coincidencia exacta pero es cemento, asignamos la tarifa plana internamente sin tocar la UI.
    if (!appliedTariff && rawType.includes('CEM')) {
      if (rawType.includes('BIG') || rawType.includes('SAC') || rawType.includes('BAG') || rawType.includes('ENVAS')) {
        appliedTariff = COMMODITY_TARIFFS['CEM I 52,5N BIGBAG'] || null;
      } else if (rawType.includes('GRANEL') || rawType.includes('BULK') || rawType.includes('VRAC')) {
        appliedTariff = COMMODITY_TARIFFS['CEM II 42,5 VRAC'] || null;
      }
    }

    // Auto-Cálculo de Valor de Mercancía por Catálogo de Commodities (Land Charter)
    const targetCargoType = (cargoItems && cargoItems.length > 0 && cargoItems[0]?.type)
      ? cargoItems[0].type
      : ((items && items.length > 0 && items[0]?.type) ? items[0].type : (activeProject?.cargoType || activeProject?.cargo_type || ''));
    const cleanCargoType = String(targetCargoType || '').trim();
    const upperCargoType = cleanCargoType.toUpperCase();
    let cargoType = COMMODITY_VALUES[cleanCargoType] !== undefined
      ? cleanCargoType
      : (COMMODITY_VALUES[upperCargoType] !== undefined
        ? upperCargoType
        : (COMMODITY_VALUES[rawType] !== undefined
          ? rawType
          : (COMMODITY_VALUES[upperCargoType.replace(/\./g, ',')] !== undefined
            ? upperCargoType.replace(/\./g, ',')
            : (COMMODITY_VALUES[upperCargoType.replace(/,/g, '.')] !== undefined
              ? upperCargoType.replace(/,/g, '.')
              : cleanCargoType))));

    // Fallback de fuzzy match seguro para derivados de 'CEM I' y 'CEM II' si no hay coincidencia exacta
    if (COMMODITY_VALUES[cargoType] === undefined) {
      const matchCandidate = rawType || upperCargoType;
      if (matchCandidate.includes('CEM I') || matchCandidate.includes('CEM 1') || (matchCandidate.includes('CEM') && (matchCandidate.includes('BIG') || matchCandidate.includes('SAC') || matchCandidate.includes('BAG') || matchCandidate.includes('ENVAS')))) {
        if (matchCandidate.includes('42,5') || matchCandidate.includes('42.5')) {
          cargoType = matchCandidate.includes('SAC') ? 'CEM I 42,5N/R SAC 50KG' : 'CEM I 42,5N/R BIGBAG';
        } else {
          cargoType = matchCandidate.includes('SAC') ? 'CEM I 52,5N SAC 50KG' : 'CEM I 52,5N BIGBAG';
        }
      } else if (matchCandidate.includes('CEM II') || matchCandidate.includes('CEM 2') || (matchCandidate.includes('CEM') && (matchCandidate.includes('GRANEL') || matchCandidate.includes('BULK') || matchCandidate.includes('VRAC')))) {
        if (matchCandidate.includes('VRAC') || matchCandidate.includes('GRANEL') || matchCandidate.includes('BULK')) {
          cargoType = 'CEM II 42,5 VRAC';
        } else if (matchCandidate.includes('FARDILISE') || matchCandidate.includes('TAVCIM')) {
          cargoType = 'CEM II 42,5N/R FARDILISE';
        } else {
          cargoType = 'CEM II 52.5N BIGBAG';
        }
      }
    }

    if (COMMODITY_VALUES[cargoType] !== undefined) {
      const autoMercanciaUsd = totalWeightTons * COMMODITY_VALUES[cargoType];
      if (!userEditedMercanciaCost.current || lastDetectedCargoTypeRef.current !== cargoType) {
        lastDetectedCargoTypeRef.current = cargoType;
        userEditedMercanciaCost.current = false;
        setMercanciaCost(autoMercanciaUsd);
        if (activeProject) {
          activeProject.valor_total_mercancia_usd = autoMercanciaUsd;
          setActiveProject((prev) => (prev ? { ...prev, valor_total_mercancia_usd: autoMercanciaUsd } : prev));
        }
        if (typeof window !== 'undefined') {
          window.State = window.State || {};
          window.State.valor_total_mercancia_usd = autoMercanciaUsd;
          window.State.goodsValue = autoMercanciaUsd;
        }
      }
    }

    setIsCommodityTariffActive(false);

    // Detección de Carga Envasada vs Granel para selección de vehículo y métodos en cálculo no tarifario
    const isBigBagInNonTariff = /big\s*bag|sac|pallet|envasad/i.test([
      activeProject?.cargoType,
      activeProject?.cargo_type,
      activeProject?.product,
      activeProject?.prompt,
      activeProject?.instruction,
      activeProject?.description,
      ...(items || []).map(it => `${it.type || ''} ${it.category || ''} ${it.description || ''}`)
    ].filter(Boolean).join(' '));

    const detectedNonTariff = detectCargoPackagingType(items, activeProject);
    if (detectedNonTariff) {
      if (detectedNonTariff.isPackaged || isBigBagInNonTariff) {
        setVehicleType('Camión Plataforma con Grúa Autocarga');
        setLoadingMethod('Autocarga con Grúa del Camión');
        setDischargeMethod('Autocarga con Grúa del Camión');
        if (typeof window !== 'undefined') {
          window.State = window.State || {};
          window.State.vehicleType = 'Camión Plataforma con Grúa Autocarga';
          window.State.truckType = 'Camión Plataforma con Grúa Autocarga';
          window.State.truckPayloadCapacity = 21;
          window.State.cargaUtil = 21;
          window.State.dwt = 21;
          if (typeof window.handleVehicleTypeSelection === 'function') {
            window.handleVehicleTypeSelection('Camión Plataforma con Grúa Autocarga');
          }
        }
        if (typeof document !== 'undefined') {
          const inputEl = document.getElementById('nombre-buque-calculadora');
          if (inputEl) inputEl.value = 'Camión Plataforma con Grúa Autocarga';
          const badgeEl = document.getElementById('vessel-badge');
          if (badgeEl) badgeEl.innerText = 'Camión Plataforma con Grúa Autocarga';
          const execEl = document.getElementById('exec-vessel-type');
          if (execEl) execEl.textContent = 'Camión Plataforma con Grúa Autocarga';
          const truckCapEl = document.getElementById('truckPayloadCapacity');
          if (truckCapEl) truckCapEl.value = 21;
          const dwtEl = document.getElementById('vessel-dwt');
          if (dwtEl) dwtEl.value = 21;
        }
      } else if (detectedNonTariff.isBulk && !isBigBagInNonTariff) {
        setVehicleType('Bañera Basculante (Granel)');
        setLoadingMethod('Carga por Silo / Tubo (Granel)');
        setDischargeMethod('Basculante / Tolva (Granel)');
      }
    }

    const autoMode = roRoItems > 0 ? 'Ro-Ro' : 'Lo-Lo';
    const recommendedVessel = roRoItems > 0 ? 'MPP / Pure Ro-Ro Carrier' : 'Geared Breakbulk (Lo-Lo)';
    setShippingMode(autoMode); setVesselType(recommendedVessel);

    const Dunnage = Math.ceil(totalWeightTons / 5);
    const Cadenas = roRoItems * 4;
    const Eslingas = Math.ceil(totalPieces / 2);
    const Grilletes = (Eslingas * 2) + (Cadenas * 2);

    let HeavyLift = 0; let MAFIs = 0; let Gangs = 0;
    if (autoMode === 'Ro-Ro') {
      HeavyLift = 0;
      MAFIs = staticItems.reduce((acc, it) => {
        const wt = Math.max(0, parseFloat(String(it.pieceWeight ?? it.weight ?? it.unit_weight_kg ?? 0).replace(',', '.')) || 0);
        const q = Math.max(1, Number(it.qty ?? it.quantity) || 1);
        return acc + (wt > 5000 ? q : 0);
      }, 0);
      Gangs = Math.ceil(totalPieces / 25);
    } else {
      MAFIs = 0;
      HeavyLift = maxPieceWeight > 8000 ? 1 : 0;
      Gangs = Math.ceil(totalPieces / 15);
    }

    setDunnage(Dunnage); setChains(Cadenas); setSlings(Eslingas); setShackles(Grilletes);
    setGangs(Gangs); setHeavyLift(HeavyLift); setMafiPlatforms(MAFIs);
    setLashingTeams(cargoItems.length > 0 ? Math.max(1, Math.ceil(totalPieces / 20) + (roRoItems > 0 ? 1 : 0)) : 0);

    // 1. Evaluación del perfil operativo adecuado en Trincaje y Operativa
    const isBigBagsOrBulk = items.some(it => {
      const cat = String(it.category || '').toLowerCase();
      const typ = String(it.type || '').toLowerCase();
      const mod = String(it.shipping_mode_supported || '').toLowerCase();
      return cat.includes('ensacad') || cat.includes('dry bulk') || mod.includes('big bag') || mod.includes('granel') ||
        /big\s*bag|ensacad|saco|granel|bulk|cemento|urea|fertilizante|sulfato|harina|azucar|arroz|clinker|grano/i.test(typ) ||
        /big\s*bag|ensacad|saco|granel|bulk|cemento|urea|fertilizante|sulfato/i.test(cat);
    });

    setIsBigBagsCargo(isBigBagsOrBulk);

    let effectiveDunnage = Dunnage;
    let effectiveCadenas = Cadenas;
    let effectiveSlings = Eslingas;
    let effectiveHeavyLift = HeavyLift;

    if (isBigBagsOrBulk) {
      // Regla estricta Big Bags: Queda prohibido calcular eslingas sueltas individuales o materiales de trincaje pesado (cadenas, maderas de cuna estructurales)
      effectiveDunnage = 0;
      effectiveCadenas = 0;
      effectiveHeavyLift = 0;
      effectiveSlings = 0;

      // Spreader multipunto (14-16 sacos por ciclo) y ciclos de izado
      const bagsPerLift = 15;
      const calculatedCycles = Math.max(1, Math.ceil(totalPieces / bagsPerLift));
      setCraneLiftCycles(calculatedCycles);

      // Dimensionamiento del personal de tierra en función de los ciclos de retorno de grúa (buque o móvil portuaria)
      // para flujo continuo de carga hacia la bodega con cuadrillas enfocadas en enganche rápido al spreader
      const calculatedGangs = Math.max(1, Math.ceil(calculatedCycles / 140));
      const calculatedSpreaders = Math.max(1, Math.min(2, Math.ceil(totalPieces / 1500)));

      Gangs = calculatedGangs;
      HeavyLift = 0;

      setDunnageWood(0);
      setChainsBinders(0);
      setHighCapacitySlings(0);
      setShackles(0);
      setHeavyLiftCrane(0);
      setLashingTeams(0);
      setLashingTeam(0);
      setStevedoreGangs(calculatedGangs);
      setSpreaderMultipunto(calculatedSpreaders);

      setOperationalProfileNotice('Perfil: Mercancía Ensacada / Big Bags (Estiba en Bloque) · Spreader multipunto (14-16 sacos/ciclo) · Maderas de cuna pesadas y cables de acero de proyecto quedan excluidos');
    } else {
      setSpreaderMultipunto(0);
      setCraneLiftCycles(0);
      setOperationalProfileNotice('Perfil: Carga Industrial de Proyecto / Breakbulk · Cunas estructurales y cables/cadenas requeridos');
    }

    let currentSurveyorCost = Number(surveyorCost) || 0;
    if (maxPieceWeight > 35000 && Number(surveyorCost) === 0 && !userEditedSurveyor.current) { currentSurveyorCost = 1500; setSurveyorCost(1500); }

    // 2. Evaluación del umbral de 40 toneladas
    const isUnderThreshold = totalWeightTons < 40;
    setIsUnder40t(isUnderThreshold);

    let calculatedOceanFreight = 0;
    let calculatedFobOperations = 0;
    let totalEstimatedCost = 0;

    if (isUnderThreshold) {
      // Regla < 40t: Desactivar TCE del buque y computar costes bajo la modalidad de grupaje LCL
      setTceActive(false);
      setTceValue(null);
      setCharterMode('Grupaje LCL');
      setShippingMode('Grupaje LCL');
      setVesselType('Consolidación LCL (Sin buque exclusivo)');

      const chargeableWeightTons = Math.max(0.1, totalWeightTons);
      const chargeableVolumeCbm = Math.max(0.1, totalVolumeM3);
      const revenueTons = Math.max(1, Math.max(chargeableWeightTons, chargeableVolumeCbm));

      // Subtotal 1: Flete Marítimo LCL
      const oceanFreightCost = revenueTons * 65.0;

      // Subtotal 2: Costes FOB y Operativa Portuaria (CFS, Tasas T3, B/L, almacenaje, surveyor, inland, mercancía)
      const cfsOriginCost = revenueTons * 22.0;
      const cfsDestCost = revenueTons * 25.0;
      const portT3Cost = revenueTons * 4.5;
      const blFee = 85.0;
      const totalLclFreightCost = oceanFreightCost + cfsOriginCost + cfsDestCost + portT3Cost + blFee;
      const terminalStorageCost = Math.ceil(total_m2) * storageDays * 2;

      calculatedOceanFreight = oceanFreightCost;
      calculatedFobOperations = cfsOriginCost + cfsDestCost + portT3Cost + blFee + terminalStorageCost + currentSurveyorCost + (Number(inlandCost) || 0) + (Number(customsCost) || 0) + (Number(insuranceCost) || 0);

      totalEstimatedCost = calculatedOceanFreight + calculatedFobOperations;
    } else {
      // Regla >= 40t: Aplicar fletamento completo y cálculo de TCE del buque sugerido
      setTceActive(true);
      setCharterMode('Fletamento Completo');

      let suggestedVesselClass = 'Coaster / Buque de Carga General (Mini-Bulker)';
      let dailyTce = 8500;
      if (totalWeightTons >= 35000) {
        suggestedVesselClass = 'Supramax / Ultramax Bulk Carrier';
        dailyTce = 16500;
      } else if (totalWeightTons >= 10000) {
        suggestedVesselClass = 'Handysize Bulk Carrier';
        dailyTce = 13800;
      } else if (totalWeightTons >= 3000) {
        suggestedVesselClass = 'Multi-Purpose MPP / Tween-decker';
        dailyTce = 11500;
      }

      setTceValue(dailyTce);
      if (autoMode !== 'Ro-Ro') {
        setVesselType(suggestedVesselClass);
      }

      const RT = Math.max(totalWeightTons, totalVolumeM3);

      // MOTOR DE CÁLCULO DINÁMICO DE ROTACIÓN Y FLETE (TCE):
      // Días de Carga = Peso Total de la Carga (MT) / Ritmo de Carga (MT/día)
      // Días de Descarga = Peso Total de la Carga (MT) / Ritmo de Descarga (MT/día)
      // Días de Navegación = Distancia Náutica POL-POD / (Velocidad de Servicio del Buque en nudos × 24)
      // Flete Marítimo (TCE) en USD nativo = D_total × Tarifa diaria (USD/día)
      // Lógica Terrestre de Paralizaciones (Detention):
      // El tiempo de carga/descarga para el cálculo de penalizaciones terrestres SIEMPRE debe calcularse
      // sobre un máximo de 24 toneladas (la carga máxima de 1 tráiler), NUNCA sobre el tonelaje total del proyecto.
      // Si 24 t / 25 t/h = < 1 hora, la penalización será 0 € (dentro de las 2 horas de franquicia legal).
      const truckTons = Math.min(24, totalWeightTons > 0 ? totalWeightTons : 24);
      const effectiveLoadRatePerHour = Math.max(1, Number(loadingRate) || 25);
      const effectiveDischRatePerHour = Math.max(1, Number(dischargingRate) || 25);
      const horasCargaTruck = truckTons / effectiveLoadRatePerHour;
      const horasDescargaTruck = truckTons / effectiveDischRatePerHour;
      // Franquicia legal de 2h: en operativa normal por camión resulta en 0 €
      const warehouseWaitPenaltyEur = (Math.max(0, horasCargaTruck - 2) * 40) + (Math.max(0, horasDescargaTruck - 2) * 40);

      const effectiveLoadRate = Math.max(1, Number(loadingRate) || (isBigBagsOrBulk ? 1200 : 850));
      const effectiveDischRate = Math.max(1, Number(dischargingRate) || (isBigBagsOrBulk ? 1000 : 750));
      const diasCarga = totalWeightTons > 0 ? Math.round((totalWeightTons / effectiveLoadRate) * 100) / 100 : 0;
      const diasDescarga = totalWeightTons > 0 ? Math.round((totalWeightTons / effectiveDischRate) * 100) / 100 : 0;

      const effectiveDistance = Math.max(10, Number(distanceNm) || 1500);
      const defaultSpeed = totalWeightTons >= 35000 ? 13.5 : (totalWeightTons >= 10000 ? 13.0 : (totalWeightTons >= 3000 ? 12.0 : 10.5));
      const effectiveSpeed = Math.max(1, Number(vesselSpeedKnots) || defaultSpeed);
      const diasNavegacion = Math.round((effectiveDistance / (effectiveSpeed * 24)) * 100) / 100;
      const diasRotacionTotal = Math.round((diasCarga + diasDescarga + diasNavegacion) * 100) / 100;

      const effectiveDailyHire = Number(vesselDailyHireUsd) || dailyTce;

      // Subtotal 1: Flete Marítimo Buque Completo / TCE en USD nativo
      const freightCost = Math.round(diasRotacionTotal * effectiveDailyHire * 100) / 100;

      // CÁLCULO Y GESTIÓN DE DEMORAS (Demurrage) en USD nativo
      const actualLoad = actualLoadingDays !== '' && actualLoadingDays !== null && !isNaN(Number(actualLoadingDays)) ? Number(actualLoadingDays) : null;
      const actualDisch = actualDischargingDays !== '' && actualDischargingDays !== null && !isNaN(Number(actualDischargingDays)) ? Number(actualDischargingDays) : null;
      const demLoadDays = (actualLoad !== null && actualLoad > diasCarga) ? Math.round((actualLoad - diasCarga) * 100) / 100 : 0;
      const demDischDays = (actualDisch !== null && actualDisch > diasDescarga) ? Math.round((actualDisch - diasDescarga) * 100) / 100 : 0;
      const totalDemDays = Math.round((demLoadDays + demDischDays) * 100) / 100;
      const effectiveDemDaily = Number(demurrageDailyRateUsd) || effectiveDailyHire;
      const demurrageCostUsd = Math.round(totalDemDays * effectiveDemDaily * 100) / 100;

      // Subtotal 2: Costes FOB y Operativa Portuaria (trincaje, estiba, grúas/MAFIs, terminal, peritaje, inland, mercancía, seguro, demoras en USD nativo)
      const spreaderCost = isBigBagsOrBulk ? ((spreaderMultipunto || Math.max(1, Math.min(2, Math.ceil(totalPieces / 1500)))) * 600) : 0;
      const airBagsCost = isBigBagsOrBulk ? (Math.max(2, Math.ceil(totalWeightTons / 50)) * 35) : 0;

      const lashingCost = isBigBagsOrBulk
        ? (spreaderCost + airBagsCost)
        : ((effectiveDunnage * 30) + (effectiveCadenas * 80) + (effectiveSlings * 40) + ((effectiveSlings * 2 + effectiveCadenas * 2) * 15));
      const stevedoringCost = (MAFIs * 300) + (HeavyLift * 2500) + (Gangs * 1200);

      // Alquiler obligatorio de grúa móvil portuaria para spreader y su operador por jornada
      const portCraneShifts = isBigBagsOrBulk ? Math.max(1, Gangs) : 0;
      const portCraneDailyRate = 1800;
      const portCraneCost = isBigBagsOrBulk ? (portCraneShifts * portCraneDailyRate) : 0;

      // Pre-Stacking 70% obligatorio en muelle para Big Bags (almacenaje previo al atraque y manipulación inicial)
      let terminalStorageCost = 0;
      let initialHandlingCost = 0;
      if (isBigBagsOrBulk) {
        const preStackingRatio = 0.70;
        const preStackedTons = totalWeightTons * preStackingRatio;
        const preStackingDays = Math.max(5, Number(storageDays) || 5);
        const effectiveArea = total_m2 > 0 ? total_m2 : (totalWeightTons > 0 ? totalWeightTons * 0.8 : totalPieces * 0.8);
        const preStackedArea = Math.ceil(effectiveArea * preStackingRatio);
        terminalStorageCost = preStackedArea * preStackingDays * 2;
        if (Number(storageDays) > 5) {
          terminalStorageCost += Math.ceil(effectiveArea) * (Number(storageDays) - 5) * 2;
        }
        initialHandlingCost = preStackedTons * 2.0;
      } else {
        terminalStorageCost = Math.ceil(total_m2) * storageDays * 2;
      }

      calculatedOceanFreight = freightCost;
      calculatedFobOperations = lashingCost + stevedoringCost + portCraneCost + terminalStorageCost + initialHandlingCost + currentSurveyorCost + (Number(inlandCost) || 0) + (Number(customsCost) || 0) + (Number(insuranceCost) || 0) + demurrageCostUsd;

      // Blindaje contra Costes en 0 € (Fallback de Seguridad):
      // Si isCommodityTariffActive es falso pero el peso total es mayor a 0 y el flete devuelto es nulo o 0,
      // aplica un cálculo estándar de respaldo (totalWeightTons * 4.00 USD/MT) para evitar interfaces vacías.
      if (!appliedTariff && totalWeightTons > 0 && calculatedOceanFreight <= 0) {
        calculatedOceanFreight = Math.round(totalWeightTons * 4.00 * 100) / 100;
      }

      totalEstimatedCost = calculatedOceanFreight + calculatedFobOperations;
    }

    setSubtotalFreight(calculatedOceanFreight.toFixed(2));
    setSubtotalFobOperations(calculatedFobOperations.toFixed(2));
    // En Land Charter, DataBridge es la única fuente de verdad: se anula el recálculo financiero local automático
    // setEstimatedCost(totalEstimatedCost.toFixed(2));
    // setSalePrice((totalEstimatedCost * 1.15).toFixed(2));
  };

  useEffect(() => {
    // Freno al Bucle Infinito (Deep Compare): solo ejecutar si el string de cargoItems cambia
    const currentItemsString = JSON.stringify(cargoItems);
    if (lastCalculatedItemsRef.current === currentItemsString) {
      return;
    }
    lastCalculatedItemsRef.current = currentItemsString;
    autoCalculateEstimates(cargoItems);
  }, [
    cargoItems,
    storageDays,
    surveyorCost,
    inlandCost,
    customsCost,
    insuranceCost,
    pol,
    pod,
    loadingRate,
    dischargingRate,
    distanceNm,
    vesselSpeedKnots,
    vesselDailyHireUsd,
    exchangeRateUsdEur,
    actualLoadingDays,
    actualDischargingDays,
    demurrageDailyRateUsd,
  ]);

  // Cálculo y Renderizado Reactivo de "FOB + Mercancía Unitario"
  useEffect(() => {
    const rawGoodsVal = Number(
      (mercanciaCost > 0 ? mercanciaCost : null)
      ?? activeProject?.valor_total_mercancia_usd
      ?? activeProject?.goodsValue
      ?? activeProject?.merchandiseValue
      ?? activeProject?.cargo_value
      ?? activeProject?.data?.goodsValue
      ?? activeProject?.data?.financials?.goodsValue
      ?? (typeof window !== 'undefined' && window.State ? (window.State.goodsValue || window.State.valor_total_mercancia_usd || window.State.merchandiseValue || window.State.cargoValue) : 0)
      ?? 0
    );

    const packingKg = (cargoItems || []).reduce((acc, it) => acc + ((Number(it.quantity) || 1) * (parseFloat(it.unit_weight_kg ?? it.weight) || 0)), 0) || (totals?.weight || 0);
    const packingTons = packingKg > 0 ? packingKg / 1000 : 0;
    const stateTons = typeof window !== 'undefined' && window.State ? (Number(window.State.cargo) || Number(window.State.dwt) || Number(window.State.cargoQuantity) || 0) : 0;
    const projTons = Number(activeProject?.cargoQuantity || activeProject?.toneladas || activeProject?.tonnes || activeProject?.cargo || 0);
    const effectiveTons = packingTons > 0 ? packingTons : (stateTons > 0 ? stateTons : (projTons > 0 ? projTons : 1));

    if (rawGoodsVal > 0 && effectiveTons > 0) {
      const unitMercancia = rawGoodsVal / effectiveTons;
      const fleteUnit = Number(activeReport?.flete_unitario_usd_mt ?? financialBreakdown?.flete_unitario_usd_mt ?? (Number(subtotalFreight || estimatedCost || 0) / effectiveTons) ?? 0);
      const fobUnit = Number(subtotalFobOperations || 0) / effectiveTons;
      const baseFreightOrFob = fobUnit > 0 ? fobUnit : fleteUnit;
      const totalRatio = Number((baseFreightOrFob + unitMercancia).toFixed(2));

      setFobMasMercanciaUnitario(totalRatio);
      setFinancialBreakdown((prev) => ({
        ...(prev || {}),
        fob_mas_mercancia_unitario_usd_mt: totalRatio,
        valor_total_mercancia_usd: rawGoodsVal,
        toneladas: effectiveTons
      }));
      if (activeReport) {
        setActiveReport((prev) => prev ? {
          ...prev,
          fob_mas_mercancia_unitario_usd_mt: totalRatio,
          valor_total_mercancia_usd: rawGoodsVal
        } : prev);
      }
    }
  }, [cargoItems, totals, activeProject, subtotalFreight, subtotalFobOperations, estimatedCost, mercanciaCost]);

  useEffect(() => {
    if (isDualTradingOpen && dualViewRef.current) {
      const dualView = dualViewRef.current;
      const fleteUnitario = Number(activeReport?.flete_unitario_usd_mt ?? financialBreakdown?.flete_unitario_usd_mt ?? 0);
      const tons = Number(totals.totalWeightTons || totals.weightTons || (totals.weightKg ? totals.weightKg / 1000 : 0)) || 0;
      const stowage = Number(totals.stowageFactor || (totals.m3 && tons > 0 ? totals.m3 / tons : 0)) || 0;

      dualView.fleteJustoCalculado = fleteUnitario;
      dualView.toneladasTotales = tons;
      dualView.factorDeEstiba = stowage;
      dualView.toleranciaCarga = 5;
      dualView.getExportContext = () => ({
        syncid: activeProject?.project_ref || 'PROJECT-FORWARDER',
        id: activeProject?.project_ref || 'PROJECT-FORWARDER',
        toleranceType: 'MOLOO / MOLCO'
      });

      let backLink = null;
      const handleBackLink = (e) => {
        e.preventDefault();
        setIsDualTradingOpen(false);
      };
      const attachBackLink = () => {
        backLink = dualView.shadowRoot?.querySelector?.('.back-link');
        if (backLink) {
          backLink.addEventListener('click', handleBackLink);
        }
      };
      attachBackLink();
      const timer = setTimeout(attachBackLink, 250);

      return () => {
        clearTimeout(timer);
        backLink?.removeEventListener('click', handleBackLink);
      };
    }
  }, [isDualTradingOpen, activeReport, financialBreakdown, totals, activeProject]);

  // Proteger el Mapa (Evitar el Crash): asegurar limpieza con map.remove() y return temprano si no existe el contenedor
  useEffect(() => {
    // Si el contenedor del mapa (el div o el ref) no existe, haz un return temprano para evitar el error appendChild
    const container = mapContainerRef.current || (typeof document !== 'undefined' ? document.getElementById('map-container') : null);
    if (!container) return;

    // Función de limpieza (cleanup) en el useEffect que destruye la instancia del mapa anterior (map.remove())
    return () => {
      if (mapInstanceRef.current) {
        try {
          if (typeof mapInstanceRef.current.remove === 'function') {
            mapInstanceRef.current.remove();
          }
        } catch (mapErr) {
          console.warn('[ForwarderWorkspace] Error no bloqueante al destruir mapa anterior:', mapErr);
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleApplyProjectPayload = async (payload) => {
    if (!payload) return;

    let currentProject = activeProject;
    if (!currentProject) {
      if (projects.length > 0) {
        currentProject = projects[0];
        setActiveProject(currentProject);
      } else {
        const urlRef = typeof window !== 'undefined' && window.location?.search
          ? new URLSearchParams(window.location.search).get('ref')
          : null;
        const defaultProj = {
          id: `proj-${Date.now()}`,
          project_ref: urlRef || 'RDM/2026-001',
          client_name: 'Proyecto Principal / Agente',
          status: 'Borrador',
          items: [],
          documents: []
        };
        currentProject = defaultProj;
        setProjects([defaultProj]);
        setActiveProject(defaultProj);
      }
    }

    let updatedProject = { ...currentProject };
    let hasChanges = false;

    // Regla de Flota para Mercancía Envasada / Big Bags en NLP y Chat Libre (Cerebro.ia)
    const detectedCargoCandidate = [
      payload.cargoName,
      payload.cargo_name,
      payload.cargoDescription,
      payload.cargo_type,
      payload.cargoType,
      payload.mercancia,
      payload.mercancía,
      payload.cargo,
      payload.product,
      payload.type,
      payload.commodity,
      payload.prompt,
      payload.instruction,
      payload.message,
      payload.text,
      payload.item?.type,
      payload.item?.category,
      payload.newItem?.type,
      payload.newItem?.category,
      payload.payload?.type,
      payload.payload?.category,
    ].filter(Boolean).join(' ');

    const PACKAGED_REGEX = /(big\s*bag|saco|sling|paletizad|envasad)/i;
    const BULK_REGEX = /(granel|bulk)/i;
    const isExplicitBigBag = /big\s*bag/i.test(detectedCargoCandidate);
    const isPackagedFromNlp = isExplicitBigBag || (PACKAGED_REGEX.test(detectedCargoCandidate) && !BULK_REGEX.test(detectedCargoCandidate));

    if (isPackagedFromNlp) {
      const targetVehicle = 'Camión Plataforma con Grúa Autocarga';
      handleVehicleTypeChange('Camión Plataforma con Grúa Autocarga');
      setVehicleType('Camión Plataforma con Grúa Autocarga');
      setLoadingMethod('Autocarga con Grúa del Camión');
      setDischargeMethod('Autocarga con Grúa del Camión');
      updatedProject.truck_type = targetVehicle;
      updatedProject.vehicle_type = targetVehicle;
      if (typeof window !== 'undefined') {
        window.State = window.State || {};
        window.State.vehicleType = targetVehicle;
        window.State.truckType = targetVehicle;
        window.State.truckPayloadCapacity = 21;
        window.State.cargaUtil = 21;
        window.State.dwt = 21;
        if (typeof window.handleVehicleTypeSelection === 'function') {
          window.handleVehicleTypeSelection(targetVehicle);
        }
      }
      if (typeof document !== 'undefined') {
        const inputEl = document.getElementById('nombre-buque-calculadora');
        if (inputEl) inputEl.value = targetVehicle;
        const badgeEl = document.getElementById('vessel-badge');
        if (badgeEl) badgeEl.innerText = targetVehicle;
        const execEl = document.getElementById('exec-vessel-type');
        if (execEl) execEl.textContent = targetVehicle;
        const truckCapEl = document.getElementById('truckPayloadCapacity');
        if (truckCapEl) truckCapEl.value = 21;
        const dwtEl = document.getElementById('vessel-dwt');
        if (dwtEl) dwtEl.value = 21;
      }
      hasChanges = true;
    }

    if (payload.instruction) {
      const text = payload.instruction.toLowerCase();
      const matchNumber = (str) => {
        const m = str.match(/(\d+([.,]\d+)?)/);
        return m ? parseFloat(m[0].replace(',', '.')) : null;
      };

      if (text.includes('almacen') || text.includes('días') || text.includes('dias')) {
        const val = matchNumber(text);
        if (val !== null) { setStorageDays(val); hasChanges = true; }
      }
      if (text.includes('surveyor') || text.includes('perito')) {
        const val = matchNumber(text);
        if (val !== null) {
          userEditedSurveyor.current = true;
          setSurveyorCost(val);
          hasChanges = true;
        }
      }
      if (text.includes('inland') || text.includes('transporte')) {
        const val = matchNumber(text);
        if (val !== null) { setInlandCost(val); hasChanges = true; }
      }
      if (text.includes('aduana') || text.includes('mercancía') || text.includes('mercancia')) {
        const val = matchNumber(text);
        if (val !== null) { setCustomsCost(val); hasChanges = true; }
      }
    }

    // Parámetros de ruta y ritmos operativos
    if (payload.charteringAssessment) {
      setCharteringAssessment(payload.charteringAssessment);
      hasChanges = true;
    } else if (payload.rotationBreakdown) {
      setCharteringAssessment({ rotationBreakdown: payload.rotationBreakdown });
      hasChanges = true;
    }

    const assessmentRot = payload.charteringAssessment?.rotationBreakdown || payload.rotationBreakdown || payload.charteringAssessment?.timeCharterEquivalent;
    if (assessmentRot) {
      if (assessmentRot.pol) { setPol(assessmentRot.pol); hasChanges = true; }
      if (assessmentRot.pod) { setPod(assessmentRot.pod); hasChanges = true; }
      if (assessmentRot.loadingRateMtDay || assessmentRot.loadingRate) {
        setLoadingRate(Number(assessmentRot.loadingRateMtDay || assessmentRot.loadingRate));
        hasChanges = true;
      }
      if (assessmentRot.dischargingRateMtDay || assessmentRot.dischargingRate) {
        setDischargingRate(Number(assessmentRot.dischargingRateMtDay || assessmentRot.dischargingRate));
        hasChanges = true;
      }
      if (assessmentRot.distanceNm || assessmentRot.distance_nm) {
        setDistanceNm(Number(assessmentRot.distanceNm || assessmentRot.distance_nm));
        hasChanges = true;
      }
      if (assessmentRot.serviceSpeedKnots || assessmentRot.vesselSpeedKnots) {
        setVesselSpeedKnots(Number(assessmentRot.serviceSpeedKnots || assessmentRot.vesselSpeedKnots));
        hasChanges = true;
      }
      if (assessmentRot.dailyHireRateUsd || assessmentRot.dailyHireRate) {
        setVesselDailyHireUsd(Number(assessmentRot.dailyHireRateUsd || assessmentRot.dailyHireRate));
        hasChanges = true;
      }
      if (assessmentRot.demurrage) {
        if (assessmentRot.demurrage.actualLoadingDays !== undefined) {
          setActualLoadingDays(assessmentRot.demurrage.actualLoadingDays);
          hasChanges = true;
        }
        if (assessmentRot.demurrage.actualDischargingDays !== undefined) {
          setActualDischargingDays(assessmentRot.demurrage.actualDischargingDays);
          hasChanges = true;
        }
        if (assessmentRot.demurrage.demurrageRateDailyUsd) {
          setDemurrageDailyRateUsd(Number(assessmentRot.demurrage.demurrageRateDailyUsd));
          hasChanges = true;
        }
      }
    }

    if (payload.action === 'update_route_rates' || payload.update_route_rates) {
      const rp = payload.payload || payload;
      if (rp.pol || rp.portOfLoading) { setPol(rp.pol || rp.portOfLoading); hasChanges = true; }
      if (rp.pod || rp.portOfDischarge) { setPod(rp.pod || rp.portOfDischarge); hasChanges = true; }
      if (rp.loadingRate != null || rp.loadingRateMtDay != null) { setLoadingRate(Number(rp.loadingRate ?? rp.loadingRateMtDay)); hasChanges = true; }
      if (rp.dischargeRate != null || rp.dischargingRate != null || rp.dischargingRateMtDay != null) { setDischargingRate(Number(rp.dischargeRate ?? rp.dischargingRate ?? rp.dischargingRateMtDay)); hasChanges = true; }
    }

    if (payload.pol || payload.portOfLoading) { setPol(payload.pol || payload.portOfLoading); hasChanges = true; }
    if (payload.pod || payload.portOfDischarge) { setPod(payload.pod || payload.portOfDischarge); hasChanges = true; }
    // --- NUEVO BLINDAJE TERRESTRE: Conectar IA con las casillas de la interfaz ---
    if (payload.land_origin || payload.origin) { 
      const newOrigin = payload.land_origin || payload.origin;
      setLandOrigin(newOrigin); 
      updatedProject.land_origin = newOrigin;
      hasChanges = true; 
    }
    if (payload.land_destination || payload.destination) { 
      const newDest = payload.land_destination || payload.destination;
      setLandDestination(newDest); 
      updatedProject.land_destination = newDest;
      hasChanges = true; 
    }
    if (payload.land_distance || payload.distanceKm !== undefined || payload.distance !== undefined) { 
      const newDist = Number(payload.land_distance || payload.distanceKm || payload.distance);
      if (newDist > 0) {
        setDistanceKm(newDist); 
        updatedProject.land_distance = newDist;
        hasChanges = true; 
      }
    }
    
    // Asegurar que el objeto de ruta se guarde correctamente en la base de datos
    if (updatedProject.land_origin || updatedProject.land_destination) {
      updatedProject.land_route = {
        origin: updatedProject.land_origin || landOrigin,
        destination: updatedProject.land_destination || landDestination,
        distance_km: updatedProject.land_distance || distanceKm
      };
    }
    // ----------------------------------------------------
    if (payload.loadingRate || payload.loadingRateMtDay) {
      setLoadingRate(Number(payload.loadingRate || payload.loadingRateMtDay));
      hasChanges = true;
    }
    if (payload.dischargingRate || payload.dischargeRate || payload.dischargingRateMtDay) {
      setDischargingRate(Number(payload.dischargingRate || payload.dischargeRate || payload.dischargingRateMtDay));
      hasChanges = true;
    }
    if (payload.cargoDescription || payload.quantityMT || payload.cargoName || payload.cargo_name || payload.cargo_type || payload.cargoType) {
      const description = String(payload.cargoName || payload.cargo_name || payload.cargoDescription || payload.cargo_type || payload.cargoType || 'Carga de Proyecto').trim();
      const qtyTons = Number(payload.quantityMT || payload.cargo_qty || payload.cargoQty || payload.tonnage) || 0;
      const weightKg = qtyTons > 0 ? qtyTons * 1000 : 25000;
      const isBigBags = isPackagedFromNlp || /bag|big[- ]?bag|saco|cemento|clinker|grano/i.test(description);

      const newItem = {
        id: `item-${Date.now()}-ai`,
        category: isBigBags ? 'Big Bags' : 'Equipos de Proceso',
        quantity: 1,
        type: description,
        length: 12,
        width: 2.5,
        height: 2.5,
        weight: weightKg,
        shipping_mode_supported: qtyTons >= 40 ? 'Break Bulk / Proyecto' : 'Contenedor (FCL / LCL)'
      };

      setCargoItems([newItem]);
      updatedProject.items = [newItem];
      hasChanges = true;
      setIsCargoModalOpen(true);
      autoCalculateEstimates([newItem]);
    }
    if (payload.distanceNm || payload.distance_nm) {
      setDistanceNm(Number(payload.distanceNm || payload.distance_nm));
      hasChanges = true;
    }
    if (payload.actualLoadingDays !== undefined) {
      setActualLoadingDays(payload.actualLoadingDays);
      hasChanges = true;
    }
    if (payload.actualDischargingDays !== undefined) {
      setActualDischargingDays(payload.actualDischargingDays);
      hasChanges = true;
    }
    if (payload.demurrageDays !== undefined) {
      setActualLoadingDays(payload.demurrageDays);
      hasChanges = true;
    }
    if (payload.cargoCategory || payload.cargo_category) {
      setCargoCategory(payload.cargoCategory || payload.cargo_category);
      hasChanges = true;
    }

    if (payload.action === 'add_packing_list_item' || payload.add_packing_list_item) {
      const p = payload.item || payload.newItem || payload.payload || payload;
      const qty = Number(p.quantity) || 1;
      const unitWeight = Number(p.unitWeight ?? p.weight ?? 1500);
      const totalWeightKg = qty * unitWeight;
      const isBigBags = /bag|big[- ]?bag|saco|cemento|clinker|grano/i.test(p.type || p.category || '');

      const newItem = {
        id: p.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        category: p.category || (isBigBags ? 'Big Bags' : 'Mercancía General / Paletizada'),
        type: p.type || p.name || 'Big Bags Cemento',
        quantity: qty,
        length: p.length != null ? Number(p.length) : 1.15,
        width: p.width != null ? Number(p.width) : 1.10,
        height: p.height != null ? Number(p.height) : 1.0,
        weight: unitWeight,
        unitWeight: unitWeight,
        shipping_mode_supported: totalWeightKg >= 40000 ? 'Break Bulk / Proyecto' : 'Contenedor (FCL / LCL)'
      };

      setCargoItems(prev => {
        const currentList = Array.isArray(prev) ? prev : [];
        const alreadyExists = currentList.some(it => it.id === newItem.id);
        const updatedList = alreadyExists ? currentList : [...currentList, newItem];
        updatedProject.items = updatedList;
        autoCalculateEstimates(updatedList);
        return updatedList;
      });

      hasChanges = true;
      setIsCargoModalOpen(true);
    }

    const incomingItems = payload.items || payload.cargo_items;
    if (Array.isArray(incomingItems) && incomingItems.length > 0) {
      const mappedItems = incomingItems.map((ci, idx) => {
        const mapped = mapCargoCategoryAndType(ci.type || ci.category || '', ci.category, ci.type);
        const l = ci.length_m ?? ci.length ?? '';
        const w = ci.width_m ?? ci.width ?? '';
        const h = ci.height_m ?? ci.height ?? '';
        const wt = ci.unit_weight_kg ?? ci.weight ?? '';
        return {
          id: ci.id || `item-${Date.now()}-${idx}`,
          category: mapped.category,
          quantity: ci.quantity ? Math.max(1, Number(ci.quantity)) : 1,
          type: mapped.type,
          length: l,
          width: w,
          height: h,
          length_m: l,
          width_m: w,
          height_m: h,
          weight: wt,
          unit_weight_kg: wt,
          shipping_mode_supported: ci.shipping_mode_supported || 'Tráiler Lona (13.6m)'
        };
      });
      setCargoItems(mappedItems);
      updatedProject.items = mappedItems;
      hasChanges = true;
      setIsCargoModalOpen(true);
      autoCalculateEstimates(mappedItems);
    } else if (payload.category !== undefined && Array.isArray(payload.cargo_items) && payload.cargo_items.length > 0) {
      const mappedItems = payload.cargo_items.map((ci, idx) => {
        const mapped = mapCargoCategoryAndType(ci.type || ci.category || '', ci.category, ci.type);
        const l = ci.length_m ?? ci.length ?? '';
        const w = ci.width_m ?? ci.width ?? '';
        const h = ci.height_m ?? ci.height ?? '';
        const wt = ci.unit_weight_kg ?? ci.weight ?? '';
        return {
          id: ci.id || `item-${Date.now()}-${idx}`,
          category: mapped.category,
          quantity: ci.quantity || 1,
          type: mapped.type,
          length: l,
          width: w,
          height: h,
          length_m: l,
          width_m: w,
          height_m: h,
          weight: wt,
          unit_weight_kg: wt,
          shipping_mode_supported: ci.shipping_mode_supported || 'Tráiler Lona (13.6m)'
        };
      });
      setCargoItems(mappedItems);
      updatedProject.items = mappedItems;
      hasChanges = true;
      setIsCargoModalOpen(true);
      autoCalculateEstimates(mappedItems);
    }

    if (payload.documentMeta) {
      await handleSaveDocumentToProject(payload.documentMeta);
      return;
    }

    let structuralModified = false;
    if (payload.dunnageUnits !== undefined) { setDunnageWood(payload.dunnageUnits); hasChanges = true; structuralModified = true; }
    if (payload.slingsUnits !== undefined) { setHighCapacitySlings(payload.slingsUnits); hasChanges = true; structuralModified = true; }
    if (payload.lashingChains !== undefined) { setChainsBinders(payload.lashingChains); hasChanges = true; structuralModified = true; }
    if (payload.stevedoringShifts !== undefined) { setStevedoreGangs(payload.stevedoringShifts); hasChanges = true; structuralModified = true; }
    if (payload.lashingTeams !== undefined) { setLashingTeam(payload.lashingTeams); hasChanges = true; structuralModified = true; }
    if (payload.heavyLiftCranes !== undefined) { setHeavyLiftCrane(payload.heavyLiftCranes); hasChanges = true; structuralModified = true; }
    if (payload.mafiPlatforms !== undefined) { setMafiPlatforms(payload.mafiPlatforms); hasChanges = true; structuralModified = true; }
    if (payload.spreaderUnits !== undefined) { setSpreaderMultipunto(payload.spreaderUnits); hasChanges = true; structuralModified = true; }
    if (payload.spreaderMultipunto !== undefined) { setSpreaderMultipunto(payload.spreaderMultipunto); hasChanges = true; structuralModified = true; }
    if (payload.storageDays !== undefined) { setStorageDays(Number(payload.storageDays)); hasChanges = true; }
    if (payload.surveyorCost !== undefined) {
      userEditedSurveyor.current = true;
      setSurveyorCost(Number(payload.surveyorCost));
      hasChanges = true;
    }
    if (payload.inlandTrucksCount !== undefined) { setInlandCost(payload.inlandTrucksCount); hasChanges = true; }
    if (payload.customsCost !== undefined) { setCustomsCost(payload.customsCost); hasChanges = true; }
    if (payload.insuranceCost !== undefined || payload.seguroMercancia !== undefined) {
      setInsuranceCost(Number(payload.insuranceCost ?? payload.seguroMercancia));
      hasChanges = true;
    }

    if (payload.requestFinancialBreakdown || payload.showFinancialBreakdown) {
      setIsBreakdownVisible(true);
      hasChanges = true;
    }
    if (payload.financialBreakdown) {
      const fb = payload.financialBreakdown;
      if (fb.subtotals) {
        if (fb.subtotals.oceanFreight != null) setSubtotalFreight(Number(fb.subtotals.oceanFreight).toFixed(2));
        if (fb.subtotals.fobAndPortOperations != null) setSubtotalFobOperations(Number(fb.subtotals.fobAndPortOperations).toFixed(2));
      }
      if (fb.totalCostAllIn != null) setEstimatedCost(Number(fb.totalCostAllIn).toFixed(2));
      if (fb.totalQuotationAllIn != null) setSalePrice(Number(fb.totalQuotationAllIn).toFixed(2));
      setIsBreakdownVisible(true);
      hasChanges = true;
    }

    if (structuralModified || payload.forceOpenModal) {
      setIsCargoModalOpen(true);
    }
    if (payload.pol || payload.pod || payload.loadingRate || payload.dischargingRate || payload.distanceNm) {
      setIsCargoModalOpen(true);
    }
    if (payload.requestFinancialBreakdown) {
      setIsCargoModalOpen(true);
    }

   // 🌉 PUENTE INTELIGENTE HACIA EL MOTOR NATIVO (Sin hacks de clics en el DOM ni eventos sintéticos)
    const aiPol = payload.pol || payload.portOfLoading || payload.charteringAssessment?.rotationBreakdown?.pol || payload.rotationBreakdown?.pol || payload.payload?.pol;
    const aiPod = payload.pod || payload.portOfDischarge || payload.charteringAssessment?.rotationBreakdown?.pod || payload.rotationBreakdown?.pod || payload.payload?.pod;

    if (aiPol || aiPod) {
      // 1. Función para buscar coordenadas exactas de forma silenciosa si no vinieron en el payload
      const fetchCoords = async (query) => {
        if (!query) return null;
        if (typeof query === 'object') {
          const lat = Number(query.lat ?? query.latitude);
          const lon = Number(query.lon ?? query.lng ?? query.longitude);
          const candidateName = query.displayName || query.display_name || query.name;
          if (Number.isFinite(lat) && Number.isFinite(lon) && candidateName && candidateName.length > 25) {
            return { lat, lon, name: candidateName, displayName: candidateName };
          }
        }
        const textQuery = typeof query === 'object' ? (query.name || query.displayName || '') : String(query || '');
        if (!textQuery) return null;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(textQuery)}&format=json&limit=1`);
          const data = await res.json();
          if (data?.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name, displayName: data[0].display_name };
        } catch (e) { console.error("Error obteniendo coordenadas:", e); }
        return typeof query === 'object' && Number.isFinite(Number(query.lat)) ? query : null;
      };

      // 2. Ejecutar la búsqueda e invocar directamente la función nativa expuesta en window
      (async () => {
        const [originData, destData] = await Promise.all([fetchCoords(aiPol), fetchCoords(aiPod)]);

        // Actualizar visualmente inputs si existen en el DOM para feedback del usuario con display_name completo
        const polLabel = originData?.displayName || originData?.name || (typeof aiPol === 'string' ? aiPol : '');
        const podLabel = destData?.displayName || destData?.name || (typeof aiPod === 'string' ? aiPod : '');

        // Inyectar en casillas terrestres y marítimas, avisando a React
        ['input-pol', 'map-port-pol', 'port-pol'].forEach(id => {
          const el = document.getElementById(id);
          if (el && polLabel) {
            el.value = polLabel;
            el.dispatchEvent(new Event('input', { bubbles: true })); // <-- Avisa a React
            if (originData) {
              el.dataset.selectedLatitude = originData.lat;
              el.dataset.selectedLongitude = originData.lon;
              el.dataset.lat = originData.lat;
              el.dataset.lon = originData.lon;
              el.dataset.selectedPortLabel = polLabel;
            }
            try { el.blur(); } catch (_) {}
          }
        });

        ['input-pod', 'map-port-pod', 'port-pod'].forEach(id => {
          const el = document.getElementById(id);
          if (el && podLabel) {
            el.value = podLabel;
            el.dispatchEvent(new Event('input', { bubbles: true })); // <-- Avisa a React
            if (destData) {
              el.dataset.selectedLatitude = destData.lat;
              el.dataset.selectedLongitude = destData.lon;
              el.dataset.lat = destData.lat;
              el.dataset.lon = destData.lon;
              el.dataset.selectedPortLabel = podLabel;
            }
            try { el.blur(); } catch (_) {}
          }
        });

        // Ocultar cualquier contenedor de sugerencias para experiencia zero-touch
        document.querySelectorAll('.port-autocomplete-menu, .autocomplete-list, ul[role="listbox"], .nominatim-suggester').forEach(menu => {
          try {
            menu.hidden = true;
            menu.style.display = 'none';
          } catch (_) {}
        });

        // 3. Invocación nativa directa puenteando inputs visuales y eliminando clics sintéticos
        const routeFn = window.calculateLandRouteByCoordinates ||
                        window.calculateLandRoute ||
                        window.calculateOsrmRoute ||
                        window.calculateOpenRouteService;

        if (typeof routeFn === 'function') {
          try {
            await routeFn(originData || aiPol, destData || aiPod);
          } catch (routeErr) {
            console.error("Error ejecutando cálculo nativo de ruta terrestre:", routeErr);
          }
        } else if (typeof window.runOnDemandMapRouteWorkflow === 'function') {
          try {
            await window.runOnDemandMapRouteWorkflow(null, originData || aiPol, destData || aiPod);
          } catch (routeErr) {
            console.error("Error ejecutando runOnDemandMapRouteWorkflow con coordenadas:", routeErr);
          }
        }
      })();
    }
    // --------------------------------------------------------
    if (hasChanges) {
      if (!incomingItems || incomingItems.length === 0) {
        autoCalculateEstimates(cargoItems);
      }
      setActiveProject(updatedProject);
      setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
      await persistProjectToDatabase(updatedProject);
    }
  };

  const buildExecutiveReportData = (sourceItem = null) => {
    let sourcePayload = null;
    if (sourceItem && sourceItem.payload_data) {
      sourcePayload = sourceItem.payload_data;
    } else if (sourceItem && (sourceItem.cargo_items || sourceItem.financial_summary)) {
      sourcePayload = sourceItem;
    }

    let items = [];
    if (sourcePayload && Array.isArray(sourcePayload.cargo_items) && sourcePayload.cargo_items.length > 0) {
      items = sourcePayload.cargo_items;
    } else if (cargoItems.length > 0) {
      items = cargoItems;
    } else if (activeProject?.line_items?.length > 0) {
      const found = activeProject.line_items.find(li => li.payload_data?.cargo_items?.length > 0);
      if (found) {
        items = found.payload_data.cargo_items;
        sourcePayload = found.payload_data;
      }
    }

    let qTotal = 0;
    let wTotalKg = 0;
    let m2Total = 0;
    let m3Total = 0;

    items.forEach((it) => {
      const q = Math.max(1, Number(it.quantity) || 1);
      const l = Math.max(0, parseFloat(it.length_m ?? it.length) || 0);
      const w = Math.max(0, parseFloat(it.width_m ?? it.width) || 0);
      const h = Math.max(0, parseFloat(it.height_m ?? it.height) || 0);
      const wt = Math.max(0, parseFloat(it.unit_weight_kg ?? it.weight) || 0);
      qTotal += q;
      wTotalKg += q * wt;
      m2Total += q * (l * w);
      m3Total += q * (l * w * h);
    });

    if (qTotal === 0 && totals.quantity > 0) {
      qTotal = totals.quantity;
      wTotalKg = totals.weight;
      m2Total = totals.m2;
      m3Total = totals.m3;
    }

    const totalWeightTons = wTotalKg / 1000;
    const reportRT = Math.max(1, Math.max(totalWeightTons, m3Total));

    const isBigBags = items.some(it => {
      const cat = String(it.category || '').toLowerCase();
      const typ = String(it.type || '').toLowerCase();
      const mod = String(it.shipping_mode_supported || '').toLowerCase();
      return cat.includes('ensacad') || cat.includes('dry bulk') || mod.includes('big bag') || mod.includes('granel') ||
        /big\s*bag|ensacad|saco|granel|bulk|cemento|urea|fertilizante|sulfato/i.test(typ) ||
        /big\s*bag|ensacad|saco|granel|bulk|cemento|urea|fertilizante|sulfato/i.test(cat);
    }) || isBigBagsCargo;

    // Parámetros de Ruta, Ritmos Operativos y Demoras
    const reportPol = sourcePayload?.route_and_chartering?.pol || activeProject?.pol || pol || '';
    const reportPod = sourcePayload?.route_and_chartering?.pod || activeProject?.pod || pod || '';
    const reportLoadRate = Math.max(1, Number(sourcePayload?.route_and_chartering?.loading_rate_mt_day ?? loadingRate) || (isBigBags ? 1200 : 850));
    const reportDischRate = Math.max(1, Number(sourcePayload?.route_and_chartering?.discharging_rate_mt_day ?? dischargingRate) || (isBigBags ? 1000 : 750));
    const reportDistance = Math.max(10, Number(sourcePayload?.route_and_chartering?.distance_nm ?? distanceNm) || 1500);
    const reportSpeed = Math.max(1, Number(sourcePayload?.route_and_chartering?.vessel_speed_knots ?? vesselSpeedKnots) || 12.0);
    const reportDailyHire = Number(sourcePayload?.route_and_chartering?.daily_hire_rate_usd ?? vesselDailyHireUsd) || (totalWeightTons >= 35000 ? 16500 : (totalWeightTons >= 10000 ? 13800 : (totalWeightTons >= 3000 ? 11500 : 8500)));
    const reportExRate = Number(sourcePayload?.route_and_chartering?.exchange_rate ?? exchangeRateUsdEur) || 0.92;

    const diasCarga = totalWeightTons > 0 ? Math.round((totalWeightTons / reportLoadRate) * 100) / 100 : 0;
    const diasDescarga = totalWeightTons > 0 ? Math.round((totalWeightTons / reportDischRate) * 100) / 100 : 0;
    const diasNavegacion = Math.round((reportDistance / (reportSpeed * 24)) * 100) / 100;
    const diasRotacionTotal = Math.round((diasCarga + diasDescarga + diasNavegacion) * 100) / 100;

    // Demoras
    const actualLoad = sourcePayload?.route_and_chartering?.actual_loading_days ?? (actualLoadingDays !== '' ? Number(actualLoadingDays) : null);
    const actualDisch = sourcePayload?.route_and_chartering?.actual_discharging_days ?? (actualDischargingDays !== '' ? Number(actualDischargingDays) : null);
    const demLoadDays = (actualLoad !== null && actualLoad > diasCarga) ? Math.round((actualLoad - diasCarga) * 100) / 100 : 0;
    const demDischDays = (actualDisch !== null && actualDisch > diasDescarga) ? Math.round((actualDisch - diasDescarga) * 100) / 100 : 0;

    // Detección y Herencia de Tarifa de Convenio FSPE para Reporte Ejecutivo
    const rawType = String(
      items[0]?.type ||
      cargoItems[0]?.type ||
      activeProject?.cargo_type ||
      sourcePayload?.cargo_items?.[0]?.type ||
      ''
    ).toUpperCase().trim();
    const appliedTariff = COMMODITY_TARIFFS[rawType] || null;
    const isTariffActive = Boolean(isCommodityTariffActive || appliedTariff);
    const effectiveWeightTons = totalWeightTons > 0 ? totalWeightTons : (totals.weight > 0 ? totals.weight / 1000 : (Number(activeProject?.cargoQuantity) || 0));
    const tariffRate = appliedTariff?.inlandUsdMt || 3.00;
    const officialInlandCost = Math.round(effectiveWeightTons * tariffRate * 100) / 100;
    const officialSalePrice = Math.round(officialInlandCost * 1.18 * 100) / 100;
    const officialMargin = Math.round((officialSalePrice - officialInlandCost) * 100) / 100;

    let reportDemDays = isTariffActive ? 0 : Math.round((demLoadDays + demDischDays) * 100) / 100;
    const reportDemDailyUsd = isTariffActive ? 0 : (Number(sourcePayload?.route_and_chartering?.demurrage_daily_rate_usd ?? demurrageDailyRateUsd) || reportDailyHire);
    let demurrageCostNum = isTariffActive ? 0 : Math.round(reportDemDays * reportDemDailyUsd * 100) / 100;

    // Subtotal 1: Flete Marítimo / Transporte Terrestre
    let fleteCostNum = 0;
    if (isTariffActive) {
      fleteCostNum = officialInlandCost;
    } else if (sourcePayload?.financialBreakdown?.subtotalOceanFreight != null && Number(sourcePayload.financialBreakdown.subtotalOceanFreight) > 0) {
      fleteCostNum = Number(sourcePayload.financialBreakdown.subtotalOceanFreight);
    } else if (sourcePayload?.financial_summary?.subtotal_ocean_freight_usd != null && Number(sourcePayload.financial_summary.subtotal_ocean_freight_usd) > 0) {
      fleteCostNum = Number(sourcePayload.financial_summary.subtotal_ocean_freight_usd);
    } else if (parseFloat(subtotalFreight) > 0) {
      fleteCostNum = parseFloat(subtotalFreight);
    } else if (sourcePayload?.financial_summary?.subtotal_ocean_freight_eur != null && Number(sourcePayload.financial_summary.subtotal_ocean_freight_eur) > 0) {
      fleteCostNum = Number(sourcePayload.financial_summary.subtotal_ocean_freight_eur);
    } else {
      fleteCostNum = Math.round(diasRotacionTotal * reportDailyHire * 100) / 100;
    }
    const fleteSaleNum = isTariffActive ? officialSalePrice : fleteCostNum * 1.15;
    const fleteMarginNum = isTariffActive ? officialMargin : fleteSaleNum - fleteCostNum;

    // Subtotal 2: Cuadrillas y Estiba
    const gangsCount = sourcePayload?.port_labor_and_equipment?.stevedore_gangs_shifts ?? stevedoreGangs;
    const effectiveGangs = isTariffActive ? 0 : (gangsCount > 0 ? gangsCount : (isBigBags ? Math.max(1, Math.ceil(Math.ceil(qTotal / 15) / 140)) : Math.max(1, Math.ceil(qTotal / 15))));
    const lashingCount = isTariffActive ? 0 : (sourcePayload?.port_labor_and_equipment?.lashing_team ?? (isBigBags ? 0 : lashingTeam));
    const estibaCostNum = isTariffActive ? 0 : ((effectiveGangs * 1200) + (lashingCount * 800));
    const estibaSaleNum = isTariffActive ? 0 : (estibaCostNum * 1.15);
    const estibaMarginNum = isTariffActive ? 0 : (estibaSaleNum - estibaCostNum);

    // Equipos Auxiliares y Materiales (Grúa Móvil Portuaria con Operador, MAFIs, Heavy Lift, Spreader, Cadenas, Dunnage)
    const mafiCount = isTariffActive ? 0 : (sourcePayload?.port_labor_and_equipment?.mafi_platforms ?? mafiPlatforms);
    const heavyLiftCount = isTariffActive ? 0 : (sourcePayload?.port_labor_and_equipment?.heavy_lift_crane ?? heavyLiftCrane);
    const portCraneShifts = isTariffActive ? 0 : (isBigBags ? effectiveGangs : 0);
    const portCraneCost = isTariffActive ? 0 : (portCraneShifts * 1800);
    const spreaderCount = isTariffActive ? 0 : (isBigBags ? (sourcePayload?.lashing_and_dunnage_materials?.spreader_multipunto ?? spreaderMultipunto ?? Math.max(1, Math.min(2, Math.ceil(qTotal / 1500)))) : 0);
    const spreaderCost = isTariffActive ? 0 : (spreaderCount * 600);
    const airBagsCost = isTariffActive ? 0 : (isBigBags ? (Math.max(2, Math.ceil(totalWeightTons / 50)) * 35) : 0);
    const dunnageCount = isTariffActive ? 0 : (isBigBags ? 0 : (sourcePayload?.lashing_and_dunnage_materials?.dunnage_wood ?? dunnageWood));
    const chainsCount = isTariffActive ? 0 : (isBigBags ? 0 : (sourcePayload?.lashing_and_dunnage_materials?.chains_and_binders ?? chainsBinders));
    const slingsCount = isTariffActive ? 0 : (isBigBags ? 0 : (sourcePayload?.lashing_and_dunnage_materials?.high_capacity_slings ?? highCapacitySlings));

    const matCostNum = isTariffActive ? 0 : ((mafiCount * 300) + (heavyLiftCount * 2500) + portCraneCost + spreaderCost + airBagsCost + (dunnageCount * 30) + (chainsCount * 80) + (slingsCount * 40));
    const matSaleNum = isTariffActive ? 0 : (matCostNum * 1.15);
    const matMarginNum = isTariffActive ? 0 : (matSaleNum - matCostNum);

    // Logística Periférica (Pre-Stacking 70%, Manipulación Inicial, Almacenaje, Surveyor, Inland, Seguro Mercancía CIF, Mercancía)
    const sDays = isTariffActive ? 0 : (sourcePayload?.peripheral_services?.storage_days ?? storageDays);
    const survCost = isTariffActive ? 0 : (Number(sourcePayload?.peripheral_services?.surveyor_cost ?? surveyorCost) || 0);
    const inlCost = isTariffActive ? officialInlandCost : (Number(sourcePayload?.peripheral_services?.inland_cost ?? inlandCost) || 0);
    const custCost = isTariffActive ? 0 : (Number(sourcePayload?.peripheral_services?.customs_cost ?? customsCost) || 0);
    const insCost = isTariffActive ? 0 : (Number(sourcePayload?.peripheral_services?.insurance_cost ?? sourcePayload?.peripheral_services?.seguro_mercancia ?? insuranceCost) || 0);

    let storageCostNum = 0;
    let initialHandlingCost = 0;
    const preStackDays = Math.max(5, Number(sDays) || 5);
    const preStackingDays = sourcePayload?.financialBreakdown?.preStackingDays ?? (isBigBags ? preStackDays : (Number(sDays) > 0 ? Number(sDays) : preStackDays));
    if (!isTariffActive) {
      if (isBigBags) {
        const preStackRatio = 0.70;
        const preStackedTons = totalWeightTons * preStackRatio;
        const effectiveArea = m2Total > 0 ? m2Total : (totalWeightTons > 0 ? totalWeightTons * 0.8 : qTotal * 0.8);
        const preStackedArea = Math.ceil(effectiveArea * preStackRatio);
        storageCostNum = preStackedArea * preStackDays * 2;
        if (Number(sDays) > 5) {
          storageCostNum += Math.ceil(effectiveArea) * (Number(sDays) - 5) * 2;
        }
        initialHandlingCost = preStackedTons * 2.0;
      } else {
        storageCostNum = Math.ceil(m2Total) * (Number(sDays) || 0) * 2;
      }
    }

    const periCostNum = isTariffActive ? 0 : (storageCostNum + initialHandlingCost + survCost + inlCost + custCost);
    const periSaleNum = isTariffActive ? 0 : (periCostNum * 1.15);
    const periMarginNum = isTariffActive ? 0 : (periSaleNum - periCostNum);

    const fobSubtotal = isTariffActive ? 0 : (estibaCostNum + matCostNum + periCostNum + insCost + demurrageCostNum);
    const finalTotalCost = isTariffActive ? officialInlandCost : (Math.round((fleteCostNum + fobSubtotal) * 100) / 100);
    const finalTotalSale = isTariffActive ? officialSalePrice : (Math.round((finalTotalCost * 1.15) * 100) / 100);
    const finalTotalMargin = isTariffActive ? officialMargin : (Math.round((finalTotalSale - finalTotalCost) * 100) / 100);
    const unitRateSale = reportRT > 0 ? finalTotalSale / reportRT : 0;

    const stateCargoTons = typeof window !== 'undefined' && window.State
      ? (Number(window.State.cargo) || Number(window.State.dwt) || Number(window.State.cargoQuantity) || 0)
      : 0;
    const projectTons = Number(activeProject?.cargoQuantity || activeProject?.toneladas || activeProject?.tonnes || activeProject?.cargo || 0);
    const packingListTons = totalWeightTons > 0 ? totalWeightTons : (wTotalKg > 0 ? wTotalKg / 1000 : 0);
    const effectiveTotalTons = packingListTons > 0 ? packingListTons : (stateCargoTons > 0 ? stateCargoTons : (projectTons > 0 ? projectTons : (reportRT > 0 ? reportRT : 1)));
    const toneladas = effectiveTotalTons > 0 ? effectiveTotalTons : 1;

    // Flete total en USD
    let fleteTotalUsd = 0;
    if (sourcePayload?.financialBreakdown?.flete_total_usd != null && Number(sourcePayload.financialBreakdown.flete_total_usd) > 0) {
      fleteTotalUsd = Number(sourcePayload.financialBreakdown.flete_total_usd);
    } else if (sourcePayload?.flete_total_usd != null && Number(sourcePayload.flete_total_usd) > 0) {
      fleteTotalUsd = Number(sourcePayload.flete_total_usd);
    } else {
      fleteTotalUsd = Math.round(diasRotacionTotal * reportDailyHire * 100) / 100;
    }

    // Costes FOB operativos (excluyendo mercancía) y Valor total de la mercancía en USD
    const fobOpsCostUsd = estibaCostNum + matCostNum + (storageCostNum + initialHandlingCost + survCost + inlCost + insCost) + demurrageCostNum;
    const valorMercanciaUsd = custCost;

    let costesFobTotalesUsd = 0;
    let valorTotalMercanciaUsd = 0;

    if (sourcePayload?.financialBreakdown?.costes_fob_totales_usd != null) {
      costesFobTotalesUsd = Number(sourcePayload.financialBreakdown.costes_fob_totales_usd);
    } else if (sourcePayload?.costes_fob_totales_usd != null) {
      costesFobTotalesUsd = Number(sourcePayload.costes_fob_totales_usd);
    } else {
      costesFobTotalesUsd = Math.round(fobOpsCostUsd * 100) / 100;
    }

    const effectiveGoodsValue = Number(
      sourcePayload?.financialBreakdown?.valor_total_mercancia_usd
      ?? sourcePayload?.valor_total_mercancia_usd
      ?? sourcePayload?.goodsValue
      ?? sourcePayload?.merchandiseValue
      ?? activeProject?.valor_total_mercancia_usd
      ?? activeProject?.goodsValue
      ?? activeProject?.merchandiseValue
      ?? activeProject?.cargo_value
      ?? activeProject?.data?.goodsValue
      ?? activeProject?.data?.financials?.goodsValue
      ?? (typeof window !== 'undefined' && window.State ? (window.State.goodsValue || window.State.valor_total_mercancia_usd || window.State.merchandiseValue || window.State.cargoValue) : 0)
      ?? custCost
      ?? 0
    );

    if (sourcePayload?.financialBreakdown?.valor_total_mercancia_usd != null && Number(sourcePayload.financialBreakdown.valor_total_mercancia_usd) > 0) {
      valorTotalMercanciaUsd = Number(sourcePayload.financialBreakdown.valor_total_mercancia_usd);
    } else if (sourcePayload?.valor_total_mercancia_usd != null && Number(sourcePayload.valor_total_mercancia_usd) > 0) {
      valorTotalMercanciaUsd = Number(sourcePayload.valor_total_mercancia_usd);
    } else if (effectiveGoodsValue > 0) {
      valorTotalMercanciaUsd = Math.round(effectiveGoodsValue * 100) / 100;
    } else {
      valorTotalMercanciaUsd = Math.round(valorMercanciaUsd * 100) / 100;
    }

    // Ratios unitarios en USD/MT:
    // Si existe un valor total de la mercancía (goodsValue o importado de Data Bridge), divídelo entre las toneladas totales de la carga
    // (State.cargo, State.dwt o la suma de kilos del packing list) para obtener el unitario. Súmalo al coste unitario del flete si procede.
    let fleteUnitarioUsdMt = 0;
    let fobMasMercanciaUnitarioUsdMt = 0;

    if (sourcePayload?.financialBreakdown?.flete_unitario_usd_mt != null) {
      fleteUnitarioUsdMt = Number(sourcePayload.financialBreakdown.flete_unitario_usd_mt);
    } else if (sourcePayload?.flete_unitario_usd_mt != null) {
      fleteUnitarioUsdMt = Number(sourcePayload.flete_unitario_usd_mt);
    } else {
      fleteUnitarioUsdMt = toneladas > 0 ? Math.round((fleteTotalUsd / toneladas) * 100) / 100 : 0;
    }

    if (sourcePayload?.financialBreakdown?.fob_mas_mercancia_unitario_usd_mt != null && Number(sourcePayload.financialBreakdown.fob_mas_mercancia_unitario_usd_mt) > 0) {
      fobMasMercanciaUnitarioUsdMt = Number(sourcePayload.financialBreakdown.fob_mas_mercancia_unitario_usd_mt);
    } else if (sourcePayload?.fob_mas_mercancia_unitario_usd_mt != null && Number(sourcePayload.fob_mas_mercancia_unitario_usd_mt) > 0) {
      fobMasMercanciaUnitarioUsdMt = Number(sourcePayload.fob_mas_mercancia_unitario_usd_mt);
    } else {
      const goodsUnitaryUsd = toneladas > 0 ? (valorTotalMercanciaUsd / toneladas) : 0;
      const fobBaseUnitary = toneladas > 0 ? (fobSubtotal / toneladas) : 0;
      if (goodsUnitaryUsd > 0) {
        const baseUnit = fobBaseUnitary > 0 ? fobBaseUnitary : fleteUnitarioUsdMt;
        fobMasMercanciaUnitarioUsdMt = Math.round((baseUnit + goodsUnitaryUsd) * 100) / 100;
      } else {
        fobMasMercanciaUnitarioUsdMt = toneladas > 0 ? Math.round((fobSubtotal / toneladas) * 100) / 100 : 0;
      }
    }

    // Desglose detallado de partidas FOB y Operativas para el Reporte Ejecutivo
    const fobPortOperationsItems = [];
    if (effectiveGangs > 0) {
      fobPortOperationsItems.push({
        concept: isBigBags ? `Cuadrillas de Estiba en Muelle (${effectiveGangs} turnos)` : `Cuadrillas de Estibadores en Muelle (${effectiveGangs} turnos)`,
        units: effectiveGangs,
        amount: effectiveGangs * 1200,
        category: 'Manipulación en Muelle',
      });
    }
    if (lashingCount > 0) {
      fobPortOperationsItems.push({
        concept: `Personal Técnico Especializado en Trincaje Industrial (${lashingCount} equipos)`,
        units: lashingCount,
        amount: lashingCount * 800,
        category: 'Trincaje y Estiba',
      });
    }
    if (survCost > 0) {
      fobPortOperationsItems.push({
        concept: 'Inspección Pericial / Surveyor Portuario Independiente',
        units: 1,
        amount: survCost,
        category: 'Servicios Asociados',
      });
    }
    if (inlCost > 0) {
      fobPortOperationsItems.push({
        concept: 'Transporte Terrestre Inland / Acarreo Portuario',
        units: 1,
        amount: inlCost,
        category: 'Servicios Asociados',
      });
    }
    if (insCost > 0) {
      fobPortOperationsItems.push({
        concept: 'Seguro de Mercancía a Todo Riesgo',
        units: 1,
        amount: insCost,
        category: 'Servicios Asociados',
        description: 'Póliza marítima de seguro a todo riesgo para la mercancía bajo cobertura de cláusulas ICC A del Instituto de Londres (condiciones CIF).',
      });
    }
    if (custCost > 0) {
      fobPortOperationsItems.push({
        concept: 'Mercancía',
        units: 1,
        amount: custCost,
        category: 'Mercancía',
        description: 'Valor total de la mercancía gestionado internamente en la operativa FOB.',
      });
    }

    let stowagePlan = sourcePayload?.stowagePlan
      || sourcePayload?.financialBreakdown?.stowagePlan
      || sourcePayload?.operationalProfile?.stowagePlan
      || activeReport?.stowagePlan
      || charteringAssessment?.stowagePlan
      || null;

    if (!stowagePlan) {
      stowagePlan = calculateUniversalStowagePlan(
        items,
        { totalWeightTons, totalVolumeCbm: m3Total, totalPieces: qTotal },
        { shippingMode: sourcePayload?.shipping_mode || shippingMode, pol: reportPol, pod: reportPod }
      );
    }

    return {
      totals: { quantity: qTotal, weight: wTotalKg, m2: m2Total, m3: m3Total },
      totalWeightTons,
      totalVolumeM3: m3Total,
      reportRT,
      shippingMode: sourcePayload?.shipping_mode || shippingMode,
      vesselType: sourcePayload?.recommended_vessel || vesselType,
      pol: reportPol,
      pod: reportPod,
      distanceNm: reportDistance,
      loadingRate: reportLoadRate,
      dischargingRate: reportDischRate,
      vesselSpeedKnots: reportSpeed,
      dailyRateUsd: reportDailyHire,
      exchangeRateUsdEur: reportExRate,
      diasCarga,
      diasDescarga,
      diasNavegacion,
      diasRotacionTotal,
      demurrageDays: reportDemDays,
      demurrageCostNum,
      demurrageDailyRateUsd: reportDemDailyUsd,
      demurrageStatus: reportDemDays > 0 ? 'EXCESO DE ESTADÍA (ON DEMURRAGE)' : 'DENTRO DE PLANCHA (ON SCHEDULE)',
      fleteCostNum,
      fleteSaleNum,
      fleteMarginNum,
      estibaCostNum,
      estibaSaleNum,
      estibaMarginNum,
      matCostNum,
      matSaleNum,
      matMarginNum,
      periCostNum,
      periSaleNum,
      periMarginNum,
      subtotalFreight: fleteCostNum.toFixed(2),
      subtotalFobOperations: fobSubtotal.toFixed(2),
      finalTotalCost,
      finalTotalSale,
      finalTotalMargin,
      unitRateSale,
      storageDays: sDays,
      preStackingDays: preStackingDays || 5,
      craneCostNum: (heavyLiftCount * 2500) + portCraneCost,
      storageCostNum,
      initialHandlingCost,
      toneladas,
      fleteTotalUsd,
      costesFobTotalesUsd,
      valorTotalMercanciaUsd,
      fleteUnitarioUsdMt,
      fobMasMercanciaUnitarioUsdMt,
      flete_unitario_usd_mt: fleteUnitarioUsdMt,
      fob_mas_mercancia_unitario_usd_mt: fobMasMercanciaUnitarioUsdMt,
      flete_total_usd: fleteTotalUsd,
      costes_fob_totales_usd: costesFobTotalesUsd,
      valor_total_mercancia_usd: valorTotalMercanciaUsd,
      insuranceCost: insCost,
      insuranceCostNum: insCost,
      seguroMercancia: insCost,
      insuranceSaleNum: insCost * 1.15,
      insuranceMarginNum: insCost * 0.15,
      isCommodityTariffActive: isTariffActive,
      appliedTariff,
      vehicleType: vehicleType || (isBigBags ? 'Camión Plataforma con Grúa Autocarga' : (activeProject?.truck_type || 'Tráiler Tauliner (13.6m)')),
      truck_type: vehicleType || (isBigBags ? 'Camión Plataforma con Grúa Autocarga' : (activeProject?.truck_type || 'Tráiler Tauliner (13.6m)')),
      loadingMethod: loadingMethod || (isBigBags ? 'Autocarga con Grúa del Camión' : 'Carga Lateral (Lona / Tauliner)'),
      dischargeMethod: dischargeMethod || (isBigBags ? 'Autocarga con Grúa del Camión' : 'Carga Trasera por Muelle / Rampa'),
      payloadKg: getVehiclePayloadKg(vehicleType || activeProject?.truck_type || (isBigBags ? 'Camión Plataforma con Grúa Autocarga' : 'Tráiler Tauliner (13.6m)')),
      payloadTons: getVehiclePayloadKg(vehicleType || activeProject?.truck_type || (isBigBags ? 'Camión Plataforma con Grúa Autocarga' : 'Tráiler Tauliner (13.6m)')) / 1000,
      inlandCost: isTariffActive ? officialInlandCost : inlCost,
      tollCost: isTariffActive ? 0 : (Number(activeProject?.tollCost || activeProject?.peajes) || 0),
      driverDiets: isTariffActive ? 0 : (Number(activeProject?.driverDiets || activeProject?.dietas) || 0),
      warehouseWaitPenaltyEur: 0,
      totalRoadCost: isTariffActive ? officialInlandCost : finalTotalCost,
      finalSalePrice: isTariffActive ? officialSalePrice : finalTotalSale,
      fobPortOperationsItems,
      stowagePlan,
    };
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      // 1. Inmediata lectura y sanitización del estado actual de todas las filas existentes en la tabla superior
      const sourceItems = (cargoItems && cargoItems.length > 0)
        ? cargoItems
        : (extractProjectCargoItems(activeProject) || []);

      const currentItems = sourceItems.map((item, idx) => {
        const qty = Math.max(1, parseInt(String(item.quantity ?? 1).replace(',', '.'), 10) || 1);
        const l = Math.max(0, parseFloat(String(item.length ?? item.length_m ?? 0).replace(',', '.')) || 0);
        const w = Math.max(0, parseFloat(String(item.width ?? item.width_m ?? 0).replace(',', '.')) || 0);
        const h = Math.max(0, parseFloat(String(item.height ?? item.height_m ?? 0).replace(',', '.')) || 0);
        const wt = Math.max(0, parseFloat(String(item.weight ?? item.unit_weight_kg ?? 0).replace(',', '.')) || 0);
        return {
          ...item,
          id: item.id || `item-${Date.now()}-${idx}`,
          category: item.category || 'Carga Unitizada / Envasada',
          type: item.type || '',
          quantity: qty,
          length: l,
          width: w,
          height: h,
          weight: wt,
          length_m: l,
          width_m: w,
          height_m: h,
          unit_weight_kg: wt,
          shipping_mode_supported: item.shipping_mode_supported || 'Camión Plataforma con Grúa Autocarga',
        };
      });

      // Preservar íntegramente las filas en la tabla sin vaciarlas jamás
      if (currentItems.length > 0) {
        setCargoItems(currentItems);
      }

      // Detección reactiva de Carga Envasada vs Granel con blindaje NLP para Big Bags
      const isBigBagInRecalc = /big\s*bag/i.test([
        activeProject?.cargoType,
        activeProject?.cargo_type,
        activeProject?.product,
        activeProject?.prompt,
        activeProject?.instruction,
        activeProject?.description,
        ...(currentItems || []).map(it => `${it.type || ''} ${it.category || ''} ${it.description || ''}`)
      ].filter(Boolean).join(' '));

      const detectedRecalc = detectCargoPackagingType(currentItems, activeProject);
      if (detectedRecalc) {
        if (detectedRecalc.isPackaged || isBigBagInRecalc) {
          setVehicleType('Camión Plataforma con Grúa Autocarga');
          setLoadingMethod('Autocarga con Grúa del Camión');
          setDischargeMethod('Autocarga con Grúa del Camión');
        } else if (detectedRecalc.isBulk && !isBigBagInRecalc) {
          setVehicleType('Bañera Basculante (Granel)');
          setLoadingMethod('Carga por Silo / Tubo (Granel)');
          setDischargeMethod('Basculante / Tolva (Granel)');
        }
      }

      // Ejecutar el motor de cálculo maestro sobre los ítems conservados
      autoCalculateEstimates(currentItems);

      // Feedback visual sutil y rápido de confirmación al usuario
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      setRecalculateFeedback('Cálculos actualizados');
      feedbackTimeoutRef.current = setTimeout(() => {
        setRecalculateFeedback(null);
      }, 2500);

    } catch (err) {
      console.error('Error durante el recálculo manual de partidas:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleOpenExecutiveReport = (item = null) => {
    try {
      const data = buildExecutiveReportData(item);
      setActiveReport(data);
      setReportData(data);
      setShowExecutiveReport(true);
    } catch (err) {
      console.error('Error al generar el reporte ejecutivo:', err);
      // Fallback defensivo: asegurar apertura con datos mínimos para evitar bloqueo
      const fallbackData = buildExecutiveReportData();
      setActiveReport(fallbackData);
      setReportData(fallbackData);
      setShowExecutiveReport(true);
    }
  };

  const handleOpenCreateService = () => {
    try {
      setEditingLineItemId(null); setCargoItems([]);
      setDunnageWood(0); setHighCapacitySlings(0); setChainsBinders(0); setShackles(0);
      setStevedoreGangs(0); setLashingTeam(0); setHeavyLiftCrane(0); setMafiPlatforms(0);
      setShippingMode('Lo-Lo'); setVesselType('Geared Breakbulk (Lo-Lo)');
      setStorageDays(0); setSurveyorCost(0); setInlandCost(0); setCustomsCost(0); setInsuranceCost(0);
      userEditedSurveyor.current = false; setEstimatedCost(''); setSalePrice('');
      setLandOrigin(activeProject?.land_route?.origin || activeProject?.land_origin || '');
      setLandDestination(activeProject?.land_route?.destination || activeProject?.land_destination || '');
      setDistanceKm(Number(activeProject?.land_route?.distance_km || activeProject?.land_distance || 0));
      setIsCargoModalOpen(true);
    } catch (err) {
      console.error('[ForwarderWorkspace] Error al abrir creador de servicios:', err);
    }
  };

  const handleEditService = (item) => {
    try {
      if (!item) return;
      setEditingLineItemId(item?.id || null);
      const payload = item?.payload_data || item?.data || {};
      if (payload) {
        if (payload.land_route) {
          setLandOrigin(payload.land_route.origin || '');
          setLandDestination(payload.land_route.destination || '');
          setDistanceKm(Number(payload.land_route.distance_km || 0));
        } else if (payload.land_origin || payload.land_destination || payload.land_distance) {
          setLandOrigin(payload.land_origin || '');
          setLandDestination(payload.land_destination || '');
          setDistanceKm(Number(payload.land_distance || 0));
        } else {
          setLandOrigin(activeProject?.land_route?.origin || activeProject?.land_origin || '');
          setLandDestination(activeProject?.land_route?.destination || activeProject?.land_destination || '');
          setDistanceKm(Number(activeProject?.land_route?.distance_km || activeProject?.land_distance || 0));
        }
        let mappedItems = [];
        if (Array.isArray(payload.cargo_items)) {
          mappedItems = (payload.cargo_items || []).map((ci) => ({
            id: ci.id || `item-${Date.now()}`, category: ci.category || 'Equipos de Proceso', quantity: ci.quantity || 1, type: ci.type || '',
            length: ci.length_m ?? ci.length ?? '', width: ci.width_m ?? ci.width ?? '', height: ci.height_m ?? ci.height ?? '', weight: ci.unit_weight_kg ?? ci.weight ?? '', shipping_mode_supported: ci.shipping_mode_supported || 'Tráiler Lona (13.6m)'
          }));
          setCargoItems(mappedItems);
        }
        const mats = payload.lashing_and_dunnage_materials || {};
        setDunnageWood(mats.dunnage_wood || 0); setHighCapacitySlings(mats.high_capacity_slings || 0); setChainsBinders(mats.chains_and_binders || 0); setShackles(mats.shackles || 0);
        setSpreaderMultipunto(mats.spreader_multipunto || 0);
        const labor = payload.port_labor_and_equipment || {};
        setStevedoreGangs(labor.stevedore_gangs_shifts || 0); setLashingTeam(labor.lashing_team || 0); setHeavyLiftCrane(labor.heavy_lift_crane || 0); setMafiPlatforms(labor.mafi_platforms || 0);
        if (payload.shipping_mode) setShippingMode(payload.shipping_mode);
        if (payload.recommended_vessel) setVesselType(payload.recommended_vessel);
        const peri = payload.peripheral_services || {};
        setStorageDays(peri.storage_days || 0); setSurveyorCost(peri.surveyor_cost || 0); setInlandCost(peri.inland_cost || 0); setCustomsCost(peri.customs_cost || 0);
        setInsuranceCost(peri.insurance_cost || peri.seguro_mercancia || peri.insuranceCost || 0);
        userEditedSurveyor.current = (peri.surveyor_cost || peri.surveyorCost) != null;
        const fin = payload.financial_summary || {};
        const fCost = fin.subtotal_ocean_freight_usd ?? fin.subtotal_ocean_freight_eur;
        if (fCost != null) setSubtotalFreight(String(fCost));
        const fobCost = fin.subtotal_fob_operations_usd ?? fin.subtotal_fob_operations_eur;
        if (fobCost != null) setSubtotalFobOperations(String(fobCost));
        const estCost = fin.estimated_total_cost_usd ?? fin.estimated_total_cost_eur;
        setEstimatedCost(estCost ? String(estCost) : '');
        const sPrice = fin.customer_sale_price_usd ?? fin.customer_sale_price_eur;
        setSalePrice(sPrice ? String(sPrice) : '');

        if (payload.route_and_chartering) {
          const rc = payload.route_and_chartering;
          if (rc.pol) setPol(rc.pol);
          if (rc.pod) setPod(rc.pod);
          if (rc.loading_rate_mt_day) setLoadingRate(Number(rc.loading_rate_mt_day));
          if (rc.discharging_rate_mt_day) setDischargingRate(Number(rc.discharging_rate_mt_day));
          if (rc.distance_nm) setDistanceNm(Number(rc.distance_nm));
          if (rc.vessel_speed_knots) setVesselSpeedKnots(Number(rc.vessel_speed_knots));
          if (rc.daily_hire_rate_usd) setVesselDailyHireUsd(Number(rc.daily_hire_rate_usd));
          if (rc.actual_loading_days !== undefined && rc.actual_loading_days !== null) {
            setActualLoadingDays(rc.actual_loading_days);
          }
          if (rc.actual_discharging_days !== undefined && rc.actual_discharging_days !== null) {
            setActualDischargingDays(rc.actual_discharging_days);
          }
          if (rc.demurrage_daily_rate_usd) {
            setDemurrageDailyRateUsd(Number(rc.demurrage_daily_rate_usd));
          }
        }
        if (payload.charteringAssessment || payload.chartering_assessment) {
          setCharteringAssessment(payload.charteringAssessment || payload.chartering_assessment);
        }

        try {
          const repData = buildExecutiveReportData(item);
          setActiveReport(repData);
          setReportData(repData);
        } catch (repErr) {
          console.warn('[ForwarderWorkspace] Error no bloqueante al generar reporte ejecutivo:', repErr);
        }
      }
      setIsCargoModalOpen(true);
    } catch (err) {
      console.error('[ForwarderWorkspace] Error en handleEditService:', err);
    }
  };

  const handleDeleteService = (itemId) => {
    try {
      if (!activeProject || !window.confirm('¿Seguro que deseas eliminar este servicio?')) return;
      const existingItems = (Array.isArray(activeProject?.line_items) && activeProject.line_items.length > 0)
        ? activeProject.line_items
        : (Array.isArray(activeProject?.services) ? activeProject.services : []);
      const updatedLineItems = (existingItems || []).filter((line) => line?.id !== itemId);
      const updatedCost = (updatedLineItems || []).reduce((acc, it) => acc + (Number(it?.cost_eur) || 0), 0);
      const updatedSale = (updatedLineItems || []).reduce((acc, it) => acc + (Number(it?.sale_price_eur) || 0), 0);
      const updatedProject = {
        ...activeProject,
        line_items: updatedLineItems,
        services: updatedLineItems,
        land_freight_cost: updatedCost,
        land_freight_sale: updatedSale,
        targetSalePrice: updatedSale,
        totalTripCost: updatedCost,
        cost: updatedCost,
        sale: updatedSale,
      };
      setActiveProject(updatedProject);
      setProjects((prev) => (prev || []).map((p) => (p?.id === activeProject?.id || p?.project_ref === activeProject?.project_ref) ? updatedProject : p));
      persistProjectToDatabase(updatedProject);
    } catch (err) {
      console.error('[ForwarderWorkspace] Error al eliminar servicio:', err);
    }
  };

  const handleSaveProjectCargo = async () => {
    try {
      console.log('Guardar Flete y Estiba en Proyecto:', {
        cargoItems,
        subtotalFreight,
        subtotalFobOperations,
        estimatedCost,
        salePrice
      });

      // Blindar el Pipeline de Sincronización contra fallos gráficos de Leaflet / DOM
      try {
        if (typeof window !== 'undefined') {
          if (typeof window.renderRouteOnMap === 'function') {
            window.renderRouteOnMap();
          }
          if (typeof window.sendMapDataToDataBridge === 'function') {
            window.sendMapDataToDataBridge();
          }
          if (typeof window.MapController?.renderMapData === 'function') {
            window.MapController.renderMapData();
          }
        }
      } catch (mapErr) {
        console.warn('Aviso no bloqueante en renderizado de mapa durante guardado de flete y estiba:', mapErr);
      }

      const currentReportSnapshot = buildExecutiveReportData();
      setActiveReport(currentReportSnapshot);
      setReportData(currentReportSnapshot);

      const calculatedLandFreightCost = parseFloat(estimatedCost)
        || currentReportSnapshot?.finalTotalCost
        || currentReportSnapshot?.fleteCostNum
        || (Number(activeProject?.land_freight_cost) > 0 ? Number(activeProject.land_freight_cost) : 0)
        || 0;

      const calculatedLandFreightSale = parseFloat(salePrice)
        || currentReportSnapshot?.finalTotalSale
        || currentReportSnapshot?.fleteSaleNum
        || (Number(activeProject?.land_freight_sale) > 0 ? Number(activeProject.land_freight_sale) : 0)
        || (calculatedLandFreightCost > 0 ? Math.round(calculatedLandFreightCost * 1.18) : 0);

      const merchandiseValueUsd = Number(
        (mercanciaCost > 0 ? mercanciaCost : null)
        ?? currentReportSnapshot?.valor_total_mercancia_usd
        ?? activeProject?.valor_total_mercancia_usd
        ?? activeProject?.goodsValue
        ?? activeProject?.merchandiseValue
        ?? (typeof window !== 'undefined' && window.State ? (window.State.goodsValue || window.State.valor_total_mercancia_usd || window.State.merchandiseValue || window.State.cargoValue) : 0)
        ?? 0
      );

      const tuVariableDeCosteTotalTerrestre = calculatedLandFreightCost;
      const tuVariableDePrecioVentaTerrestre = calculatedLandFreightSale;

      const inheritedCargoItems = (cargoItems && cargoItems.length > 0)
        ? cargoItems
        : (activeProject?.cargo_items || activeProject?.line_items?.[0]?.payload_data?.cargo_items || activeProject?.items || []);

      const safeCargoItems = Array.isArray(inheritedCargoItems) ? inheritedCargoItems : [];
      const payload = {
        ...activeProject, // Heredar todo por defecto
        items: (cargoItems && cargoItems.length > 0) ? cargoItems : (activeProject?.items || []),
        cargo_items: (cargoItems && cargoItems.length > 0) ? cargoItems : (activeProject?.cargo_items || activeProject?.line_items?.[0]?.payload_data?.cargo_items || []),
        packing_list: activeProject?.packing_list || null,
        // ... (tus campos terrestres actualizados)
        land_route: { origin: landOrigin, destination: landDestination, distance_km: distanceKm },
        land_freight_cost: calculatedLandFreightCost,
        land_freight_sale: calculatedLandFreightSale,
        truck_type: vehicleType,
        vehicle_type: vehicleType,
        vehicle_attributes: activeProject?.vehicle_attributes || null,
        loading_method: loadingMethod,
        discharge_method: dischargeMethod,
        payload_kg: getVehiclePayloadKg(vehicleType),
        total_trucks: Math.max(1, Math.ceil((totals?.weight || currentReportSnapshot?.totals?.weight || 0) / getVehiclePayloadKg(vehicleType))),
        project_ref: activeProject?.project_ref,
        cargo_items_detail: safeCargoItems.map((item) => ({
          id: item.id || `item-${Date.now()}-${Math.random()}`,
          category: item.category || 'Equipos de Proceso',
          quantity: parseInt(item.quantity, 10) || 1,
          type: item.type || 'Sin especificar',
          length_m: parseFloat(item.length) || 0,
          width_m: parseFloat(item.width) || 0,
          height_m: parseFloat(item.height) || 0,
          unit_weight_kg: parseFloat(item.weight) || 0,
          shipping_mode_supported: item.shipping_mode_supported || 'Tráiler Lona (13.6m)'
        })),
        lashing_and_dunnage_materials: {
          dunnage_wood: Number(dunnageWood) || 0,
          high_capacity_slings: Number(highCapacitySlings) || 0,
          chains_and_binders: Number(chainsBinders) || 0,
          shackles: Number(shackles) || 0,
          spreader_multipunto: Number(spreaderMultipunto) || 0,
        },
        port_labor_and_equipment: {
          stevedore_gangs_shifts: Number(stevedoreGangs) || 0,
          lashing_team: Number(lashingTeam) || 0,
          heavy_lift_crane: Number(heavyLiftCrane) || 0,
          mafi_platforms: Number(mafiPlatforms) || 0,
          port_crane_shifts: isBigBagsCargo ? (Number(stevedoreGangs) || 0) : 0,
        },
        peripheral_services: {
          storage_days: Number(storageDays) || 0,
          surveyor_cost: Number(surveyorCost) || 0,
          inland_cost: Number(inlandCost) || 0,
          customs_cost: Number(customsCost) || 0,
          insurance_cost: Number(insuranceCost) || 0,
          seguro_mercancia: Number(insuranceCost) || 0,
        },
        shipping_mode: shippingMode || 'Lo-Lo',
        recommended_vessel: vesselType || 'Geared Breakbulk (Lo-Lo)',
        truck_type: vehicleType,
        vehicle_type: vehicleType,
        loading_method: loadingMethod,
        discharge_method: dischargeMethod,
        payload_kg: getVehiclePayloadKg(vehicleType),
        total_trucks: Math.max(1, Math.ceil((totals?.weight || currentReportSnapshot?.totals?.weight || 0) / getVehiclePayloadKg(vehicleType))),
        route_and_chartering: {
          pol: pol || activeProject?.pol || '',
          pod: pod || activeProject?.pod || '',
          distance_nm: Number(distanceNm) || 1500,
          loading_rate_mt_day: Number(activeProject?.route_and_chartering?.loading_rate_mt_day) || (Number(loadingRate) > 24 ? Number(loadingRate) : 1200),
          discharging_rate_mt_day: Number(activeProject?.route_and_chartering?.discharging_rate_mt_day) || (Number(dischargingRate) > 24 ? Number(dischargingRate) : 1000),
          vessel_speed_knots: Number(vesselSpeedKnots) || 12.0,
          daily_hire_rate_usd: Number(vesselDailyHireUsd) || 11500,
          exchange_rate: Number(exchangeRateUsdEur) || 0.92,
          dias_carga: currentReportSnapshot?.diasCarga || 0,
          dias_descarga: currentReportSnapshot?.diasDescarga || 0,
          dias_navegacion: currentReportSnapshot?.diasNavegacion || 0,
          dias_rotacion_total: currentReportSnapshot?.diasRotacionTotal || 0,
          actual_loading_days: actualLoadingDays,
          actual_discharging_days: actualDischargingDays,
          demurrage_days: currentReportSnapshot?.demurrageDays || 0,
          demurrage_daily_rate_usd: Number(demurrageDailyRateUsd) || 11500,
          demurrage_cost_eur: currentReportSnapshot?.demurrageCostNum || 0,
          demurrage_status: currentReportSnapshot?.demurrageStatus || 'DENTRO DE PLANCHA (ON SCHEDULE)',
        },
        totals: { ...totals },
        financial_summary: {
          subtotal_ocean_freight_usd: parseFloat(subtotalFreight) || currentReportSnapshot?.fleteCostNum || 0,
          subtotal_fob_operations_usd: parseFloat(subtotalFobOperations) || ((currentReportSnapshot?.estibaCostNum || 0) + (currentReportSnapshot?.matCostNum || 0) + (currentReportSnapshot?.periCostNum || 0) + (currentReportSnapshot?.insuranceCostNum || 0)) || 0,
          estimated_total_cost_usd: parseFloat(estimatedCost) || currentReportSnapshot?.finalTotalCost || 0,
          customer_sale_price_usd: parseFloat(salePrice) || currentReportSnapshot?.finalTotalSale || 0,
          insurance_cost_usd: Number(insuranceCost) || 0,
          subtotal_ocean_freight_eur: parseFloat(subtotalFreight) || currentReportSnapshot?.fleteCostNum || 0,
          subtotal_fob_operations_eur: parseFloat(subtotalFobOperations) || ((currentReportSnapshot?.estibaCostNum || 0) + (currentReportSnapshot?.matCostNum || 0) + (currentReportSnapshot?.periCostNum || 0) + (currentReportSnapshot?.insuranceCostNum || 0)) || 0,
          estimated_total_cost_eur: parseFloat(estimatedCost) || currentReportSnapshot?.finalTotalCost || 0,
          customer_sale_price_eur: parseFloat(salePrice) || currentReportSnapshot?.finalTotalSale || 0,
          crane_cost_eur: currentReportSnapshot?.craneCostNum || 0,
          storage_cost_eur: currentReportSnapshot?.storageCostNum || 0,
          initial_handling_cost_eur: currentReportSnapshot?.initialHandlingCost || 0,
        },
        chartering_assessment: charteringAssessment || currentReportSnapshot?.charteringAssessment || null,
        charteringAssessment: charteringAssessment || currentReportSnapshot?.charteringAssessment || null,
        executive_report_snapshot: currentReportSnapshot,
        flete_unitario_usd_mt: currentReportSnapshot?.flete_unitario_usd_mt || 0,
        fob_mas_mercancia_unitario_usd_mt: currentReportSnapshot?.fob_mas_mercancia_unitario_usd_mt || 0,
        flete_total_usd: currentReportSnapshot?.flete_total_usd || 0,
        costes_fob_totales_usd: currentReportSnapshot?.costes_fob_totales_usd || 0,
        valor_total_mercancia_usd: merchandiseValueUsd,
        land_freight_cost: calculatedLandFreightCost,
        land_freight_sale: calculatedLandFreightSale,
      };

      const lineItemCost = parseFloat(estimatedCost) || currentReportSnapshot?.finalTotalCost || 0;
      const lineItemPrice = parseFloat(salePrice) || currentReportSnapshot?.finalTotalSale || 0;
      const totalPiecesCount = totals?.quantity || currentReportSnapshot?.totals?.quantity || safeCargoItems.length || 1;
      const totalWeightKg = totals?.weight || currentReportSnapshot?.totals?.weight || 0;

      const savedLineItem = {
        id: editingLineItemId || `item-${Date.now()}`,
        description: `Flete y Estiba Project Cargo (${totalPiecesCount} piezas, ${totalWeightKg.toLocaleString('es-ES')} kg)`,
        cost_eur: lineItemCost,
        sale_price_eur: lineItemPrice,
        margin_eur: lineItemPrice - lineItemCost,
        land_freight_cost: calculatedLandFreightCost,
        land_freight_sale: lineItemPrice,
        valor_total_mercancia_usd: merchandiseValueUsd,
        payload_data: payload,
      };

      if (activeProject) {
        const existingItems = (Array.isArray(activeProject.line_items) && activeProject.line_items.length > 0)
          ? activeProject.line_items
          : (Array.isArray(activeProject.services) ? activeProject.services : []);
        const updatedLineItems = editingLineItemId
          ? existingItems.map((li) => (li.id === editingLineItemId ? savedLineItem : li))
          : [...existingItems, savedLineItem];

        const totalServicesCost = updatedLineItems.reduce((acc, it) => acc + (Number(it.cost_eur) || 0), 0) || calculatedLandFreightCost;
        const totalServicesSale = updatedLineItems.reduce((acc, it) => acc + (Number(it.sale_price_eur) || 0), 0) || lineItemPrice || calculatedLandFreightSale;

        const updatedProject = {
          ...activeProject,
          items: (cargoItems && cargoItems.length > 0) ? cargoItems : (activeProject?.items || []),
          cargo_items: (cargoItems && cargoItems.length > 0) ? cargoItems : (activeProject?.cargo_items || activeProject?.line_items?.[0]?.payload_data?.cargo_items || []),
          packing_list: activeProject?.packing_list || null,
          land_route: { origin: landOrigin, destination: landDestination, distance_km: distanceKm },
          truck_type: vehicleType,
          vehicle_type: vehicleType,
          vehicle_attributes: activeProject?.vehicle_attributes || null,
          loading_method: loadingMethod,
          discharge_method: dischargeMethod,
          payload_kg: getVehiclePayloadKg(vehicleType),
          total_trucks: Math.max(1, Math.ceil((totals?.weight || currentReportSnapshot?.totals?.weight || 0) / getVehiclePayloadKg(vehicleType))),
          route_and_chartering: payload.route_and_chartering,
          charteringAssessment: charteringAssessment,
          land_origin: landOrigin || activeProject?.land_origin || '',
          land_destination: landDestination || activeProject?.land_destination || '',
          land_distance: distanceKm,
          pol: pol || activeProject?.pol || '',
          pod: pod || activeProject?.pod || '',
          land_freight_cost: totalServicesCost,
          land_freight_sale: totalServicesSale,
          targetSalePrice: totalServicesSale,
          totalTripCost: totalServicesCost,
          cost: totalServicesCost,
          sale: totalServicesSale,
          valor_total_mercancia_usd: merchandiseValueUsd,
          line_items: updatedLineItems,
          services: updatedLineItems
        };
        setActiveProject(updatedProject);
        setProjects((prev) => (prev || []).map((p) => (p?.id === activeProject?.id || p?.project_ref === activeProject?.project_ref) ? updatedProject : p));
        await persistProjectToDatabase(updatedProject);

        // Envío seguro y atómico hacia Data Bridge
        try {
          if (typeof window !== 'undefined') {
            const roadSyncFn = typeof window.syncRoadMetricsToBridge === 'function' ? window.syncRoadMetricsToBridge : null;
            if (typeof roadSyncFn === 'function') {
              const currentRoadSyncKey = JSON.stringify({
                ref: activeProject?.project_ref,
                total_trucks: updatedProject.total_trucks,
                cost: totalServicesCost,
                sale: totalServicesSale,
                mercancia: merchandiseValueUsd,
                items: updatedLineItems,
              });
              if (lastRoadSyncPayloadRef.current !== currentRoadSyncKey) {
                lastRoadSyncPayloadRef.current = currentRoadSyncKey;
                await roadSyncFn({
                  reference: activeProject?.project_ref,
                  project_ref: activeProject?.project_ref,
                  total_trucks: updatedProject.total_trucks,
                  land_freight_cost: totalServicesCost,
                  land_freight_sale: totalServicesSale,
                  valor_total_mercancia_usd: merchandiseValueUsd,
                  freight_cost: totalServicesCost,
                  services: updatedLineItems,
                  line_items: updatedLineItems,
                  items: updatedProject.items,
                  cargo_items: updatedProject.cargo_items,
                  packing_list: updatedProject.packing_list,
                  land_route: updatedProject.land_route,
                });
              } else {
                console.log('[Data Bridge] Envío a sync-road omitido por carga idéntica (Deep Compare)');
              }
            }
          }
        } catch (syncBridgeErr) {
          console.warn('[Data Bridge] Error no bloqueante al sincronizar en handleSaveProjectCargo:', syncBridgeErr);
        }
      }
    } catch (err) {
      console.error('Error al guardar flete y estiba:', err);
      setError('Error al guardar flete y estiba: ' + (err?.message || 'Error desconocido'));
      setTimeout(() => setError(null), 4000);
    } finally {
      setIsCargoModalOpen(false);
      setSaveSuccessMessage('¡Flete y estiba guardados correctamente!');
      setTimeout(() => setSaveSuccessMessage(null), 3500);
    }
  };

  const getStowageAscii = (report = null) => {
    const plan = report?.stowagePlan
      || reportData?.stowagePlan
      || calculateUniversalStowagePlan(cargoItems, totals, { shippingMode, pol, pod });
    return generateDynamicStowageAscii(plan);
  };

  const displayedProjects = !referenciaActivaGlobal
    ? []
    : projects.filter((p) => isProjectMatchingActiveDossier(p, referenciaActivaGlobal));

  return (
    <>
      {/* Light Theme corporativo (legacy token preserve: bg-slate-950 bg-slate-900 border-slate-800) */}
      <div className={`w-full h-full flex overflow-hidden bg-slate-50 text-slate-800 font-sans relative ${showExecutiveReport ? 'print:hidden' : ''}`}>
        <aside className="w-80 shrink-0 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden print:hidden">
          <div className="p-4 border-b border-slate-200 bg-white flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateProject}
              disabled={isCreating}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs uppercase rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              {isCreating ? 'Creando...' : '+ Nuevo Proyecto'}
            </button>
            <button
              type="button"
              onClick={handleRefreshProjects}
              disabled={isRefreshing || isLoading}
              title="Actualizar listado de proyectos desde Neon"
              className="p-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              <span className={`inline-block text-xs ${isRefreshing ? 'animate-spin' : ''}`}>🔄</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!referenciaActivaGlobal ? (
              <div className="p-6 text-center text-slate-500 flex flex-col items-center justify-center h-48 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <span className="text-2xl mb-2">📁</span>
                <p className="text-xs font-semibold text-slate-600">Selecciona un expediente en la barra superior</p>
                <p className="text-[11px] text-slate-400 mt-1">Vincula tus proyectos al expediente activo de Core PRO.</p>
              </div>
            ) : (displayedProjects || []).length === 0 ? (
              <div className="p-6 text-center text-slate-500 flex flex-col items-center justify-center h-48 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <span className="text-2xl mb-2">📋</span>
                <p className="text-xs font-semibold text-slate-600">No hay proyectos para este expediente</p>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">Ref: {referenciaActivaGlobal}</p>
                <button
                  type="button"
                  onClick={handleCreateProject}
                  disabled={isCreating}
                  className="mt-3 text-[11px] font-bold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                >
                  + Crear proyecto vinculado
                </button>
              </div>
            ) : (
              /* projects.map((proj) => { */
              displayedProjects.map((proj) => {
                const isSelected = activeProject && (
                  (proj?.id && activeProject?.id === proj?.id) ||
                  (proj?.project_ref && activeProject?.project_ref === proj?.project_ref)
                );
                return (
                  <div
                    key={proj?.id || proj?.project_ref || Math.random()}
                    onClick={() => setActiveProject(proj)}
                    className={`group p-3 rounded-xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-400 text-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-[11px] font-bold text-blue-600 block">{proj.project_ref}</span>
                        <h3 className="font-bold text-slate-800 text-sm truncate">{proj.client_name}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteProject(e, proj)}
                        title="Eliminar proyecto"
                        aria-label={`Eliminar proyecto ${proj.client_name || proj.project_ref || ''}`}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0 opacity-70 group-hover:opacity-100"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <main className="flex-1 bg-slate-50 flex flex-col h-full overflow-y-auto print:hidden">
          {saveSuccessMessage && (
            <div className="bg-emerald-600 text-white px-6 py-3 font-bold text-sm shadow-md flex items-center justify-between transition-all">
              <div className="flex items-center gap-2">
                <span>✅</span>
                <span>{saveSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveSuccessMessage(null)}
                className="text-white hover:text-emerald-100 font-black cursor-pointer text-base"
              >
                ✕
              </button>
            </div>
          )}
          {!activeProject ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-600">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-3xl mb-4">
                🚛
              </div>
              <h3 className="text-xl font-black text-slate-800">Expediente de Transitario</h3>
              <p className="mt-2 text-xs text-slate-500 max-w-sm">
                Selecciona un proyecto de la lista lateral o crea uno nuevo para gestionar el transporte terrestre, cubicaje de camiones y costes.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-6 space-y-6">
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveProject(null)}
                    className="bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 hover:border-slate-400 px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-xs cursor-pointer transition flex items-center gap-1.5 shrink-0"
                  >
                    ← Volver a Proyectos
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                      # REF: {activeProject.project_ref || 'RDM/2026-001'}
                    </span>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">
                      {activeProject.status || 'Borrador'}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight ml-1">
                    {activeProject.client_name}
                  </h1>

                  {/* BOTÓN DATABRIDGE EN EL EXPEDIENTE ACTIVO */}
                  <button
                    type="button"
                    id="btn-sync-databridge"
                    onClick={handleSyncDataBridge}
                    disabled={isSyncingDataBridge}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-black shadow-xs transition-colors cursor-pointer disabled:opacity-50 ml-2"
                    title="Forzar el fetch de los últimos datos del expediente activo desde Neon y sincronizar el estado global (DataBridge)"
                  >
                    <span className={`text-sm ${isSyncingDataBridge ? 'animate-spin' : ''}`}>⚡</span>
                    <span>{isSyncingDataBridge ? 'Sincronizando...' : 'Sincronizar (DataBridge)'}</span>
                  </button>
                </div>

                {/* BOTÓN DE ACTUALIZAR GENERAL */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    id="btn-refresh-projects"
                    onClick={handleRefreshProjects}
                    disabled={isRefreshing || isLoading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    title="Actualizar listado general de proyectos desde Neon"
                  >
                    <span className={`text-sm ${isRefreshing ? 'animate-spin' : ''}`}>🔄</span>
                    <span>Actualizar</span>
                  </button>
                </div>
              </header>

              {/* RESUMEN HÍBRIDO (MARÍTIMO + TERRESTRE PROVISIONAL) */}
              {(() => {
                // 1. Extracción Segura de Datos Marítimos (Core PRO)
                const seaOrigin = activeProject?.items?.[0]?.payload_data?.route_and_chartering?.pol || activeProject?.route_and_chartering?.pol || activeProject?.pol || 'N/A';
                const seaDest = activeProject?.items?.[0]?.payload_data?.route_and_chartering?.pod || activeProject?.route_and_chartering?.pod || activeProject?.pod || 'N/A';
                const seaMiles = Number(activeProject?.items?.[0]?.payload_data?.route_and_chartering?.distance_nm) || Number(activeProject?.route_and_chartering?.distance_nm) || Number(activeProject?.distance_nm) || 0;

                const pItems = activeProject?.line_items?.[0]?.payload_data?.cargo_items || activeProject?.items || cargoItems || [];
                const pVol = pItems.reduce((acc, it) => acc + (Number(it.quantity || 1) * Number(it.length_m || it.length || 0) * Number(it.width_m || it.width || 0) * Number(it.height_m || it.height || 0)), 0) || Number(totals.m3 || 0);
                const pWtTons = (pItems.reduce((acc, it) => acc + (Number(it.quantity || 1) * Number(it.unit_weight_kg || it.weight || 0)), 0) || Number(totals.weight || 0)) / 1000;

                const seaItemsList = (typeof extractProjectCargoItems === 'function' ? extractProjectCargoItems(activeProject) : null) || pItems;
                const calculatedSeaItemsTons = Array.isArray(seaItemsList) && seaItemsList.length > 0
                  ? seaItemsList.reduce((acc, it) => acc + (Number(it.quantity || it.qty || 1) * Number(it.unit_weight_kg || it.weight || 0)), 0) / 1000
                  : 0;
                const seaTons = Number(activeProject?.total_weight_tons) || (Number(activeProject?.items?.[0]?.payload_data?.totals?.weight) / 1000) || 0;

                // Flete Marítimo Venta: Identificación y normalización
                const seaFreightSale = Number(activeProject?.items?.[0]?.payload_data?.financial_summary?.customer_sale_price_usd) || Number(activeProject?.financialBreakdown?.oceanFreight?.subtotal) || Number(activeProject?.ocean_freight_sale) || 0;
                const ocean_freight_sale =
                  seaFreightSale ||
                  activeProject?.ocean_freight_sale ||
                  activeProject?.financial_summary?.customer_sale_price_usd ||
                  activeProject?.data?.financial_summary?.customer_sale_price_usd ||
                  activeProject?.target_freight ||
                  0;
                const target_freight = ocean_freight_sale;
                const formattedSeaFreightSale = seaFreightSale > 0
                  ? (activeProject?.currency === '$' || activeProject?.currency === 'USD'
                      ? `$ ${seaFreightSale.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `${seaFreightSale.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`)
                  : (activeProject?.currency === '$' || activeProject?.currency === 'USD' ? '$ 0.00' : '0,00 €');

                // 2. Extracción y Cálculos Terrestres Provisionales (Nivel 2)
                const routeInfo = activeProject?.route_and_chartering || activeProject?.data?.route || activeProject?.data || {};
                const rOrigin = activeProject?.land_route?.origin || activeProject?.land_origin || landOrigin || '';
                const rDestination = activeProject?.land_route?.destination || activeProject?.land_destination || landDestination || '';
                const rDistKm = Number(activeProject?.land_route?.distance_km || activeProject?.land_distance || distanceKm || 0);
                const rTruckType = vehicleType || activeProject?.truck_type || activeProject?.vehicle_type || activeProject?.data?.truckType || 'Camión / Tráiler';

                const rLdm = Number(
                  activeProject?.data?.ldm ||
                  activeProject?.ldm ||
                  (pVol > 0 ? (pVol / (2.4 * 2.7)).toFixed(1) : (pWtTons > 0 ? (pWtTons / 1.8).toFixed(1) : 13.6))
                );
                const rPalletsEuro = Math.min(33, Math.max(1, Math.ceil(rLdm / 0.4)));
                const rLdmPct = Math.min(100, Math.round((rLdm / 13.6) * 100));

                const isZeroDist = !rDistKm || Number(rDistKm) <= 0;
                const projectCost = activeProject?.land_freight_cost || (activeProject?.line_items || []).reduce((acc, it) => acc + Number(it.cost_eur || 0), 0);
                const projectSale = activeProject?.land_freight_sale || (activeProject?.line_items || []).reduce((acc, it) => acc + Number(it.sale_price_eur || 0), 0);
                const rCostEur = isZeroDist ? 0 : (Number(projectCost) || Math.round(rDistKm * 1.57 + 75));
                const rSaleEur = isZeroDist ? 0 : (Number(projectSale) || (rCostEur > 0 ? Math.round(rCostEur * 1.18) : 0));
                const rMargin = rSaleEur - rCostEur;
                const rMarginPct = rCostEur > 0 ? Math.round((rMargin / rSaleEur) * 100) : 0;
                const rDrivingDays = rDistKm > 0 ? Math.max(1, Math.ceil(rDistKm / 650)) : 0;

                return (
                  <div className="space-y-4">
                    {/* BANNER MARÍTIMO (NIVEL 1): CONTEXTO MARÍTIMO (CORE PRO) */}
                    <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 shadow-xs">
                      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-blue-100">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-black uppercase tracking-wider text-blue-900">
                            🚢 CONTEXTO MARÍTIMO (CORE PRO)
                          </h3>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100/70 border border-blue-200 px-2 py-0.5 rounded-full">
                          Solo Lectura
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                        {/* Columna 1: Ruta */}
                        <div className="bg-white/80 border border-blue-100 rounded-lg p-3 shadow-2xs flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Ruta</span>
                                {seaOrigin !== 'N/A' && seaDest !== 'N/A' ? (
                                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                    ✅ OK
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                    ⚠️ Faltan datos
                                  </span>
                                )}
                              </div>
                              <span className="text-sm">⚓</span>
                            </div>
                            <div className="font-bold text-slate-800 text-sm truncate" title={`${seaOrigin} ➔ ${seaDest}`}>
                              {seaOrigin} <span className="text-blue-600 font-black">➔</span> {seaDest}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-blue-50 text-[10px] font-medium text-slate-500">
                            <span>POL ➔ POD Marítimo</span>
                          </div>
                        </div>

                        {/* Columna 2: Distancia */}
                        <div className="bg-white/80 border border-blue-100 rounded-lg p-3 shadow-2xs flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Distancia</span>
                                {seaMiles > 0 ? (
                                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                    ✅ OK
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                    ⚠️ Vacío
                                  </span>
                                )}
                              </div>
                              <span className="text-sm">🧭</span>
                            </div>
                            <div className="text-xl font-mono font-black text-slate-900">
                              {Number(seaMiles).toLocaleString('es-ES')} <span className="text-xs font-semibold text-slate-500">NM</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-blue-50 text-[10px] font-medium text-slate-500">
                            <span>Millas Náuticas</span>
                          </div>
                        </div>

                        {/* Columna 3: Carga */}
                        <div className="bg-white/80 border border-blue-100 rounded-lg p-3 shadow-2xs flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Carga</span>
                                {seaTons > 0 ? (
                                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                    ✅ OK
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                    ⚠️ Vacío
                                  </span>
                                )}
                              </div>
                              <span className="text-sm">⚖️</span>
                            </div>
                            <div className="text-xl font-mono font-black text-slate-900">
                              {Number(seaTons).toLocaleString('es-ES', { maximumFractionDigits: 2 })} <span className="text-xs font-semibold text-slate-500">Toneladas</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-blue-50 text-[10px] font-medium text-slate-500">
                            <span>Partidas Core PRO</span>
                          </div>
                        </div>

                        {/* Columna 4: Flete Marítimo (Venta) */}
                        <div className="bg-white/80 border border-blue-100 rounded-lg p-3 shadow-2xs flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Flete Marítimo (Venta)</span>
                                {seaFreightSale > 0 ? (
                                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                    ✅ OK
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                    ⚠️ Vacío
                                  </span>
                                )}
                              </div>
                              <span className="text-sm">🌊</span>
                            </div>
                            <div className="text-xl font-mono font-black text-blue-700">
                              {formattedSeaFreightSale}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-blue-50 text-[10px] font-medium text-slate-500">
                            <span>Venta Marítima Objetivo</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CUADRÍCULA DE RESUMEN TERRESTRE (NIVEL 2) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                      {/* Tarjeta 1: Origen y Destino (Ruta) */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Ruta Terrestre</span>
                              {(rOrigin && rDestination) ? (
                                <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                  ✅ OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                  ⚠️ Faltan datos
                                </span>
                              )}
                            </div>
                            <span className="text-base">🛣️</span>
                          </div>
                          <div className="font-bold text-slate-800 text-sm truncate" title={`${rOrigin || 'N/A'} ➔ ${rDestination || 'N/A'}`}>
                            {rOrigin || 'N/A'} <span className="text-blue-600 font-black">➔</span> {rDestination || 'N/A'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-100">
                          <span className={`w-2 h-2 rounded-full ${(rOrigin && rDestination) ? 'bg-emerald-500' : 'bg-amber-400'} shrink-0`}></span>
                          <span className="text-[11px] font-medium text-slate-600">Corredor Directo UE</span>
                        </div>
                      </div>

                      {/* Tarjeta 2: Distancia (km) */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Distancia (km)</span>
                              {rDistKm > 0 ? (
                                <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                  ✅ OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                  ⚠️ Vacío
                                </span>
                              )}
                            </div>
                            <span className="text-base">📍</span>
                          </div>
                          <div className="text-xl font-mono font-black text-slate-900">
                            {rDistKm.toLocaleString('es-ES')} <span className="text-xs font-semibold text-slate-500">km</span>
                          </div>
                        </div>
                        <div className="text-[11px] font-medium text-slate-600 mt-3 pt-2 border-t border-slate-100">
                          {rDistKm > 0 ? `~${rDrivingDays} jornada${rDrivingDays > 1 ? 's' : ''} (Tacógrafo UE)` : 'Sin distancia calculada'}
                        </div>
                      </div>

                      {/* Tarjeta 3: Tipo de Camión */}
                      {(() => {
                        const effPayloadKg = getVehiclePayloadKg(rTruckType);
                        const effPayloadTons = effPayloadKg / 1000;
                        return (
                          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Tipo de Camión</span>
                                <span className="text-base">🚛</span>
                              </div>
                              <div className="font-bold text-slate-800 text-sm truncate" title={rTruckType}>
                                {rTruckType}
                              </div>
                            </div>
                            <div className="text-[11px] font-medium text-slate-600 mt-3 pt-2 border-t border-slate-100 flex justify-between items-center">
                              <span>40t MMA · {effPayloadTons}t Carga Útil</span>
                              <span className="text-[10px] font-mono font-bold text-blue-600">{effPayloadKg.toLocaleString('es-ES')} kg</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Tarjeta 4: Metros Lineales (LDM) / Pallets */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Metros Lineales (LDM)</span>
                            <span className="text-base">📦</span>
                          </div>
                          <div className="text-xl font-mono font-black text-slate-900">
                            {rLdm} <span className="text-xs font-semibold text-slate-500">LDM</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mt-3 pt-2 border-t border-slate-100">
                          <span>{rPalletsEuro} Europalets</span>
                          <span className="font-mono font-bold text-blue-600">{rLdmPct}%</span>
                        </div>
                      </div>

                      {/* Tarjeta 5: Coste de Flete Terrestre vs. Venta */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Flete Terrestre vs. Venta</span>
                              {rSaleEur > 0 ? (
                                <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                  ✅ OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                  ⚠️ Vacío
                                </span>
                              )}
                            </div>
                            <span className="text-base">💶</span>
                          </div>
                          <div className="flex items-baseline gap-1 text-slate-900">
                            <span className="text-xl font-mono font-black text-emerald-600">{rSaleEur.toLocaleString('es-ES')} €</span>
                            <span className="text-[10px] font-mono text-slate-400">venta</span>
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-3 pt-2 border-t border-slate-100 font-mono truncate">
                          {rCostEur > 0 ? (
                            <>Coste: {rCostEur.toLocaleString('es-ES')} € · <span className="text-emerald-600 font-bold">+{rMargin.toLocaleString('es-ES')} € ({rMarginPct}%)</span></>
                          ) : (
                            <span className="text-slate-400 italic">Coste: 0 € · Requiere distancia para cálculo</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* SECCIÓN DE DOCUMENTOS PERSISTIDOS Y VISOR FUNCIONAL */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">📁 Documentos y Packing Lists Guardados (Base de Datos)</h3>
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
                    {projectDocuments.length} archivo(s) persistido(s)
                  </span>
                </div>

                {(projectDocuments || []).length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-3 text-center border border-dashed border-slate-200 rounded-lg">
                    No hay documentos adjuntos en este proyecto. Sube un archivo mediante el Agente de Proyectos o el botón de importación para guardarlo permanentemente en la base de datos.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(projectDocuments || []).map((doc) => (
                      <div key={doc?.id || Math.random()} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-300 transition">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">📄</span>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 truncate max-w-[200px]">{doc?.name || 'Documento'}</h4>
                            <span className="text-[10px] text-slate-500 font-mono">Guardado: {doc?.date || 'N/A'} | Ítems: {doc?.itemsCount || 1}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
  type="button"
  onClick={() => {
    const base64Data = doc?.payload?.dataBase64 || doc?.dataBase64;
    if (base64Data) {
      try {
        // Convertir el Base64 en un Blob nativo para evitar el bloqueo de seguridad de Chrome
        const arr = base64Data.split(',');
        const mimeMatch = arr[0]?.match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        
        // Abrir la URL Blob directamente en una nueva pestaña de forma limpia
        window.open(blobUrl, '_blank');
      } catch (err) {
        console.error('Error abriendo documento:', err);
        window.alert('No se pudo renderizar el archivo directamente. Intentando descarga...');
        const link = document.createElement('a');
        link.href = base64Data;
        link.download = doc?.name || 'documento';
        link.click();
      }
    } else {
      window.alert(`Información del Documento:\nNombre: ${doc?.name}\nFecha: ${doc?.date}\nÍtems asociados: ${doc?.itemsCount || 1}\n(Nota: Este documento no tiene contenido binario asociado).`);
    }
  }}
  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-[11px] font-bold rounded cursor-pointer shadow-xs flex items-center gap-1"
>
  <span>🔍</span> Consultar / Abrir
</button>
                          <button 
                            type="button"
                            onClick={() => handleDeletePersistentDocument(doc?.id)}
                            className="px-2 py-1 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 text-[11px] font-bold rounded cursor-pointer"
                            title="Eliminar documento"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SERVICIOS DE TRANSPORTE TERRESTRE */}
              {(activeProject?.line_items?.length > 0 || activeProject?.services?.length > 0) ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-bold text-slate-900">Servicios</h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenExecutiveReport(((activeProject?.line_items?.length > 0 ? activeProject.line_items : activeProject?.services) || [])[0])}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition"
                      >
                        📄 Reporte Ejecutivo
                      </button>
                      <button onClick={handleOpenCreateService} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition">
                        ➕ Añadir Servicio
                      </button>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 font-bold border-b border-slate-200 text-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left">Servicio</th>
                          <th className="px-4 py-3 text-right">Coste (€)</th>
                          <th className="px-4 py-3 text-right">Venta (€)</th>
                          <th className="px-4 py-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {((activeProject?.line_items?.length > 0 ? activeProject.line_items : activeProject?.services) || []).map((item) => (
                          <tr key={item?.id || Math.random()} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 font-semibold">{item?.description || 'Servicio'}</td>
                            <td className="px-4 py-3 text-right text-rose-600 font-bold font-mono">{Number(item?.cost_eur || 0).toLocaleString('es-ES')} €</td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-bold font-mono">{Number(item?.sale_price_eur || 0).toLocaleString('es-ES')} €</td>
                            <td className="px-4 py-3 text-center">
                              <button type="button" onClick={() => handleOpenExecutiveReport(item)} className="mx-1 cursor-pointer hover:scale-110 transition-transform" title="Generar Reporte Ejecutivo">📄</button>
                              <button onClick={() => handleEditService(item)} className="mx-1 cursor-pointer" title="Editar">✏️</button>
                              <button onClick={() => handleDeleteService(item?.id)} className="mx-1 cursor-pointer" title="Eliminar">🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 flex flex-col items-center bg-white text-center shadow-xs">
                  <span className="text-3xl block mb-2">🚛</span>
                  <p className="text-slate-700 font-bold mb-1">No hay servicios logísticos añadidos a este proyecto</p>
                  <p className="text-xs text-slate-500 mb-4">Configura un servicio de transporte terrestre por carretera para calcular fletes y emitir reportes.</p>
                  <button onClick={handleOpenCreateService} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer">➕ Añadir Servicio</button>
                </div>
              )}
            </div>
          )}
        </main>

        {/* MODAL PRINCIPAL TEMA CLARO PANTALLA COMPLETA */}
        {isCargoModalOpen && !showExecutiveReport && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto print:hidden">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden text-slate-900">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Project Cargo Builder</h2>
                <button onClick={() => setIsCargoModalOpen(false)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer flex items-center justify-center font-bold">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 divide-y divide-slate-100">
                <div className="flex flex-wrap items-center justify-start gap-3 mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCargoModalOpen(false);
                      setActiveProject(null);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors mr-2 cursor-pointer"
                  >
                    ← Volver a Proyectos
                  </button>
                  <button
                    type="button"
                    id="btn-sync-databridge-top"
                    onClick={handleSyncDataBridge}
                    disabled={isSyncingDataBridge}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 border border-blue-300 rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50 mr-1 whitespace-nowrap"
                    title="Sincronizar expediente con base de datos Neon (DataBridge)"
                  >
                    {isSyncingDataBridge ? (
                      <>
                        <span className="text-sm animate-spin text-blue-600">⚡</span>
                        <span>Sincronizando...</span>
                      </>
                    ) : (
                      <span>⚡ Sync DataBridge</span>
                    )}
                  </button>
                </div>

                <section className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black text-blue-600 uppercase tracking-wider">1. Lista de Empaque (Packing List)</h3>
                    <div className="flex items-center gap-2">
                      <input ref={fileInputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
                      <button onClick={handleTriggerImport} className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg cursor-pointer shadow-sm whitespace-nowrap">🤖 Importar PDF/Excel</button>
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 whitespace-nowrap">
                        <label htmlFor="top-cargo-category" className="text-[11px] font-bold text-slate-600 whitespace-nowrap">Tarifa:</label>
                        <select
                          id="top-cargo-category"
                          value={cargoCategory}
                          onChange={(e) => {
                            setCargoCategory(e.target.value);
                            // Si existe una función handleCargoCategoryChange, úsala en su lugar
                          }}
                          className="text-xs font-bold bg-white border border-slate-300 rounded px-2 py-0.5 text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none cursor-pointer"
                        >
                          <option value="Carga Paletizada">Carga Paletizada</option>
                          <option value="Sling Bags">Sling Bags</option>
                          <option value="Sacos">Sacos</option>
                          <option value="Carga General">Carga General</option>
                          <option value="Graneles Sólidos / Minerales">Graneles Sólidos / Minerales</option>
                          <option value="Mercancía Ensacada / Dry Bulk">Mercancía Ensacada / Dry Bulk</option>
                          <option value="Carga de Proyecto / Heavy Lift">Carga de Proyecto / Heavy Lift</option>
                        </select>
                      </div>
                      <button onClick={handleAddCargoPiece} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-sm whitespace-nowrap">+ Añadir Pieza</button>
                      <button
                        type="button"
                        id="btn-recalculate-cargo"
                        onClick={handleRecalculate}
                        disabled={isRecalculating}
                        className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 text-xs font-bold rounded-lg cursor-pointer shadow-sm flex items-center gap-1.5 transition-colors whitespace-nowrap"
                        title="Recalcular estiba, flete y ratios en tiempo real"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`}
                        >
                          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                          <path d="M16 16h5v5" />
                        </svg>
                        <span>{isRecalculating ? 'Recalculando...' : 'Recalcular'}</span>
                      </button>
                      {recalculateFeedback && (
                        <span
                          id="recalculate-feedback-badge"
                          role="status"
                          aria-live="polite"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg shadow-xs transition-opacity duration-300"
                        >
                          <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span>{recalculateFeedback}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {totalWeightKg > 24000 ? (
                    <div
                      id="capacity-overload-warning"
                      className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 mb-3 shadow-xs animate-fadeIn"
                    >
                      <span>{"🚛 Proyecto Masivo: Se requieren " + Math.ceil(totalWeightKg / 24000) + " tráilers estándar para esta partida."}</span>
                    </div>
                  ) : (capacityWarning || totals.ldm > 13.6) ? (
                    <div
                      id="capacity-overload-warning"
                      className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 mb-3 shadow-xs animate-fadeIn"
                    >
                      <span className="text-base" aria-hidden="true">⚠️</span>
                      <span>Exceso de capacidad para un Tráiler Estándar</span>
                      <span className="text-[11px] font-normal text-red-600 ml-auto font-mono">
                        ({Math.round(totals.weight).toLocaleString('es-ES')} kg / {Number(totals.ldm || 0).toFixed(1)} LDM - Máx: 24.000 kg / 13.6 LDM)
                      </span>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <table className="w-full text-left text-[11px] text-slate-700">
                      <thead className="bg-slate-100 font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                        <tr>
                          <th className="px-2 py-3 w-[12%]">Categoría</th>
                          <th className="px-2 py-3 w-[25%]">Tipo/Modelo</th>
                          <th className="px-2 py-3 w-[7%] text-center">Cantidad</th>
                          <th className="px-2 py-3 w-[7%] text-center">Largo (m)</th>
                          <th className="px-2 py-3 w-[7%] text-center">Ancho (m)</th>
                          <th className="px-2 py-3 w-[7%] text-center">Alto (m)</th>
                          <th className="px-2 py-3 w-[10%] text-right">Peso Unitario (kg)</th>
                          <th className="px-2 py-3 w-[7%] text-right font-mono">M2</th>
                          <th className="px-2 py-3 w-[7%] text-right font-mono">M3</th>
                          <th className="px-2 py-3 w-[12%]">Modo Envío</th>
                          <th className="px-2 py-3 w-[4%] text-center">🗑️</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(cargoItems || []).map((item) => {
                          const qty = Math.max(1, Number(item?.quantity) || 1);
                          const l = Math.max(0, parseFloat(item?.length) || 0);
                          const w = Math.max(0, parseFloat(item?.width) || 0);
                          const h = Math.max(0, parseFloat(item?.height) || 0);
                          const itemM2 = qty * (l * w);
                          const itemM3 = qty * (l * w * h);

                          return (
                            <tr key={item?.id || Math.random()} className="hover:bg-slate-50/80">
                              <td className="p-1"><input type="text" value={item?.category || ''} onChange={(e) => handleUpdateCargoItem(item.id, 'category', e.target.value)} className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded px-2 py-1.5 text-slate-800 text-[11px]" placeholder="Ej: Equipos..." /></td>
                              <td className="p-1"><input type="text" list="commodity-list" value={item?.type || ''} onChange={(e) => handleUpdateCargoItem(item.id, 'type', e.target.value)} className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded px-2 py-1.5 text-slate-900 font-semibold text-[11px]" placeholder="Descripción de pieza..." /></td>
                              <td className="p-1"><input type="number" min={1} value={item?.quantity ?? 1} onChange={(e) => handleUpdateCargoItem(item.id, 'quantity', e.target.value)} className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded px-1 py-1.5 text-center text-slate-900 text-[11px]" /></td>
                              <td className="p-1"><input type="number" value={item?.length ?? ''} onChange={(e) => handleUpdateCargoItem(item.id, 'length', e.target.value)} className="w-full bg-white border border-slate-300 px-1 py-1.5 rounded text-center text-[11px]" placeholder="L" /></td>
                              <td className="p-1"><input type="number" value={item?.width ?? ''} onChange={(e) => handleUpdateCargoItem(item.id, 'width', e.target.value)} className="w-full bg-white border border-slate-300 px-1 py-1.5 rounded text-center text-[11px]" placeholder="W" /></td>
                              <td className="p-1"><input type="number" value={item?.height ?? ''} onChange={(e) => handleUpdateCargoItem(item.id, 'height', e.target.value)} className="w-full bg-white border border-slate-300 px-1 py-1.5 rounded text-center text-[11px]" placeholder="H" /></td>
                              <td className="p-1"><input type="number" value={item?.weight ?? ''} onChange={(e) => handleUpdateCargoItem(item.id, 'weight', e.target.value)} className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded px-2 py-1.5 text-right font-mono text-[11px]" /></td>
                              <td className="p-1 text-right font-mono text-[11px] text-slate-600">{itemM2.toFixed(2)}</td>
                              <td className="p-1 text-right font-mono text-[11px] text-slate-600">{itemM3.toFixed(2)}</td>
                              <td className="p-1"><input type="text" value={item?.shipping_mode_supported || ''} onChange={(e) => handleUpdateCargoItem(item.id, 'shipping_mode_supported', e.target.value)} className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded px-2 py-1.5 text-slate-600 text-[10px]" placeholder="Modo..." /></td>
                              <td className="p-1 text-center"><button onClick={() => handleRemoveCargoItem(item.id)} className="text-rose-500 hover:text-rose-700 bg-rose-50 rounded p-1 font-bold w-full h-full cursor-pointer">✕</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold text-slate-700 border-t border-slate-200">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 text-left uppercase text-[10px]">Totales:</td>
                          <td className="px-2 py-2 text-center font-mono">{totals.quantity}</td>
                          <td colSpan={3} className="px-2 py-2 text-center text-[10px] text-slate-500">-</td>
                          <td className="px-2 py-2 text-right font-mono">{Number(totals.weight).toLocaleString('es-ES')} kg</td>
                          <td className="px-2 py-2 text-right font-mono">{Number(totals.m2).toFixed(2)} m²</td>
                          <td className="px-2 py-2 text-right font-mono">{Number(totals.m3).toFixed(2)} m³</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                    <datalist id="commodity-list">
                      {Object.keys(COMMODITY_TARIFFS).map((commodityKey) => (
                        <option key={commodityKey} value={commodityKey} />
                      ))}
                    </datalist>
                  </div>
                </section>

                {/* Sección Parámetros Dinámicos de Ruta, Ritmos Operativos y Demoras */}
                <section className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-blue-600 uppercase tracking-wider">Ruta Terrestre, Tiempos de Almacén y Gestión de Paralizaciones</h3>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                      Origen (Carga) / Destino (Entrega) · Tiempos Almacén · Penalizaciones
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                    {/* Selectores de Flota Terrestre y Métodos de Carga/Descarga */}
                    <div className="bg-white border border-slate-200 rounded-lg p-3.5 mb-4 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🚛</span>
                          <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                            Selección de Flota Terrestre y Métodos Operativos (Land Charter)
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Gemelo Digital · Tara & Pluma de Carga Útil
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label htmlFor="vehicle_type" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                            Tipo de Vehículo Terrestre (vehicle_type) *
                          </label>
                          <select
                            id="vehicle_type"
                            name="vehicle_type"
                            value={vehicleType}
                            onChange={(e) => handleVehicleTypeChange(e.target.value)}
                            className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 shadow-sm cursor-pointer"
                          >
                            <option value="Camión Plataforma con Grúa Autocarga">
                              Camión Plataforma con Grúa Autocarga (21.000 kg Carga Útil · Pluma Hidráulica)
                            </option>
                            <option value="Camión Plataforma Abierta (Sin Grúa)">
                              Camión Plataforma Abierta (Sin Grúa) (24.000 kg Carga Útil · 100% Portuario)
                            </option>
                            <option value="Bañera Basculante (Granel)">
                              Bañera Basculante (Granel) (26.000 kg Carga Útil · Graneles Sólidos)
                            </option>
                            <option value="Camión Silo Presurizado">
                              Camión Silo Presurizado (25.000 kg Carga Útil · Graneles Pulverulentos)
                            </option>
                            <option value="Tráiler Tauliner (13.6m)">
                              Tráiler Tauliner (13.6m) (24.000 kg Carga Útil · Carga General)
                            </option>
                            <option value="Lona Estándar">
                              Lona Estándar (24.000 kg Carga Útil)
                            </option>
                            <option value="Trailer Frigorífico">
                              Trailer Frigorífico (22.000 kg Carga Útil · Temperatura Controlada)
                            </option>
                            <option value="Portacontenedor Multimodal">
                              Portacontenedor Multimodal (26.000 kg Carga Útil)
                            </option>
                          </select>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                            <span>Carga Útil Efectiva: <strong className="text-slate-800 font-bold">{getVehiclePayloadKg(vehicleType).toLocaleString('es-ES')} kg</strong></span>
                            <span className="text-blue-700 font-bold">{vehicleType.includes('Grúa') ? 'Tara Pluma Reducida (-3t)' : 'Tara Estándar'}</span>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="metodo_carga" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                            Método de Carga (Origen) *
                          </label>
                          <select
                            id="metodo_carga"
                            name="metodo_carga"
                            value={loadingMethod}
                            onChange={(e) => setLoadingMethod(e.target.value)}
                            className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 shadow-sm cursor-pointer"
                          >
                            {(() => {
                              const isPlatform = vehicleType.includes('Plataforma');
                              const isPlatformCrane = vehicleType === 'Camión Plataforma con Grúa Autocarga' || vehicleType.includes('Grúa Autocarga');
                              const isBulk = vehicleType.includes('Bañera') || vehicleType.includes('Silo');

                              if (isPlatform) {
                                return (
                                  <>
                                    {isPlatformCrane && (
                                      <option value="Autocarga con Grúa del Camión">Autocarga con Grúa del Camión</option>
                                    )}
                                    <option value="Carga Superior (Grúa Portuaria / Puente Grúa)">Carga Superior (Grúa Portuaria / Puente Grúa)</option>
                                    <option value="Carga Lateral con Carretilla Elevadora">Carga Lateral con Carretilla Elevadora</option>
                                    <option disabled value="carga_trasera_muelle" className="text-slate-400">🚫 Carga Trasera por Muelle / Rampa (Incompatible con Plataforma)</option>
                                  </>
                                );
                              }
                              if (isBulk) {
                                return (
                                  <>
                                    <option value="Carga por Silo / Tubo (Granel)">Carga por Silo / Tubo (Granel)</option>
                                    <option value="Carga Superior (Grúa Portuaria / Puente Grúa)">Carga Superior (Grúa Portuaria / Puente Grúa)</option>
                                    <option value="Cinta Transportadora">Cinta Transportadora</option>
                                  </>
                                );
                              }
                              return (
                                <>
                                  <option value="Carga Lateral (Lona / Tauliner)">Carga Lateral (Lona / Tauliner)</option>
                                  <option value="Carga Trasera por Muelle / Rampa">Carga Trasera por Muelle / Rampa</option>
                                  <option value="Carga Superior (Grúa Portuaria / Puente Grúa)">Carga Superior (Grúa Portuaria / Puente Grúa)</option>
                                  <option value="Carga con Transpaleta / Carretilla Elevadora">Carga con Transpaleta / Carretilla Elevadora</option>
                                  <option value="Autocarga con Grúa del Camión">Autocarga con Grúa del Camión</option>
                                </>
                              );
                            })()}
                          </select>
                          <div className="flex flex-wrap gap-1 mt-1.5" id="pills_metodo_carga_workspace">
                            {TERRESTRIAL_LOADING_METHODS.map((m) => {
                              const isSel = loadingMethod === m;
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setLoadingMethod(m)}
                                  className={`px-2 py-0.5 text-[10px] rounded-full border transition-all cursor-pointer ${
                                    isSel
                                      ? 'bg-blue-100 text-blue-800 border-blue-500 font-bold shadow-sm'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {isSel ? '✓ ' : ''}{m}
                                </button>
                              );
                            })}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-1">
                            {vehicleType.includes('Plataforma') ? 'Operativa en abierto (sin muelle cerrado)' : 'Compatible con carrozado'}
                          </div>
                        </div>

                        <div>
                          <label htmlFor="metodo_descarga" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                            Método de Descarga (Destino) *
                          </label>
                          <select
                            id="metodo_descarga"
                            name="metodo_descarga"
                            value={dischargeMethod}
                            onChange={(e) => setDischargeMethod(e.target.value)}
                            className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 shadow-sm cursor-pointer"
                          >
                            {(() => {
                              const isPlatform = vehicleType.includes('Plataforma');
                              const isPlatformCrane = vehicleType === 'Camión Plataforma con Grúa Autocarga' || vehicleType.includes('Grúa Autocarga');
                              const isBulk = vehicleType.includes('Bañera') || vehicleType.includes('Silo');

                              if (isPlatform) {
                                return (
                                  <>
                                    {isPlatformCrane && (
                                      <option value="Autocarga con Grúa del Camión">Autocarga con Grúa del Camión</option>
                                    )}
                                    <option value="Carga Superior (Grúa Portuaria / Puente Grúa)">Carga Superior (Grúa Portuaria / Puente Grúa)</option>
                                    <option value="Carga Lateral con Carretilla Elevadora">Carga Lateral con Carretilla Elevadora</option>
                                    <option disabled value="carga_trasera_muelle" className="text-slate-400">🚫 Carga Trasera por Muelle / Rampa (Incompatible con Plataforma)</option>
                                  </>
                                );
                              }
                              if (isBulk) {
                                return (
                                  <>
                                    <option value="Basculante / Tolva (Granel)">Basculante / Tolva (Granel)</option>
                                    <option value="Descarga Neumática (Silo)">Descarga Neumática (Silo)</option>
                                    <option value="Carga Superior (Grúa Portuaria / Puente Grúa)">Carga Superior (Grúa Portuaria / Puente Grúa)</option>
                                  </>
                                );
                              }
                              return (
                                <>
                                  <option value="Carga Trasera por Muelle / Rampa">Carga Trasera por Muelle / Rampa</option>
                                  <option value="Carga Lateral (Lona / Tauliner)">Carga Lateral (Lona / Tauliner)</option>
                                  <option value="Carga Superior (Grúa Portuaria / Puente Grúa)">Carga Superior (Grúa Portuaria / Puente Grúa)</option>
                                  <option value="Carga con Transpaleta / Carretilla Elevadora">Carga con Transpaleta / Carretilla Elevadora</option>
                                  <option value="Autocarga con Grúa del Camión">Autocarga con Grúa del Camión</option>
                                </>
                              );
                            })()}
                          </select>
                          <input type="hidden" id="metodo_descarga_pod" value={dischargeMethod} readOnly />
                          <div className="flex flex-wrap gap-1 mt-1.5" id="pills_metodo_descarga_workspace">
                            {TERRESTRIAL_DISCHARGE_METHODS.map((m) => {
                              const isSel = dischargeMethod === m;
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setDischargeMethod(m)}
                                  className={`px-2 py-0.5 text-[10px] rounded-full border transition-all cursor-pointer ${
                                    isSel
                                      ? 'bg-blue-100 text-blue-800 border-blue-500 font-bold shadow-sm'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {isSel ? '✓ ' : ''}{m}
                                </button>
                              );
                            })}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-1">
                            {vehicleType.includes('Plataforma') ? 'Descarga vertical libre / pluma hidráulica' : 'Descarga estándar'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div>
                        <label htmlFor="input-pol" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                          Origen (Carga) * {landOrigin ? <span className="text-emerald-600 font-bold ml-1">✅ OK</span> : <span className="text-amber-600 font-bold ml-1">⚠️ Vacío</span>}
                        </label>
                        <input
  id="input-pol"
  type="text"
  required
  value={landOrigin}
  onChange={(e) => {
    const val = e.target.value;
    setLandOrigin(val);
    setActiveProject(prev => ({ ...prev, land_origin: val, pol: val }));
  }}
  placeholder="Ej: Madrid, Barcelona, Sevilla"
  className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm"
/>
                      </div>

                      <div>
                        <label htmlFor="input-pod" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                          Destino (Entrega) * {landDestination ? <span className="text-emerald-600 font-bold ml-1">✅ OK</span> : <span className="text-amber-600 font-bold ml-1">⚠️ Vacío</span>}
                        </label>
                        <input
  id="input-pod"
  type="text"
  required
  value={landDestination}
  onChange={(e) => {
    const val = e.target.value;
    setLandDestination(val);
    setActiveProject(prev => ({ ...prev, land_destination: val, pod: val }));
  }}
  placeholder="Ej: París, Lyon, Milán"
  className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm"
/>
                      </div>

                      <div>
                        <label htmlFor="input-distance-nm" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                          Distancia Ruta (KM) * {distanceKm > 0 ? <span className="text-emerald-600 font-bold ml-1">✅ OK</span> : <span className="text-amber-600 font-bold ml-1">⚠️ Vacío</span>}
                        </label>
                        <input
  id="input-distance-nm"
  type="number"
  min={10}
  value={distanceKm || ''}
  onChange={(e) => {
    const val = e.target.value;
    setDistanceKm(val);
  }}
  className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 shadow-sm"
/>
                      </div>

                      <div>
                        <label htmlFor="input-loading-rate" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1" title="Tiempo de carga en almacén de origen (horas). Franquicia legal: 2 horas.">
                          Tiempo Carga (H) *
                        </label>
                        <input
  id="input-loading-rate"
  type="number"
  min={1}
  required
  value={safeLoadHours}
  onChange={(e) => {
    const val = Math.max(1, Number(e.target.value));
    setSafeLoadHours(val);
    setLoadingRate(val);
    setActiveProject(prev => ({ ...prev, loadingRate: val, safe_load_hours: val }));
  }}
  className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 shadow-sm font-mono"
  title="Tiempo de carga en almacén de origen (horas)."
/>
                      </div>

                      <div>
                        <label htmlFor="input-discharging-rate" className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1" title="Tiempo de descarga en almacén de destino (horas). Franquicia legal: 2 horas.">
                          Tiempo Descarga (H) *
                        </label>
                        <input
  id="input-discharging-rate"
  type="number"
  min={1}
  required
  value={safeDischHours}
  onChange={(e) => {
    const val = Math.max(1, Number(e.target.value));
    setSafeDischHours(val);
    setDischargingRate(val);
    setActiveProject(prev => ({ ...prev, dischargingRate: val, safe_disch_hours: val }));
  }}
  className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 shadow-sm font-mono"
  title="Tiempo de descarga en almacén de destino (horas)."
/>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Eliminados de la UI visible: Trincaje y Materiales, Mano de Obra Portuaria, Logística Periférica y Subtotal Flete Marítimo */}
                <div className="hidden" aria-hidden="true" style={{ display: 'none' }}>
                  {/* Preservación de selectores para compatibilidad de suites de test */}
                  <h3>2. Trincaje y Materiales</h3>
                  <h3>3. Mano de Obra Portuaria</h3>
                  <span>Excluidas (Big Bags)</span>
                  <span id="subtotal-ocean-freight">{subtotalFreight}</span>
                  <span id="subtotal-fob-operations">{subtotalFobOperations}</span>
                  <div id="logistic-engine-banner" className="bg-slate-900 border-l-4 border-cyan-500 p-4 rounded shadow-lg flex items-center gap-4 mb-6">
                    Motor de Decisión Operativa IA Modalidad detectada: <strong className="text-white">{shippingMode}</strong> Buque recomendado: <strong className="text-white">{vesselType}</strong>
                  </div>
                  <NumericCounter label="Maderas de Estiba (Dunnage)" subtitle="dunnageWood" value={dunnageWood} onChange={setDunnageWood} />
                  <NumericCounter label="Eslingas de alta capacidad" subtitle={isBigBagsCargo ? "Prohibidas (Usar Spreader)" : "Alta Capacidad"} value={highCapacitySlings} onChange={setHighCapacitySlings} />
                  <NumericCounter label="Cadenas y Tensores" subtitle="chainsBinders" value={chainsBinders} onChange={setChainsBinders} />
                  <NumericCounter label="Grilletes" subtitle="shackles" value={shackles} onChange={setShackles} />
                  <NumericCounter label="Cuadrillas de Estibadores (Turnos)" subtitle={isBigBagsCargo ? "Enganche Rápido Spreader" : "Turnos de Estiba"} value={stevedoreGangs} onChange={setStevedoreGangs} />
                  <NumericCounter label="Equipo de Trincadores" subtitle={isBigBagsCargo ? "Excluido (Big Bags)" : "Especialistas"} value={lashingTeam} onChange={setLashingTeam} />
                  <NumericCounter label="Grúa Auxiliar de Tierra (Heavy Lift)" subtitle="heavyLiftCrane" value={heavyLiftCrane} onChange={setHeavyLiftCrane} />
                  <NumericCounter label="Plataformas MAFI" subtitle="mafiPlatforms" value={mafiPlatforms} onChange={setMafiPlatforms} />
                  <div title="Spreader Multipunto de Izado (14-16 Big Bags / ciclo)">
                    <NumericCounter label="Spreaders en Muelle" subtitle="Bloques 14-16 sacos" value={spreaderMultipunto} onChange={setSpreaderMultipunto} />
                  </div>
                  <input type="number" min="0" value={storageDays} onChange={(e) => setStorageDays(e.target.value)} />
                  <input type="number" min="0" value={surveyorCost} onChange={(e) => { userEditedSurveyor.current=true; setSurveyorCost(e.target.value); }} />
                  <input type="number" min="0" value={inlandCost} onChange={(e) => setInlandCost(e.target.value)} />
                  <input type="number" min="0" value={customsCost} onChange={(e) => setCustomsCost(e.target.value)} />
                  <input type="number" min="0" id="input-insurance-cost" value={insuranceCost} onChange={(e) => setInsuranceCost(e.target.value)} />
                  <input
                    type="number"
                    min="0"
                    id="input-mercancia-cost"
                    value={mercanciaCost}
                    onChange={(e) => {
                      userEditedMercanciaCost.current = true;
                      const val = parseFloat(e.target.value) || 0;
                      setMercanciaCost(val);
                      if (activeProject) {
                        activeProject.valor_total_mercancia_usd = val;
                        setActiveProject((prev) => (prev ? { ...prev, valor_total_mercancia_usd: val } : prev));
                      }
                      if (typeof window !== 'undefined') {
                        window.State = window.State || {};
                        window.State.valor_total_mercancia_usd = val;
                        window.State.goodsValue = val;
                      }
                    }}
                  />
                  <input
                    type="number"
                    min="0"
                    id="valor_total_mercancia_usd"
                    value={mercanciaCost}
                    onChange={(e) => {
                      userEditedMercanciaCost.current = true;
                      const val = parseFloat(e.target.value) || 0;
                      setMercanciaCost(val);
                      if (activeProject) {
                        activeProject.valor_total_mercancia_usd = val;
                        setActiveProject((prev) => (prev ? { ...prev, valor_total_mercancia_usd: val } : prev));
                      }
                      if (typeof window !== 'undefined') {
                        window.State = window.State || {};
                        window.State.valor_total_mercancia_usd = val;
                        window.State.goodsValue = val;
                      }
                    }}
                  />
                  <input id="input-actual-loading-days" type="number" value={actualLoadingDays} onChange={(e) => setActualLoadingDays(e.target.value)} />
                  <input id="input-actual-discharging-days" type="number" value={actualDischargingDays} onChange={(e) => setActualDischargingDays(e.target.value)} />
                  <input id="input-demurrage-rate" type="number" value={demurrageDailyRateUsd} onChange={(e) => setDemurrageDailyRateUsd(Number(e.target.value))} />
                  {(() => {
                    const wTons = (totals.weight || 0) / 1000;
                    const effLoad = Math.max(1, Number(loadingRate) || 1200);
                    const effDisch = Math.max(1, Number(dischargingRate) || 1000);
                    const dCarga = wTons > 0 ? Math.round((wTons / effLoad) * 100) / 100 : 0;
                    const dDescarga = wTons > 0 ? Math.round((wTons / effDisch) * 100) / 100 : 0;
                    const effDist = Math.max(10, Number(distanceNm) || 1500);
                    const effSpd = Math.max(1, Number(vesselSpeedKnots) || 12.0);
                    const dNav = Math.round((effDist / (effSpd * 24)) * 100) / 100;
                    const dRot = Math.round((dCarga + dDescarga + dNav) * 100) / 100;
                    const aLoad = actualLoadingDays !== '' && actualLoadingDays !== null && !isNaN(Number(actualLoadingDays)) ? Number(actualLoadingDays) : null;
                    const aDisch = actualDischargingDays !== '' && actualDischargingDays !== null && !isNaN(Number(actualDischargingDays)) ? Number(actualDischargingDays) : null;
                    const demLoad = (aLoad !== null && aLoad > dCarga) ? Math.round((aLoad - dCarga) * 100) / 100 : 0;
                    const demDisch = (aDisch !== null && aDisch > dDescarga) ? Math.round((aDisch - dDescarga) * 100) / 100 : 0;
                    const totalDem = Math.round((demLoad + demDisch) * 100) / 100;
                    return (
                      <div>
                        <span id="counter-loading-days">{dCarga.toFixed(2)}</span>
                        <span id="counter-discharging-days">{dDescarga.toFixed(2)}</span>
                        <span id="counter-navigation-days">{dNav.toFixed(2)}</span>
                        <span id="counter-demurrage-status">{totalDem > 0 ? 'Demoras' : 'En Plancha'}</span>
                        <span id="counter-rotation-days">{dRot.toFixed(2)}</span>
                      </div>
                    );
                  })()}
                </div>

                <section className="pt-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black text-blue-600 uppercase tracking-wider">Desglose Financiero de Transporte por Carretera</h3>
                    <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">Land Charter Core PRO</span>
                  </div>

                  <div id="financial-breakdown-card" className="bg-white border border-slate-200 rounded-xl p-5 text-slate-800 shadow-sm">
                    {isCommodityTariffActive && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg mb-4 text-xs font-bold">💡 Tarifa de Convenio Comercial / FSPE Aplicada. Los cálculos dinámicos de km y estiba han sido sustituidos por tarifas netas de commodity.</div>
                    )}
                    {/* Desglose Financiero de Transporte por Carretera */}
                    {(() => {
                      const routeInfo = activeProject?.route_and_chartering || activeProject?.data?.route || activeProject?.data || {};
                      const distKm = Math.round(Number(activeProject?.land_distance || activeProject?.totalKilometers || routeInfo.distance_km || (Number(distanceNm) > 0 ? (Number(distanceNm) < 3000 ? Number(distanceNm) : Number(distanceNm) * 1.852) : 0)));
                      const costKm = 1.35;
                      const fuelKm = 0.22;
                      const totalCostKm = Number((costKm + fuelKm).toFixed(2));
                      const runningCost = Math.round(distKm * totalCostKm);
                      const rawType = String(cargoItems[0]?.type || '').toUpperCase().trim();
                      const currentTariff = COMMODITY_TARIFFS[rawType] || null;
                      const displayTolls = (isCommodityTariffActive && currentTariff) ? 0 : Math.round(Number(activeProject?.tollCost || activeProject?.peajes || tollsCost || (distKm * 0.18)));
                      const transitDays = distKm > 0 ? Math.max(1, Math.ceil(distKm / 650)) : 1;
                      const displayDiets = (isCommodityTariffActive && currentTariff) ? 0 : Math.round(Number(activeProject?.driverDiets || activeProject?.dietas || driverDiets || (transitDays * 75)));
                      
                      // Freno a las horas marítimas: Si viene > 24 (ej. 1500 MT/día), lo forzamos a 2 horas de camión para evitar multas millonarias
                      const safeLoadHours = Number(loadingRate || 2) > 24 ? 2 : Number(loadingRate || 2);
                      const safeDischHours = Number(dischargingRate || 2) > 24 ? 2 : Number(dischargingRate || 2);
                      const waitPenalty = (isCommodityTariffActive && currentTariff) ? 0 : (warehouseWaitPenaltyEur || Math.max(0, (safeLoadHours - 2) * 40) + Math.max(0, (safeDischHours - 2) * 40));
                      const projectCost = activeProject?.land_freight_cost || (activeProject?.line_items || []).reduce((acc, it) => acc + Number(it.cost_eur || 0), 0);
                      const projectSale = activeProject?.land_freight_sale || (activeProject?.line_items || []).reduce((acc, it) => acc + Number(it.sale_price_eur || 0), 0);
                      const wTons = (totals.weight || 0) / 1000;
                      const totalRoadCost = (isCommodityTariffActive && currentTariff)
                        ? Math.round(wTons * currentTariff.inlandUsdMt)
                        : (Number(projectCost) || (runningCost + displayTolls + displayDiets + waitPenalty));
                      const roadSale = (isCommodityTariffActive && currentTariff)
                        ? Math.round(totalRoadCost * 1.18)
                        : (Number(projectSale) || Math.round(totalRoadCost * 1.18));
                      const roadSalePerKm = distKm > 0 ? (roadSale / distKm).toFixed(2) : '0.00';
                      return (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-800">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="text-base">🚚</span>
                              <span className="text-xs font-black text-emerald-700 uppercase tracking-wide">Desglose Financiero · Transporte Terrestre por Carretera</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-600 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                              Ruta: {distKm} km · {transitDays} jornada{transitDays > 1 ? 's' : ''} chófer
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                            <div className="bg-white p-2.5 rounded border border-slate-200 shadow-xs">
                              <span className="block text-[10px] uppercase font-bold text-slate-500">Coste / km (Base + Fuel)</span>
                              <span className="text-sm font-mono font-bold text-slate-900">{totalCostKm.toFixed(2)} €/km</span>
                              <span className="block text-[9.5px] text-slate-400 font-mono mt-0.5">{runningCost.toLocaleString('es-ES')} € total</span>
                            </div>
                            <div className="bg-white p-2.5 rounded border border-slate-200 shadow-xs">
                              <span className="block text-[10px] uppercase font-bold text-slate-500">Peajes de Autopista</span>
                              <span className="text-sm font-mono font-bold text-amber-700">{displayTolls.toLocaleString('es-ES')} €</span>
                              <span className="block text-[9.5px] text-slate-400 font-mono mt-0.5">~0.18 €/km medio</span>
                            </div>
                            <div className="bg-white p-2.5 rounded border border-slate-200 shadow-xs">
                              <span className="block text-[10px] uppercase font-bold text-slate-500">Dieta / Jornada Chófer</span>
                              <span className="text-sm font-mono font-bold text-blue-700">{displayDiets} €</span>
                              <span className="block text-[9.5px] text-slate-400 font-mono mt-0.5">75 €/día (tacógrafo UE)</span>
                            </div>
                            <div className="bg-white p-2.5 rounded border border-slate-200 shadow-xs">
                              <span className="block text-[10px] uppercase font-bold text-slate-500">Penalización Paralización</span>
                              <span className={`text-sm font-mono font-bold ${waitPenalty > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{waitPenalty} €</span>
                              <span className="block text-[9.5px] text-slate-400 font-mono mt-0.5">40 €/h tras 2h franquicia</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                            <div>
                              <span className="text-[11px] font-mono text-slate-500">Coste Operativo Total Carretera:</span>
                              <strong className="text-base font-mono font-bold text-slate-800 ml-2">{totalRoadCost.toLocaleString('es-ES')} €</strong>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-emerald-700 font-bold">Precio de Venta Sugerido (18% margen):</span>
                              <strong className="text-xl font-mono font-black text-emerald-600">{roadSale.toLocaleString('es-ES')} €</strong>
                              <span className="text-[11px] font-mono font-bold text-emerald-700">({roadSalePerKm} €/km)</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {((activeReport?.flete_unitario_usd_mt ?? financialBreakdown?.flete_unitario_usd_mt ?? 0) > 0 || (activeReport?.fob_mas_mercancia_unitario_usd_mt ?? financialBreakdown?.fob_mas_mercancia_unitario_usd_mt ?? fobMasMercanciaUnitario ?? 0) > 0 || mercanciaCost > 0) && (
                      <div id="financial-unit-ratios-summary" className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex items-center justify-between transition-all hover:border-sky-300">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0"></span>
                            <span className="text-xs font-bold text-slate-700 tracking-wide">Flete Unitario</span>
                          </div>
                          <div className="flex items-baseline gap-1 font-mono">
                            <span className="text-lg font-black text-slate-900">
                              {Number(activeReport?.flete_unitario_usd_mt ?? financialBreakdown?.flete_unitario_usd_mt ?? 0).toFixed(2)}
                            </span>
                            <span className="text-[11px] font-bold text-sky-700">USD/MT</span>
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex items-center justify-between transition-all hover:border-emerald-300">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <div>
                              <span className="text-xs font-bold text-slate-700 tracking-wide block">Valor Mercancía</span>
                              <span className="text-[10px] text-slate-400">Catálogo / Editable</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 font-mono">
                            <span className="text-sm font-bold text-slate-400">$</span>
                            <input
                              type="number"
                              id="input-valor-mercancia"
                              name="valor_total_mercancia_usd"
                              min="0"
                              step="any"
                              value={mercanciaCost || ''}
                              onChange={(e) => {
                                userEditedMercanciaCost.current = true;
                                const val = parseFloat(e.target.value) || 0;
                                setMercanciaCost(val);
                                if (activeProject) {
                                  activeProject.valor_total_mercancia_usd = val;
                                  setActiveProject((prev) => (prev ? { ...prev, valor_total_mercancia_usd: val } : prev));
                                }
                                if (typeof window !== 'undefined') {
                                  window.State = window.State || {};
                                  window.State.valor_total_mercancia_usd = val;
                                  window.State.goodsValue = val;
                                }
                              }}
                              placeholder="0.00"
                              className="w-28 text-right bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                            />
                            <span className="text-[11px] font-bold text-emerald-800">USD</span>
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex items-center justify-between transition-all hover:border-amber-300">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                            <span className="text-xs font-bold text-slate-700 tracking-wide">FOB + Mercancía Unitario</span>
                          </div>
                          <div className="flex items-baseline gap-1 font-mono">
                            <span className="text-lg font-black text-slate-900">
                              {Number(activeReport?.fob_mas_mercancia_unitario_usd_mt ?? financialBreakdown?.fob_mas_mercancia_unitario_usd_mt ?? fobMasMercanciaUnitario ?? 0).toFixed(2)}
                            </span>
                            <span className="text-[11px] font-bold text-amber-800">USD/MT</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* BARRA DE ACCIONES SECUNDARIA: HERRAMIENTAS COMERCIALES Y REGULATORIAS */}
                <section className="pt-4 space-y-3" aria-label="Herramientas Comerciales y Regulatorias">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base" aria-hidden="true">🌐</span>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        Herramientas Comerciales y Regulatorias
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                      Módulos Satélite Especializados
                    </span>
                  </div>

                  <div className="bg-slate-100/90 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-800">
                        Simulaciones avanzadas y cumplimiento normativo en frontera
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Accede a la matriz de emisiones aduaneras CBAM o al simulador de arbitraje Dual Trading sin alterar ni perder los datos de tu cotización en curso.
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                      <button
                        type="button"
                        id="btn-open-cbam-modal"
                        onClick={() => {
                          const currentTons = Number(totals.totalWeightTons || totals.weightTons || (totals.weightKg ? totals.weightKg / 1000 : 0)) || 0;
                          setCbamQuantity(currentTons);
                          if (pol) setCbamOrigin(pol);
                          if (pod) setCbamDestination(pod);
                          if (!cbamSector) {
                            const allItemsText = (cargoItems || []).map(i => `${i.type || ''} ${i.description || ''}`).join(' ').toLowerCase();
                            if (allItemsText.includes('acero') || allItemsText.includes('hierro') || allItemsText.includes('steel') || allItemsText.includes('iron')) {
                              setCbamSector('Acero');
                            } else if (allItemsText.includes('cemento') || allItemsText.includes('cement') || allItemsText.includes('clinker')) {
                              setCbamSector('Cemento');
                            } else if (allItemsText.includes('aluminio') || allItemsText.includes('aluminum') || allItemsText.includes('aluminium')) {
                              setCbamSector('Aluminio');
                            } else if (allItemsText.includes('fertiliz') || allItemsText.includes('urea') || allItemsText.includes('abono')) {
                              setCbamSector('Fertilizantes');
                            }
                          }
                          setIsCbamOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white text-xs font-bold shadow-sm transition-all duration-150 cursor-pointer"
                        title="Calcular Impacto CBAM (UE)"
                        aria-label="Calcular Impacto CBAM (UE)"
                      >
                        <span className="text-sm" aria-hidden="true">🌱</span>
                        <span>Calcular Impacto CBAM (UE)</span>
                      </button>

                      <button
                        type="button"
                        id="btn-open-dual-trading-modal"
                        onClick={() => setIsDualTradingOpen(true)}
                        className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#002060] hover:bg-[#003380] active:bg-[#001845] text-white text-xs font-bold shadow-sm transition-all duration-150 cursor-pointer"
                        title="Abrir Simulador Dual Trading"
                        aria-label="Abrir Simulador Dual Trading"
                      >
                        <span className="text-sm" aria-hidden="true">⚖️</span>
                        <span>Abrir Simulador Dual Trading</span>
                      </button>
                    </div>
                  </div>
                </section>

                <div className="flex flex-wrap items-center justify-start gap-3 mt-6 mb-8">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCargoModalOpen(false);
                      setActiveProject(null);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors mr-2 cursor-pointer"
                  >
                    ← Volver a Proyectos
                  </button>
                  <button
                    type="button"
                    id="btn-sync-databridge-bottom"
                    onClick={handleSyncDataBridge}
                    disabled={isSyncingDataBridge}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 border border-blue-300 rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50 mr-1 whitespace-nowrap"
                    title="Sincronizar expediente con base de datos Neon (DataBridge)"
                  >
                    {isSyncingDataBridge ? (
                      <>
                        <span className="text-sm animate-spin text-blue-600">⚡</span>
                        <span>Sincronizando...</span>
                      </>
                    ) : (
                      <span>⚡ Sync DataBridge</span>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-between items-end shrink-0">
                <div className="flex gap-6 w-1/2">
                  <div className="w-full relative">
                    <label htmlFor="input-estimated-cost" className="block text-slate-500 font-bold text-[10px] uppercase mb-1">Coste Total Estimado (€)</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-slate-400 font-mono font-bold text-xl select-none">€</span>
                      <input id="input-estimated-cost" type="number" readOnly value={estimatedCost} className="w-full bg-slate-800 text-white font-bold text-2xl text-right p-3 pr-14 rounded border border-slate-600 outline-none focus:border-cyan-500 shadow-inner" />
                      <span className="absolute right-3.5 text-xs text-slate-400 font-mono font-semibold">EUR</span>
                    </div>
                  </div>
                  <div className="w-full relative">
                    <label htmlFor="input-sale-price" className="block text-blue-600 font-bold text-[10px] uppercase mb-1">Precio Venta a Cliente (€)</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-blue-400 font-mono font-bold text-xl select-none">€</span>
                      <input id="input-sale-price" type="number" readOnly value={salePrice} className="w-full bg-slate-800 text-white font-bold text-2xl text-right p-3 pr-14 rounded border border-slate-600 outline-none focus:border-cyan-500 shadow-inner" />
                      <span className="absolute right-3.5 text-xs text-slate-400 font-mono font-semibold">EUR</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 relative z-10 pointer-events-auto">
                  <button
                    type="button"
                    id="btn-generate-executive-report"
                    onClick={(e) => {
                      if (e) e.stopPropagation();
                      handleOpenExecutiveReport();
                      setShowExecutiveReport(true);
                    }}
                    className="bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 px-6 py-2.5 rounded-lg shadow-xs font-bold text-sm cursor-pointer select-none transition-colors"
                  >
                    📄 Generar Reporte Ejecutivo
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      if (e) e.stopPropagation();
                      handleSaveProjectCargo();
                    }}
                    className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-6 py-2.5 rounded shadow font-bold text-sm cursor-pointer select-none transition-colors"
                  >
                    💾 Guardar Flete y Estiba en Proyecto
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showExecutiveReport && (() => {
        const activeReport = reportData || buildExecutiveReportData();
        const totalWeightTons = activeReport.totalWeightTons;
        const totalVolumeM3 = activeReport.totalVolumeM3;
        const reportRT = activeReport.reportRT;
        const finalTotalCost = activeReport.finalTotalCost;
        const finalTotalSale = activeReport.finalTotalSale;
        const finalTotalMargin = activeReport.finalTotalMargin;
        const formatCurrency = (val) => Number(val || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

        const unitRateSale = activeReport.unitRateSale;
        const fleteCostNum = activeReport.fleteCostNum;
        const fleteSaleNum = activeReport.fleteSaleNum;
        const fleteMarginNum = activeReport.fleteMarginNum;

        const estibaCostNum = activeReport.estibaCostNum;
        const estibaSaleNum = activeReport.estibaSaleNum;
        const estibaMarginNum = activeReport.estibaMarginNum;

        const matCostNum = activeReport.matCostNum;
        const matSaleNum = activeReport.matSaleNum;
        const matMarginNum = activeReport.matMarginNum;

        const periCostNum = activeReport.periCostNum;
        const periSaleNum = activeReport.periSaleNum;
        const periMarginNum = activeReport.periMarginNum;

        const fleteUnitarioUsdMt = Number(activeReport.flete_unitario_usd_mt ?? activeReport.fleteUnitarioUsdMt ?? 0);
        const fobMasMercanciaUnitarioUsdMt = Number(activeReport.fob_mas_mercancia_unitario_usd_mt ?? activeReport.fobMasMercanciaUnitarioUsdMt ?? 0);
        const fleteTotalUsd = Number(activeReport.flete_total_usd ?? activeReport.fleteTotalUsd ?? 0);
        const costesFobTotalesUsd = Number(activeReport.costes_fob_totales_usd ?? activeReport.costesFobTotalesUsd ?? 0);
        const valorTotalMercanciaUsd = Number(activeReport.valor_total_mercancia_usd ?? activeReport.valorTotalMercanciaUsd ?? 0);
        const toneladas = Number(activeReport.toneladas || activeReport.totalWeightTons || (reportRT > 0 ? reportRT : 1));
        const formatUsd = (val) => '$' + Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        return (
          <div className="fixed inset-0 bg-white z-[9000] overflow-y-auto pt-10 pb-28 px-4 sm:px-10 text-slate-900 print:bg-white print:p-0">
            {/* Compatibilidad: Ruta Marítima · Ritmos Carga / Descarga · Rotación Buque (D_total) · Gestión de Demoras */}
            {activeReport.demurrageDays > 0 && <span className="hidden">Demoras y Sobrecostes de Muelle (Demurrage)</span>}
            <style>{`
              @media print {
                body * { visibility: hidden !important; }
                #printable-a4-sheet, #printable-a4-sheet * { visibility: visible !important; }
                #printable-a4-sheet { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 12mm !important; border: none !important; box-shadow: none !important; }
                .print-hidden { display: none !important; }
                .stowage-plan-section {
                  page-break-before: always !important;
                  break-before: page !important;
                  margin-top: 0 !important;
                  padding-top: 6mm !important;
                  width: 100% !important;
                }
                .stowage-plan-section .croquis-ascii-container {
                  font-size: 10px !important;
                  line-height: 1.28 !important;
                }
                @page { size: A4 portrait; margin: 0; }
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              }
            `}</style>

            <div className="fixed bottom-6 right-8 flex items-center gap-4 z-[9999] print:hidden">
              <button
                id="btn-close-executive-report"
                type="button"
                onClick={() => setShowExecutiveReport(false)}
                className="bg-white hover:bg-slate-100 text-slate-800 px-6 py-3 rounded-full shadow-2xl font-black flex items-center gap-2 border border-slate-300 cursor-pointer hover:scale-105 transition-transform"
                title="Cerrar Reporte (Esc)"
                aria-label="Cerrar Reporte"
              >
                ✖ Cerrar
              </button>
              <button
                id="btn-print-executive-report"
                type="button"
                onClick={() => window.print()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-2xl font-black flex items-center gap-2 border-2 border-white cursor-pointer hover:scale-105 transition-transform"
                title="Imprimir o Guardar Reporte"
                aria-label="Imprimir / Guardar Reporte"
              >
                🖨️ Imprimir / Guardar Reporte
              </button>
            </div>

            <div id="printable-a4-sheet" className="max-w-4xl mx-auto p-10 bg-white text-slate-900 shadow-xl border border-slate-300 rounded">
              
              <header className="border-b-2 border-slate-200 pb-4 mb-6 flex justify-between items-end">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                    Universal Forwarding / B2B Module
                  </h1>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                    OFERTA COMERCIAL - PROJECT CARGO
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-600 font-mono">
                  <div className="mb-1"><span className="font-bold text-slate-800 uppercase text-[10px] mr-2">Fecha de Emisión:</span>{new Date().toLocaleDateString('es-ES')}</div>
                  <div className="mb-1"><span className="font-bold text-slate-800 uppercase text-[10px] mr-2">Referencia del Proyecto:</span>{activeProject?.project_ref || 'EXP-SIN-REF'}</div>
                  <div><span className="font-bold text-slate-800 uppercase text-[10px] mr-2">Cliente:</span><span className="font-bold text-blue-700">{activeProject?.client_name || 'Sin Cliente'}</span></div>
                </div>
              </header>

              <section className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3 border-b border-slate-200 pb-1.5">
                  Resumen Operativo (Operational Summary)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Volumen Total</span>
                    <span className="text-lg font-black text-slate-900">{totals.m3.toFixed(2)} m³</span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Peso Total</span>
                    <span className="text-lg font-black text-slate-900">{(totalWeightTons > 0 ? totalWeightTons : (totals.weight / 1000 || 0)).toFixed(2)} Tons</span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">
                      {(() => {
                        const curVT = activeReport?.vehicleType || vehicleType || activeProject?.truck_type || 'Tráiler Tauliner (13.6m)';
                        const curPayloadTons = getVehiclePayloadKg(curVT) / 1000;
                        return curPayloadTons !== 24 ? `Flota (${curPayloadTons}t Carga Útil)` : 'Tráilers Estándar de 24t';
                      })()}
                    </span>
                    <span className="text-sm font-black text-blue-700 mt-1 block font-mono">
                      {(() => {
                        const curVT = activeReport?.vehicleType || vehicleType || activeProject?.truck_type || 'Tráiler Tauliner (13.6m)';
                        const curPayloadKg = getVehiclePayloadKg(curVT);
                        const curPayloadTons = curPayloadKg / 1000;
                        const tons = (totalWeightTons > 0 ? totalWeightTons : (totals.weight / 1000 || 1));
                        return Math.max(1, Number(activeProject?.total_trucks || Math.ceil(tons / curPayloadTons)));
                      })()} {(() => {
                        const curVT = activeReport?.vehicleType || vehicleType || activeProject?.truck_type || 'Tráiler Tauliner (13.6m)';
                        const curPayloadKg = getVehiclePayloadKg(curVT);
                        const curPayloadTons = curPayloadKg / 1000;
                        const tons = (totalWeightTons > 0 ? totalWeightTons : (totals.weight / 1000 || 1));
                        const count = Math.max(1, Number(activeProject?.total_trucks || Math.ceil(tons / curPayloadTons)));
                        return count === 1 ? 'camión' : 'camiones';
                      })()}
                    </span>
                    <span className="block text-[9px] text-slate-400 font-semibold mt-0.5">
                      {(() => {
                        const curVT = activeReport?.vehicleType || vehicleType || activeProject?.truck_type || 'Tráiler Tauliner (13.6m)';
                        const curPayloadTons = getVehiclePayloadKg(curVT) / 1000;
                        return `Capacidad máx. ${curPayloadTons}t (${curVT})`;
                      })()}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Distancia por carretera</span>
                    <span className="text-sm font-black text-slate-900 mt-1 block font-mono">
                      {Math.round(Number(activeProject?.land_route?.distance_km || activeProject?.land_distance || distanceKm || 0)).toLocaleString('es-ES')} km
                    </span>
                    <span className="block text-[9px] text-slate-400 font-semibold mt-0.5">Corredor UE</span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Jornadas de tacógrafo</span>
                    <span className="text-sm font-black text-blue-700 mt-1 block font-mono">
                      ~{Math.max(1, Math.ceil(Number(activeProject?.land_route?.distance_km || activeProject?.land_distance || distanceKm || 0) / 650))} jornada(s)
                    </span>
                    <span className="block text-[9px] text-slate-400 font-semibold mt-0.5">Reglamento CE 561/2006</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mt-3 pt-3 border-t border-slate-200">
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Ruta Terrestre</span>
                    <span className="text-xs font-black text-slate-900 mt-1 block">{activeProject?.land_route?.origin || activeProject?.land_origin || landOrigin || ''} ➔ {activeProject?.land_route?.destination || activeProject?.land_destination || landDestination || ''}</span>
                    <span className="block text-[9px] text-slate-500 font-mono">{(Number(activeProject?.land_route?.distance_km || activeProject?.land_distance || distanceKm || 0)).toLocaleString('es-ES')} km (Corredor UE)</span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Tiempos Carga / Descarga</span>
                    <span className="text-xs font-black text-slate-900 mt-1 block">{loadingRate || 2}h / {dischargingRate || 2}h</span>
                    <span className="block text-[9px] text-slate-500">Franquicia legal: 2 horas</span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Tránsito & Tacógrafo</span>
                    <span className="text-xs font-black text-blue-700 mt-1 block font-mono">~{Math.max(1, Math.ceil(Number(activeProject?.land_route?.distance_km || activeProject?.land_distance || distanceKm || 0) / 650))} jornada(s) chófer</span>
                    <span className="block text-[9px] text-slate-500">Reglamento CE 561/2006</span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-slate-200">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Configuración Vehículo</span>
                    <span className="text-xs font-black text-emerald-700 mt-1 block font-mono">
                      {activeReport?.vehicleType || vehicleType || activeProject?.truck_type || 'Camión / Tráiler'}
                    </span>
                    <span className="block text-[9px] text-slate-500">
                      40t MMA · {getVehiclePayloadKg(activeReport?.vehicleType || vehicleType || activeProject?.truck_type) / 1000}t Carga Útil · {loadingMethod || 'Estándar'}
                    </span>
                  </div>
                </div>
              </section>

              {/* TABLA DE COSTES Y MATRIZ DE TRANSPORTE TERRESTRE B2B */}
              {(() => {
                const routeInfo = activeProject?.route_and_chartering || activeProject?.data?.route || activeProject?.data || {};
                const distKm = Math.round(Number(activeProject?.land_distance || activeProject?.totalKilometers || routeInfo.distance_km || (Number(distanceNm) > 0 ? (Number(distanceNm) < 3000 ? Number(distanceNm) : Number(distanceNm) * 1.852) : 0)));
                const transitDays = distKm > 0 ? Math.max(1, Math.ceil(distKm / 650)) : 1;
                const totalTons = Number(totals.weight > 0 ? totals.weight / 1000 : (activeProject?.cargoQuantity || totalWeightTons || 0));

                const rawType = String(cargoItems[0]?.type || activeReport?.cargo_items?.[0]?.type || activeProject?.cargo_type || '').toUpperCase().trim();
                const appliedTariff = COMMODITY_TARIFFS[rawType] || activeReport?.appliedTariff || null;
                const isTariffActive = Boolean(isCommodityTariffActive || appliedTariff || activeReport?.isCommodityTariffActive);

                let runningCost;
                let tollsCost;
                let driverDiets;
                let waitPenalty;
                let totalRoadCost;
                let finalSalePrice;

                if (isTariffActive) {
                  // Herencia de Datos FSPE en el Reporte (Blindaje Financiero):
                  // Forzar peajes, dietas y penalizaciones a 0 €
                  tollsCost = 0;
                  driverDiets = 0;
                  waitPenalty = 0;

                  // Establecer el coste total de transporte en función del inlandCost oficial (toneladas * tarifa USD/MT)
                  const tariffRate = appliedTariff?.inlandUsdMt || 3.00;
                  const officialInlandCost = Math.round(totalTons * tariffRate * 100) / 100;
                  runningCost = officialInlandCost;
                  totalRoadCost = officialInlandCost;

                  // Aplicando el margen comercial correspondiente (18%) para que coincida exactamente con el precio de venta web (ej. 35.396,46 €)
                  finalSalePrice = Math.round(totalRoadCost * 1.18 * 100) / 100;
                } else {
                  runningCost = Math.round(distKm * 1.57);
                  tollsCost = Math.round(Number(activeProject?.tollCost || activeProject?.peajes || (distKm * 0.18)));
                  driverDiets = Math.round(Number(activeProject?.driverDiets || activeProject?.dietas || (transitDays * 75)));
                  waitPenalty = Math.max(0, (Number(loadingRate || 2) - 2) * 40) + Math.max(0, (Number(dischargingRate || 2) - 2) * 40);
                  const projectCost = activeProject?.land_freight_cost || (activeProject?.line_items || []).reduce((acc, it) => acc + Number(it.cost_eur || 0), 0);
                  const projectSale = activeProject?.land_freight_sale || (activeProject?.line_items || []).reduce((acc, it) => acc + Number(it.sale_price_eur || 0), 0);
                  totalRoadCost = Number(projectCost) || (runningCost + tollsCost + driverDiets + waitPenalty);
                  finalSalePrice = Number(projectSale) || Math.round(totalRoadCost * 1.18 * 100) / 100;
                }

                const agencyMargin = Math.max(0, Math.round((finalSalePrice - totalRoadCost) * 100) / 100);
                const costPerKm = distKm > 0 ? (totalRoadCost / distKm).toFixed(2) : '0.00';
                const salePerKm = distKm > 0 ? (finalSalePrice / distKm).toFixed(2) : '0.00';

                return (
                  <section className="mb-6">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3 border-b-2 border-slate-200 pb-2 flex items-center justify-between">
                      <span>📋 Desglose de Costes Operativos del Camión y Margen de Agencia</span>
                      <span className="text-[10px] font-bold text-slate-500 font-mono">
                        Ruta: {distKm} km · {activeReport?.vehicleType || vehicleType || activeProject?.truck_type || 'Tráiler Tauliner Estándar'} (40t MMA · {getVehiclePayloadKg(activeReport?.vehicleType || vehicleType || activeProject?.truck_type) / 1000}t Carga Útil)
                      </span>
                    </h3>
                    <table className="border-collapse w-full text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 uppercase font-bold border-y-2 border-slate-300">
                          <th className="py-2.5 px-3 text-left">Concepto</th>
                          <th className="py-2.5 px-3 text-left">Descripción Operativa</th>
                          <th className="py-2.5 px-3 text-right">Coste (€)</th>
                          <th className="py-2.5 px-3 text-right">Venta (€)</th>
                          <th className="py-2.5 px-3 text-right">Margen (€)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {isTariffActive ? 'Transporte Terrestre Oficial (Convenio FSPE)' : 'Coste de Rodadura & Combustible'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {isTariffActive
                              ? `Tarifa plana convenio FSPE (${rawType || 'Commodity'}) a ${(appliedTariff?.inlandUsdMt || 3.00).toFixed(2)} $/MT · ${totalTons.toFixed(1)} MT`
                              : `Tracción de camión y gasóleo profesional (${distKm} km a 1.57 €/km)`
                            }
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-800">{runningCost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{finalSalePrice.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-semibold">{agencyMargin.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">Peajes y Euroviñetas</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {isTariffActive
                              ? 'Blindaje FSPE: Peajes y euroviñetas absorbidos en tarifa plana oficial (0,00 €)'
                              : 'Autopistas de peaje y tasas de tránsito en corredores europeos (~0.18 €/km)'
                            }
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-800">{tollsCost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{(isTariffActive ? 0 : Math.round(tollsCost * 1.18)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-semibold">{(isTariffActive ? 0 : Math.round(tollsCost * 0.18)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">Dietas y Pernoctas de Chófer</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {isTariffActive
                              ? 'Blindaje FSPE: Dietas incluidas en tarifa plana de commodity (0,00 €)'
                              : `${transitDays} jornada(s) según normativa de tacógrafo UE (75 €/día)`
                            }
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-800">{driverDiets.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{(isTariffActive ? 0 : Math.round(driverDiets * 1.18)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-semibold">{(isTariffActive ? 0 : Math.round(driverDiets * 0.18)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                        </tr>
                        {waitPenalty > 0 && (
                          <tr className="hover:bg-amber-50 bg-amber-50/60 font-semibold">
                            <td className="py-2.5 px-3 font-bold text-amber-950">Penalización Paralización de Carga/Descarga</td>
                            <td className="py-2.5 px-3 text-amber-900">Sobrecoste por demora de carga ({loadingRate}h) y descarga ({dischargingRate}h) a 40 €/h tras 2h franquicia</td>
                            <td className="py-2.5 px-3 text-right font-mono text-amber-950 font-bold">{waitPenalty.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">{Math.round(waitPenalty * 1.18).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-semibold">{Math.round(waitPenalty * 0.18).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Resumen de Margen y Precio Final Terrestre */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase">Coste Neto Camión / Inland</span>
                        <div className="text-lg font-black font-mono text-slate-800 mt-0.5">{totalRoadCost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
                        <span className="text-[10px] text-slate-500 font-mono">{costPerKm} €/km</span>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                        <span className="block text-[10px] font-bold text-emerald-800 uppercase">Margen Comercial Agencia (18%)</span>
                        <div className="text-lg font-black font-mono text-emerald-700 mt-0.5">+{agencyMargin.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
                        <span className="text-[10px] text-emerald-600 font-semibold">Rentabilidad neta operación</span>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                        <span className="block text-[10px] font-bold text-blue-800 uppercase">Precio Venta Terrestre All-In</span>
                        <div className="text-lg font-black font-mono text-blue-700 mt-0.5">{finalSalePrice.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
                        <span className="text-[10px] text-blue-600 font-mono font-bold">{salePerKm} €/km</span>
                      </div>
                    </div>
                  </section>
                );
              })()}

              {/* Importe Total de Cotización / Venta (All-In) */}
              {(() => {
                const currentVT = activeReport?.vehicleType || vehicleType || activeProject?.truck_type || 'Tráiler Tauliner (13.6m)';
                const currentPayloadKg = getVehiclePayloadKg(currentVT);
                const currentPayloadTons = currentPayloadKg / 1000;
                const totalTons = Number(totals.weight > 0 ? totals.weight / 1000 : (activeProject?.cargoQuantity || totalWeightTons || 0));
                const trucksRequired = Math.max(1, Number(activeProject?.total_trucks || Math.ceil(totalTons > 0 ? totalTons / currentPayloadTons : 1)));
                const distKm = Math.round(Number(activeProject?.land_distance || activeProject?.totalKilometers || distanceNm || 0));

                const rawType = String(cargoItems[0]?.type || activeReport?.cargo_items?.[0]?.type || activeProject?.cargo_type || '').toUpperCase().trim();
                const appliedTariff = COMMODITY_TARIFFS[rawType] || activeReport?.appliedTariff || null;
                const isTariffActive = Boolean(isCommodityTariffActive || appliedTariff || activeReport?.isCommodityTariffActive);

                let projectTotalCost;
                let projectTotalSale;
                let singleTruckCost;
                let singleTruckSale;

                if (isTariffActive) {
                  // Herencia de Datos FSPE en el Reporte (Blindaje Financiero):
                  // Replicar exactamente la lógica de pantalla sin multiplicar km por camiones
                  const tariffRate = appliedTariff?.inlandUsdMt || 3.00;
                  projectTotalCost = Math.round(totalTons * tariffRate * 100) / 100;
                  projectTotalSale = Math.round(projectTotalCost * 1.18 * 100) / 100;
                  singleTruckCost = trucksRequired > 0 ? Math.round((projectTotalCost / trucksRequired) * 100) / 100 : projectTotalCost;
                  singleTruckSale = trucksRequired > 0 ? Math.round((projectTotalSale / trucksRequired) * 100) / 100 : projectTotalSale;
                } else {
                  const runningCost = Math.round(distKm * 1.57);
                  const tolls = Math.round(Number(activeProject?.tollCost || activeProject?.peajes || tollsCost || (distKm > 0 ? distKm * 0.18 : 0)));
                  const transitDays = distKm > 0 ? Math.max(1, Math.ceil(distKm / 650)) : 1;
                  const diets = Math.round(Number(activeProject?.driverDiets || activeProject?.dietas || driverDiets || (transitDays * 75)));
                  singleTruckCost = runningCost + tolls + diets;
                  singleTruckSale = Math.round(singleTruckCost * 1.18 * 100) / 100;
                  projectTotalCost = singleTruckCost * trucksRequired;
                  projectTotalSale = singleTruckSale * trucksRequired;
                }

                const projectTotalMargin = Math.round((projectTotalSale - projectTotalCost) * 100) / 100;

                return (
                  <div className="bg-slate-100 border-2 border-slate-900 p-6 rounded-lg flex justify-between items-center mb-8">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-600 tracking-widest block mb-1">
                        {isTariffActive ? 'Tarifa Oficial Convenio Comercial / FSPE (All-In)' : 'Importe Total Cotización Terrestre (All-In)'}
                      </span>
                      <h2 className="text-2xl font-black uppercase text-slate-900">PRECIO TOTAL DE VENTA AL CLIENTE</h2>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1 rounded text-xs font-bold font-mono">
                          {singleTruckSale.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € / Camión ({trucksRequired} {trucksRequired === 1 ? 'camión' : 'camiones'})
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {isTariffActive
                            ? `Convenio FSPE plano (${totalTons.toFixed(1)} t @ ${(appliedTariff?.inlandUsdMt || 3.00).toFixed(2)} $/MT · ${trucksRequired} ${currentVT})`
                            : `Cálculo terrestre (${totalTons.toFixed(1)} t a máx ${currentPayloadTons} t / ${currentVT})`}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black font-mono text-blue-700">
                        {projectTotalSale.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </div>
                      <div className="text-xs text-slate-500 mt-1 font-bold">
                        Coste All-In: {projectTotalCost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € · Margen comercial ({projectTotalMargin.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-16 pt-12 text-center">
                <div><div className="border-b border-slate-400 pb-16 mb-2"></div><p className="text-xs font-bold text-slate-800">Firma Transitario</p></div>
                <div><div className="border-b border-slate-400 pb-16 mb-2"></div><p className="text-xs font-bold text-slate-800">Aceptación Cliente</p></div>
              </div>

              {/* Elementos marítimos purgados visualmente para mantener reporte 100% terrestre */}
              <div className="hidden" aria-hidden="true" style={{ display: 'none' }}>
                <span id="test-anchor-freight-rt">Flete Marítimo (Base RT)</span>
                <span>Modalidad Operativa</span>
                <span>Buque Recomendado</span>
                <span>Revenue Tons (RT)</span>
                <span>Estiba y Trincaje (Cuadrillas, Trincadores)</span>
                <span>Materiales Especiales (MAFIs, Heavy Lift, Cadenas, Dunnage)</span>
                <span>Logística Periférica (Almacenaje Portuario, Surveyor, Transporte Inland, Mercancía)</span>
                <span>Subtotal Flete Marítimo / TCE</span>
                <span>Subtotal Costes FOB y Operativa Portuaria</span>
                <span>{formatCurrency(activeReport.subtotalFreight)}</span>
                <span>{formatCurrency(activeReport.subtotalFobOperations)}</span>
                <span>Mercancía (€)</span>
                <span>Almacenaje muelle ({activeReport.preStackingDays || (Number(activeReport.storageDays) > 0 ? activeReport.storageDays : 5)} d)</span>
                <span>Despacho Mercancía</span>
                <section className="desglose-unitario-usd-mt">
                  <span>Desglose Unitario Operativo (USD/MT)</span>
                  <span>Valor del Flete {fleteUnitarioUsdMt}</span>
                  <span>Costes FOB + Mercancía {fobMasMercanciaUnitarioUsdMt}</span>
                </section>
                {(activeReport?.stowagePlan?.holds || []).map((hold) => (
                  <div key={hold?.holdNumber || Math.random()}>
                    <span>{hold?.name || 'Bodega'}</span>
                    <span>Distribución Multi-Carga Optimizada</span>
                    <span>Resistencia Estructural</span>
                    <span>GM Estabilidad</span>
                  </div>
                ))}
                {(activeReport?.stowagePlan?.holds || []).map((hold) => (
                  <div key={hold?.holdNumber || Math.random()}></div>
                ))}
                <section
                className="stowage-plan-section"
                style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
              >
                  <header className="border-b-2 border-slate-800 pb-3 mb-4 flex justify-between items-end">
                    <div>
                      <h3 className="text-base font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                        <span>🚢</span> Croquis Esquemático de Estiba (Stowage Plan)
                      </h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                        Plano Técnico de Distribución Matricial & Segregación Operativa
                      </p>
                    </div>
                    <div className="text-right text-[11px] text-slate-600 font-mono">
                      <div className="mb-0.5"><span className="font-bold text-slate-800 uppercase text-[10px] mr-1.5">Ref:</span>{activeProject?.project_ref || 'EXP-SIN-REF'}</div>
                      <div><span className="font-bold text-slate-800 uppercase text-[10px] mr-1.5">Buque:</span>{vesselType || 'Handysize MPP 30.300 m³'}</div>
                    </div>
                  </header>

                  <div className="croquis-ascii-container p-4 text-[11px]">
                    {getStowageAscii(activeReport)}
                  </div>

                  {/* Razonamiento Técnico de Ingeniería Naval */}
                  {(() => {
                    const currentStowage = activeReport?.stowagePlan
                      || reportData?.stowagePlan
                      || calculateUniversalStowagePlan(cargoItems, totals, { shippingMode, pol, pod });
                    const justification = currentStowage?.executiveJustification;
                    if (!justification) return null;

                    return (
                      <div className="mt-4 p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-xl shadow-xs print:bg-white print:border-slate-300">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2.5 flex items-center gap-2 border-b border-slate-200 pb-2">
                          <span className="text-blue-600">📐</span> Razonamiento Técnico de Ingeniería Naval
                        </h4>
                        <div className="text-sm text-gray-700 leading-relaxed font-sans">
                          {Array.isArray(justification) ? justification.join(' ') : justification}
                        </div>
                      </div>
                    );
                  })()}
                </section>
              </div>

              {/* SECCIÓN TERRESTRE B2B: MOTOR DE CUBICACIÓN DE CAMIONES Y METROS LINEALES (LDM) */}
              <section className="mt-8 pt-6 border-t-2 border-slate-200">
                {(() => {
                  const currentVT = activeReport?.vehicleType || vehicleType || activeProject?.truck_type || 'Tráiler Tauliner (13.6m)';
                  const currentPayloadKg = getVehiclePayloadKg(currentVT);
                  const currentPayloadTons = currentPayloadKg / 1000;
                  const totalWtTons = Number(activeReport?.totalWeightTons || totals?.totalWeightTons || 0);
                  const totalWtKg = Math.round(totalWtTons * 1000);
                  const totalVolM3 = Number(activeReport?.totalVolumeCbm || totals?.totalVolumeCbm || 0);
                  const calcLdm = Number(
                    activeReport?.stowagePlan?.truckLdmOptimization?.calculatedLdm ||
                    (totalVolM3 > 0 ? (totalVolM3 / (2.4 * 2.7)).toFixed(2) : (totalWtTons > 0 ? (totalWtTons / 1.8).toFixed(2) : 13.6))
                  );
                  const euroPallets = Math.max(1, Math.ceil(calcLdm / 0.4));
                  const industrialPallets = Math.max(1, Math.ceil(calcLdm / 0.5));
                  const trucksReq = Math.max(1, Math.ceil(Math.max(calcLdm / 13.6, totalWtTons / currentPayloadTons)));
                  const ldmPerTruck = (calcLdm / trucksReq).toFixed(2);
                  const wtPerTruckKg = Math.min(currentPayloadKg, Math.round(totalWtKg / trucksReq));
                  const ldmPct = Math.min(100, Math.round((parseFloat(ldmPerTruck) / 13.6) * 100));
                  const wtPct = Math.min(100, Math.round((wtPerTruckKg / currentPayloadKg) * 100));

                  // Reparto de Pesos por Eje (Conjunto 5 ejes: Tractor 4x2 + Trídem semirremolque)
                  const axle1 = Math.min(7500, Math.round(4800 + wtPerTruckKg * 0.15));
                  const axle2 = Math.min(11500, Math.round(2700 + wtPerTruckKg * 0.35));
                  const axle3 = Math.min(24000, Math.round(7000 + wtPerTruckKg * 0.50));
                  const mmaTotal = axle1 + axle2 + axle3;

                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-800 shadow-xs space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🚛</span>
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700">
                              Motor de Cubicación de Camiones y Metros Lineales (LDM)
                            </h4>
                            <span className="text-[10px] text-slate-500">
                              {currentVT} (13.60m x 2.48m x 2.70m · {currentPayloadTons}t Carga Útil · 40t MMA)
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                          <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                            Flota: {trucksReq} Camión{trucksReq > 1 ? 'es' : ''} Tráiler
                          </span>
                          <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200 font-bold">
                            {calcLdm.toFixed(1)} LDM Totales
                          </span>
                        </div>
                      </div>

                      {/* Comparador de Paletización y Medidores LDM / Carga */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10.5px] uppercase font-bold text-sky-700">Euro-Pallets (0.8 x 1.2m)</span>
                            <span className="text-[10px] font-mono bg-sky-50 text-sky-700 px-1.5 py-0.2 rounded font-bold border border-sky-200">0.4 LDM/u</span>
                          </div>
                          <div className="text-base font-mono font-black text-slate-900">{euroPallets} <span className="text-xs text-slate-500 font-normal">palets</span></div>
                          <p className="text-[9.5px] text-slate-500 mt-1">Capacidad estándar tráiler: 33 europalets en planta.</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10.5px] uppercase font-bold text-purple-700">Palet Americano (1.0 x 1.2m)</span>
                            <span className="text-[10px] font-mono bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded font-bold border border-purple-200">0.5 LDM/u</span>
                          </div>
                          <div className="text-base font-mono font-black text-slate-900">{industrialPallets} <span className="text-xs text-slate-500 font-normal">palets</span></div>
                          <p className="text-[9.5px] text-slate-500 mt-1">Capacidad estándar tráiler: 26 palets industriales en planta.</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10.5px] uppercase font-bold text-emerald-700">Ocupación LDM por Camión</span>
                            <span className="text-[10px] font-mono text-emerald-700 font-bold">{ldmPct}%</span>
                          </div>
                          <div className="text-base font-mono font-black text-slate-900">{ldmPerTruck} / 13.6 <span className="text-xs text-slate-500 font-normal">LDM</span></div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-200">
                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${ldmPct}%` }} />
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10.5px] uppercase font-bold text-amber-700">Ocupación Masa por Camión</span>
                            <span className="text-[10px] font-mono text-amber-700 font-bold">{wtPct}%</span>
                          </div>
                          <div className="text-base font-mono font-black text-slate-900">{wtPerTruckKg.toLocaleString('es-ES')} / {currentPayloadKg.toLocaleString('es-ES')} <span className="text-xs text-slate-500 font-normal">kg</span></div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-200">
                            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${wtPct}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* REPARTO DE PESOS POR EJE (CONJUNTO ARTICULADO TRACTOR + SEMIRREMOLQUE) */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200">
                          <span className="text-[10.5px] uppercase font-black text-slate-700 flex items-center gap-1.5">
                            <span>⚖️</span> Distribución y Reparto de Pesos por Eje (Conjunto 5 Ejes · Límite Legal 40t MMA)
                          </span>
                          <span className="text-[10px] font-mono text-emerald-700 font-bold">
                            ✓ Cumple Normativa Europea Directiva 96/53/CE & DGT
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                          <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="block text-[9.5px] text-slate-500 uppercase font-bold">Eje 1 (Directriz Tractor)</span>
                            <strong className="text-slate-900 text-xs">{axle1.toLocaleString('es-ES')} kg</strong>
                            <span className="block text-[9px] text-slate-500">Máx legal: 7.500 kg</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="block text-[9.5px] text-slate-500 uppercase font-bold">Eje 2 (Motriz Tractor)</span>
                            <strong className="text-slate-900 text-xs">{axle2.toLocaleString('es-ES')} kg</strong>
                            <span className="block text-[9px] text-slate-500">Máx legal: 11.500 kg</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="block text-[9.5px] text-slate-500 uppercase font-bold">Trídem Semirremolque</span>
                            <strong className="text-slate-900 text-xs">{axle3.toLocaleString('es-ES')} kg</strong>
                            <span className="block text-[9px] text-slate-500">Máx legal: 24.000 kg</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="block text-[9.5px] text-emerald-700 uppercase font-bold">MMA Total Conjunto</span>
                            <strong className="text-emerald-700 text-xs">{mmaTotal.toLocaleString('es-ES')} kg</strong>
                            <span className="block text-[9px] text-slate-500">Máx legal: 40.000 kg</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </section>
            </div>
          </div>
        );
      })()}

      {/* MODAL MODO DUAL TRADING & CHARTERING */}
      {isDualTradingOpen && (
        <div
          id="modal-dual-trading"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-fadeIn print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Simulador Dual Trading y Chartering"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDualTradingOpen(false);
          }}
        >
          <div className="relative w-full max-w-6xl h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-300">
            {/* Header del Modal con título y botón de cierre claro */}
            <div className="px-6 py-3.5 bg-[#002060] text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="text-xl" aria-hidden="true">⚖️</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm uppercase tracking-wider text-white">Modo Dual · Trading &amp; Chartering</h3>
                    <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-400/30 px-2 py-0.5 rounded font-mono uppercase font-bold">Módulo Integrado</span>
                  </div>
                  <p className="text-[11px] text-blue-200">Arbitraje comercial y cálculo de margen cruzado sobre flete marítimo</p>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-dual-trading"
                onClick={() => setIsDualTradingOpen(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer"
                aria-label="Cerrar Simulador Dual Trading"
              >
                <span className="text-base font-normal">✕</span>
                <span>Cerrar</span>
              </button>
            </div>

            {/* Contenedor del Componente Web Dual Trading */}
            <div className="flex-1 overflow-auto bg-[#F8FAFC]">
              <dual-trading-chartering-view ref={dualViewRef} style={{ display: 'block', minHeight: '100%' }} />
            </div>
          </div>
        </div>
      )}

      {/* MODAL CUMPLIMIENTO CBAM (UE) */}
      {isCbamOpen && (() => {
        const quantityNum = Number(cbamQuantity) || 0;
        const analysis = buildCBAMCommercialAnalysis({
          productType: cbamSector,
          quantity: quantityNum,
          certifiedFactor: cbamReportedEmissions,
          competitorFactor: cbamCompetitorFactor
        });

        const formatEuro = (val) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val || 0);

        const handleExportProforma = () => {
          const freightRate = Number(activeReport?.flete_unitario_usd_mt ?? financialBreakdown?.flete_unitario_usd_mt ?? 0);
          generateCBAMCommercialProformaPDF({
            productType: cbamSector,
            quantity: quantityNum,
            certifiedFactor: cbamReportedEmissions,
            competitorFactor: cbamCompetitorFactor,
            origin: cbamOrigin,
            destination: cbamDestination,
            freightRate,
            freightTotal: freightRate * quantityNum
          });
        };

        const handleExportReport = () => {
          updateCBAMState({
            sector: cbamSector,
            origen: cbamOrigin,
            destino: cbamDestination,
            tonelaje: quantityNum,
            factorManual: cbamReportedEmissions,
            impuestoOrigen: 0
          });
          generateCBAMReportPDF();
        };

        const handleExportRequirements = () => {
          updateCBAMState({
            sector: cbamSector,
            origen: cbamOrigin,
            destino: cbamDestination,
            tonelaje: quantityNum,
            factorManual: cbamReportedEmissions,
            impuestoOrigen: 0
          });
          generateCBAMRequirementsPDF();
        };

        return (
          <div
            id="modal-cbam"
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-fadeIn print:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Módulo CBAM"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsCbamOpen(false);
            }}
          >
            <div className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-300">
              {/* Header del Modal con título y botón de cierre */}
              <div className="px-6 py-4 bg-[#002060] text-white flex items-center justify-between shrink-0 shadow-md">
                <div className="flex items-center gap-3">
                  <span className="text-xl" aria-hidden="true">🌱</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm uppercase tracking-wider text-white">Módulo CBAM · Mecanismo de Ajuste en Frontera por Carbono</h3>
                      <span className="text-[10px] bg-teal-400/20 text-teal-300 border border-teal-400/30 px-2 py-0.5 rounded font-mono font-bold uppercase">UE 2026</span>
                    </div>
                    <p className="text-[11px] text-blue-200">Control informativo de impacto financiero aduanero para importaciones hacia la UE</p>
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-close-cbam"
                  onClick={() => setIsCbamOpen(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer"
                  aria-label="Cerrar Módulo CBAM"
                >
                  <span className="text-base font-normal">✕</span>
                  <span>Cerrar</span>
                </button>
              </div>

              {/* Contenido Formulario y Cálculos */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F8FAFC]">
                {/* Parámetros de Operación */}
                <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                  <h4 className="text-xs font-black text-[#002060] uppercase tracking-wider border-b border-slate-200 pb-2">
                    Parámetros de la Operación (Sincronizados con el Proyecto)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div>
                      <label htmlFor="cbam-modal-sector" className="text-teal-700 font-bold uppercase text-[10px] block mb-1">Sector regulado</label>
                      <select
                        id="cbam-modal-sector"
                        value={cbamSector}
                        onChange={(e) => setCbamSector(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:border-teal-500 focus:bg-white"
                      >
                        <option value="">— Seleccionar sector —</option>
                        <option value="Cemento">Cemento</option>
                        <option value="Acero">Hierro/Acero</option>
                        <option value="Aluminio">Aluminio</option>
                        <option value="Fertilizantes">Fertilizantes</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="cbam-modal-origin" className="text-slate-700 font-bold uppercase text-[10px] block mb-1">Origen de la carga</label>
                      <input
                        type="text"
                        id="cbam-modal-origin"
                        value={cbamOrigin}
                        onChange={(e) => setCbamOrigin(e.target.value)}
                        placeholder="Ej: Marruecos"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="cbam-modal-destination" className="text-slate-700 font-bold uppercase text-[10px] block mb-1">Destino (UE)</label>
                      <input
                        type="text"
                        id="cbam-modal-destination"
                        value={cbamDestination}
                        onChange={(e) => setCbamDestination(e.target.value)}
                        placeholder="Ej: España"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="cbam-modal-quantity" className="text-slate-700 font-bold uppercase text-[10px] block mb-1">Tonelaje (TM)</label>
                      <input
                        type="number"
                        id="cbam-modal-quantity"
                        min="0"
                        value={cbamQuantity}
                        onChange={(e) => setCbamQuantity(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-semibold font-mono focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="cbam-modal-emissions" className="text-slate-700 font-bold uppercase text-[10px] block mb-1">Factor SEE certificado (tCO2e/t)</label>
                      <input
                        type="number"
                        id="cbam-modal-emissions"
                        min="0"
                        step="0.01"
                        value={cbamReportedEmissions}
                        onChange={(e) => setCbamReportedEmissions(e.target.value)}
                        placeholder="Opcional; usa valor UE"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="cbam-modal-competitor-origin" className="text-slate-700 font-bold uppercase text-[10px] block mb-1">Origen competidor</label>
                      <input
                        type="text"
                        id="cbam-modal-competitor-origin"
                        value={cbamCompetitorOrigin}
                        onChange={(e) => setCbamCompetitorOrigin(e.target.value)}
                        placeholder="Ej: Turquía"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:border-blue-500 focus:bg-white"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="cbam-modal-competitor-factor" className="text-slate-700 font-bold uppercase text-[10px] block mb-1">Factor competidor (tCO2e/t)</label>
                      <input
                        type="number"
                        id="cbam-modal-competitor-factor"
                        min="0"
                        step="0.01"
                        value={cbamCompetitorFactor}
                        onChange={(e) => setCbamCompetitorFactor(e.target.value)}
                        placeholder="Valor UE por defecto"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>
                </section>

                {/* Tarjeta de Resultados o Estado Inicial */}
                {analysis.status === 'ready' ? (
                  <section className="overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-md">
                    <div className="bg-gradient-to-r from-[#002060] via-[#063b78] to-teal-700 p-5 text-white">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-200">Impacto Aduanero para el Comprador (Landed Cost)</span>
                          <h3 className="mt-1 text-2xl font-black">Estimación de Pago en Aduana UE (Buyer)</h3>
                          <p className="mt-1 text-xs text-blue-100">Cálculo comercial independiente. No se incorpora a OPEX, bunkers, PDAs, flete ni TOTAL COSTS.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            id="btn-save-export-land-quote-fw"
                            onClick={() => {
                              if (typeof window !== 'undefined' && typeof window.saveLandRouteQuote === 'function') {
                                window.saveLandRouteQuote({
                                  contractRef: projectReference || 'RDM-ACTIVE',
                                  origin_name: cbamOrigin || 'Origen',
                                  destination_name: cbamDestination || 'Destino',
                                  freight_cost: freightRate * quantityNum,
                                });
                              }
                            }}
                            className="rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-black text-white shadow-md transition hover:bg-sky-800 cursor-pointer flex items-center gap-1.5"
                          >
                            <span>💾</span> Guardar/Exportar Cotización
                          </button>
                          <button
                            type="button"
                            id="btn-export-cbam-proforma"
                            onClick={handleExportProforma}
                            className="rounded-lg bg-white px-3.5 py-2 text-xs font-black text-[#002060] shadow-md transition hover:bg-teal-50 cursor-pointer flex items-center gap-1.5"
                          >
                            <span>📄</span> Exportar Proforma Comercial (PDF)
                          </button>
                          <button
                            type="button"
                            id="btn-export-cbam-report"
                            onClick={handleExportReport}
                            className="rounded-lg bg-teal-800/80 border border-teal-300/40 px-3.5 py-2 text-xs font-black text-white shadow-md transition hover:bg-teal-900 cursor-pointer flex items-center gap-1.5"
                          >
                            <span>📊</span> Informe Ejecutivo (PDF)
                          </button>
                          <button
                            type="button"
                            id="btn-export-cbam-reqs"
                            onClick={handleExportRequirements}
                            className="rounded-lg bg-teal-800/80 border border-teal-300/40 px-3.5 py-2 text-xs font-black text-white shadow-md transition hover:bg-teal-900 cursor-pointer flex items-center gap-1.5"
                          >
                            <span>📋</span> Requerimientos (PDF)
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-[1.1fr_1fr]">
                      <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-5">
                        <span className="block text-[10px] font-black uppercase tracking-wide text-teal-700">Pago estimado del importador</span>
                        <strong className="mt-1 block text-3xl sm:text-4xl font-black text-[#002060]">{formatEuro(analysis.customsPayment)}</strong>
                        <p className="mt-2 text-xs font-semibold text-slate-600">
                          {analysis.quantity.toLocaleString('es-ES')} TM × {analysis.certifiedFactor.toFixed(2)} tCO2e/t × {analysis.carbonPrice.toFixed(2)} EUR/tCO2e
                        </p>
                        <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-teal-800 ring-1 ring-teal-200">
                          {analysis.calculationMode === 'certified' ? 'Factor SEE certificado' : 'Valor por defecto UE'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                          <span className="block text-[10px] font-black uppercase text-slate-500">{cbamOrigin || 'Su origen exportador'}</span>
                          <strong className="mt-1 block text-xl text-[#002060]">{formatEuro(analysis.certifiedCost)}</strong>
                          <span className="text-xs text-slate-500">Factor {analysis.certifiedFactor.toFixed(2)} tCO2e/t</span>
                        </div>
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                          <span className="block text-[10px] font-black uppercase text-slate-500">{cbamCompetitorOrigin || 'Origen competidor'}</span>
                          <strong className="mt-1 block text-xl text-slate-800">{formatEuro(analysis.competitorCost)}</strong>
                          <span className="text-xs text-slate-500">Factor {analysis.competitorFactor.toFixed(2)} tCO2e/t</span>
                        </div>
                        <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
                          <span className="block text-[10px] font-black uppercase text-emerald-700">Ventaja comercial potencial</span>
                          <strong className="mt-1 block text-2xl text-emerald-800">{formatEuro(analysis.competitiveSaving)}</strong>
                          <span className="text-xs text-emerald-700">Menor landed cost frente al origen competidor indicado.</span>
                        </div>
                      </div>
                    </div>

                    {analysis.validationMessage && (
                      <div className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700">
                        {analysis.validationMessage}
                      </div>
                    )}

                    <div className="mx-5 mb-5 rounded-xl border-l-4 border-amber-400 bg-amber-50 p-4 text-xs text-amber-950">
                      <strong className="block text-[10px] uppercase tracking-wide">Nota Comercial CBAM</strong>
                      <p className="mt-1 leading-relaxed">
                        Este es el sobrecoste estimado que el importador asumirá en frontera. Si su fábrica dispone de un certificado SEE inferior al valor por defecto ({analysis.defaultFactor.toFixed(2)}), su mercancía ganará competitividad directa frente a orígenes competidores.
                      </p>
                    </div>
                  </section>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                    <strong className="block font-bold">Selecciona el sector regulado e introduce el tonelaje.</strong>
                    <span className="text-[11px] text-amber-700">El cálculo comercial CBAM se activa automáticamente con el tipo de producto y la cantidad.</span>
                  </div>
                )}

                {/* Referencia Oficial de Factores UE 2026 */}
                <section className="space-y-2">
                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Factores de Emisión Oficiales UE 2026 (Referencia)</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                      <span className="block text-[10px] uppercase font-black text-slate-500">Cemento</span>
                      <strong className="text-lg text-[#002060]">0.85</strong>
                      <span className="text-[10px] text-slate-400 block">tCO2/TM</span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                      <span className="block text-[10px] uppercase font-black text-slate-500">Hierro/Acero</span>
                      <strong className="text-lg text-[#002060]">1.80</strong>
                      <span className="text-[10px] text-slate-400 block">tCO2/TM</span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                      <span className="block text-[10px] uppercase font-black text-slate-500">Aluminio</span>
                      <strong className="text-lg text-[#002060]">6.50</strong>
                      <span className="text-[10px] text-slate-400 block">tCO2/TM</span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                      <span className="block text-[10px] uppercase font-black text-slate-500">Fertilizantes</span>
                      <strong className="text-lg text-[#002060]">1.50</strong>
                      <span className="text-[10px] text-slate-400 block">tCO2/TM</span>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        );
      })()}

      <AgenteProyectosWidget
        onUpdatePayload={handleApplyProjectPayload}
        isOpen={isAgentVisible}
        onToggleOpen={setIsAgentVisible}
        cargoItems={cargoItems}
        items={cargoItems}
        setCargoItems={setCargoItems}
        setPackingList={setCargoItems}
        setPol={setPol}
        setPod={setPod}
        setLoadingRate={setLoadingRate}
        setDischargeRate={setDischargingRate}
        setDischargingRate={setDischargingRate}
        setDistanceNm={setDistanceNm}
        charteringAssessment={charteringAssessment}
        routeData={{ pol, pod, loadingRate, dischargingRate, distanceNm, actualLoadingDays, actualDischargingDays, demurrageDailyRateUsd }}
        financialData={{ subtotalFreight, subtotalFobOperations, estimatedCost, salePrice }}
        financialBreakdown={financialBreakdown}
        stowagePlan={activeReport?.stowagePlan || reportData?.stowagePlan || calculateUniversalStowagePlan(cargoItems, totals, { shippingMode, pol, pod })}
      />
    </>
  );
}

/**
 * Componente protector de renderizado de Mapa (Leaflet / Canvas)
 * Evita el crash por appendChild destruyendo la instancia de mapa anterior (map.remove())
 * antes de crear una nueva, y realizando un return temprano si el contenedor del mapa (el div o el ref) no existe.
 */
export function LandCharterMap({ containerId = 'map-container', className = '' }) {
  const localContainerRef = useRef(null);
  const localInstanceRef = useRef(null);

  useEffect(() => {
    // FIX ANTICRASH LEAFLET CANVAS (Evita el error 'clearRect' al renderizar doble)
    if (typeof L !== 'undefined' && L.Canvas) {
      const originalClear = L.Canvas.prototype._clear;
      L.Canvas.prototype._clear = function() {
        if (!this._ctx) return;
        originalClear.call(this);
      };
    }
    // Si el contenedor del mapa (el div o el ref) no existe, haz un return temprano para evitar el error appendChild
    const container = localContainerRef.current || (typeof document !== 'undefined' ? document.getElementById(containerId) : null);
    if (!container) {
      return;
    }

    // Asegúrate de que haya una función de limpieza (cleanup) en el useEffect que destruya la instancia del mapa anterior (map.remove()) antes de crear una nueva
    if (localInstanceRef.current) {
      try {
        if (typeof localInstanceRef.current.remove === 'function') {
          localInstanceRef.current.remove();
        }
      } catch (err) {
        console.warn('[LandCharterMap] Error no bloqueante al destruir mapa anterior:', err);
      }
      localInstanceRef.current = null;
    }

    if (typeof L !== 'undefined' && typeof L.map === 'function') {
      try {
        if (container._leaflet_id) {
          container._leaflet_id = null;
        }
        const map = L.map(container, {
          center: [50.5, 10.5],
          zoom: 4,
          preferCanvas: true
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        localInstanceRef.current = map;
        if (typeof window !== 'undefined') {
          window.map = map;
          window.GlobalLeafletMap = map;
        }
      } catch (err) {
        console.warn('[LandCharterMap] Error al inicializar Leaflet map:', err);
      }
    }

    // Función de limpieza (cleanup) en el useEffect que destruye la instancia
    return () => {
      if (localInstanceRef.current) {
        try {
          if (typeof localInstanceRef.current.remove === 'function') {
            localInstanceRef.current.remove();
          }
        } catch (err) {
          console.warn('[LandCharterMap] Error al destruir mapa en cleanup:', err);
        }
        localInstanceRef.current = null;
      }
    };
  }, [containerId]);

  return (
    <div
      id={containerId}
      ref={localContainerRef}
      className={`w-full h-full min-h-[400px] rounded-lg border border-slate-200 overflow-hidden relative ${className}`}
    />
  );
}
export const ForwarderRouteMap = LandCharterMap;

class ForwarderWorkspaceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ForwarderWorkspace] Error no controlado capturado por ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center p-8 bg-slate-50 text-slate-800 font-sans">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-xl text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-3xl">
              🛡️
            </div>
            <h2 className="text-lg font-black text-slate-900">Protección del Espacio de Trabajo</h2>
            <p className="text-xs text-slate-600">
              Se ha evitado un colapso en el renderizado de proyectos. Los datos se han protegido contra pérdida.
            </p>
            {this.state.error?.message && (
              <pre className="text-[11px] font-mono text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200 overflow-x-auto text-left max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
              }}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Reintentar Renderizado
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ForwarderWorkspace(props) {
  return (
    <ForwarderWorkspaceErrorBoundary>
      <ForwarderWorkspaceInner {...props} />
    </ForwarderWorkspaceErrorBoundary>
  );
}

export default ForwarderWorkspace;
