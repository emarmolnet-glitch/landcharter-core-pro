export default async function proxyRequest(request) {
    // 🔴 ESTA ES LA URL REAL DE TU BACKEND (DATA BRIDGE)
    const BACKEND_URL = "https://calm-shortbread-55bcfc.netlify.app/.netlify/functions/cerebro-ia";

    // 1. Manejar las peticiones de seguridad CORS del navegador
    if (request.method === "OPTIONS") {
        return new Response("ok", { 
            status: 200, 
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, OPTIONS"
            } 
        });
    }
    
    try {
        // 2. Extraer el Content-Type original (Vital para que no se rompan los PDFs)
        const contentType = request.headers.get("content-type");
        
        const fetchOptions = {
            method: request.method,
            headers: {
                // INYECCIÓN DE CONTEXTO: Le decimos a Data Bridge que somos de camiones
                "X-App-Context": "land"
            },
        };

        if (contentType) {
            fetchOptions.headers["Content-Type"] = contentType;
        }

        // 3. Extraer el cuerpo de la petición de forma binaria para soportar archivos
        if (request.method === "POST") {
            fetchOptions.body = await request.arrayBuffer();
        }

        // 4. Reenviar todo al cerebro real en Data Bridge
        const response = await fetch(BACKEND_URL, fetchOptions);
        
        // 5. Capturar la respuesta de Data Bridge
        const responseData = await response.text();

        // 6. Devolverla a Core PRO aplicando la regla de cadencia dinámica en alto volumen (Fase 4):
        // Cadencia Diaria = Math.ceil(Total de Vehículos / Días de Buffer de Entrega)
        // MADRE / Cerebro jamás debe sugerir una cadencia de 1 vehículo al día en operaciones de alto volumen.
        try {
            const parsed = JSON.parse(responseData);
            const totalVehicles = Number(
                parsed?.payload?.total_trucks || parsed?.payload?.trucks || parsed?.payload?.totalVehicles ||
                parsed?.total_trucks || parsed?.totalVehicles ||
                (parsed?.payload?.tonnage ? Math.ceil(Number(parsed.payload.tonnage) / 24) : 0) ||
                (parsed?.tonnage ? Math.ceil(Number(parsed.tonnage) / 24) : 0) || 0
            );
            if (totalVehicles > 1) {
                const bufferDays = Number(
                    parsed?.payload?.deliveryBufferDays || parsed?.payload?.bufferDays || parsed?.payload?.bufferEntrega ||
                    parsed?.deliveryBufferDays || parsed?.bufferDays || parsed?.bufferEntrega || 0
                ) || 7;
                const dynamicCadence = Math.ceil(totalVehicles / bufferDays);

                if (parsed.cadencia === 1 || parsed.payload?.cadencia === 1 || parsed.cadencia_sugerida === 1 || parsed.payload?.cadencia_sugerida === 1 || !parsed.cadencia) {
                    parsed.cadencia = dynamicCadence;
                    if (parsed.payload) {
                        parsed.payload.cadencia = dynamicCadence;
                        parsed.payload.cadencia_sugerida = dynamicCadence;
                        parsed.payload.dss_optimal_cadence = dynamicCadence;
                    }
                }
                if (typeof parsed.respuesta === 'string' && /1\s*(?:camión|vehículo)\s*al\s*día/i.test(parsed.respuesta)) {
                    parsed.respuesta = parsed.respuesta.replace(/1\s*(?:camión|vehículo)\s*al\s*día/gi, `${dynamicCadence} vehículos al día`);
                }
            }
            return new Response(JSON.stringify(parsed), {
                status: response.status,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                }
            });
        } catch (_) {
            return new Response(responseData, {
                status: response.status,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                }
            });
        }

    } catch (error) {
        console.error("[Proxy Core PRO] Error conectando con Data Bridge:", error);
        return new Response(JSON.stringify({
            success: false,
            intent: "ERROR",
            action: "none",
            respuesta: "Error de conexión: El frontend no pudo alcanzar el servidor Data Bridge.",
            payload: {}
        }), { 
            status: 500, 
            headers: { 
                "Content-Type": "application/json", 
                "Access-Control-Allow-Origin": "*" 
            } 
        });
    }
}
