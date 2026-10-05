// netlify/functions/madre-ia.js
// Proxy / Gateway hacia el Cerebro Central de MADRE en Data Bridge

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

  try {
    body = JSON.parse(event.body || "{}");
    userPrompt = String(body.prompt || body.message || body.texto || "").trim();
    
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
      current_module: "land_charter",
      contexto_ui: body.contexto_ui || {},
      history: body.history || []
    };

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
            vehicle_type: res.tipo_vehiculo || args.tipo_vehiculo || "Camión Plataforma"
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

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    throw new Error(`Data Bridge respondió con estado: ${backendResponse.status}`);

  } catch (error) {
    console.error("⚠️ [MADRE Proxy] Fallo de conexión remota:", error.message);
    console.error(`[madre-ia] Error devuelto por Data Bridge: ${error.message}`);

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
