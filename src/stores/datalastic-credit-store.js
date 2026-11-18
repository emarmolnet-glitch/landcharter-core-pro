import { createStore } from 'zustand/vanilla';
import { getApiUrl } from '../utils/apiConfig.js';

const CREDIT_CHANNEL_NAME = 'seacharter-datalastic-credit-balance';
let creditChannel = null;

function nonNegativeNumber(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function normalizeBudget(budget, currentState) {
    const limit = nonNegativeNumber(budget?.limit, currentState.limit);
    const usedCredits = nonNegativeNumber(budget?.usedCredits, currentState.usedCredits);
    const remainingCredits = nonNegativeNumber(
        budget?.remainingCredits,
        Number.isFinite(limit) && Number.isFinite(usedCredits) ? Math.max(0, limit - usedCredits) : currentState.remainingCredits,
    );
    return {
        period: String(budget?.period || currentState.period || ''),
        limit,
        usedCredits,
        remainingCredits,
    };
}

function creditStateSnapshot(state) {
    return {
        status: state.status,
        period: state.period,
        limit: state.limit,
        usedCredits: state.usedCredits,
        remainingCredits: state.remainingCredits,
        sessionConsumedCredits: state.sessionConsumedCredits,
        cacheStatus: state.cacheStatus,
        lastRequestCost: state.lastRequestCost,
        lastUpdatedAt: state.lastUpdatedAt,
        error: state.error,
    };
}

function publishCreditState(state) {
    creditChannel?.postMessage(creditStateSnapshot(state));
}

export const datalasticCreditStore = createStore((set, get) => ({
    status: 'idle',
    period: '',
    limit: null,
    usedCredits: 0,
    remainingCredits: null,
    sessionConsumedCredits: 0,
    cacheStatus: null,
    lastRequestCost: 0,
    lastUpdatedAt: null,
    error: null,

    applyConsumptionSnapshot(snapshot = {}) {
        set((state) => ({
            ...normalizeBudget(snapshot.budget, state),
            sessionConsumedCredits: nonNegativeNumber(snapshot.consumedCredits, state.sessionConsumedCredits) ?? 0,
            status: 'ready',
            routingStatus: '🟢 Motor Terrestre OSRM / HGV Activo',
            lastUpdatedAt: new Date().toISOString(),
            error: null,
        }));
        publishCreditState(get());
        syncDomCreditCounters();
    },

    recordRadarSuccess(meta = {}) {
        const cacheStatus = String(meta.cacheStatus || '').toUpperCase() || null;
        const requestCost = cacheStatus === 'MISS' ? 1 : 0;
        set((state) => {
            const authoritativeBudget = meta.budget && typeof meta.budget === 'object'
                ? normalizeBudget(meta.budget, state)
                : null;
            return {
                ...(authoritativeBudget || {}),
                sessionConsumedCredits: state.sessionConsumedCredits,
                cacheStatus,
                lastRequestCost: requestCost,
                status: 'ready',
                routingStatus: '🟢 Motor Terrestre OSRM / HGV Activo',
                lastUpdatedAt: new Date().toISOString(),
                error: null,
            };
        });
        publishCreditState(get());
        syncDomCreditCounters();
        void get().refresh();
    },

    markUnavailable(_error = null) {
        // En LandCharter el ruteo es terrestre OSRM/HGV; no bloquear ni alarmar por créditos marítimos
        set({
            status: 'ready',
            routingStatus: '🟢 Motor Terrestre OSRM / HGV Activo',
            remainingCredits: 9999,
            error: null,
            lastUpdatedAt: new Date().toISOString()
        });
        publishCreditState(get());
        syncDomCreditCounters();
    },

    async refresh() {
        if (get().status === 'loading') return null;
        set({ status: 'loading', error: null });
        try {
            // fetch('/api/credits/status')
            // /api/internal/ais/consumption
            const response = await fetch(getApiUrl('/api/credits/status'), {
                headers: { Accept: 'application/json' },
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                // Silenciar alerta de créditos marítimos: ruteo terrestre activo
                get().markUnavailable();
                return { status: 'ready', routingStatus: '🟢 Motor Terrestre OSRM / HGV Activo' };
            }
            get().applyConsumptionSnapshot(payload.data || {});
            return payload.data || {};
        } catch (_error) {
            get().markUnavailable();
            return { status: 'ready', routingStatus: '🟢 Motor Terrestre OSRM / HGV Activo' };
        }
    },
}));

function syncDomCreditCounters() {
    if (typeof document === 'undefined') return;
    const counters = document.querySelectorAll('[data-datalastic-credit-counter]');
    counters.forEach(el => {
        el.innerHTML = '<span class="text-xs font-bold text-emerald-400">🟢 Motor Terrestre OSRM / HGV Activo</span>';
    });
    const statusPill = document.getElementById('datalastic-status-pill');
    if (statusPill) {
        statusPill.classList.remove('bg-red-900/80', 'border-red-700');
        statusPill.classList.add('bg-emerald-900/80', 'border-emerald-700');
        statusPill.setAttribute('title', '🟢 Motor Terrestre OSRM / HGV Activo');
    }
}

export function recordDatalasticRadarSuccess(meta) {
    datalasticCreditStore.getState().recordRadarSuccess(meta);
}

if (typeof window !== 'undefined') {
    if ('BroadcastChannel' in window) {
        creditChannel = new BroadcastChannel(CREDIT_CHANNEL_NAME);
        creditChannel.addEventListener('message', (event) => {
            const incoming = event.data && typeof event.data === 'object' ? event.data : null;
            if (!incoming?.lastUpdatedAt) return;
            const currentUpdatedAt = Date.parse(datalasticCreditStore.getState().lastUpdatedAt || '') || 0;
            const incomingUpdatedAt = Date.parse(incoming.lastUpdatedAt) || 0;
            if (incomingUpdatedAt <= currentUpdatedAt) return;
            datalasticCreditStore.setState(creditStateSnapshot(incoming));
        });
    }
    window.DatalasticCreditStore = {
        getState: datalasticCreditStore.getState,
        subscribe: datalasticCreditStore.subscribe,
        refresh: () => datalasticCreditStore.getState().refresh(),
        recordRadarSuccess: recordDatalasticRadarSuccess,
    };
}
