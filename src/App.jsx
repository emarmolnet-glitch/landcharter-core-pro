import React, { useEffect, useRef, useState } from 'react';
import { HashRouter, HashRouter as BrowserRouter } from 'react-router-dom';
import { ForwarderWorkspace } from './components/ForwarderWorkspace.jsx';
import { getApiUrl } from './utils/apiConfig.js';

/**
 * Normalizes reference identifiers for cross-module session matching.
 */
export function normalizeSessionRef(value) {
  return String(value || '').trim().toUpperCase();
}

/**
 * Extracts active contract reference from window/storage state.
 */
export function getActiveSessionReference() {
  if (typeof window === 'undefined') return '';
  return normalizeSessionRef(
    window.ContractRefManager?.getActiveContractRef?.() ||
    window.ContractReference?.getActiveContractRef?.() ||
    window.getActiveContractRef?.() ||
    (typeof window.sessionStorage !== 'undefined' ? window.sessionStorage.getItem('active_contract_ref') : null) ||
    (typeof window.localStorage !== 'undefined' ? window.localStorage.getItem('active_contract_ref') : null) ||
    ''
  );
}

/**
 * Checks if target reference matches the active session.
 */
export function matchesActiveSession(targetRef) {
  const currentRef = getActiveSessionReference();
  const normalizedTarget = normalizeSessionRef(targetRef);
  if (!normalizedTarget) return true; // No target restriction means current session
  if (!currentRef) return true;
  return normalizedTarget === currentRef;
}

/**
 * Extracts IMO and optional target reference from heterogeneous payloads.
 */
export function extractImoAndReference(data) {
  if (!data) return null;

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (/^\d{7}$/.test(trimmed)) {
      return { imo: trimmed, reference: '' };
    }
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractImoAndReference(parsed);
      } catch (_) {}
    }
    return null;
  }

  if (typeof data !== 'object') return null;

  const targetRef = normalizeSessionRef(
    data.reference ||
    data.target_session_id ||
    data.targetSessionId ||
    data.target_session ||
    data.contractRef ||
    data.contract_ref ||
    data.session_id ||
    data.sessionId ||
    data.ref ||
    data.payload?.reference ||
    data.payload?.target_session_id ||
    ''
  );

  const imoCandidate = String(
    data.imo ||
    data.imo_number ||
    data.imoNumber ||
    data.pending_imo ||
    data.core_pro_pending_imo ||
    data.value ||
    data.vessel?.imo ||
    data.vessel?.imo_number ||
    data.payload?.imo ||
    data.payload?.vessel?.imo ||
    ''
  ).trim();

  if (imoCandidate && /^\d{7}$/.test(imoCandidate)) {
    return { imo: imoCandidate, reference: targetRef };
  }

  if (data.value && typeof data.value === 'object') {
    return extractImoAndReference(data.value);
  }
  if (typeof data.value === 'string' && data.value.trim().startsWith('{')) {
    try {
      return extractImoAndReference(JSON.parse(data.value));
    } catch (_) {}
  }

  return null;
}

/**
 * Reusable IMO hydration engine: updates React state, VoyageStore, GlobalStore and triggers fetchVesselByImo/fetchVesselSpecs.
 */
export function executeImoHydration(imoValue) {
  const cleanImo = String(imoValue || '').trim();
  if (!cleanImo || !/^\d{7}$/.test(cleanImo)) return false;

  const referenceManager = typeof window !== 'undefined'
    ? (window.ContractReference || window.ContractRefManager)
    : null;

  referenceManager?.setInjectionLock?.(true);

  try {
    // 1. Actualización nativa de estado en el input de Section 2 si existe
    const imoInput = typeof document !== 'undefined'
      ? (document.getElementById?.('vessel-identity-imo') ||
         document.getElementById?.('imo') ||
         (typeof document.querySelector === 'function' ? (document.querySelector('input[name="imo"]') || document.querySelector('input[name="imo_number"]') || document.querySelector('input[name="vessel_imo"]')) : null))
      : null;

    if (imoInput) {
      imoInput.value = cleanImo;
    }

    const altImoInput = typeof document !== 'undefined' && document.getElementById?.('imo') && document.getElementById?.('imo') !== imoInput
      ? document.getElementById?.('imo')
      : null;
    if (altImoInput) {
      altImoInput.value = cleanImo;
    }

    if (typeof window !== 'undefined' && typeof window.handleManualVesselUpdate === 'function') {
      window.handleManualVesselUpdate('imo', cleanImo);
    }

    const vesselData = { imo: cleanImo, imo_number: cleanImo, imoNumber: cleanImo };

    // 2. Sincronización en Contexto Global / Zustand / VoyageStore
    if (typeof window !== 'undefined' && typeof window.patchSection2Vessel === 'function') {
      window.patchSection2Vessel(vesselData);
    }

    if (typeof window !== 'undefined') {
      try {
        const vStore = window.VoyageStore?.getState?.() || window.useVoyageStore?.getState?.();
        vStore?.patchSection2Vessel?.(vesselData);
      } catch (_) {}
      if (window.GlobalStore) {
        window.GlobalStore.activeVessel = { ...(window.GlobalStore.activeVessel || {}), ...vesselData };
        window.GlobalStore.calculatorVessel = { ...(window.GlobalStore.calculatorVessel || {}), ...vesselData };
      }
    }

    // 3. Ejecutar la función o abrir el VesselDetailDrawer para revisión del fletador
    if (typeof window !== 'undefined') {
      if (typeof window.openVesselDetailDrawer === 'function') {
        // Consultar ficha y abrir drawer para revisión intermedia
        void fetch(getApiUrl(`/api/vessel/${encodeURIComponent(cleanImo)}`))
          .then((res) => res.json())
          .then((payload) => {
            if (payload?.success && payload.vessel) {
              window.openVesselDetailDrawer(payload.vessel, 'Data Bridge (Neon DB)');
            } else {
              window.openVesselDetailDrawer({ imo: cleanImo, imo_number: cleanImo }, 'Data Bridge (Broadcast)');
            }
          })
          .catch(() => {
            window.openVesselDetailDrawer({ imo: cleanImo, imo_number: cleanImo }, 'Data Bridge (Broadcast)');
          });
      } else {
        const fetchFn = (window.fetchVesselSpecs || window.fetchVesselByImo);
        if (typeof fetchFn === 'function') {
          void fetchFn(cleanImo);
        } else if (typeof fetch === 'function') {
          void fetch(getApiUrl(`/api/vessel/${encodeURIComponent(cleanImo)}`))
            .then((res) => res.json())
            .then((payload) => {
              if (payload?.success && payload.vessel) {
                const fullVessel = payload.vessel;
                try {
                  const vStore = window.VoyageStore?.getState?.() || window.useVoyageStore?.getState?.();
                  vStore?.patchSection2Vessel?.(fullVessel);
                } catch (_) {}
                if (window.GlobalStore) {
                  window.GlobalStore.activeVessel = { ...(window.GlobalStore.activeVessel || {}), ...fullVessel };
                  window.GlobalStore.calculatorVessel = { ...(window.GlobalStore.calculatorVessel || {}), ...fullVessel };
                }
                if (typeof window.applyDataBridgeHydrationToCalculator === 'function') {
                  window.applyDataBridgeHydrationToCalculator(fullVessel, { imo: cleanImo, imo_number: cleanImo });
                }
              }
            })
            .catch(() => {});
        }
      }
    }

    return true;
  } finally {
    if (referenceManager?.setInjectionLock) {
      setTimeout(() => referenceManager.setInjectionLock?.(false), 250);
    }
  }
}

/**
 * Global BroadcastChannel synchronization hook for SeaCharter Core PRO.
 * Listens for PING_SESSION events from Data Bridge or other tabs/windows
 * and responds with the active voyage/contract session reference.
 */
export function useSeaCharterSync() {
  const lastPersistedRef = useRef('');
  const isSavingRef = useRef(false);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') {
      return;
    }

    const channel = new BroadcastChannel('seacharter_sync_channel');
    console.log('[Core PRO] Canal de sincronización abierto');

    const persistActiveSessionToBackend = (ref, immediate = false) => {
      const normalized = String(ref || '').trim().toUpperCase();
      if (!normalized || typeof fetch !== 'function') return;

      // Only trigger if reference actually changed
      if (normalized === lastPersistedRef.current) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const executeSave = () => {
        if (isSavingRef.current) return;
        isSavingRef.current = true;

        if (typeof window.ContractRefManager?.persistSessionToDatabase === 'function') {
          window.ContractRefManager.persistSessionToDatabase(normalized, null, true)
            .then((data) => {
              if (data) {
                lastPersistedRef.current = normalized;
              }
            })
            .catch(() => {})
            .finally(() => { isSavingRef.current = false; });
        } else {
          fetch(getApiUrl('/api/app-state'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              id: 'current_session',
              key: 'current_session',
              session_ref: normalized,
              currentSessionRef: normalized,
              reference: normalized,
              timestamp: Date.now(),
            }),
          })
            .then((res) => {
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
              }
              return res.json();
            })
            .then((data) => {
              lastPersistedRef.current = normalized;
              console.log('[Core PRO] Sesión activa guardada en Neon:', normalized);
            })
            .catch((err) => {
              console.warn('[Core PRO] No se pudo persistir la sesión activa en backend:', err?.message || err);
            })
            .finally(() => { isSavingRef.current = false; });
        }
      };

      if (immediate) {
        executeSave();
      } else {
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          executeSave();
        }, 500);
      }
    };

    const initialRef = getActiveSessionReference();
    if (initialRef) {
      persistActiveSessionToBackend(initialRef);
    }

    channel.onmessage = (event) => {
      const data = event?.data;
      if (data?.type === 'PING_SESSION' || data === 'PING_SESSION') {
        const currentSessionRef = getActiveSessionReference();

        console.log('[Core PRO] PING recibido, respondiendo con:', currentSessionRef);
        channel.postMessage({
          type: 'CORE_SESSION_ACTIVE',
          reference: currentSessionRef,
        });

        if (currentSessionRef && currentSessionRef !== lastPersistedRef.current) {
          persistActiveSessionToBackend(currentSessionRef);
        }
      }
    };

    const handleContractChange = (e) => {
      const nextRef = e?.detail?.reference || e?.detail?.ref;
      if (nextRef) {
        persistActiveSessionToBackend(nextRef);
      }
    };

    if (typeof window.addEventListener === 'function') {
      window.addEventListener('contract-reference:changed', handleContractChange);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (typeof window.removeEventListener === 'function') {
        window.removeEventListener('contract-reference:changed', handleContractChange);
      }
      channel.close();
    };
  }, []);
}

/**
 * Hook for URL IMO parameter injection and automatic database vessel lookup.
 */
export function useUrlImoAutoLookup() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location?.search) return;

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const imoValue = searchParams.get('imo')?.trim() || '';

      if (imoValue && /^\d{7}$/.test(imoValue)) {
        // 2. INYECCIÓN DE ESTADO: Inyectar inmediatamente en Section 2
        const imoInput = document.getElementById('vessel-identity-imo');
        if (imoInput) {
          imoInput.value = imoValue;
        }

        if (typeof window.handleManualVesselUpdate === 'function') {
          window.handleManualVesselUpdate('imo', imoValue);
        }

        if (typeof window.patchSection2Vessel === 'function') {
          window.patchSection2Vessel({ imo: imoValue });
        }

        // 3. AUTO-DISPARO DE BÚSQUEDA: Ejecutar consulta existente en base de datos
        if (typeof window.fetchVesselByImo === 'function') {
          void window.fetchVesselByImo(imoValue);
        }

        // 4. LIMPIEZA DE URL: Limpiar parámetro imo para evitar repetición al recargar
        if (window.history?.replaceState && window.location?.href) {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('imo');
          const nextSearch = cleanUrl.searchParams.toString();
          const nextUrl = `${cleanUrl.pathname}${nextSearch ? `?${nextSearch}` : ''}${cleanUrl.hash}`;
          window.history.replaceState(window.history.state, '', nextUrl);
        }
      }
    } catch (_) {}
  }, []);
}

/**
 * Hook for background IMO injection via BroadcastChannels ('core_pro_channel', 'seacharter_sync_channel'),
 * localStorage ('core_pro_pending_imo'), and Neon DB polling.
 */
export function usePendingImoSync() {
  const processedKeysRef = useRef(new Set());
  const isPollingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Helper to discard and clean up pending IMO from storage and Neon
    const cleanupPendingImo = () => {
      try {
        if (typeof window.localStorage !== 'undefined') {
          window.localStorage.removeItem('core_pro_pending_imo');
          window.localStorage.removeItem('selected_imo');
          window.localStorage.removeItem('pending_imo');
          window.localStorage.removeItem('seacharter_pending_imo');
        }
      } catch (_) {}

      if (typeof fetch === 'function') {
        fetch(getApiUrl('/api/app-state?key=core_pro_pending_imo'), {
          method: 'DELETE',
          headers: { 'Accept': 'application/json' },
        }).catch(() => {});

        fetch(getApiUrl('/api/app-state?key=selected_imo'), {
          method: 'DELETE',
          headers: { 'Accept': 'application/json' },
        }).catch(() => {});

        fetch(getApiUrl('/api/app-state'), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ key: 'core_pro_pending_imo' }),
        }).catch(() => {});
      }
    };

    // Helper to process candidate message / item
    const processCandidate = (candidate, sourceKey = '') => {
      const extracted = extractImoAndReference(candidate);
      if (!extracted || !extracted.imo) return false;

      if (!matchesActiveSession(extracted.reference)) {
        return false;
      }

      const currentActiveRef = getActiveSessionReference();
      const dedupKey = `${currentActiveRef || 'ALL'}:${extracted.imo}:${sourceKey}`;

      if (processedKeysRef.current.has(dedupKey)) {
        return false;
      }

      processedKeysRef.current.add(dedupKey);

      // Inyectar en Sección 2 y disparar búsqueda en base de datos
      const hydrated = executeImoHydration(extracted.imo);
      if (hydrated) {
        cleanupPendingImo();
      }
      return hydrated;
    };

    // 1. Initial check from localStorage
    try {
      const storedImo = window.localStorage?.getItem('core_pro_pending_imo') ||
                        window.localStorage?.getItem('pending_imo') ||
                        window.localStorage?.getItem('seacharter_pending_imo');
      if (storedImo) {
        processCandidate(storedImo, 'localStorage:init');
      }
    } catch (_) {}

    // 2. Storage event listener for cross-tab localStorage changes
    const handleStorage = (event) => {
      if (!event) return;
      if (event.key === 'core_pro_pending_imo' || event.key === 'pending_imo' || event.key === 'seacharter_pending_imo') {
        if (event.newValue) {
          processCandidate(event.newValue, `storage:${event.key}`);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. BroadcastChannels listeners ('cross_app_sync', 'core_pro_channel', 'seacharter_sync_channel')
    let crossAppChannel = null;
    let coreProChannel = null;
    let seacharterSyncChannel = null;

    if (typeof window.BroadcastChannel === 'function') {
      try {
        crossAppChannel = new window.BroadcastChannel('cross_app_sync');
        crossAppChannel.onmessage = (event) => {
          const data = event?.data;
          if (data && (data.type === 'LOAD_IMO' || data.imo || data.selected_imo)) {
            processCandidate(data, 'bc:cross_app_sync');
          }
        };
      } catch (_) {}

      try {
        coreProChannel = new window.BroadcastChannel('core_pro_channel');
        coreProChannel.onmessage = (event) => {
          const data = event?.data;
          if (data) {
            processCandidate(data, 'bc:core_pro_channel');
          }
        };
      } catch (_) {}

      try {
        seacharterSyncChannel = new window.BroadcastChannel('seacharter_sync_channel');
        seacharterSyncChannel.onmessage = (event) => {
          const data = event?.data;
          if (data) {
            processCandidate(data, 'bc:seacharter_sync_channel');
          }
        };
      } catch (_) {}
    }

    // 4. Polling to Neon DB for 'core_pro_pending_imo' / 'selected_imo'
    const pollNeonPendingImo = async () => {
      if (isPollingRef.current || typeof fetch !== 'function') return;
      isPollingRef.current = true;
      try {
        const res = await fetch(getApiUrl('/api/app-state?key=core_pro_pending_imo'), {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          console.log('[Core PRO] Polling check, IMO recibido:', data);
          if (data?.success && (data.value || data.imo || data.selected_imo || data.pending_imo)) {
            processCandidate(data, 'neon:poll');
          }
        }
      } catch (pollErr) {
        console.warn('[Core PRO] Error en polling de estado:', pollErr);
      } finally {
        isPollingRef.current = false;
      }
    };

    // Run immediate check and periodic interval
    void pollNeonPendingImo();
    const pollInterval = setInterval(pollNeonPendingImo, 3000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      crossAppChannel?.close();
      coreProChannel?.close();
      seacharterSyncChannel?.close();
      clearInterval(pollInterval);
    };
  }, []);
}

/**
 * Storage key for persistent header visibility preference.
 */
export const HEADER_STORAGE_KEY = 'seacharter_header_visible';

/**
 * Returns stored header visibility preference or true by default.
 */
export function getStoredHeaderVisibility(defaultVisible = true) {
  if (typeof window === 'undefined') return defaultVisible;
  try {
    const stored = window.localStorage?.getItem(HEADER_STORAGE_KEY);
    if (stored !== null && stored !== undefined) {
      return stored === 'true';
    }
  } catch (_) {}
  return defaultVisible;
}

/**
 * Persists header visibility preference to localStorage and emits an event.
 */
export function setStoredHeaderVisibility(visible) {
  const boolVal = Boolean(visible);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem(HEADER_STORAGE_KEY, String(boolVal));
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('header:visibility-change', {
        detail: { isHeaderVisible: boolVal, visible: boolVal }
      }));
    } catch (_) {}
  }
  return boolVal;
}

/**
 * Global Header Visibility management hook for SeaCharter Core PRO.
 * Keeps state in sync with localStorage, DOM layout, and window resize events.
 */
export function useHeaderVisibility(defaultVisible = true) {
  const [isHeaderVisible, setIsHeaderVisible] = useState(() => getStoredHeaderVisibility(defaultVisible));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Apply visibility class and ARIA states to DOM elements
    const syncDom = (visible) => {
      if (typeof document !== 'undefined') {
        if (document.body) {
          document.body.classList.toggle('header-collapsed', !visible);
          document.body.dataset.headerVisible = String(visible);
        }
        const appHeader = document.querySelector('header.app-header');
        if (appHeader) {
          appHeader.classList.toggle('header-collapsed', !visible);
          appHeader.setAttribute('aria-hidden', String(!visible));
        }
        const collapseBtn = document.getElementById('btn-collapse-header');
        if (collapseBtn) {
          collapseBtn.setAttribute('aria-expanded', String(visible));
        }
        const expandBtn = document.getElementById('btn-expand-header');
        if (expandBtn) {
          expandBtn.setAttribute('aria-expanded', String(visible));
        }
      }
      window.dispatchEvent(new Event('resize'));
    };

    syncDom(isHeaderVisible);

    const handleVisibilityEvent = (event) => {
      const nextVal = event?.detail?.isHeaderVisible ?? event?.detail?.visible;
      if (typeof nextVal === 'boolean') {
        setIsHeaderVisible(nextVal);
      }
    };

    const handleToggleEvent = () => {
      setIsHeaderVisible((prev) => {
        const next = !prev;
        setStoredHeaderVisibility(next);
        return next;
      });
    };

    window.addEventListener('header:visibility-change', handleVisibilityEvent);
    window.addEventListener('header:toggle', handleToggleEvent);

    window.isHeaderVisible = isHeaderVisible;
    window.setHeaderVisibility = (val) => {
      const next = Boolean(val);
      setStoredHeaderVisibility(next);
      setIsHeaderVisible(next);
    };
    window.toggleHeaderVisibility = () => {
      setIsHeaderVisible((prev) => {
        const next = !prev;
        setStoredHeaderVisibility(next);
        return next;
      });
    };

    return () => {
      window.removeEventListener('header:visibility-change', handleVisibilityEvent);
      window.removeEventListener('header:toggle', handleToggleEvent);
    };
  }, [isHeaderVisible]);

  const toggleHeader = () => {
    const next = !isHeaderVisible;
    setStoredHeaderVisibility(next);
    setIsHeaderVisible(next);
  };

  return { isHeaderVisible, setIsHeaderVisible, toggleHeader };
}

let hasTriggeredLandDataBridge = false;

/**
 * Auto-Fetch de Data Bridge (Init) & Inyección de Distancia (Map -> State)
 */
export function useLandDataBridgeSync() {
  const [landData, setLandData] = useState(null);
  const [dieselPrice, setDieselPrice] = useState(1.48);
  const [truckPayloadCapacity, setTruckPayloadCapacity] = useState(24);
  const [totalKilometers, setTotalKilometers] = useState(0);
  const [drivingHours, setDrivingHours] = useState(0);
  const fetchAttemptedRef = useRef(false);

  // Auto-Fetch de Data Bridge (Init)
  useEffect(() => {
    if (fetchAttemptedRef.current || hasTriggeredLandDataBridge) return;
    fetchAttemptedRef.current = true;
    hasTriggeredLandDataBridge = true;

    let isMounted = true;
    async function initDataBridge() {
      try {
        // Fallback reference: fetch(getApiUrl('/api-land-data'))
        const res = await fetch(getApiUrl('/.netlify/functions/api-land-data'));
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted || !data) return;

        // Guarda el precio oficial del diésel en el estado (dieselPrice). NO intentes extraer precio de AdBlue
        const dPrice = Number(data.dieselPrice) || 1.48;
        const tollPerKm = Number(data.tollCostPerKm) || 0.19;
        const fixedDaily = Number(data.fixedDailyCost) || 350;
        const vehicleTypes = Array.isArray(data.vehicleTypes) ? data.vehicleTypes : [];

        setLandData(data);
        setDieselPrice(dPrice);

        if (typeof window !== 'undefined') {
          window.State = window.State || {};
          window.State.dieselPrice = dPrice;
          window.State.tollCostPerKm = tollPerKm;
          window.State.fixedDailyCost = fixedDaily;
          window.State.vehicleTypes = vehicleTypes;
          window.State.truckPayloadCapacity = window.State.truckPayloadCapacity || 24;

          window.SeaCharterStore?.set?.({
            dieselPrice: dPrice,
            tollCostPerKm: tollPerKm,
            fixedDailyCost: fixedDaily,
            vehicleTypes,
            truckPayloadCapacity: 24
          });

          const vStore = window.VoyageStore?.getState?.() || window.useVoyageStore?.getState?.();
          if (vStore) {
            vStore.setDieselPrice?.(dPrice);
            if (typeof window.VoyageStore?.setState === 'function') {
              window.VoyageStore.setState((s) => ({
                draft: {
                  ...s.draft,
                  dieselPrice: dPrice,
                  tollCostPerKm: tollPerKm,
                  fixedDailyCost: fixedDaily,
                  vehicleTypes,
                  truckPayloadCapacity: 24
                }
              }));
            }
          }
        }
      } catch (err) {
        console.warn('[Core PRO] Error en auto-fetch de Data Bridge (/.netlify/functions/api-land-data):', err);
      }
    }

    initDataBridge();
    return () => { isMounted = false; };
  }, []);

  // Auto-cálculo si totalCargoTonnage > 0 y la capacidad del camión es 24
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkAndTriggerCalculation = () => {
      const searchParams = window.location?.search ? new URLSearchParams(window.location.search) : null;
      const urlCargo = searchParams ? (parseFloat(searchParams.get('cargo') || searchParams.get('cargoQty') || searchParams.get('cargoVolume') || searchParams.get('tonnage') || searchParams.get('totalCargoTonnage') || '') || 0) : 0;
      const domCargo = parseFloat(document.getElementById('cargo-qty')?.value || document.getElementById('cost-plus-cargo-volume')?.value || '0') || 0;
      const stateCargo = window.State?.cargo || window.State?.cargoQuantity || 0;
      const totalCargoTonnage = urlCargo || domCargo || stateCargo || 0;

      const domTruckPayload = parseFloat(document.getElementById('truckPayloadCapacity')?.value || document.getElementById('vessel-dwt')?.value || '0') || 0;
      const effectiveTruckPayload = domTruckPayload > 0 ? domTruckPayload : (truckPayloadCapacity || window.State?.truckPayloadCapacity || 24);

      if (totalCargoTonnage > 0 && effectiveTruckPayload === 24) {
        if (typeof window.handleMasterValidationAndCalculate === 'function') {
          void window.handleMasterValidationAndCalculate();
        } else if (typeof window.validarYCalcularSeccion2 === 'function') {
          void window.validarYCalcularSeccion2({ deferDependentCalculations: false, showFeedback: false });
        }
      }
    };

    checkAndTriggerCalculation();
    const timer = setTimeout(checkAndTriggerCalculation, 300);
    return () => clearTimeout(timer);
  }, [truckPayloadCapacity]);

  // Inyección de Distancia (Map -> State)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRouteUpdated = (event) => {
      const detail = event?.detail || {};
      const distanceMeters = Number(detail.route?.distance) || 0;
      const km = distanceMeters > 0 ? (distanceMeters / 1000) : (Number(detail.totalKilometers) || Number(detail.distanceKm) || 0);
      const durationSeconds = Number(detail.route?.duration) || 0;
      const hours = durationSeconds > 0 ? (durationSeconds / 3600) : (Number(detail.drivingHours) || (km > 0 ? km / 75 : 0));

      setTotalKilometers(km);
      setDrivingHours(hours);

      window.State = window.State || {};
      window.State.totalKilometers = km;
      window.State.drivingHours = hours;

      window.SeaCharterStore?.set?.({
        totalKilometers: km,
        drivingHours: hours,
        distLaden: Math.round(km),
        distTotal: Math.round(km),
        distanceKm: Math.round(km)
      });

      const vStore = window.VoyageStore?.getState?.() || window.useVoyageStore?.getState?.();
      vStore?.setRouteDistanceAndDuration?.(km, hours);
    };

    window.addEventListener('osrm:route-updated', handleRouteUpdated);
    return () => {
      window.removeEventListener('osrm:route-updated', handleRouteUpdated);
    };
  }, []);

  return { landData, dieselPrice, totalKilometers, drivingHours };
}

export default function App(props) {
  return (
    <HashRouter>
      <AppLayout {...props} />
    </HashRouter>
  );
}

/**
 * Fetch maritime POL (Port of Loading) and POD (Port of Discharge) for an anchored reference.
 * Queries forwarder_projects, charter_dossiers, or voyage-active endpoints with strict JSON validation.
 */
export async function fetchMultimodalPorts(ref) {
  if (!ref) return null;
  const cleanRef = String(ref).trim();
  const resolveUrl = typeof window !== 'undefined' && typeof window.getApiUrl === 'function'
    ? window.getApiUrl
    : (p) => p;

  async function safeFetchJson(url) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!res.ok) return null;
      const contentType = res.headers?.get('content-type') || '';
      if (contentType && !contentType.includes('application/json') && contentType.includes('text/html')) {
        return null;
      }
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  // 1. Consulta directa a la función serverless de Netlify (evita fallbacks 404 de redirecciones)
  try {
    const response = await fetch('/.netlify/functions/voyage-active?contractRef=' + encodeURIComponent(cleanRef), {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (response.ok) {
      const contentType = response.headers?.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        const data = await response.json();
        if (data && (data.pol || data.pod || data.voyage)) {
          const pol = data.pol || data.voyage?.loadPort?.name || data.voyage?.loadPortName || '';
          const pod = data.pod || data.voyage?.dischargePort?.name || data.voyage?.dischargePortName || '';
          if (pol || pod) {
            return { pol: String(pol || '').trim(), pod: String(pod || '').trim(), source: 'voyage_active' };
          }
        }
      }
    }
  } catch (_) {}

  // 2. Consulta de respaldo a la tabla forwarder_projects (Neon DB)
  const forwarderEndpoints = [
    resolveUrl(`/api/forwarder-projects?ref=${encodeURIComponent(cleanRef)}`),
    resolveUrl(`/.netlify/functions/forwarder-projects?ref=${encodeURIComponent(cleanRef)}`)
  ];

  for (const url of forwarderEndpoints) {
    const data = await safeFetchJson(url);
    if (data) {
      const list = Array.isArray(data) ? data : (data.projects || [data]);
      const project = list.find((p) => String(p.project_ref || '').toUpperCase() === cleanRef.toUpperCase()) || list[0];
      if (project) {
        const route = project.route_and_chartering ||
          project.items?.[0]?.payload_data?.route_and_chartering ||
          project.line_items?.[0]?.payload_data?.route_and_chartering ||
          project.data?.route_and_chartering ||
          project.data || {};
        const pol = route.pol || project.pol || project.load_port || '';
        const pod = route.pod || project.pod || project.discharge_port || '';
        if (pol || pod) {
          return { pol: String(pol || '').trim(), pod: String(pod || '').trim(), source: 'forwarder_projects' };
        }
      }
    }
  }

  // 3. Consulta de respaldo al equivalente marítimo (/api/dossiers / charter_dossiers en Neon DB)
  const dossierEndpoints = [
    resolveUrl(`/api/dossiers?q=${encodeURIComponent(cleanRef)}`),
    resolveUrl(`/.netlify/functions/dossiers?q=${encodeURIComponent(cleanRef)}`)
  ];

  for (const url of dossierEndpoints) {
    const data = await safeFetchJson(url);
    if (data) {
      const list = Array.isArray(data.dossiers) ? data.dossiers : (Array.isArray(data) ? data : []);
      const dossier = list.find((d) => String(d.reference || '').toUpperCase() === cleanRef.toUpperCase()) || list[0];
      if (dossier && (dossier.pol || dossier.pod)) {
        return { pol: String(dossier.pol || '').trim(), pod: String(dossier.pod || '').trim(), source: 'dossiers' };
      }
    }
  }

  return null;
}

/**
 * Aplica la lógica de precarga suave en los inputs geográficos:
 * - Para Exportación (Pre-carriage): Precarga Destino = POL marítimo; deja Origen vacío.
 * - Para Importación (On-carriage): Precarga Origen = POD marítimo; deja Destino vacío.
 * No deshabilita ni bloquea los inputs para asegurar sinergia con Cerebro IA y el usuario.
 */
export function applyMultimodalPortPreload({ pol = '', pod = '', mode = 'export' } = {}) {
  const normMode = String(mode || '').toLowerCase();
  const isImport = normMode.includes('import') || normMode.includes('on-carriage') || normMode.includes('oncarriage');

  const polInputs = ['map-port-pol', 'port-pol', 'input-pol']
    .map((id) => (typeof document !== 'undefined' ? document.getElementById(id) : null))
    .filter(Boolean);
  const podInputs = ['map-port-pod', 'port-pod', 'input-pod']
    .map((id) => (typeof document !== 'undefined' ? document.getElementById(id) : null))
    .filter(Boolean);

  if (isImport) {
    const podValue = String(pod || '').trim();
    polInputs.forEach((input) => {
      input.value = podValue;
      input.dataset.preloaded = 'true';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    podInputs.forEach((input) => {
      if (!input.dataset.userEdited) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    if (typeof window !== 'undefined' && window.State) {
      window.State.pol = podValue;
      window.State.origin = podValue;
      if (!window.State.userEditedDestination) {
        window.State.pod = '';
        window.State.destination = '';
      }
    }
  } else {
    const polValue = String(pol || '').trim();
    podInputs.forEach((input) => {
      input.value = polValue;
      input.dataset.preloaded = 'true';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    polInputs.forEach((input) => {
      if (!input.dataset.userEdited) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    if (typeof window !== 'undefined' && window.State) {
      window.State.pod = polValue;
      window.State.destination = polValue;
      if (!window.State.userEditedOrigin) {
        window.State.pol = '';
        window.State.origin = '';
      }
    }
  }

  // Garantizar sinergia con Cerebro IA y el operador humano: nunca deshabilitar
  [...polInputs, ...podInputs].forEach((input) => {
    input.readOnly = false;
    input.disabled = false;
    input.removeAttribute?.('readonly');
    input.removeAttribute?.('disabled');
  });

  return { mode: isImport ? 'import' : 'export', pol, pod };
}

/**
 * Fetch and apply multimodal port preload for a given reference.
 */
export async function fetchAndApplyMultimodalPorts(ref, explicitMode) {
  if (!ref) return null;
  const urlParams = typeof window !== 'undefined' && window.location?.search
    ? new URLSearchParams(window.location.search)
    : null;
  const modeParam = explicitMode ||
    urlParams?.get('mode') ||
    urlParams?.get('flow') ||
    urlParams?.get('type') ||
    urlParams?.get('tramo') ||
    urlParams?.get('operation') ||
    'export';

  const portData = await fetchMultimodalPorts(ref);
  if (portData && (portData.pol || portData.pod)) {
    applyMultimodalPortPreload({
      pol: portData.pol,
      pod: portData.pod,
      mode: modeParam
    });
    return portData;
  }
  return null;
}

if (typeof window !== 'undefined') {
  window.fetchMultimodalPorts = fetchMultimodalPorts;
  window.applyMultimodalPortPreload = applyMultimodalPortPreload;
  window.fetchAndApplyMultimodalPorts = fetchAndApplyMultimodalPorts;
}

/**
 * Bloqueo de Referencia y Sincronización Multimodal en inicialización.
 */
export function useUrlReferenceSync() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Bloqueo de Referencia: leer parámetro URL
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && String(ref).trim()) {
      const cleanRef = String(ref).trim();

      // Fijar como referencia definitiva en el estado global
      window.State = window.State || {};
      window.State.activeReference = cleanRef;
      window.anchoredReference = cleanRef;
      window.isRefAnchored = true;

      if (window.ContractRefManager?.setActiveContractRef) {
        window.ContractRefManager.setActiveContractRef(cleanRef);
        window.ContractRefManager.setInjectionLock?.(true);
      } else if (window.setActiveContractRef) {
        window.setActiveContractRef(cleanRef);
      }

      // La cabecera muestra únicamente la referencia anclada
      const quickRef = document.getElementById('quick-ref');
      if (quickRef && quickRef.value !== cleanRef) {
        quickRef.value = cleanRef;
      }
      ['gc-ref', 'asb-ref', 'tracking-live-contract-ref'].forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.value !== cleanRef) el.value = cleanRef;
      });

      // 2. Precarga Inteligente de Puertos (POL / POD)
      void fetchAndApplyMultimodalPorts(cleanRef);
    }
  }, []);
}

/**
 * Main Application / Layout wrapper component for Land Charter Core PRO.
 */
export function AppLayout({ children, currentView: initialView = 'MAP', defaultHeaderVisible = true }) {
  useUrlReferenceSync();
  useSeaCharterSync();
  useUrlImoAutoLookup();
  usePendingImoSync();
  useLandDataBridgeSync();

  const [currentView, setCurrentView] = useState(initialView);
  const { isHeaderVisible, toggleHeader } = useHeaderVisibility(defaultHeaderVisible);

  useEffect(() => {
    const handleViewChange = (event) => {
      const nextView = event?.detail?.view || event?.detail;
      if (nextView) {
        setCurrentView(String(nextView).toUpperCase());
      }
    };

    const syncFromHash = () => {
      if (typeof window !== 'undefined' && window.location && window.location.hash) {
        const hash = window.location.hash.replace(/^#\/?/, '').toUpperCase();
        if (hash === 'FORWARDERS' || hash === 'PROYECTOS') {
          setCurrentView('FORWARDERS');
        } else if (hash === 'MAP' || hash === 'CALCULATOR') {
          setCurrentView(hash);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('navigation:view-change', handleViewChange);
      window.addEventListener('hashchange', syncFromHash);
      syncFromHash();
      if (!window.setAppView) {
        window.setAppView = (view) => {
          const normalized = String(view).toUpperCase();
          setCurrentView(normalized);
          if (typeof window !== 'undefined' && window.location) {
            window.location.hash = `#/${normalized.toLowerCase()}`;
          }
          window.dispatchEvent(new CustomEvent('navigation:view-change', { detail: { view: normalized } }));
        };
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('navigation:view-change', handleViewChange);
        window.removeEventListener('hashchange', syncFromHash);
      }
    };
  }, []);

  return (
    <div
      className={`seacharter-core-pro-app ${isHeaderVisible ? 'header-visible' : 'header-collapsed'}`}
      data-header-visible={isHeaderVisible}
    >
      <button
        type="button"
        id="react-header-toggle-btn"
        className="header-toggle-control sr-only"
        onClick={toggleHeader}
        aria-label={isHeaderVisible ? 'Ocultar cabecera' : 'Mostrar cabecera'}
        aria-expanded={isHeaderVisible}
      >
        {isHeaderVisible ? 'Ocultar cabecera' : 'Mostrar cabecera'}
      </button>
      {currentView === 'FORWARDERS' ? (
        <ForwarderWorkspace />
      ) : (
        children
      )}
    </div>
  );
}

export { HashRouter, HashRouter as BrowserRouter };
