// netlify/functions/madre-ia.js
// Proxy / Gateway hacia el Cerebro Central de MADRE en Data Bridge

const DEFAULT_DATA_BRIDGE_ORIGIN = "https://calm-shortbread-55bcfc.netlify.app";

function resolveBackendUrl() {
  const configured = (process.env.MADRE_BACKEND_URL || process.env.DATA_BRIDGE_URL || "").trim();
  if (configured) {
    if (configured.includes("/.netlify/functions/") || configured.includes("/api/")) {
      return configured;
    }
    return `${configured.replace(/\/$/, '')}/.netlify/functions/madre-ia`;
  }
  return `${DEFAULT_DATA_BRIDGE_ORIGIN}/.netlify/functions/madre-ia`;
}

export default async function handler(request) {
  const BACKEND_URL = resolveBackendUrl();

  // 1. Manejo de CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-App-Context, x-api-key, X-Requested-With"
      }
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const rawBody = await request.json().catch(() => ({}));
    
    // Forzar el identificador de módulo de Land Charter para MADRE
    const enrichedPayload = {
      ...rawBody,
      current_module: "land_charter"
    };

    let backendResponse = null;
    let backendErrorDetails = null;

    try {
      const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-App-Context": "land_charter"
      };

      const apiSecret = process.env.DATA_BRIDGE_API_SECRET || process.env.VITE_DATA_BRIDGE_API_SECRET;
      if (apiSecret) {
        headers["Authorization"] = `Bearer ${apiSecret}`;
      }
      const apiKey = process.env.DATA_BRIDGE_API_KEY || process.env.VITE_DATA_BRIDGE_API_KEY;
      if (apiKey) {
        headers["x-api-key"] = apiKey;
      }

      backendResponse = await fetch(BACKEND_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(enrichedPayload)
      });

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text().catch(() => "");
        console.error(`[madre-ia] Error devuelto por Data Bridge en ${BACKEND_URL}: Código HTTP ${backendResponse.status} (${backendResponse.statusText}). Detalle: ${errorText.slice(0, 500)}`);
        backendErrorDetails = `HTTP ${backendResponse.status}: ${errorText.slice(0, 100)}`;
      }
    } catch (networkError) {
      console.error(`[madre-ia] Error exacto de red al conectar con Data Bridge en ${BACKEND_URL}:`, networkError?.message || networkError, networkError?.cause ? `Causa: ${networkError.cause}` : "");
      backendErrorDetails = networkError?.message || String(networkError);
      backendResponse = null;
    }

    if (backendResponse && backendResponse.ok) {
      const data = await backendResponse.json();
      return new Response(JSON.stringify(data), {
        status: backendResponse.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // --- LÓGICA DE ORQUESTACIÓN LOCAL (FALLBACK) ---
    const userPrompt = String(enrichedPayload.prompt || enrichedPayload.message || enrichedPayload.texto || "").trim();
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
        if (!backendResponse || !backendResponse.ok) {
             halReply = "Se ha perdido la conexión con el Cerebro Central remota. Intenta reformular tu petición o utiliza los comandos locales.";
             fallbackAction = "error_conexion";
        }
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

  } catch (error) {
    console.error("[madre-ia] Error procesando solicitud:", error);
    return new Response(JSON.stringify({
      success: false,
      error: "Error interno en el procesador de MADRE.",
      details: String(error?.message || error)
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
