// netlify/functions/madre-ia.js
// Proxy / Gateway hacia el Cerebro Central de MADRE en Data Bridge

const DEFAULT_DATA_BRIDGE_ORIGIN = "https://calm-shortbread-55bcfc.netlify.app";

export default async function handler(request) {
  const BACKEND_URL = process.env.DATA_BRIDGE_URL || process.env.MADRE_BACKEND_URL 
    ? `${(process.env.DATA_BRIDGE_URL || process.env.MADRE_BACKEND_URL).replace(/\/$/, '')}/.netlify/functions/madre-ia`
    : `${DEFAULT_DATA_BRIDGE_ORIGIN}/.netlify/functions/madre-ia`;

  // 1. Manejo de CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-App-Context"
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

    let backendResponse;
    try {
      backendResponse = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Context": "land_charter"
        },
        body: JSON.stringify(enrichedPayload)
      });
    } catch (networkError) {
      console.warn("[madre-ia] Data Bridge no alcanzable directamente, activando orquestación de contingencia local:", networkError?.message);
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
    const promptLower = userPrompt.toLowerCase();
    let fallbackAction = "informar";
    let delegationPayload = {};
    let halReply = "Entendido. Procesando solicitud.";

    // Regex ultra-flexible: captura "[cualquier cosa] de [Origen] a [Destino]"
    // Usa normalización para evitar problemas de tildes
    const normalizedPrompt = userPrompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Captura: "de barcelona a zaragoza", "ir desde madrid hasta paris", "ruta de lyon a milan"
    const rutaRegex = /(?:de|desde)\s+([a-z\s]+?)\s+(?:a|hasta)\s+([a-z\s]+)/i;
    const rutaMatch = normalizedPrompt.match(rutaRegex);

    if (rutaMatch) {
      // Capitalizar nombres de ciudades (opcional, pero mejora la salida)
      const cap = str => str.charAt(0).toUpperCase() + str.slice(1);
      fallbackAction = "delegar_cerebro_ia";
      delegationPayload = {
        pol: cap(rutaMatch[1].trim()),
        pod: cap(rutaMatch[2].trim()),
        tonnage: 8000,
        vehicle_type: "Camión Plataforma"
      };
      halReply = `Entendido. He transferido los parámetros a Cerebro.ia para calcular la ruta de ${delegationPayload.pol} a ${delegationPayload.pod}.`;
    } else if (/llevame|llévame|abre|ir a|calculadora|calculo|cálculo|ldm/i.test(promptLower)) {
      fallbackAction = "navegar_vista";
      delegationPayload = { vista: "calculadora" };
      halReply = "Abriendo la calculadora.";
    } else if (/proyecto|expediente|transitario/i.test(promptLower)) {
      fallbackAction = "navegar_vista";
      delegationPayload = { vista: "proyectos" };
      halReply = "Cambiando a gestión de proyectos.";
    } else if (/\bruta\b|mapa/i.test(promptLower) && !/calcula/i.test(promptLower)) {
      fallbackAction = "navegar_vista";
      delegationPayload = { vista: "rutas" };
      halReply = "Mostrando el mapa de rutas.";
    } else if (/recalcula|calcula|ruta|distancia/i.test(promptLower)) {
      fallbackAction = "delegar_cerebro_ia";
      delegationPayload = { pol: "Sétif", pod: "Béjaïa" };
      halReply = "Calculando ruta predeterminada.";
    } else {
        if (!backendResponse || !backendResponse.ok) {
             halReply = "Se ha perdido la conexión con el Cerebro Central en Data Bridge. Reinténtalo más tarde.";
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
