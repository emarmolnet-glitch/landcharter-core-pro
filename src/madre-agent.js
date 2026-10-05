// src/madre-agent.js
// Integración de MADRE (IA Ejecutiva de Voz estilo HAL 9000) en Land Charter
// Conexión con Data Bridge, telemetría de DOM y enrutamiento con los 3 sub-agentes locales.

const MADRE_ENDPOINT = "/.netlify/functions/madre-ia";

let isMadreOpen = false;
let isSpeaking = false;
let isListening = false;
let isVoiceExplicitlyStopped = false;
let recognitionInstance = null;

/**
 * 1. Telemetría Estricta al Cerebro Central
 * Extrae contexto_ui leyendo los selectores del informe técnico y estado global
 */
export function extractLandCharterTelemetry() {
  const readVal = (id) => {
    const el = document.getElementById(id);
    return el ? (el.value !== undefined ? el.value : el.textContent?.trim()) : null;
  };

  const pol = readVal("port-pol") || readVal("input-pol") || window.State?.pol || window.State?.origin || "";
  const pod = readVal("port-pod") || readVal("input-pod") || window.State?.pod || window.State?.destination || "";
  const distTotal = readVal("dist-total") || readVal("input-distance-nm") || window.State?.distanceKm || window.State?.totalKilometers || 0;
  const cargoQty = readVal("cargo-qty") || readVal("cargo-tonnage") || window.State?.cargoQty || window.State?.cargoQuantity || 0;
  const vehicleType = readVal("nombre-buque-calculadora") || readVal("vehicle_type") || window.State?.vehicleType || window.State?.truckType || "Camión / Tráiler";
  
  // Estado global y modo de proyectos
  const isProjectMode = Boolean(window.State?.isProjectMode || window.State?.activeModule === 'proyectos' || document.getElementById('view-forwarders')?.classList.contains('active-block'));
  
  // Sub-agente visible / activo
  let iaActiva = "cerebro";
  const agentTitle = document.getElementById("sea-assistant-title")?.textContent || "";
  if (agentTitle.includes("Core")) {
    iaActiva = "core";
  } else if (document.querySelector(".agente-proyectos-widget") || isProjectMode) {
    iaActiva = "proyectos";
  }

  return {
    pol: String(pol).trim(),
    pod: String(pod).trim(),
    distance_km: Number(distTotal) || 0,
    tonnage: Number(cargoQty) || 0,
    vehicle_type: String(vehicleType).trim(),
    isProjectMode,
    iaActiva,
    active_project_ref: window.State?.project_ref || window.referenciaActivaGlobal || null
  };
}

/**
 * Envía instrucción a MADRE con telemetría obligatoria
 */
export async function sendPromptToMadre(promptText) {
  const telemetry = extractLandCharterTelemetry();

  const payload = {
    current_module: "land_charter", // OBLIGATORIO
    prompt: promptText,
    contexto_ui: telemetry,
    timestamp: new Date().toISOString()
  };

  try {
    const res = await fetch(MADRE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Context": "land_charter"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    return handleMadreResponse(data);
  } catch (err) {
    console.error("[MADRE] Error comunicando con Cerebro Central:", err);
    return {
      success: false,
      reply: "Disculpa, tengo un problema de enlace con el Cerebro Central en Data Bridge.",
      accion_ui: "none"
    };
  }
}

/**
 * 2. Recepción y Ejecución de Delegación (El Handoff)
 * Despacha acciones hacia Cerebro.ia, Asistente Core o Agente de Proyectos
 */
export async function handleMadreResponse(data) {
  if (!data) return;

  const reply = data.reply || data.respuesta || "Instrucción procesada.";
  const accion = data.accion_ui || data.action || "none";
  const delegation = data.delegation_payload || data.payload || {};

  // Sintetizar voz HAL 9000
  speakHalVoice(reply);

  // Ejecución de la delegación según arquitectura
  switch (accion) {
    case "delegar_cerebro_ia": {
      console.log("🔴 [MADRE -> Cerebro.ia] Inyectando datos en formulario mediante dispatchEvent...", delegation);
      injectToCerebroInputs(delegation);
      break;
    }

    case "delegar_asistente_core": {
      console.log("🤖 [MADRE -> Asistente Core] Transfiriendo consulta...", delegation);
      if (typeof window.setActiveAgent === "function") {
        window.setActiveAgent("core");
      }
      if (typeof window.setSelectedModel === "function") {
        window.setSelectedModel("Asistente Core");
      }
      // Cambiar modelo activo en el UI del Asistente del Mar
      const aiSelector = document.getElementById("ai-model-selector");
      if (aiSelector) {
        aiSelector.value = "core";
        aiSelector.dispatchEvent(new Event("change", { bubbles: true }));
      }
      // Abrir panel lateral izquierdo si existe
      document.getElementById("sea-assistant-toggle")?.click();
      // Inyectar prompt
      const inputCore = document.querySelector(".sca-input");
      if (inputCore && delegation.query) {
        inputCore.value = delegation.query;
        document.querySelector(".sca-send-btn")?.click();
      }
      break;
    }

    case "delegar_agente_proyectos": {
      console.log("📋 [MADRE -> Agente Proyectos] Delegando en Jefe de Tráfico (Blindaje: Sin Delete)...", delegation);
      // Validar si existe función puente expuesta por ForwarderWorkspace
      if (typeof window.handleApplyProjectPayload === "function") {
        window.handleApplyProjectPayload(delegation);
      } else if (typeof window.handleProjectAgentPayload === "function") {
        window.handleProjectAgentPayload(delegation);
      }
      // Guardar de forma segura si se solicita actualizar
      if (delegation.action === "save_project" && typeof window.handleSaveProject === "function") {
        window.handleSaveProject();
      }
      break;
    }

    case "navegar_vista":
    case "cambiar_pestana": {
      const destino = (delegation.vista || delegation.target || "").toLowerCase();
      console.log("🧭 [MADRE] Ejecutando navegación UI hacia:", destino);
      
      // Buscar botones en el menú lateral o en las pestañas móviles que coincidan con el destino
      const tabs = typeof document.querySelectorAll === "function" ? Array.from(document.querySelectorAll('button, li, a, .module-tab')) : [];
      
      if (destino.includes("calculadora") || destino.includes("ldm")) {
        const btn = tabs.find(el => (el.textContent && el.textContent.toLowerCase().includes("calculadora")) || el.dataset?.moduleId === "calculadora" || el.dataset?.["module-id"] === "calculadora")
          || (typeof document.querySelector === "function" && (document.querySelector("[data-module-id='calculadora']") || document.querySelector("button[data-module-id='calculadora']")));
        if (btn) btn.click();
      } else if (destino.includes("proyecto") || destino.includes("forwarder")) {
        const btn = tabs.find(el => (el.textContent && el.textContent.toLowerCase().includes("proyecto")) || el.dataset?.moduleId === "proyectos" || el.dataset?.["module-id"] === "proyectos")
          || (typeof document.querySelector === "function" && (document.querySelector("[data-module-id='proyectos']") || document.querySelector("button[data-module-id='proyectos']")));
        if (btn) btn.click();
      } else if (destino.includes("ruta") || destino.includes("mapa") || destino.includes("terrestre")) {
        const btn = tabs.find(el => (el.textContent && el.textContent.toLowerCase().includes("ruta")) || el.dataset?.moduleId === "rutas" || el.dataset?.["module-id"] === "rutas")
          || (typeof document.querySelector === "function" && (document.querySelector("[data-module-id='rutas']") || document.querySelector("button[data-module-id='rutas']")));
        if (btn) btn.click();
      }
      break;
    }

    default:
      console.log("ℹ️ [MADRE] Acción ejecutada:", accion);
  }

  return data;
}

/**
 * Inyección sintética para Cerebro.ia
 */
function injectToCerebroInputs(data) {
  const setAndDispatch = (id, val) => {
    if (val === undefined || val === null || val === "") return;
    const el = document.getElementById(id);
    if (!el) return;
    el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  };

  if (data.pol || data.origin) setAndDispatch("port-pol", data.pol || data.origin);
  if (data.pod || data.destination) setAndDispatch("port-pod", data.pod || data.destination);
  if (data.tonnage) setAndDispatch("cargo-qty", data.tonnage);
  if (data.vehicle_type || data.truck_type) {
    setAndDispatch("nombre-buque-calculadora", data.vehicle_type || data.truck_type);
    if (typeof window.handleVehicleTypeSelection === "function") {
      window.handleVehicleTypeSelection(data.vehicle_type || data.truck_type);
    }
  }

  // Si se dispone de calculateLandRouteByCoordinates o calculateOsrmRoute, lanzar
  const polVal = document.getElementById("port-pol")?.value;
  const podVal = document.getElementById("port-pod")?.value;
  if (polVal && podVal) {
    const routeFn = window.calculateLandRouteByCoordinates || window.calculateOsrmRoute;
    if (typeof routeFn === "function") {
      routeFn(polVal, podVal).catch((e) => console.warn("[MADRE] Recálculo OSRM:", e));
    }
  }
}

/**
 * Sintetizador de voz HAL 9000
 */
function speakHalVoice(text) {
  if (!window.speechSynthesis) return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 0.92; // Tono pausado y calmado estilo HAL
    utterance.pitch = 0.82; // Voz profunda

    const voices = window.speechSynthesis.getVoices();
    const deepVoice = voices.find(v => v.lang.startsWith("es") && (v.name.includes("Male") || v.name.includes("Jorge") || v.name.includes("Raul")));
    if (deepVoice) utterance.voice = deepVoice;

    // Animación del ojo de HAL mientras habla
    const halEye = document.getElementById("madre-hal-pupil");
    utterance.onstart = () => {
      isSpeaking = true;
      if (halEye) halEye.classList.add("madre-pulsing");
    };
    utterance.onend = () => {
      isSpeaking = false;
      if (halEye) halEye.classList.remove("madre-pulsing");
    };
    utterance.onerror = () => {
      isSpeaking = false;
      if (halEye) halEye.classList.remove("madre-pulsing");
    };

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("[MADRE] Error en síntesis de voz:", e);
  }
}

/**
 * 3. Inyección de la UI en el Header y Panel Lateral Off-canvas con z-[9999]
 */
export function mountMadreUI() {
  // 1. Eliminar botón erróneo anterior si existiera en el DOM
  const oldBtn = document.getElementById("btn-open-madre");
  if (oldBtn) {
    oldBtn.remove();
  }

  // 2. Eliminar panel flotante anterior si existiera
  const oldPanel = document.getElementById("madre-executive-panel");
  if (oldPanel) {
    oldPanel.remove();
  }

  // 3. Configurar listener en el botón del Header toggle-madre-btn
  const toggleBtn = document.getElementById("toggle-madre-btn");
  if (toggleBtn && !toggleBtn.dataset.bound) {
    toggleBtn.dataset.bound = "true";
    toggleBtn.onclick = () => toggleMadrePanel();
  }

  // Actualizar referencia en la píldora de sesión
  updateActiveSessionReference();

  // 4. Configurar listeners del Panel Lateral Off-canvas #madre-panel
  const sidePanel = document.getElementById("madre-panel");
  if (sidePanel) {
    const inputEl = sidePanel.querySelector("input");
    const sendBtn = sidePanel.querySelector("button[type='submit']") || sidePanel.querySelector("button.bg-blue-600") || sidePanel.querySelector("button.bg-slate-900");
    const micBtn = document.getElementById("madre-mic-btn") || sidePanel.querySelector("button svg path[d*='M19 11']")?.closest("button");

    const submitChat = async () => {
      const text = inputEl?.value?.trim();
      if (!text) return;
      inputEl.value = "";
      appendMadreMessage("user", text);
      const response = await sendPromptToMadre(text);
      if (response && response.reply) {
        appendMadreMessage("madre", response.reply);
      }
    };

    if (sendBtn && !sendBtn.dataset.bound) {
      sendBtn.dataset.bound = "true";
      sendBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        submitChat();
      });
    }

    const chatForm = document.getElementById("madre-chat-form") || sidePanel.querySelector("form");
    if (chatForm && !chatForm.dataset.bound) {
      chatForm.dataset.bound = "true";
      chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        e.stopPropagation();
        submitChat();
      });
    }

    if (inputEl && !inputEl.dataset.bound) {
      inputEl.dataset.bound = "true";
      inputEl.addEventListener("click", (e) => e.stopPropagation());
      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submitChat();
        }
      });
    }

    if (micBtn && !micBtn.dataset.bound) {
      micBtn.dataset.bound = "true";
      micBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleVoiceRecognition();
      });
    }

    const closeBtn = sidePanel.querySelector("button svg path[d*='M6 18L18 6']")?.closest("button");
    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.dataset.bound = "true";
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMadrePanel(false);
      });
    }

    // Activación de Voz por Clic Global en el panel lateral (Escucha Táctil)
    if (!sidePanel.dataset.touchVoiceBound) {
      sidePanel.dataset.touchVoiceBound = "true";
      sidePanel.addEventListener("click", (e) => {
        // No activar si se pulsa cerrar, silenciar, enviar o inputs
        const target = e.target;
        if (target.closest("button") || target.closest("input") || target.closest("textarea")) {
          return;
        }
        if (!isListening) {
          toggleVoiceRecognition();
        }
      });
    }

    // Comandos rápidos: Genera los 3 escenarios & Redacta el escudo preventivo
    const quickButtons = sidePanel.querySelectorAll("button");
    quickButtons.forEach((btn) => {
      const txt = btn.textContent || "";
      if (txt.includes("Genera los 3 escenarios") && !btn.dataset.bound) {
        btn.dataset.bound = "true";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (inputEl) inputEl.value = "Genera los 3 escenarios";
          submitChat();
        });
      } else if (txt.includes("Redacta el escudo preventivo") && !btn.dataset.bound) {
        btn.dataset.bound = "true";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (inputEl) inputEl.value = "Redacta el escudo preventivo";
          submitChat();
        });
      }
    });
  }
}

export function updateActiveSessionReference(ref) {
  const activeRefEl = document.getElementById("madre-session-ref-text") || document.getElementById("madre-active-reference");
  if (!activeRefEl) return;
  const currentRef = ref 
    || window.State?.project_ref 
    || window.referenciaActivaGlobal 
    || document.getElementById("quick-ref")?.value 
    || "RDM/2026-0042";
  activeRefEl.textContent = String(currentRef).trim() || "RDM/2026-0042";
}

export function updateMadreStatusUI(status) {
  const toggleBtn = document.getElementById("toggle-madre-btn");
  if (!toggleBtn) return;
  const textSpan = toggleBtn.querySelector("span");
  const dot = toggleBtn.querySelector("div");

  if (status === "ESCUCHANDO") {
    if (textSpan) textSpan.textContent = "ESCUCHANDO";
    if (dot) {
      dot.className = "w-2 h-2 rounded-full bg-emerald-500 border border-emerald-200 animate-pulse";
    }
  } else {
    if (textSpan) textSpan.textContent = "APAGADA";
    if (dot) {
      dot.className = "w-2 h-2 rounded-full bg-red-500 border border-red-200";
    }
  }
}

export function toggleMadrePanel(forceState) {
  const panel = document.getElementById("madre-panel") || document.getElementById("madre-side-panel") || document.getElementById("madre-executive-panel");
  if (!panel) return;

  if (typeof forceState === "boolean") {
    isMadreOpen = forceState;
  } else {
    isMadreOpen = !isMadreOpen;
  }

  if (isMadreOpen) {
    panel.classList.remove("translate-x-full");
    panel.classList.remove("hidden");
    updateActiveSessionReference();
    updateMadreStatusUI(isListening ? "ESCUCHANDO" : "APAGADA");
    const input = document.getElementById("madre-input") || document.getElementById("madre-side-input") || document.getElementById("madre-text-input");
    input?.focus();
    // Mensaje de saludo auditivo si es la primera apertura
    if (!panel.dataset.greeted) {
      panel.dataset.greeted = "true";
      speakHalVoice("MADRE conectada a Land Charter. Supervisión holística activa.");
    }

    // Activación automática de voz al abrir
    setTimeout(() => {
      if (!isListening) {
        toggleVoiceRecognition();
      }
    }, 400);
  } else {
    panel.classList.add("translate-x-full");
    updateMadreStatusUI("APAGADA");
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    detenerReconocimientoVoz();
  }
}

function updateHudDisplay() {
  const t = extractLandCharterTelemetry();
  const hudPol = document.getElementById("hud-pol");
  const hudPod = document.getElementById("hud-pod");
  const hudDist = document.getElementById("hud-dist");
  const hudVehicle = document.getElementById("hud-vehicle");

  if (hudPol) hudPol.textContent = t.pol || "Sétif";
  if (hudPod) hudPod.textContent = t.pod || "Béjaïa";
  if (hudDist) hudDist.textContent = `${t.distance_km || 115} km`;
  if (hudVehicle) hudVehicle.textContent = (t.vehicle_type || "Camión").substring(0, 16);
}

export function appendMadreMessage(sender, text) {
  const log = document.getElementById("madre-dialog-log") || document.getElementById("madre-chat-log") || document.getElementById("madre-chat-container");
  if (!log) return;

  const msgDiv = document.createElement("div");
  const safeText = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  if (sender === "user") {
    msgDiv.className = "flex flex-col items-end mb-3";
    // FUERZA BRUTA: style color white important para saltarse cualquier herencia o fallo de Tailwind JIT
    msgDiv.innerHTML = `<div class="p-3 rounded-2xl rounded-tr-none max-w-[85%] text-sm bg-blue-600 shadow-sm" style="background-color: #2563eb !important; color: #ffffff !important;">
      <p style="color: #ffffff !important; margin: 0; font-weight: 500;">${safeText}</p>
    </div>`;
  } else {
    msgDiv.className = "flex flex-col items-start mb-3";
    msgDiv.innerHTML = `<div class="p-3 rounded-2xl rounded-tl-none max-w-[85%] text-sm bg-slate-50 border border-slate-200 text-slate-800 shadow-sm">
      <p style="margin: 0;">${safeText}</p>
    </div>`;
  }
  
  log.appendChild(msgDiv);
  log.scrollTop = log.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function detenerReconocimientoVoz() {
  isVoiceExplicitlyStopped = true;
  if (recognitionInstance) {
    try {
      recognitionInstance.stop();
    } catch (_) {}
  }
  isListening = false;
  const micBtn = document.getElementById("madre-mic-btn");
  micBtn?.classList.remove("madre-listening");
  updateMadreStatusUI("APAGADA");
}

export function toggleVoiceRecognition() {
  const micBtn = document.getElementById("madre-mic-btn");
  const SpeechRecognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  if (!SpeechRecognition) {
    if (typeof alert === "function") {
      alert("Tu navegador no soporta reconocimiento de voz nativo Web Speech API.");
    } else {
      console.warn("[MADRE] Tu navegador no soporta reconocimiento de voz nativo Web Speech API.");
    }
    return;
  }

  if (isListening && recognitionInstance) {
    detenerReconocimientoVoz();
    return;
  }

  isVoiceExplicitlyStopped = false;

  try {
    const recognition = new SpeechRecognition();
    recognitionInstance = recognition;
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isListening = true;
      micBtn?.classList.add("madre-listening");
      updateMadreStatusUI("ESCUCHANDO");
    };

    recognition.onresult = (event) => {
      if (isSpeaking) {
        return;
      }

      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex || 0; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      const input = document.getElementById("madre-text-input") || document.getElementById("madre-input") || document.querySelector("#madre-panel input");

      if (interimTranscript && input && !finalTranscript) {
        input.value = interimTranscript;
      }

      const transcriptToSubmit = finalTranscript.trim() || (!('isFinal' in (event.results[0] || {})) && event.results[0]?.[0]?.transcript ? event.results[0][0].transcript.trim() : "");

      if (transcriptToSubmit) {
        if (input) input.value = transcriptToSubmit;
        document.getElementById("madre-chat-form")?.dispatchEvent(new Event("submit"));
      }
    };

    recognition.onerror = (e) => {
      console.warn("[MADRE] Error reconocimiento de voz:", e?.error || e);
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        isVoiceExplicitlyStopped = true;
        isListening = false;
        micBtn?.classList.remove("madre-listening");
        updateMadreStatusUI("APAGADA");
      }
    };

    recognition.onend = () => {
      // Si el usuario no ha cerrado explícitamente el asistente ni apagado el micrófono,
      // reiniciamos automáticamente la escucha permanente (bucle de escucha continua)
      if (!isVoiceExplicitlyStopped) {
        try {
          recognition.start();
          return;
        } catch (err) {
          setTimeout(() => {
            if (!isVoiceExplicitlyStopped) {
              try {
                recognition.start();
              } catch (reErr) {
                console.warn("[MADRE] No se pudo reiniciar reconocimiento continuo:", reErr);
                isListening = false;
                micBtn?.classList.remove("madre-listening");
                updateMadreStatusUI("APAGADA");
              }
            }
          }, 150);
          return;
        }
      }

      isListening = false;
      micBtn?.classList.remove("madre-listening");
      updateMadreStatusUI("APAGADA");
    };

    recognition.start();
  } catch (e) {
    console.error("[MADRE] No se pudo iniciar reconocimiento:", e);
    isListening = false;
    micBtn?.classList.remove("madre-listening");
    updateMadreStatusUI("APAGADA");
  }
}

// Funciones de control de audio y voz requeridas
export function toggleAudio() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
  }
}

export function iniciarReconocimientoVoz() {
  toggleVoiceRecognition();
}

export async function enviarMensaje() {
  const inputEl = document.getElementById("madre-text-input") || document.getElementById("madre-input") || document.querySelector("#madre-panel input");
  const text = inputEl?.value?.trim();
  if (!text) return;
  inputEl.value = "";
  appendMadreMessage("user", text);
  const response = await sendPromptToMadre(text);
  if (response && response.reply) {
    appendMadreMessage("madre", response.reply);
  }
}

// Inicialización automática cuando cargue el DOM
if (typeof window !== "undefined") {
  window.toggleAudio = toggleAudio;
  window.iniciarReconocimientoVoz = iniciarReconocimientoVoz;
  window.detenerReconocimientoVoz = detenerReconocimientoVoz;
  window.toggleVoiceRecognition = toggleVoiceRecognition;
  window.enviarMensaje = enviarMensaje;

  if (typeof window.addEventListener === "function") {
    window.addEventListener("DOMContentLoaded", () => {
      mountMadreUI();
    });
  }
  // Si el DOM ya cargó
  if (typeof document !== "undefined" && (document.readyState === "complete" || document.readyState === "interactive")) {
    setTimeout(mountMadreUI, 100);
  }

  // Exportar a window para interoperabilidad global
  window.MadreAgent = {
    mountMadreUI,
    toggleMadrePanel,
    sendPromptToMadre,
    extractLandCharterTelemetry,
    handleMadreResponse,
    toggleAudio,
    iniciarReconocimientoVoz,
    detenerReconocimientoVoz,
    toggleVoiceRecognition,
    enviarMensaje,
    appendMadreMessage,
    getUserHasInteracted: () => userHasInteracted
  };
}

// Almacenar estado de inicialización
let userHasInteracted = false;

export function getUserHasInteracted() {
  return userHasInteracted;
}

// Activación Global (MODO INVISIBLE - SIN ABRIR PANEL)
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    // 1. Ignorar clics si el usuario está interactuando con inputs, botones, enlaces o el propio panel
    if (e.target && typeof e.target.closest === "function" && e.target.closest("input, textarea, button, a, #madre-panel, .module-tabs-wrapper")) {
      return;
    }

    // 2. Encender el micrófono silenciosamente en background SIN abrir el panel
    if (typeof toggleVoiceRecognition === "function" && typeof isListening !== "undefined" && !isListening) {
      console.log("🎙️ [MADRE] Encendiendo micrófono en background por interacción en el mapa.");
      
      // Feedback visual sutil en el botón del header
      const toggleBtnDot = document.querySelector("#toggle-madre-btn div");
      const toggleBtnText = document.querySelector("#toggle-madre-btn span");
      if (toggleBtnDot) toggleBtnDot.className = "w-2 h-2 rounded-full bg-blue-500 border border-blue-200 animate-pulse";
      if (toggleBtnText) toggleBtnText.textContent = "ESCUCHANDO";

      // Activar voz síncrona
      toggleVoiceRecognition();
    }
  });
}

