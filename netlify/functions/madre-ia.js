// netlify/functions/madre-ia.js
// Proxy / Gateway hacia el Cerebro Central de MADRE en Data Bridge

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

export default async function handler(request) {
  // 1. Manejo de CORS preflight
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

  // Soporte universal para Web API Request (Netlify v2) y AWS Lambda event
  let event = request;
  if (request && typeof request.text === "function") {
    const rawText = await request.text().catch(() => "");
    event = {
      body: rawText,
      headers: request.headers,
      method: request.method
    };
  }

  let body = {};
  let userPrompt = "";
  let isRailMode = false;

  try {
    body = JSON.parse(event.body || "{}");
    userPrompt = String(body.prompt || body.message || body.texto || "").trim();

    isRailMode = String(
      body.globalTransportMode ||
      body.transportMode ||
      body.transport_mode ||
      body.contexto_ui?.globalTransportMode ||
      body.contexto_ui?.transport_mode ||
      body.contexto_ui?.porte?.transportMode ||
      body.contexto_ui?.porte?.globalTransportMode ||
      (body.isRail ? 'RAIL' : '') ||
      (body.contexto_ui?.isRail ? 'RAIL' : '')
    ).toUpperCase() === 'RAIL' ||
    /tren|tolva|vag[oó]n|ferrocarril|rail/i.test(userPrompt) ||
    /tren|tolva|vag[oó]n|ferrocarril|rail/i.test(String(body.contexto_ui?.tipo_vehiculo || body.contexto_ui?.vehicle_type || body.contexto_ui?.porte?.vehicleType || ''));
    
    // URL base por variable de entorno
    const baseUrl = process.env.DATA_BRIDGE_URL || "https://calm-shortbread-55bcfc.netlify.app";
    // EL ENDPOINT REAL EN DATA BRIDGE ES madre-chat
    const dataBridgeEndpoint = `${baseUrl.replace(/\/$/, '')}/.netlify/functions/madre-chat`;

    console.log(" puenteeando hacia Data Bridge ->", dataBridgeEndpoint);
    console.log("🔍 [DEBUG RED] Intentando conectar con Data Bridge en la URL exacta:", dataBridgeEndpoint);

    // Formatear el payload EXACTAMENTE como lo espera Data Bridge (madre-chat.js)
    const remotePayload = {
      mensajeUsuario: userPrompt,
      origen: "Land Charter",
      current_module: body.modulo || "land_charter",
      modulo: body.modulo || "land_charter",
      vista_activa: body.vista_activa || "decisiones",
      contexto_ui: body.contexto_ui || {},
      history: body.history || []
    };

    if (isRailMode) {
      remotePayload.globalTransportMode = 'RAIL';
      remotePayload.transport_mode = 'RAIL';
      remotePayload.transportMode = 'RAIL';
      remotePayload.isRail = true;
      remotePayload.fleet_tonnage_divisor = 50;
      remotePayload.divisor_flota = 50;
      remotePayload.wagon_capacity = 50;
      remotePayload.vagon_capacity = 50;
      remotePayload.truck_capacity = 50;
      remotePayload.vehicle_capacity = 50;
      remotePayload.fleet_capacity = 50;
      remotePayload.vehicle_type = 'Vagón Tolva (Ferrocarril)';
      remotePayload.tipo_vehiculo = 'Vagón Tolva (Ferrocarril)';

      if (remotePayload.contexto_ui) {
        remotePayload.contexto_ui.globalTransportMode = 'RAIL';
        remotePayload.contexto_ui.transport_mode = 'RAIL';
        remotePayload.contexto_ui.isRail = true;
        remotePayload.contexto_ui.fleet_tonnage_divisor = 50;
        remotePayload.contexto_ui.divisor_flota = 50;
        remotePayload.contexto_ui.wagon_capacity = 50;
        remotePayload.contexto_ui.vagon_capacity = 50;
        remotePayload.contexto_ui.truck_capacity = 50;
        remotePayload.contexto_ui.vehicle_type = 'Vagón Tolva (Ferrocarril)';
        remotePayload.contexto_ui.tipo_vehiculo = 'Vagón Tolva (Ferrocarril)';
      }

      const ctxTonnage = Number(
        body.contexto_ui?.toneladas ||
        body.contexto_ui?.porte?.cargo ||
        body.contexto_ui?.tonnage ||
        body.tonnage || 0
      );
      if (ctxTonnage > 0) {
        const railWagons = Math.ceil(ctxTonnage / 50);
        remotePayload.flota = railWagons;
        remotePayload.total_trucks = railWagons;
        remotePayload.total_wagons = railWagons;
        remotePayload.totalVehiculos = railWagons;
        if (remotePayload.contexto_ui) {
          remotePayload.contexto_ui.flota = railWagons;
          remotePayload.contexto_ui.total_trucks = railWagons;
          remotePayload.contexto_ui.total_wagons = railWagons;
        }
      }

      const railDirective = " [DIRECTIVA FERROVIARIA ESTRICTA: Transporte mediante convoy ferroviario (tren con vagones tolva). Capacidad por vagón tolva = 50 toneladas (divisor de cálculo de flota = 50t, NO 24t). Usa siempre la palabra 'vagones' en lugar de 'camiones' o 'trailers'. Operación ferroviaria sin peajes de carretera ni dietas de chófer.]";
      remotePayload.mensajeUsuario = userPrompt ? `${userPrompt} ${railDirective}` : railDirective;
    }

    // Intentar conexión real con el Cerebro Central
    const backendResponse = await fetch(dataBridgeEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(remotePayload)
    });

    if (backendResponse.ok) {
      let data = await backendResponse.json();
      
      // --- CAPA DE ADAPTACIÓN: DATA BRIDGE (LLM) -> LAND CHARTER (FRONTEND) ---
      
      // 1. Mapeo de navegación directa (Data Bridge devuelve "navegar" y "destino")
      if (data.accion_ui === "navegar") {
        data.accion_ui = "navegar_vista";
        data.delegation_payload = { vista: data.destino };
      }
      
      // 2. Mapeo de herramientas ejecutadas en background (Cerebro IA, Asistente Core)
      if (!data.accion_ui && data.herramientasEjecutadas && data.herramientasEjecutadas.length > 0) {
        const ultimaHerramienta = data.herramientasEjecutadas[data.herramientasEjecutadas.length - 1];
        const nombre = ultimaHerramienta.herramienta;
        const args = ultimaHerramienta.argumentos || {};
        const res = ultimaHerramienta.resultado || {};

        if (nombre === "delegar_cerebro_ia") {
          data.accion_ui = "delegar_cerebro_ia";
          data.delegation_payload = {
            pol: res.origen || args.origen || "Sétif",
            pod: res.destino || args.destino || "Béjaïa",
            tonnage: 8000,
            vehicle_type: isRailMode ? "Vagón Tolva (Ferrocarril)" : (res.tipo_vehiculo || args.tipo_vehiculo || "Camión Plataforma")
          };
        } else if (nombre === "delegar_asistente_core") {
          data.accion_ui = "delegar_asistente_core";
          data.delegation_payload = { query: args.consulta || args.query };
        } else if (nombre === "delegar_agente_proyectos") {
          data.accion_ui = "delegar_agente_proyectos";
          data.delegation_payload = { operacion: args.operacion, expediente_id: args.expediente_id };
        }
      }

      // Asegurar que el remitente sea MADRE para los estilos de chat
      data.sender = "MADRE";
      // Asegurar que el mensaje de voz se renderice en el chat si viene como 'respuesta'
      data.reply = data.mensaje_voz || data.respuesta || data.reply || "Operación completada.";

      if (isRailMode) {
        data.globalTransportMode = 'RAIL';
        data.fleet_tonnage_divisor = 50;
        data.divisor_flota = 50;
        data.wagon_capacity = 50;

        const ctxPayload = body.contexto_ui || {};
        const ctxTonnage = Number(
          ctxPayload.toneladas || ctxPayload.porte?.cargo || ctxPayload.tonnage || data.delegation_payload?.tonnage || 0
        );
        let railWagons = 0;
        if (ctxTonnage > 0) {
          railWagons = Math.ceil(ctxTonnage / 50);
        } else {
          const rawVehicles = Number(data.total_trucks || data.totalVehiculos || ctxPayload.total_trucks || ctxPayload.flota || 0);
          if (rawVehicles > 0) {
            railWagons = Math.ceil((rawVehicles * 24) / 50);
          }
        }
        if (railWagons > 0) {
          data.total_trucks = railWagons;
          data.total_wagons = railWagons;
          data.totalVehiculos = railWagons;
          data.flota = railWagons;
          if (data.delegation_payload) {
            data.delegation_payload.total_trucks = railWagons;
            data.delegation_payload.total_wagons = railWagons;
          }
        }

        sanitizeRoadTermsInObject(data);
      }

      // Regla Fase 4: MADRE jamás debe sugerir una cadencia de 1 vehículo al día en operaciones de alto volumen
      const ctxPayload = body.contexto_ui || {};
      const divisorRemote = isRailMode ? 50 : 24;
      const totalVehiculosRemote = Number(
        data.total_wagons || data.total_trucks || data.totalVehiculos || ctxPayload.total_wagons || ctxPayload.total_trucks || ctxPayload.flota ||
        (ctxPayload.toneladas ? Math.ceil(Number(ctxPayload.toneladas) / divisorRemote) : 0) ||
        (data.delegation_payload?.tonnage ? Math.ceil(Number(data.delegation_payload.tonnage) / divisorRemote) : 0) || 0
      );
      const bufferDaysRemote = Number(ctxPayload.bufferEntrega || ctxPayload.laycanBuffer || ctxPayload.deliveryBufferDays || data.bufferDays || 0) || 7;
      if (totalVehiculosRemote > 1) {
        const dynamicCadence = Math.ceil(totalVehiculosRemote / bufferDaysRemote);
        if (data.cadencia === 1 || data.modificacionesRecap?.cadencia === 1 || data.cadenciaSugerida === 1) {
          data.cadencia = dynamicCadence;
          if (data.modificacionesRecap) {
            data.modificacionesRecap.cadencia = dynamicCadence;
            data.modificacionesRecap.cadenciaSugerida = dynamicCadence;
          }
          if (data.cadenciaSugerida) data.cadenciaSugerida = dynamicCadence;
        }
        if (data.delegation_payload && data.delegation_payload.cadencia === 1) {
          data.delegation_payload.cadencia = dynamicCadence;
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

    throw new Error(`Data Bridge respondió con estado: ${backendResponse.status}`);

  } catch (error) {
    console.error("⚠️ [MADRE Proxy] Fallo de conexión remota:", error.message);
    console.error(`[madre-ia] Error devuelto por Data Bridge: ${error.message}`);

    // --- MANEJO ESPECIALIZADO DE AUDITORÍA ESTRATÉGICA LAND CHARTER ---
    if (body.vista_activa === "decisiones" || body.modulo === "land_charter" || /auditor[ií]a/i.test(userPrompt)) {
      const ctx = body.contexto_ui || {};
      const porte = ctx.porte || {};
      const ruta = ctx.ruta || {};
      const costes = ctx.costes || {};
      const peajes = Number(ctx.peajes) || 0;
      const ldm = Number(ctx.ldm) || 13.6;
      const flete = Number(porte.fleteEstimado) || 1200;
      const breakEven = Number(porte.breakEven) || 950;
      const margen = flete > 0 ? ((flete - breakEven) / flete) * 100 : 0;

      let veredicto = "🟢";
      if (margen < 5) veredicto = "🔴";
      else if (margen < 18) veredicto = "🟡";

      const variablesPerjudiciales = [
        "Riesgo de paralización en frontera / aduana (>3h sin indemnización)",
        "Retorno en vacío no cubierto en destino secundario",
        peajes > 200 ? "Sobrecoste elevado de peajes y euroviñeta no repercutidos" : "Volatilidad del gasóleo profesional sin cláusula de indexación"
      ];

      const recomendaciones = [
        {
          tipo: "pro",
          titulo: "Cláusula de Paralización Estricta",
          descripcion: "Exigir compensación contractual de 60 €/hora a partir de la 3ª hora de demora en carga, descarga o aduana."
        },
        {
          tipo: "pro",
          titulo: "Recargo por Reposicionamiento en Vacío",
          descripcion: `Garantizar una tarifa base revisada de ${(flete * 1.08).toFixed(2)} € para absorber retornos vacíos.`
        },
        {
          tipo: "contra",
          titulo: "Aceptar Flete Cerrado sin Cláusula de Combustible",
          descripcion: "Un aumento del 5% en diésel neutralizaría el margen neto proyectado del transporte."
        }
      ];

      const reporteEstrategico = `Auditoría Estratégica Terrestre completada para la ruta ${ruta.origen || 'Origen'} ➔ ${ruta.destino || 'Destino'} (${ruta.distanciaKm || 0} km, ${ldm} LDM). Con un flete proyectado de ${flete} € y un coste operativo base de ${breakEven} € (incluyendo ${peajes} € en peajes), el margen bruto estimado se sitúa en el ${margen.toFixed(1)}%. Se detecta exposición comercial crítica ante demoras en muelle o retornos en vacío. Se recomienda proceder bajo la Opción B contractual con blindaje de paralizaciones.`;

      const divisorLocal = isRailMode ? 50 : 24;
      const totalVehiculosLocal = Number(
        porte.total_wagons || porte.total_trucks || porte.trucks_needed || ctx.flota || ctx.total_trucks ||
        (ctx.toneladas ? Math.ceil(Number(ctx.toneladas) / divisorLocal) : (porte.cargo ? Math.ceil(Number(porte.cargo) / divisorLocal) : 0)) || 0
      );
      const bufferDaysLocal = Number(ctx.bufferEntrega || ctx.laycanBuffer || ctx.deliveryBufferDays || 0) || 7;
      const cadenciaDinamica = totalVehiculosLocal > 1 ? Math.ceil(totalVehiculosLocal / bufferDaysLocal) : 1;

      const modificacionesRecap = {
        tarifaSugerida: Math.round(flete * 1.08),
        fleteEstimado: Math.round(flete * 1.08),
        breakEven: breakEven,
        clausulaParalizacion: "Indemnización por paralización de 60,00 €/hora tras 3 horas de espera en origen, destino o aduana.",
        condicionesEspeciales: "Opción B Estratégica MADRE: Retorno en vacío cubierto al 70%, peajes incluidos y franquicia de espera limitada a 3h.",
        peajes: peajes,
        cadenciaSugerida: cadenciaDinamica,
        cadencia: cadenciaDinamica
      };

      const auditResponse = {
        success: true,
        sender: "MADRE",
        status: "success",
        veredicto_general: veredicto,
        reporte_estrategico: reporteEstrategico,
        variables_perjudiciales: variablesPerjudiciales,
        recomendaciones: recomendaciones,
        modificaciones_recap: modificacionesRecap,
        reply: `Auditoría Estratégica MADRE completada con veredicto ${veredicto}.`,
        timestamp: new Date().toISOString()
      };

      if (isRailMode) {
        auditResponse.globalTransportMode = 'RAIL';
        auditResponse.fleet_tonnage_divisor = 50;
        auditResponse.total_wagons = totalVehiculosLocal;
        sanitizeRoadTermsInObject(auditResponse);
      }

      return new Response(JSON.stringify(auditResponse), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // --- LÓGICA DE ORQUESTACIÓN LOCAL (FALLBACK) ---
    const promptLower = userPrompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let fallbackAction = "informar";
    let delegationPayload = {};
    let halReply = "Procesando solicitud.";

    // Captura: "de barcelona a zaragoza", "ir desde madrid hasta paris"
    const rutaRegex = /(?:de|desde)\s+([a-z\s]+?)\s+(?:a|hasta)\s+([a-z\s]+)/i;
    const rutaMatch = promptLower.match(rutaRegex);

    if (rutaMatch) {
      const cap = str => str.charAt(0).toUpperCase() + str.slice(1);
      fallbackAction = "delegar_cerebro_ia";
      delegationPayload = {
        pol: cap(rutaMatch[1].trim()),
        pod: cap(rutaMatch[2].trim()),
        tonnage: 8000,
        vehicle_type: "Camión Plataforma"
      };
      halReply = `Entendido. He transferido los parámetros a Cerebro.ia para calcular la ruta de ${delegationPayload.pol} a ${delegationPayload.pod}.`;
    } else if (/recalcula|calcula|ruta|distancia/i.test(promptLower)) {
      fallbackAction = "delegar_cerebro_ia";
      delegationPayload = { pol: "Sétif", pod: "Béjaïa" };
      halReply = "Calculando ruta predeterminada.";
    } else if (/llevame|abre|ir a|calculadora|calculo|ldm/i.test(promptLower)) {
      fallbackAction = "navegar_vista";
      delegationPayload = { vista: "calculadora" };
      halReply = "Abriendo la calculadora.";
    } else if (/proyecto|expediente|transitario/i.test(promptLower)) {
      fallbackAction = "navegar_vista";
      delegationPayload = { vista: "proyectos" };
      halReply = "Cambiando a gestión de proyectos.";
    } else if (/ruta|mapa/i.test(promptLower)) {
      fallbackAction = "navegar_vista";
      delegationPayload = { vista: "rutas" };
      halReply = "Mostrando el mapa de rutas.";
    
    // NUEVO: Derivación analítica al Asistente Core
    } else if (/cuanto|cuanta|camion|camiones|margen|coste|precio|dime|busca|analiza/i.test(promptLower)) {
      fallbackAction = "delegar_asistente_core";
      delegationPayload = { query: userPrompt };
      halReply = "Transfiriendo consulta al Asistente Core para analizar los datos del proyecto.";
    
    // NUEVO: Saludos y respuestas conversacionales locales
    } else if (/hola|buenos dias|buenas tardes|que tal|madre/i.test(promptLower)) {
      fallbackAction = "informar";
      halReply = "Hola, Esteban. La conexión remota con Data Bridge está inactiva, pero opero en Modo Local. Cerebro.ia y Asistente Core están listos. ¿Qué necesitas?";
    
    } else {
      halReply = "Se ha perdido la conexión con el Cerebro Central remota. Intenta reformular tu petición o utiliza los comandos locales.";
      fallbackAction = "error_conexion";
    }

    return new Response(JSON.stringify({
      success: true,
      sender: "MADRE",
      reply: halReply,
      accion_ui: fallbackAction,
      delegation_payload: delegationPayload,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
