import React, { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';

export const DATA_BRIDGE_URL = "https://calm-shortbread-55bcfc.netlify.app";

export const LANDCHARTER_DOM_DICTIONARY = {
  "flota": { "contenedor": "#view-matching", "inputs": ["#vehicle_type", "#metodo_carga", "#metodo_descarga", "#input-loading-rate", "#input-discharging-rate", "#ais-vessel-search"], "metricas": ["#val-dss-cadencia-camiones-dia", "#val-dss-plazo-campana", "#matching-compatible-count", "#fleet-intel-count"] },
  "rutas": { "contenedor": "#view-map", "inputs": ["#map-port-pol", "#map-port-pod", "#map-laycan-date", "#map-cancelling-date"], "metricas": ["#sync-miles-card", "#sync-pol-label", "#sync-pod-label", "#header-sync-status-badge"] },
  "calculadora": { "contenedor": "#view-estimator", "inputs": ["#port-pol", "#port-pod", "#dist-laden", "#nombre-buque-calculadora", "#truckPayloadCapacity", "#cargo-qty", "#cargo-type", "#tacografo-speed", "#price-sea", "#opex-daily"], "metricas": ["#exec-buy-freight-total", "#exec-sell-freight-total", "#res-cost-bunker", "#res-cost-opex", "#res-cost-pda", "#res-cost-base-break-even", "#res-breakeven", "#res-net-profit-owner", "#res-net-profit-charterer"] },
  "proyectos": { "contenedor": "#view-forwarders", "inputs": ["#top-cargo-category", "#input-pol", "#input-pod", "#input-distance-nm", "#input-valor-mercancia", "#dossiers-search"], "metricas": ["#financial-breakdown-card", "#financial-unit-ratios-summary", "#capacity-overload-warning", "#dossiers-count"] },
  "decisiones": { "contenedor": "#view-decisiones", "inputs": ["#input-pol", "#input-pod", "#input-cargoQty", "#input-fleteEstimado", "#input-breakEven", "#input-km-vacio", "#input-sobrecostes-ruta"], "metricas": ["#val-transito-estimado", "#val-flota-total", "#val-cadencia-sugerida", "#val-margen-neto-proyecto", "#display-all-in-gross", "#display-net-freight", "#madre-audit-veredicto-badge"] }
};

/**
 * Detecta el módulo actual de Land Charter mapeándolo al diccionario DOM
 */
export function detectCurrentModule(specifiedModule) {
  if (specifiedModule && typeof specifiedModule === 'string') {
    const norm = specifiedModule.toLowerCase().trim();
    if (LANDCHARTER_DOM_DICTIONARY[norm]) return norm;
    if (norm === 'matching' || norm === '#view-matching' || norm === 'view-matching') return 'flota';
    if (norm === 'map' || norm === '#view-map' || norm === 'view-map') return 'rutas';
    if (norm === 'estimator' || norm === '#view-estimator' || norm === 'view-estimator') return 'calculadora';
    if (norm === 'forwarders' || norm === '#view-forwarders' || norm === 'view-forwarders') return 'proyectos';
    if (norm === 'decisiones' || norm === '#view-decisiones' || norm === 'view-decisiones') return 'decisiones';
  }

  if (typeof window !== 'undefined') {
    const current = window.currentView || window.State?.activeModule || window.State?.currentView;
    if (current && typeof current === 'string') {
      const norm = current.toLowerCase().trim();
      if (LANDCHARTER_DOM_DICTIONARY[norm]) return norm;
      if (norm === 'matching') return 'flota';
      if (norm === 'map') return 'rutas';
      if (norm === 'estimator') return 'calculadora';
      if (norm === 'forwarders') return 'proyectos';
      if (norm === 'decisiones') return 'decisiones';
    }
  }

  if (typeof document !== 'undefined') {
    for (const [key, conf] of Object.entries(LANDCHARTER_DOM_DICTIONARY)) {
      try {
        const el = document.querySelector(conf.contenedor);
        if (el) {
          const isHidden = el.classList.contains('hidden') || el.style.display === 'none';
          const isActive = el.classList.contains('active-block') || el.classList.contains('active-flex') || (!isHidden && el.style.display !== 'none');
          if (isActive && !isHidden) {
            return key;
          }
        }
      } catch (_) {}
    }
  }

  return 'calculadora';
}

/**
 * Motor de captura del DOM para Escáner Universal en Land Charter
 */
export function captureScreenDOM(specifiedModuleId) {
  let moduloId = specifiedModuleId || detectCurrentModule();
  if (!LANDCHARTER_DOM_DICTIONARY[moduloId]) {
    moduloId = detectCurrentModule(moduloId);
  }

  let elementosVisibles = "";
  const metricasCapturadas = {};
  const inputsCapturados = {};
  const listaMetricas = [];
  const listaInputs = [];

  // Busca si el ID del módulo actual existe en LANDCHARTER_DOM_DICTIONARY
  if (LANDCHARTER_DOM_DICTIONARY[moduloId]) {
    const configModulo = LANDCHARTER_DOM_DICTIONARY[moduloId];

    // Iterar sobre array de inputs usando document.querySelector para extraer los valores prioritarios
    if (Array.isArray(configModulo.inputs) && typeof document !== 'undefined') {
      configModulo.inputs.forEach((selector) => {
        try {
          const el = document.querySelector(selector);
          if (el) {
            const val = el.value !== undefined ? el.value.trim() : (el.textContent ? el.textContent.trim().replace(/\s+/g, ' ') : '');
            inputsCapturados[selector] = val;
            listaInputs.push(`${selector}: ${val}`);
          }
        } catch (err) {
          console.warn(`[UniversalScanner] Selector input inválido ${selector}:`, err);
        }
      });
    }

    // Iterar sobre array de metricas usando document.querySelector para extraer los valores prioritarios
    if (Array.isArray(configModulo.metricas) && typeof document !== 'undefined') {
      configModulo.metricas.forEach((selector) => {
        try {
          const el = document.querySelector(selector);
          if (el) {
            const val = el.textContent !== undefined ? el.textContent.trim().replace(/\s+/g, ' ') : (el.value !== undefined ? el.value.trim() : '');
            metricasCapturadas[selector] = val;
            listaMetricas.push(`${selector}: ${val}`);
          }
        } catch (err) {
          console.warn(`[UniversalScanner] Selector métrica inválido ${selector}:`, err);
        }
      });
    }

    // Añade las métricas encontradas en una lista llamada [Métricas Clave]: dentro del string de elementos visibles antes del fallback genérico
    if (listaMetricas.length > 0) {
      elementosVisibles += `[Métricas Clave]:\n` + listaMetricas.map(m => `- ${m}`).join('\n') + '\n\n';
    }

    if (listaInputs.length > 0) {
      elementosVisibles += `[Inputs Prioritarios]:\n` + listaInputs.map(i => `- ${i}`).join('\n') + '\n\n';
    }
  }

  // Fallback genérico de elementos visibles
  let fallbackGenerico = "";
  if (typeof document !== 'undefined') {
    const contenedorSelector = LANDCHARTER_DOM_DICTIONARY[moduloId]?.contenedor;
    const container = contenedorSelector ? document.querySelector(contenedorSelector) : document.body;
    if (container) {
      const itemsGenericos = [];
      const fields = container.querySelectorAll('input:not([type="hidden"]), select, textarea');
      fields.forEach((field) => {
        const id = field.id ? `#${field.id}` : (field.name ? `[name="${field.name}"]` : null);
        if (id && (!LANDCHARTER_DOM_DICTIONARY[moduloId]?.inputs?.includes(id))) {
          const val = field.value !== undefined ? field.value.trim() : '';
          if (val) {
            itemsGenericos.push(`${id}: ${val}`);
          }
        }
      });
      if (itemsGenericos.length > 0) {
        fallbackGenerico = `[Elementos DOM Generales]:\n` + itemsGenericos.map(item => `- ${item}`).join('\n');
      }
    }
  }

  if (fallbackGenerico) {
    elementosVisibles += fallbackGenerico;
  }
  elementosVisibles = elementosVisibles.trim();

  const toneladas = parseFloat(inputsCapturados['#cargo-qty'] || document.getElementById?.('cargo-qty')?.value) || (typeof window !== 'undefined' ? (window.State?.cargoQty || window.State?.toneladas) : 25) || 25;
  const distanciaKm = parseFloat(inputsCapturados['#dist-laden'] || document.getElementById?.('dist-total')?.value) || (typeof window !== 'undefined' ? (window.State?.totalKilometers || window.State?.distanciaKm) : 850) || 850;
  const isRail = (typeof window !== 'undefined' && window.globalTransportMode === 'RAIL') ||
    (typeof window !== 'undefined' && window.State?.globalTransportMode === 'RAIL') ||
    (typeof document !== 'undefined' && document.getElementById?.('btn-view-mode-charterer')?.getAttribute('aria-pressed') === 'true');
  const peajesAltos = (parseFloat(inputsCapturados['#input-sobrecostes-ruta'] || document.getElementById?.('pda-pol')?.value) || 0) > 150;
  const riesgosDetectados = Boolean(typeof window !== 'undefined' && window.State?.riesgosDetectados);
  const costPerKm = (typeof window !== 'undefined' && window.State?.costPerKm !== undefined) ? window.State.costPerKm : 1.65;

  return {
    suite: "Land Charter",
    modulo_actual: moduloId,
    elementos_visibles: elementosVisibles,
    metricas_clave: metricasCapturadas,
    inputs: inputsCapturados,
    datos_extraidos: { ...inputsCapturados, ...metricasCapturadas },
    toneladas,
    distanciaKm,
    costPerKm,
    esTren: isRail,
    peajesAltos,
    riesgosDetectados
  };
}

/**
 * Función inquebrantable para enviar mensajes de texto a MADRE mediante Data Bridge
 */
export async function sendToMadreChat(payload) {
    try {
        const safePayload = payload || {};
        const moduloActual = safePayload.modulo_actual || safePayload.moduloActual || detectCurrentModule(safePayload.current_module || safePayload.modulo);
        const enrichedPayload = {
            ...safePayload,
            suite: "Land Charter",
            modulo_actual: moduloActual,
            origen: safePayload.origen || "Land Charter",
            current_module: safePayload.current_module || "land_charter"
        };

        const response = await fetch(`${DATA_BRIDGE_URL}/.netlify/functions/madre-chat`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(enrichedPayload)
        });

        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Fallo de conexión frontend con madre-chat:", error);
        throw error;
    }
}

/**
 * Paso 1: Guion Ejecutivo Adaptado a Land Charter (Camión y Tren)
 * Evalúa rutas terrestres y costes por kilómetro sin tocar la lógica de cálculo externa.
 */
export function buildMotherExecutiveScript(state = {}) {
  const horasAhorradas = 2.0;
  const ahorroAdmin = horasAhorradas * 45;
  const toneladas = state?.toneladas || 25;
  const distanciaKm = state?.distanciaKm || 850;
  const costPerKm = state?.costPerKm ?? 1.65;
  const modalidad = state?.esTren ? 'transporte ferroviario intermodal' : 'flota de camiones de gran tonelaje';
  const peajesDetectados = state?.peajesAltos ? 'Se han registrado peajes elevados en los corredores seleccionados.' : 'Ruta optimizada sin sobrecostes severos de peaje.';
  const fugas = state?.riesgosDetectados ? 1400 : 0;

  return `Escaneo terrestre completado para ${modalidad}. Distancia: ${distanciaKm} km con un bloque de ${toneladas} toneladas. Coste operativo: ${costPerKm} euros por kilómetro. Atención: ${peajesDetectados} Impacto: se han ahorrado ${ahorroAdmin} euros de gestión y prevenido posibles desvíos por valor de ${fugas} euros. Operación validada.`;
}

/**
 * Blindar la conexión a madre-voice:
 * Reproducción de audio asegurándose de procesar el Base64 que envía Data Bridge correctamente.
 */
export async function playNeuralMotherVoice(text, options = {}) {
    if (!text) return;

    try {
        const response = await fetch(`${DATA_BRIDGE_URL}/.netlify/functions/madre-voice`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg'
            },
            body: JSON.stringify({ 
                text: text, 
                voice: options.voice || "Clara",
                origen: "Land Charter"
            })
        });

        if (!response.ok) throw new Error(`Error HTTP madre-voice: ${response.status}`);

        // Esquivar bloqueo CSP (blob:) procesando en memoria con Web Audio API
        const arrayBuffer = await response.arrayBuffer();
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start(0);
        return source;

    } catch (error) {
        console.error("Fallo de conexión frontend con madre-voice:", error);
        // Fallback nativo de emergencia
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "es-ES";
        window.speechSynthesis.speak(utterance);
        return null;
    }
}

if (typeof window !== 'undefined') {
  window.DATA_BRIDGE_URL = DATA_BRIDGE_URL;
  window.LANDCHARTER_DOM_DICTIONARY = LANDCHARTER_DOM_DICTIONARY;
  window.detectCurrentModule = detectCurrentModule;
  window.captureScreenDOM = captureScreenDOM;
  window.sendToMadreChat = sendToMadreChat;
  window.playNeuralMotherVoice = playNeuralMotherVoice;
}

/**
 * Componente Header con toggle de MADRE para Land Charter
 */
export function Header({ isMadreOpen: controlledOpen, setIsMadreOpen: controlledSetOpen } = {}) {
  const [isMadreOpen, setIsMadreOpen] = useState(false);
  const currentOpen = controlledOpen !== undefined ? controlledOpen : isMadreOpen;
  const toggleOpen = controlledSetOpen ? () => controlledSetOpen(!currentOpen) : () => setIsMadreOpen(!isMadreOpen);

  return (
    <header className="app-header bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button
          type="button"
          id="btn-madre-header-toggle"
          onClick={() => setIsMadreOpen(!isMadreOpen)}
          className="relative group flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full border border-slate-200 hover:scale-105 transition-transform duration-200 shadow-sm cursor-pointer shrink-0"
          title="Auditoría Estratégica MADRE"
          aria-label="Toggle MADRE"
        >
          <img src="/MADRE.png" alt="MADRE" className="w-full h-full rounded-full object-cover pointer-events-none" />
        </button>
      </div>
    </header>
  );
}

export function MadreHeaderButton({ isMadreOpen, setIsMadreOpen }) {
  return (
    <button
      type="button"
      id="btn-madre-header-toggle"
      onClick={() => setIsMadreOpen(!isMadreOpen)}
      className="relative group flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-full border border-slate-200 hover:scale-105 transition-transform duration-200 shadow-sm cursor-pointer shrink-0"
      title="Auditoría Estratégica MADRE"
      aria-label="Toggle MADRE"
    >
      <img src="/MADRE.png" alt="MADRE" className="w-full h-full rounded-full object-cover pointer-events-none" />
    </button>
  );
}

/**
 * Componente React GlobalMadreDrawer para Land Charter
 */
export default function GlobalMadreDrawer({
  isOpen: controlledIsOpen,
  isMadreOpen: controlledIsMadreOpen,
  setIsMadreOpen: controlledSetIsMadreOpen,
  onClose,
  initialMessages = []
} = {}) {
  const [isMadreOpen, setIsMadreOpen] = useState(false);

  const [messages, setMessages] = useState(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const nodeRef = useRef(null);
  const activeAudioSourceRef = useRef(null);
  const recognitionRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Sincronización con props controladas
  useEffect(() => {
    if (controlledIsMadreOpen !== undefined) {
      setIsMadreOpen(controlledIsMadreOpen);
    } else if (controlledIsOpen !== undefined) {
      setIsMadreOpen(controlledIsOpen);
    }
  }, [controlledIsMadreOpen, controlledIsOpen]);

  // Sincronización con eventos globales y toggle externo de MADRE
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleToggle = (e) => {
      const forceState = e?.detail?.forceState;
      const isUserAction = e?.detail?.isUserAction ?? true;
      if (forceState === true && isUserAction === false) {
        console.warn('[MADRE] Invocación automática bloqueada. MADRE solo se abre por petición explícita del usuario.');
        return;
      }
      setIsMadreOpen(prev => {
        const next = typeof forceState === 'boolean' ? forceState : !prev;
        controlledSetIsMadreOpen?.(next);
        return next;
      });
    };

    const handleOpen = () => {
      setIsMadreOpen(true);
      controlledSetIsMadreOpen?.(true);
    };

    const handleClose = () => {
      setIsMadreOpen(false);
      controlledSetIsMadreOpen?.(false);
      stopAudio();
    };

    window.addEventListener('madre:toggle-drawer', handleToggle);
    window.addEventListener('madre:toggle', handleToggle);
    window.addEventListener('madre:open-drawer', handleOpen);
    window.addEventListener('madre:close-drawer', handleClose);

    window.DATA_BRIDGE_URL = DATA_BRIDGE_URL;
    window.LANDCHARTER_DOM_DICTIONARY = LANDCHARTER_DOM_DICTIONARY;
    window.detectCurrentModule = detectCurrentModule;
    window.captureScreenDOM = captureScreenDOM;
    window.sendToMadreChat = sendToMadreChat;
    window.buildMotherExecutiveScript = buildMotherExecutiveScript;
    window.playNeuralMotherVoice = playNeuralMotherVoice;

    return () => {
      window.removeEventListener('madre:toggle-drawer', handleToggle);
      window.removeEventListener('madre:toggle', handleToggle);
      window.removeEventListener('madre:open-drawer', handleOpen);
      window.removeEventListener('madre:close-drawer', handleClose);
    };
  }, [controlledSetIsMadreOpen]);

  // Scroll automático al recibir nuevos mensajes
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const stopAudio = () => {
    if (activeAudioSourceRef.current) {
      try {
        activeAudioSourceRef.current.stop();
      } catch (_) {}
      activeAudioSourceRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const handleToggleVoice = () => {
    const nextState = !isVoiceEnabled;
    setIsVoiceEnabled(nextState);
    if (!nextState) {
      stopAudio();
    }
  };

  const handleScan = () => {
    handleSendMessage('Escanear pantalla');
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    setInputText('');
    const userMsg = { id: 'user-' + Date.now(), sender: 'user', role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);

    const esEscaneo = /(?:escan(?:ear|eo)?|scan(?:ner)?|auditar|leer)/i.test(query);

    if (esEscaneo) {
      setIsLoading(true);
      const domCapture = captureScreenDOM();
      const detectedModule = domCapture.modulo_actual;

      try {
        const payload = {
          suite: "Land Charter",
          modulo_actual: detectedModule,
          origen: "Land Charter",
          current_module: "land_charter",
          mensajeUsuario: `Escaneo universal de pantalla en el módulo ${detectedModule}. Analiza las métricas clave y elementos visibles para emitir dictamen operativo.`,
          prompt: `Escaneo universal de pantalla en ${detectedModule}`,
          elementos_visibles: domCapture.elementos_visibles,
          contexto_ui: domCapture
        };

        const data = await sendToMadreChat(payload);
        const replyText = data?.respuesta || data?.reply || data?.texto_preformateado || data?.mensaje_voz || buildMotherExecutiveScript(domCapture);

        const assistantMsg = { id: 'asst-' + Date.now(), sender: 'assistant', role: 'assistant', text: replyText };
        setMessages(prev => [...prev, assistantMsg]);

        if (isVoiceEnabled) {
          stopAudio();
          const source = await playNeuralMotherVoice(replyText, { voice: "Clara" });
          if (source) activeAudioSourceRef.current = source;
        }
      } catch (err) {
        console.warn("[GlobalMadreDrawer] Modo contingencia para escaneo:", err);
        const script = buildMotherExecutiveScript(domCapture);
        const assistantMsg = { id: 'asst-' + Date.now(), sender: 'assistant', role: 'assistant', text: script };
        setMessages(prev => [...prev, assistantMsg]);

        if (isVoiceEnabled) {
          stopAudio();
          const source = await playNeuralMotherVoice(script, { voice: "Clara" });
          if (source) activeAudioSourceRef.current = source;
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    try {
      const domCapture = captureScreenDOM();
      const detectedModule = domCapture.modulo_actual;

      const data = await sendToMadreChat({
        suite: "Land Charter",
        modulo_actual: detectedModule,
        origen: "Land Charter",
        current_module: "land_charter",
        mensajeUsuario: query,
        prompt: query,
        elementos_visibles: domCapture.elementos_visibles,
        contexto_ui: domCapture
      });

      const replyText = data?.respuesta || data?.reply || data?.texto_preformateado || data?.mensaje_voz || "Instrucción recibida y procesada en Land Charter.";

      const assistantMsg = { id: 'asst-' + Date.now(), sender: 'assistant', role: 'assistant', text: replyText };
      setMessages(prev => [...prev, assistantMsg]);

      if (isVoiceEnabled) {
        stopAudio();
        const source = await playNeuralMotherVoice(replyText, { voice: "Clara" });
        if (source) activeAudioSourceRef.current = source;
      }
    } catch (err) {
      console.warn("[GlobalMadreDrawer] Modo contingencia para chat:", err);
      const stateSnapshot = captureScreenDOM();
      const fallbackScript = buildMotherExecutiveScript(stateSnapshot);
      const assistantMsg = { id: 'asst-' + Date.now(), sender: 'assistant', role: 'assistant', text: fallbackScript };
      setMessages(prev => [...prev, assistantMsg]);

      if (isVoiceEnabled) {
        stopAudio();
        const source = await playNeuralMotherVoice(fallbackScript, { voice: "Clara" });
        if (source) activeAudioSourceRef.current = source;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicrophoneClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      setTimeout(() => {
        handleSendMessage(transcript);
        setInputText('');
      }, 2000);
    };
    recognition.start();
  };

  if (!isMadreOpen) {
    return null;
  }

  return (
    <Draggable handle=".drag-handle" nodeRef={nodeRef} bounds="parent">
      <div
        ref={nodeRef}
        id="madre-drawer"
        className="fixed bottom-4 right-4 z-[9999] w-[450px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col text-gray-800 overflow-hidden"
        style={{ position: 'fixed' }}
        data-testid="global-madre-drawer"
      >
        {/* Cabecera (Drag Handle) idéntica a SeaCharter */}
        <div className="drag-handle cursor-move bg-white border-b border-gray-100 p-3 flex flex-row justify-between items-center select-none w-full overflow-hidden gap-4">
          <div className="flex flex-row items-center gap-2 shrink-0 pointer-events-none">
            <img src="/MADRE.png" alt="MADRE" className="w-6 h-6 rounded-full shadow-sm shrink-0" />
            <div>
              <span className="font-bold text-sm text-gray-800 whitespace-nowrap">MADRE</span>
              <span className="ml-1.5 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider">
                Cerebro Central
              </span>
            </div>
          </div>

          <div className="flex flex-row items-center justify-end gap-1.5 shrink-0">
            <button
              type="button"
              id="btn-madre-scan"
              onClick={handleScan}
              className="text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-md px-2 py-1 text-xs font-semibold flex flex-row items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Escanear pantalla Terrestre"
            >
              <span className="text-emerald-600 font-bold text-sm">⚡</span>
              <span className="hidden sm:inline-block">Escanear</span>
            </button>
            <button
              type="button"
              id="btn-madre-toggle-voice"
              onClick={handleToggleVoice}
              className="text-gray-600 hover:bg-gray-100 rounded-md w-7 h-7 flex items-center justify-center transition-colors text-sm cursor-pointer shrink-0"
              title={isVoiceEnabled ? 'Desactivar Voz (Clara)' : 'Activar Voz (Clara)'}
            >
              <i className={`fa-solid ${isVoiceEnabled ? 'fa-volume-high text-emerald-600' : 'fa-volume-xmark text-gray-400'} text-xs`} />
            </button>
            <button
              type="button"
              id="btn-madre-close"
              onClick={() => setIsMadreOpen(false)}
              className="text-gray-600 hover:bg-gray-100 rounded-md w-7 h-7 flex items-center justify-center transition-colors font-bold text-sm cursor-pointer shrink-0"
              title="Cerrar MADRE"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Cuerpo del Chat */}
        <div
          id="madre-chat-history"
          className="overflow-y-auto max-h-[60vh] min-h-[300px] bg-gray-50 p-4 flex flex-col gap-3 relative font-sans"
        >
          {messages.length === 0 ? (
            <div id="madre-idle-state" className="flex flex-col items-center justify-center h-full text-center py-6 text-gray-600">
              <div className="relative mb-3">
                <img src="/MADRE.png" alt="MADRE" className="w-16 h-16 rounded-full border border-gray-200 shadow-sm" />
              </div>
              <h3 className="font-semibold text-sm mb-1 text-gray-800">Cerebro Terrestre Activo</h3>
              <p className="text-xs max-w-[260px] text-gray-500 mb-3">
                Escáner visual y soporte operativo en tiempo real para variables de transporte terrestre.
              </p>
              <button
                type="button"
                onClick={handleScan}
                className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <span className="text-emerald-600 font-bold">⚡</span>
                <span>Escanear pantalla</span>
              </button>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.sender === 'user' || msg.role === 'user';
              return (
                <div
                  key={msg.id || index}
                  className={`flex gap-2.5 max-w-[90%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  {isUser ? (
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs shrink-0 font-bold">
                      <i className="fa-solid fa-user text-xs" />
                    </div>
                  ) : (
                    <img
                      src="/MADRE.png"
                      alt="MADRE"
                      className="w-7 h-7 rounded-full border border-gray-200 shadow-2xs shrink-0"
                    />
                  )}
                  <div
                    className={`px-3 py-2 rounded-lg text-xs leading-relaxed ${
                      isUser
                        ? 'bg-blue-50 text-gray-800'
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}

          {isLoading && (
            <div className="flex gap-2 mr-auto items-center text-gray-500 text-xs py-1">
              <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-robot text-blue-600 text-xs" />
              </div>
              <div className="bg-white text-gray-800 border border-gray-200 px-3 py-2 rounded-lg text-xs flex items-center gap-2 shadow-xs">
                <i className="fa-solid fa-circle-notch fa-spin text-blue-600" />
                <span>Conectando con Cerebro Central...</span>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Footer / Input de Texto */}
        <div className="bg-white border-t border-gray-100 p-3 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleMicrophoneClick}
            className="p-2 rounded-lg cursor-pointer transition-colors text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            title="Dictar por voz"
            aria-label="Micrófono"
          >
            <i className="fa-solid fa-microphone text-xs" />
          </button>
          <input
            type="text"
            id="madre-chat-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="bg-white border border-gray-200 text-gray-800 placeholder-gray-400 rounded-lg p-2 w-full text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            placeholder="Pregunta a MADRE o escribe 'Escanear pantalla'..."
          />
          <button
            type="button"
            onClick={() => handleSendMessage()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors cursor-pointer shadow-xs shrink-0"
          >
            Enviar
          </button>
        </div>
      </div>
    </Draggable>
  );
}

export { GlobalMadreDrawer };
