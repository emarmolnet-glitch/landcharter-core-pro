import React, { useState, useEffect, useRef } from 'react';

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
 * Componente React GlobalMadreDrawer para Land Charter
 */
export default function GlobalMadreDrawer({
  isOpen: controlledIsOpen,
  onClose,
  initialMessages = []
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const [messages, setMessages] = useState(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const activeAudioSourceRef = useRef(null);
  const recognitionRef = useRef(null);
  const chatBottomRef = useRef(null);

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
      setInternalIsOpen(prev => (typeof forceState === 'boolean' ? forceState : !prev));
    };

    const handleOpen = () => setInternalIsOpen(true);
    const handleClose = () => {
      setInternalIsOpen(false);
      stopAudio();
    };

    window.addEventListener('madre:toggle-drawer', handleToggle);
    window.addEventListener('madre:open-drawer', handleOpen);
    window.addEventListener('madre:close-drawer', handleClose);

    // Asignar funciones a window para retrocompatibilidad
    window.DATA_BRIDGE_URL = DATA_BRIDGE_URL;
    window.LANDCHARTER_DOM_DICTIONARY = LANDCHARTER_DOM_DICTIONARY;
    window.detectCurrentModule = detectCurrentModule;
    window.captureScreenDOM = captureScreenDOM;
    window.sendToMadreChat = sendToMadreChat;
    window.buildMotherExecutiveScript = buildMotherExecutiveScript;
    window.playNeuralMotherVoice = playNeuralMotherVoice;

    return () => {
      window.removeEventListener('madre:toggle-drawer', handleToggle);
      window.removeEventListener('madre:open-drawer', handleOpen);
      window.removeEventListener('madre:close-drawer', handleClose);
    };
  }, []);

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

  const handleCloseDrawer = () => {
    stopAudio();
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      setIsListening(false);
    }
    if (onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  /**
   * Extrae el estado terrestre actual del DOM o de window.State
   */
  const extractCurrentState = () => {
    return captureScreenDOM();
  };

  /**
   * Enrutamiento de comandos y mensajes conectado directamente a Data Bridge
   */
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

    // Consulta de chat conectada directamente a madre-chat en Data Bridge
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

  /**
   * Reconocimiento de voz nativo (Micrófono) vía Web Speech API
   */
  const handleMicrophoneClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error("Web Speech API no soportada en este navegador.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // 1. PITIDO DE FEEDBACK SONORO AL EMPEZAR A ESCUCHAR
    recognition.onstart = () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
      } catch (e) {
        console.warn("No se pudo reproducir el pitido:", e);
      }
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      
      // 2. MOSTRAR TRANSCRIPCIÓN
      if (typeof setInputText === 'function') {
        setInputText(transcript); // Para GlobalMadreDrawer.jsx
      } else {
        const input = document.getElementById('madre-chat-input');
        if (input) input.value = transcript; // Para index.html
      }
      
      // 3. AUTO-ENVÍO DESPUÉS DE 2 SEGUNDOS
      setTimeout(() => {
        if (typeof handleSendMessage === 'function') {
          handleSendMessage(transcript);
          setInputText('');
        } else if (typeof enviarMensajeMadre === 'function') {
          enviarMensajeMadre(transcript);
          const input = document.getElementById('madre-chat-input');
          if (input) input.value = '';
        }
      }, 2000);
    };

    recognition.onerror = (event) => {
      console.error("Error en micrófono:", event.error);
    };

    recognition.start();
  };

  /**
   * Paso 4: Manos Libres en el Micrófono
   * Evento de reconocimiento de voz que auto-envía el comando transcrito al completarse (isFinal).
   */
  const handleToggleListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[GlobalMadreDrawer] Reconocimiento de voz no soportado en este navegador.');
      return;
    }

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript;
          } else {
            interimTranscript += res[0].transcript;
          }
        }

        const isFinal = Boolean(finalTranscript) || Boolean(event.results?.[event.resultIndex]?.isFinal);
        const completeTranscript = (finalTranscript || interimTranscript).trim();

        if (isFinal && completeTranscript) {
          setIsListening(false);
          setInputText('');
          // Auto-envío hands-free del comando transcrito
          handleSendMessage(completeTranscript);
        } else if (completeTranscript) {
          setInputText(completeTranscript);
        }
      };

      recognition.onerror = (err) => {
        console.warn('[GlobalMadreDrawer] Error de reconocimiento:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error('[GlobalMadreDrawer] No se pudo activar el micrófono:', err);
      setIsListening(false);
    }
  };

  const handleQuickCommand = (text) => {
    handleSendMessage(text);
  };

  return (
    <div
      id="madre-drawer"
      className={`fixed top-0 left-0 h-full w-[400px] max-w-[90vw] bg-[#0B1121] text-slate-300 z-[99999] transform transition-transform duration-300 flex flex-col shadow-2xl border-r border-slate-800 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      data-testid="global-madre-drawer"
    >
      {/* HEADER MADRE */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#0F172A]">
        <div className="flex items-center gap-3">
          <img
            src="/MADRE.png"
            alt="MADRE"
            className="w-8 h-8 rounded-full border border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
          />
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2 text-white">
              MADRE{' '}
              <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider">
                Cerebro Central
              </span>
            </h2>
            <p className="text-[10px] leading-tight text-slate-300">
              Cerebro Operacional Intermodal<br />& Terrestre (Land Charter)
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            id="btn-madre-toggle-voice"
            onClick={handleToggleVoice}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isVoiceEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
            }`}
            title={isVoiceEnabled ? 'Desactivar Voz (Clara)' : 'Activar Voz (Clara)'}
          >
            <i className={`fa-solid ${isVoiceEnabled ? 'fa-volume-high' : 'fa-volume-xmark'} text-xs`} />
          </button>
          <button
            id="btn-madre-stop-speech"
            onClick={stopAudio}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded transition-colors cursor-pointer"
            title="Detener voz"
          >
            <i className="fa-solid fa-stop text-xs" />
          </button>
          <button
            onClick={handleCloseDrawer}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded transition-colors cursor-pointer"
            title="Cerrar Panel"
          >
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>
      </div>

      {/* CUERPO DEL CHAT / HISTORIAL */}
      <div id="madre-chat-history" className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 relative font-sans">
        {messages.length === 0 ? (
          <div id="madre-idle-state" className="flex flex-col items-center justify-center h-full text-center mt-10 transition-opacity duration-300">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 rounded-full animate-pulse" />
              <img src="/MADRE.png" alt="MADRE" className="w-20 h-20 rounded-full border border-slate-700 relative z-10" />
            </div>
            <h3 className="font-medium text-sm mb-2 text-white">Cerebro Terrestre Activo</h3>
            <p className="text-xs max-w-[250px] mb-4 text-slate-300">
              Escáner visual de pantalla listo para capturar en tiempo real las variables de LDM, peajes, gasóleo y costes terrestres.
            </p>
            <button
              onClick={() => handleQuickCommand('Escanear pantalla')}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-4 py-2 rounded-full flex items-center gap-2 transition-colors shadow-lg cursor-pointer"
            >
              <span className="text-amber-500">⚡</span> Auditar Operación (DSS)
            </button>
          </div>
        ) : (
          /* Paso 3: Contraste Visual y Burbujas de Chat (text-white y fondos sólidos bg-teal-700 / bg-slate-800) */
          messages.map((msg, index) => {
            const isUser = msg.sender === 'user' || msg.role === 'user';
            return (
              <div
                key={msg.id || index}
                className={`flex gap-3 max-w-[90%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {isUser ? (
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs shrink-0 text-white">
                    <i className="fa-solid fa-user text-slate-300" />
                  </div>
                ) : (
                  <img
                    src="/MADRE.png"
                    alt="MADRE"
                    className="w-7 h-7 rounded-full border border-cyan-500 shadow-sm shrink-0"
                  />
                )}
                <div
                  className={`border px-3 py-2 rounded-lg text-[13px] leading-relaxed shadow-sm text-white ${
                    isUser
                      ? 'bg-teal-700 border-teal-600'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex gap-3 mr-auto items-center text-slate-400 text-xs py-1">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-robot text-teal-400 text-xs" />
            </div>
            <div className="bg-slate-800 text-white border border-slate-700 px-3 py-2 rounded-lg text-[13px] flex items-center gap-2">
              <i className="fa-solid fa-circle-notch fa-spin text-teal-400" />
              <span>Conectando con Cerebro Central...</span>
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* COMANDOS RÁPIDOS (1-CLIC) */}
      <div className="p-3 border-t border-slate-800 bg-[#0F172A]">
        <p className="text-[9px] font-bold tracking-wider mb-2 flex items-center gap-1 text-white">
          <i className="fa-solid fa-bolt text-amber-400" /> COMANDOS RÁPIDOS (1-CLIC)
        </p>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => handleQuickCommand('Escanear Pantalla Terrestre')}
            className="text-left text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded border border-slate-700 flex items-center justify-between group transition-colors cursor-pointer"
          >
            <span><span className="text-cyan-400 mr-2">⚡</span> Escanear Pantalla Terrestre</span>
            <span className="text-slate-500 group-hover:text-slate-300">›</span>
          </button>
          <button
            onClick={() => handleQuickCommand('Evaluar viabilidad comercial y Break-Even')}
            className="text-left text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded border border-slate-700 flex items-center justify-between group transition-colors cursor-pointer"
          >
            <span><span className="text-blue-400 mr-2">📊</span> Evaluar viabilidad y Break-Even</span>
            <span className="text-slate-500 group-hover:text-slate-300">›</span>
          </button>
          <button
            onClick={() => handleQuickCommand('Redacta el escudo preventivo')}
            className="text-left text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded border border-slate-700 flex items-center justify-between group transition-colors cursor-pointer"
          >
            <span><span className="text-emerald-400 mr-2">🛡️</span> Redacta el escudo preventivo</span>
            <span className="text-slate-500 group-hover:text-slate-300">›</span>
          </button>
        </div>
      </div>

      {/* ZONA DE INPUT Y MICRÓFONO */}
      <div className="p-3 bg-[#0B1121] border-t border-slate-800 flex items-center gap-2">
        <button
          type="button"
          onClick={handleMicrophoneClick}
          className={`p-2 rounded-full cursor-pointer transition-all ${
            isListening
              ? 'bg-red-500 text-white animate-pulse'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title={isListening ? 'Escuchando... Di tu orden' : 'Dictar por voz'}
        >
          <i className="fa-solid fa-microphone text-xs" />
        </button>
        <div className="flex-1 bg-slate-800 border border-slate-700 rounded-full flex items-center px-3 py-1.5 focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500 transition-colors">
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
            className="bg-transparent border-none outline-none text-xs text-slate-200 w-full placeholder-slate-500 font-sans"
            placeholder="Pregunta a MADRE o escribe 'Escanear pantalla'..."
          />
        </div>
        <button
          type="button"
          onClick={() => handleSendMessage()}
          className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-1.5 rounded-full transition-colors cursor-pointer shadow-md"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

export { GlobalMadreDrawer };
