let lastSyncFailure = null;

function readValue(value) {
    return value ?? '';
}

function readSyncId(rawData) {
    const syncid = rawData?.operation?.syncid;
    if (syncid === null || syncid === undefined) return '';
    return String(syncid).trim();
}

function recordSyncFailure(stage, error) {
    try {
        lastSyncFailure = Object.freeze({
            stage,
            message: error instanceof Error ? error.message : String(error ?? 'Unknown sync failure'),
            timestamp: new Date().toISOString(),
        });
    } catch {
        lastSyncFailure = null;
    }
}

export function getDataBridgeSyncDiagnostics() {
    return lastSyncFailure ? { ...lastSyncFailure } : null;
}

export function buildDataBridgeSyncPayload(rawData = {}, timestamp = new Date().toISOString()) {
    const operation = rawData.operation ?? {};
    const cargo = rawData.cargo ?? {};
    const trading = rawData.trading ?? {};
    const route = rawData.route ?? {};
    const laycan = rawData.laycan ?? {};
    const chartering = rawData.chartering ?? {};
    const result = rawData.result ?? {};

    return {
        type: 'fleet',
        syncId: readSyncId(rawData),
        operation: {
            id: readValue(operation.id),
            timestamp,
            status: 'finalized',
            source: 'Land Charter Core PRO - Dual Mode',
        },
        trading_terms: {
            cargo_qty_mt: readValue(cargo.tonnage),
            tolerance_type: readValue(cargo.toleranceType),
            tolerance_percentage: readValue(cargo.tolerance),
            price_fob_usd: readValue(trading.fobPrice),
            price_cif_target_usd: readValue(trading.cifPrice),
        },
        chartering_terms: {
            load_port: readValue(route.loadPort),
            discharge_port: readValue(route.dischargePort),
            laycan_start: readValue(laycan.startDate),
            laycan_end: readValue(laycan.endDate),
            fair_freight_usd: readValue(chartering.fairFreight),
        },
        financial_recap: {
            net_margin_usd: readValue(result.netMargin),
            cross_viability: true,
        },
    };
}

export async function syncDualTradingChartering(rawData = {}, options = {}) {
    const syncid = readSyncId(rawData);
    if (!syncid || options.enabled === false) return false;

    const url = String(options.url ?? (import.meta.env && import.meta.env.VITE_DATA_BRIDGE_URL) ?? '').trim();
    const token = String(options.token ?? (import.meta.env && import.meta.env.VITE_DATA_BRIDGE_TOKEN) ?? '').trim();
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    const logger = options.logger ?? console;
    const timestamp = typeof options.timestamp === 'string'
        ? options.timestamp
        : new Date().toISOString();

    try {
        if (!url) {
            logger.warn('[Data Bridge] VITE_DATA_BRIDGE_URL no está configurada; se omite el Live Sync.');
            return false;
        }
        if (typeof fetchImpl !== 'function') return false;
        await Promise.resolve();
        logger.log('[DEBUG] Enviando a Gatekeeper:', url);
        const response = await fetchImpl(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(buildDataBridgeSyncPayload(rawData, timestamp)),
            keepalive: true,
        });
        const responseStatus = `${response?.status ?? ''} ${response?.statusText ?? ''}`.trim();
        logger.log('[DEBUG] Respuesta de Gatekeeper:', response, responseStatus);
        if (response?.status === 200) void globalThis.revalidateDataBridgeConnectionState?.();
        return response?.status === 200;
    } catch (error) {
        recordSyncFailure('post', error);
        return false;
    }
}

export const DEFAULT_DATA_BRIDGE_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

function sanitizeBaseUrl(candidate) {
    if (!candidate || typeof candidate !== 'string') return '';
    const trimmed = candidate.trim();
    if (!trimmed) return '';
    try {
        const parsed = new URL(trimmed);
        return parsed.origin;
    } catch {
        return trimmed.replace(/\/+$/, '');
    }
}

export function resolveDataBridgeBaseUrl(overrideUrl = '') {
    if (typeof overrideUrl === 'string' && overrideUrl.trim()) {
        return sanitizeBaseUrl(overrideUrl);
    }
    if (typeof window !== 'undefined') {
        const win = window;
        const candidate = win.URL_BASE_DATABRIDGE || win.DATA_BRIDGE_FRONTEND_URL || win.DATA_BRIDGE_BASE_URL || win.DATA_BRIDGE_URL;
        const sanitized = sanitizeBaseUrl(candidate);
        if (sanitized) return sanitized;
    }
    return DEFAULT_DATA_BRIDGE_BASE_URL;
}

export const URL_BASE_DATABRIDGE = resolveDataBridgeBaseUrl();

function parseLocalizedNumber(val, fallback = 0, decimals = 2) {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'number') {
        if (!Number.isFinite(val)) return fallback;
        return Number(val.toFixed(decimals));
    }
    let str = String(val).trim();
    if (!str) return fallback;
    if (str.includes(',')) {
        str = str.replace(/\./g, '').replace(',', '.');
    }
    const cleaned = str.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    if (!Number.isFinite(num)) return fallback;
    return Number(num.toFixed(decimals));
}

export function extractActiveSessionReference(options = {}) {
    if (typeof options.reference === 'string' && options.reference.trim()) {
        return options.reference.trim();
    }
    if (typeof window !== 'undefined') {
        if (window.location && window.location.search) {
            const urlParams = new URLSearchParams(window.location.search);
            const refFromUrl = urlParams.get('ref') || urlParams.get('contract_ref') || urlParams.get('reference') || urlParams.get('target_session_id');
            if (refFromUrl && refFromUrl.trim()) {
                return refFromUrl.trim();
            }
        }
        if (typeof window.getActiveContractRef === 'function') {
            try {
                const ref = window.getActiveContractRef();
                if (ref && String(ref).trim()) return String(ref).trim();
            } catch (_) {}
        }
        if (window.ContractRefManager && typeof window.ContractRefManager.getActiveContractRef === 'function') {
            try {
                const ref = window.ContractRefManager.getActiveContractRef();
                if (ref && String(ref).trim()) return String(ref).trim();
            } catch (_) {}
        }
        if (window.State && window.State.reference) {
            return String(window.State.reference).trim();
        }
        const quickRefInput = document.getElementById('quick-ref');
        if (quickRefInput && quickRefInput.value && quickRefInput.value.trim()) {
            return quickRefInput.value.trim();
        }
    }
    return 'RDM/2026-0001';
}

export function buildRoadSyncPayload(options = {}) {
    const reference = extractActiveSessionReference(options);

    // 1. Total Trucks (total_trucks)
    let rawTrucks = options.total_trucks;
    if (rawTrucks === undefined || rawTrucks === null) {
        if (typeof window !== 'undefined' && window.State) {
            rawTrucks = window.State.total_trucks ?? window.State.trucks_needed ?? window.State.trucksNeeded;
        }
    }
    if ((rawTrucks === undefined || rawTrucks === null || rawTrucks === '') && typeof document !== 'undefined') {
        const fleetEl = document.getElementById('val-flota-total') || document.getElementById('camion-tolva-camiones-totales');
        if (fleetEl && fleetEl.textContent) {
            rawTrucks = fleetEl.textContent;
        }
    }
    if (rawTrucks === undefined || rawTrucks === null || rawTrucks === '' || Number(rawTrucks) <= 0) {
        const cargo = Number(typeof window !== 'undefined' ? (window.State?.cargoQty ?? window.State?.cargo ?? 0) : 0);
        const capacity = Number(typeof window !== 'undefined' ? (window.State?.truckPayloadCapacity ?? 24) : 24);
        if (cargo > 0 && capacity > 0) {
            rawTrucks = Math.ceil(cargo / capacity);
        }
    }
    const total_trucks = Math.max(0, Math.round(parseLocalizedNumber(rawTrucks, 1, 0)));

    // 2. Road Transit Days (road_transit_days)
    let rawTransitDays = options.road_transit_days;
    if (rawTransitDays === undefined || rawTransitDays === null) {
        if (typeof window !== 'undefined' && window.State) {
            rawTransitDays = window.State.road_transit_days ?? window.State.roadTransitDays;
        }
    }
    if ((rawTransitDays === undefined || rawTransitDays === null) && typeof window !== 'undefined' && typeof window.calculateTachographTimes === 'function') {
        try {
            const tachograph = window.calculateTachographTimes();
            if (tachograph && tachograph.tiempo_total_dias !== undefined) {
                rawTransitDays = tachograph.tiempo_total_dias;
            }
        } catch (_) {}
    }
    if ((rawTransitDays === undefined || rawTransitDays === null || rawTransitDays === '') && typeof document !== 'undefined') {
        const transitEl = document.getElementById('tacografo-total-transit-days');
        if (transitEl && transitEl.textContent) {
            rawTransitDays = transitEl.textContent;
        }
    }
    if ((rawTransitDays === undefined || rawTransitDays === null) && typeof window !== 'undefined' && window.State) {
        rawTransitDays = window.State.seaDays ?? window.State.totalDays;
    }
    const road_transit_days = Math.max(0, parseLocalizedNumber(rawTransitDays, 0, 2));

    // 3. Road Net Margin (road_net_margin)
    let rawMargin = options.road_net_margin;
    if (rawMargin === undefined || rawMargin === null) {
        if (typeof window !== 'undefined' && window.State) {
            rawMargin = window.State.road_net_margin ?? window.State.netProfitOwner ?? window.State.tceTotal ?? window.State.finalNetProfitOwner;
        }
    }
    if ((rawMargin === undefined || rawMargin === null || rawMargin === '') && typeof document !== 'undefined') {
        const marginEl = document.getElementById('val-margen-neto-proyecto') || document.getElementById('res-net-profit-owner');
        if (marginEl && marginEl.textContent) {
            rawMargin = marginEl.textContent;
        }
    }
    const road_net_margin = parseLocalizedNumber(rawMargin, 0, 2);

    const payload = {
        project_ref: String(reference),
        reference: String(reference),
        total_trucks,
        road_transit_days,
        road_net_margin,
    };

    // 4. Land Freight Cost (land_freight_cost)
    let rawFreightCost = options.land_freight_cost ?? options.freight_cost ?? options.cost;
    if (rawFreightCost === undefined || rawFreightCost === null) {
        if (typeof window !== 'undefined' && window.State) {
            rawFreightCost = window.State.land_freight_cost ?? window.State.totalTripCost ?? window.State.costTotal ?? window.State.freight_cost;
        }
    }
    if ((rawFreightCost === undefined || rawFreightCost === null || rawFreightCost === '') && typeof document !== 'undefined') {
        const costEl = document.getElementById('res-cost-total');
        if (costEl && costEl.textContent) {
            rawFreightCost = costEl.textContent;
        }
    }
    const land_freight_cost = parseLocalizedNumber(rawFreightCost, 0, 2);

    // 5. Valor Total Mercancía USD (valor_total_mercancia_usd)
    let rawGoodsValue = options.valor_total_mercancia_usd ?? options.goodsValue ?? options.merchandiseValue;
    if (rawGoodsValue === undefined || rawGoodsValue === null) {
        if (typeof window !== 'undefined' && window.State) {
            rawGoodsValue = window.State.valor_total_mercancia_usd ?? window.State.goodsValue ?? window.State.merchandiseValue ?? window.State.cargoValue;
        }
    }
    const valor_total_mercancia_usd = parseLocalizedNumber(rawGoodsValue, 0, 2);

    if (options.land_freight_cost !== undefined || options.freight_cost !== undefined || land_freight_cost > 0) {
        payload.land_freight_cost = land_freight_cost;
    }
    if (options.valor_total_mercancia_usd !== undefined || options.goodsValue !== undefined || valor_total_mercancia_usd > 0) {
        payload.valor_total_mercancia_usd = valor_total_mercancia_usd;
    }

    // 6. Services / Line items
    const rawServices = options.services ?? options.line_items;
    if (Array.isArray(rawServices) && rawServices.length > 0) {
        payload.services = rawServices;
        payload.line_items = rawServices;
    }

    // 7. Land Freight Sale (land_freight_sale)
    let rawFreightSale = options.land_freight_sale ?? options.targetSalePrice ?? options.sale;
    if (rawFreightSale === undefined || rawFreightSale === null) {
        if (typeof window !== 'undefined' && window.State) {
            rawFreightSale = window.State.land_freight_sale ?? window.State.salePrice ?? window.State.targetSalePrice;
        }
    }
    const land_freight_sale = parseLocalizedNumber(rawFreightSale, 0, 2);
    if (options.land_freight_sale !== undefined || land_freight_sale > 0) {
        payload.land_freight_sale = land_freight_sale;
    }

    // 8. Cargo Items / Packing List / Land Route (Non-destructive inheritance)
    const rawItems = options.items ?? options.cargo_items;
    if (Array.isArray(rawItems) && rawItems.length > 0) {
        payload.items = rawItems;
        payload.cargo_items = rawItems;
    }
    if (options.packing_list) {
        payload.packing_list = options.packing_list;
    }
    if (options.land_route) {
        payload.land_route = options.land_route;
    }

    return payload;
}

export function showSyncSuccessUI() {
    if (typeof document === 'undefined') return;

    // 1. Checkmark discreto en la cabecera
    const headerBadge = document.getElementById('header-sync-status-badge');
    if (headerBadge) {
        headerBadge.classList.remove('hidden');
        headerBadge.classList.add('inline-flex');
        headerBadge.setAttribute('data-synced-at', String(Date.now()));
    }

    // 2. Indicador tipo toast en la esquina inferior
    let toast = document.getElementById('road-sync-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'road-sync-toast';
        toast.className = 'fixed bottom-5 right-5 z-[250] flex items-center gap-2 rounded-lg bg-slate-900/95 border border-emerald-500/50 px-3.5 py-2 text-xs font-semibold text-emerald-300 shadow-xl backdrop-blur-sm transition-all duration-300 opacity-0 translate-y-3 pointer-events-none';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i><span id="road-sync-toast-text">Sincronizado</span>';
        document.body.appendChild(toast);
    }

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
            toast.classList.remove('opacity-0', 'translate-y-3', 'pointer-events-none');
            toast.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');
        });
    } else {
        toast.classList.remove('opacity-0', 'translate-y-3', 'pointer-events-none');
        toast.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');
    }

    if (typeof window !== 'undefined') {
        if (window._roadSyncToastTimer) clearTimeout(window._roadSyncToastTimer);
        window._roadSyncToastTimer = setTimeout(() => {
            if (toast) {
                toast.classList.add('opacity-0', 'translate-y-3', 'pointer-events-none');
                toast.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');
            }
        }, 3500);
    }
}

export async function syncRoadMetricsToBridge(options = {}) {
    const fetchImpl = options.fetchImpl ?? (typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : globalThis.fetch);
    const logger = options.logger ?? console;
    const method = String(options.method ?? 'POST').toUpperCase();

    const baseUrl = resolveDataBridgeBaseUrl(options.baseUrl || options.url);
    const endpoint = `${baseUrl}/api/projects/sync-road`;

    const payload = buildRoadSyncPayload(options);

    if (typeof window !== 'undefined') {
        window.lastDataBridgePayloadStr = window.lastDataBridgePayloadStr || '';
        const currentStr = JSON.stringify(payload);
        if (window.lastDataBridgePayloadStr === currentStr) {
            return { success: true, cached: true, payload };
        }
        window.lastDataBridgePayloadStr = currentStr;
    }

    try {
        if (typeof fetchImpl !== 'function') {
            logger.warn('[Data Bridge] fetch no disponible para sincronización inversa.');
            return { success: false, error: 'fetch not available', payload };
        }

        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
        };

        const response = await fetchImpl(endpoint, {
            method,
            headers,
            body: JSON.stringify(payload),
            keepalive: true,
        });

        const isOk = response ? (response.ok || response.status === 200 || response.status === 201 || response.status === 204) : false;

        if (!isOk) {
            const statusText = response ? `${response.status} ${response.statusText || ''}`.trim() : 'Sin respuesta';
            logger.warn(`[Data Bridge] Sincronización inversa no confirmada (${statusText})`);
            return { success: false, status: response?.status, payload };
        }

        logger.log('[Data Bridge] Volcado exitoso a /api/projects/sync-road:', payload);

        if (options.showUI !== false) {
            showSyncSuccessUI();
        }

        return { success: true, payload };
    } catch (error) {
        logger.warn('[Data Bridge] Excepción durante sincronización inversa:', error?.message || error);
        return { success: false, error: error?.message || String(error), payload };
    }
}

if (typeof window !== 'undefined') {
    window.syncRoadMetricsToBridge = syncRoadMetricsToBridge;
    window.buildRoadSyncPayload = buildRoadSyncPayload;
    window.showSyncSuccessUI = showSyncSuccessUI;
    window.URL_BASE_DATABRIDGE = window.URL_BASE_DATABRIDGE || URL_BASE_DATABRIDGE;
}
