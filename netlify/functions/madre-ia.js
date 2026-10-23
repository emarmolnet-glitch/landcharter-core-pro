// netlify/functions/madre-ia.js
// Proxy Puro hacia el Cerebro Central de MADRE en Data Bridge

function replaceRoadTermsWithRail(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\btr[aá]ilers\b/gi, (match) => match[0] === match[0].toUpperCase() ? 'Vagones' : 'vagones')
    .replace(/\bcamiones\b/gi, (match) => match[0] === match[0].toUpperCase() ? 'Vagones' : 'vagones')
    .replace(/\btr[aá]iler\b/gi, (match) => match[0] === match[0].toUpperCase() ? 'Vagón' : 'vagón')
    .replace(/\bcami[oó]n\b/gi, (match) => match[0] === match[0].toUpperCase() ? 'Vagón' : 'vagón');
}

function sanitizeRoadTermsInObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      if (!key.toLowerCase().includes('url') && !key.toLowerCase().includes('link') && !key.toLowerCase().includes('endpoint')) {
        obj[key] = replaceRoadTermsWithRail(obj[key]);
      }
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeRoadTermsInObject(obj[key]);
    }
  }
  return obj;
}

// Limpiador robusto para números europeos (ej. "10.000" -> 10000)
function parseLocalNumber(val) {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === 'number') return val;
  let str = String(val).trim().replace(/[a-zA-Z\s]/g, ""); 
  
  const commas = (str.match(/,/g) || []).length;
  const dots = (str.match(/\./g) || []).length;
  
  if (dots === 1 && commas === 0) {
     if (str.split(".").pop().length === 3) str = str.replace(".", ""); 
  } else if (commas === 1 && dots === 0) {
     if (str.split(",").pop().length === 3) str = str.replace(",", "");
     else str = str.replace(",", "."); 
  } else if (dots > 0 && commas > 0) {
     const lastDot = str.lastIndexOf(".");
     const lastComma = str.lastIndexOf(",");
     if (lastDot > lastComma) str = str.replace(/,/g, "");
     else str = str.replace(/\./g, "").replace(/,/g, ".");
  } else if (dots > 1) {
     str = str.replace(/\./g, ""); 
  } else if (commas > 1) {
     str = str.replace(/,/g, "");
  }
  
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : 0;
}

export default async function handler(request) {
  const method = request?.method || request?.httpMethod || "POST";
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-App-Context, x-api-key, X-Requested-With"
      }
    });
  }

  if (method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  let event = request;
  if (request && typeof request.text === "function") {
    const rawText = await request.text().catch(() => "");
    event = { body: rawText, headers: request.headers, method: request.method };
  }

  let body = {};
  let userPrompt = "";
  let isScanCommand = false;
  let isRailMode = false;

  try {
    body = JSON.parse(event.body || "{}");
    userPrompt = String(body.prompt || body.message || body.texto || "").trim();
    const promptLower = userPrompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // 1. Detectar si piden escaneo explícito
    isScanCommand = /escan|scan|pantalla|auditor/i.test(promptLower);

    // 2. Sanitizar las toneladas para que la IA vea "10000" y no "10"
    if (body.contexto_ui) {
        if (body.contexto_ui.toneladas !== undefined) body.contexto_ui.toneladas = parseLocalNumber(body.contexto_ui.toneladas);
        if (body.contexto_ui.tonnage !== undefined) body.contexto_ui.tonnage = parseLocalNumber(body.contexto_ui.tonnage);
        if (body.contexto_ui.porte && body.contexto_ui.porte.cargo !== undefined) {
            body.contexto_ui.porte.cargo = parseLocalNumber(body.contexto_ui.porte.cargo);
        }
    }
    if (body.tonnage !== undefined) body.tonnage = parseLocalNumber(body.tonnage);

    isRailMode = String(
      body.globalTransportMode || body.transportMode || body.transport_mode ||
      body.contexto_ui?.globalTransportMode || body.contexto_ui?.transport_mode ||
      body.contexto_ui?.porte?.transportMode || body.contexto_ui?.porte?.globalTransportMode ||
      (body.isRail ? 'RAIL' : '') || (body.contexto_ui?.isRail ? 'RAIL' : '')
    ).toUpperCase() === 'RAIL' ||
    /tren|tolva|vag[oó]n|ferrocarril|rail/i.test(userPrompt) ||
    /tren|tolva|vag[oó]n|ferrocarril|rail/i.test(String(body.contexto_ui?.tipo_vehiculo || body.contexto_ui?.vehicle_type || body.contexto_ui?.porte?.vehicleType || ''));
    
    const baseUrl = process.env.DATA_BRIDGE_URL || "https://calm-shortbread-55bcfc.netlify.app";
    const dataBridgeEndpoint = `${baseUrl.replace(/\/$/, '')}/.netlify/functions/madre-chat`;

    // 3. Preparar el paquete exacto para Data Bridge
    const remotePayload = {
      mensajeUsuario: userPrompt,
      origen: "Land Charter",
      current_module: body.modulo || "land_charter",
      modulo: body.modulo || "land_charter",
      vista_activa: body.vista_activa || "decisiones",
      contexto_ui: body.contexto_ui || {},
      history: body.history || []
    };

    // 4. Si NO es un comando de escaneo, VACIAR la biblia de datos terrestres
    if (!isScanCommand && remotePayload.contexto_ui) {
        // 1. Borramos los bloques nuevos que causan el Timeout (Error 504)
        delete remotePayload.contexto_ui.bloque1_ruta_distancias;
        delete remotePayload.contexto_ui.bloque2_vehiculo_carga;
        delete remotePayload.contexto_ui.bloque3_tacografo_tiempos;
        delete remotePayload.contexto_ui.bloque4_costes_operativos;
        delete remotePayload.contexto_ui.bloque5_6_7_8_financiero_mercado;

        // 2. Borramos también el formato antiguo por seguridad
        delete remotePayload.contexto_ui.escaneo_land;
        delete remotePayload.contexto_ui.escaneo_terrestre;
        delete remotePayload.contexto_ui.ruta;
        delete remotePayload.contexto_ui.porte;
        delete remotePayload.contexto_ui.costes;
    }

    if (isRailMode) {
      remotePayload.globalTransportMode = 'RAIL';
      remotePayload.transport_mode = 'RAIL';
      remotePayload.isRail = true;
      remotePayload.divisor_flota = 50;
      remotePayload.vehicle_type = 'Vagón Tolva (Ferrocarril)';

      if (remotePayload.contexto_ui) {
        remotePayload.contexto_ui.globalTransportMode = 'RAIL';
        remotePayload.contexto_ui.isRail = true;
        remotePayload.contexto_ui.divisor_flota = 50;
        remotePayload.contexto_ui.vehicle_type = 'Vagón Tolva (Ferrocarril)';
      }

      const ctxTonnage = Number(body.contexto_ui?.toneladas || body.contexto_ui?.porte?.cargo || body.tonnage || 0);
      if (ctxTonnage > 0) {
        const railWagons = Math.ceil(ctxTonnage / 50);
        remotePayload.flota = railWagons;
        remotePayload.total_wagons = railWagons;
        if (remotePayload.contexto_ui) {
          remotePayload.contexto_ui.flota = railWagons;
          remotePayload.contexto_ui.total_wagons = railWagons;
        }
      }
      const railDirective = " [DIRECTIVA FERROVIARIA ESTRICTA: Transporte mediante convoy ferroviario (tren con vagones tolva). Capacidad por vagón tolva = 50 toneladas. Usa siempre la palabra 'vagones' en lugar de 'camiones'. Operación ferroviaria sin peajes de carretera ni dietas de chófer.]";
      remotePayload.mensajeUsuario = userPrompt ? `${userPrompt} ${railDirective}` : railDirective;
    }

    // 5. Conexión real con Data Bridge (Cerebro Central)
    const backendResponse = await fetch(dataBridgeEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(remotePayload)
    });

    if (backendResponse.ok) {
      let data = await backendResponse.json();
      
      // Adaptación de Interfaz para Land Charter
      if (data.accion_ui === "navegar") {
        data.accion_ui = "navegar_vista";
        data.delegation_payload = { vista: data.destino };
      }
      
      data.sender = "MADRE";
      data.reply = data.mensaje_voz || data.respuesta || data.reply || "Operación procesada en Data Bridge.";

      if (isRailMode) {
        data.globalTransportMode = 'RAIL';
        data.divisor_flota = 50;
        sanitizeRoadTermsInObject(data);
      }

      // Regla cadencia (No permitir 1 vehículo/día en volumen alto)
      const divisorRemote = isRailMode ? 50 : 24;
      const ctxPayload = body.contexto_ui || {};
      const totalVehiculosRemote = Number(
        data.total_wagons || data.total_trucks || data.totalVehiculos || ctxPayload.total_wagons || ctxPayload.total_trucks || ctxPayload.flota ||
        (ctxPayload.toneladas ? Math.ceil(Number(ctxPayload.toneladas) / divisorRemote) : 0) || 0
      );
      const bufferDaysRemote = Number(ctxPayload.bufferEntrega || ctxPayload.laycanBuffer || data.bufferDays || 0) || 7;
      
      if (totalVehiculosRemote > 1) {
        const dynamicCadence = Math.ceil(totalVehiculosRemote / bufferDaysRemote);
        if (data.cadencia === 1 || data.cadenciaSugerida === 1) {
          data.cadencia = dynamicCadence;
          if (data.cadenciaSugerida) data.cadenciaSugerida = dynamicCadence;
        }
        if (typeof data.reply === "string" && /1\s*(?:camión|vehículo)\s*al\s*día/i.test(data.reply)) {
          data.reply = data.reply.replace(/1\s*(?:camión|vehículo)\s*al\s*día/gi, `${dynamicCadence} vehículos al día`);
        }
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    throw new Error(`Data Bridge devolvió HTTP ${backendResponse.status}`);

  } catch (error) {
    // 6. Si Data Bridge falla, lo reporta explícitamente en vez de inventar respuestas locales
    console.error("⚠️ [MADRE Proxy] Fallo de conexión remota:", error.message);
    return new Response(JSON.stringify({
      success: false,
      sender: "Sistema",
      reply: `⚠️ Error de conexión con MADRE en Data Bridge: ${error.message}. Por favor, revisa el servidor central.`,
      isError: true,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
