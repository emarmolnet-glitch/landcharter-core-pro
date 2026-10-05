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

    // Si el backend remoto no está disponible o falla, responder con orquestación ejecutiva HAL 9000 local
    const userPrompt = String(enrichedPayload.prompt || enrichedPayload.message || enrichedPayload.texto || "").trim();
    const contextoUI = enrichedPayload.contexto_ui || {};
    
    // Evaluar intención para delegar en la arquitectura local de 3 sub-agentes
    let fallbackAction = "informar";
    let delegationPayload = {};
    let halReply = "Afirmativo. Todos mis sistemas están plenamente operativos.";

    const promptLower = userPrompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (/recalcula|calcula.*ruta|distancia|origen|destino|setif|bugia|bejaia|camion|toneladas|carga/i.test(promptLower)) {
      fallbackAction = "delegar_cerebro_ia";
      delegationPayload = {
        pol: contextoUI.pol || "Sétif",
        pod: contextoUI.pod || "Béjaïa",
        tonnage: contextoUI.tonnage || 8000,
        vehicle_type: contextoUI.vehicle_type || "Camión Plataforma con Grúa Autocarga"
      };
      halReply = "Entendido. He transferido las coordenadas y parámetros de ruta a Cerebro.ia para recálculo inmediato en OSRM.";
    } else if (/busca|mercado|precio|gasoil|bunker|noticias|terminal|puerto|barco|spot/i.test(promptLower)) {
      fallbackAction = "delegar_asistente_core";
      delegationPayload = {
        query: userPrompt
      };
      halReply = "Conmutando al Asistente Core para consultar Data Bridge y fuentes de mercado.";
    } else if (/llevame|abre|ir a|calculadora|calculo|ldm/i.test(promptLower)) {
      fallbackAction = "navegar_vista";
      delegationPayload = { vista: "calculadora" };
      halReply = "Entendido. Abriendo la calculadora de Land Charter.";
    } else if (/proyecto|expediente|transitario/i.test(promptLower)) {
      fallbackAction = "navegar_vista";
      delegationPayload = { vista: "proyectos" };
      halReply = "Cambiando a la vista de gestión de proyectos.";
    } else if (/ruta|mapa/i.test(promptLower)) {
      fallbackAction = "navegar_vista";
      delegationPayload = { vista: "rutas" };
      halReply = "Volviendo al mapa de rutas terrestres.";
    } else {
      halReply = `Buenas tardes. Soy MADRE. Estoy monitorizando la operación en Land Charter. Origen: ${contextoUI.pol || 'Sin fijar'}, Destino: ${contextoUI.pod || 'Sin fijar'}. Distancia: ${contextoUI.distance_km || 0} km. ¿Qué parámetros deseas que ajuste?`;
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
