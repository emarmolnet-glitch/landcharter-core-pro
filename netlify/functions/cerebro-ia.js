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
        let incomingPayload = null;
        let incomingTransportMode = 'ROAD';
        if (request.method === "POST") {
            const rawBodyBuffer = await request.arrayBuffer();
            fetchOptions.body = rawBodyBuffer;
            try {
                const textBody = new TextDecoder().decode(rawBodyBuffer);
                const parsedBody = JSON.parse(textBody);
                incomingPayload = parsedBody;
                incomingTransportMode = String(
                    parsedBody?.globalTransportMode ||
                    parsedBody?.transportMode ||
                    parsedBody?.transport_mode ||
                    parsedBody?.mode ||
                    parsedBody?.CalculationData?.calculatorState?.globalTransportMode ||
                    parsedBody?.CalculationData?.calculatorState?.transportMode ||
                    parsedBody?.contexto_ui?.globalTransportMode ||
                    parsedBody?.payload?.globalTransportMode ||
                    (parsedBody?.isRail ? 'RAIL' : 'ROAD')
                ).toUpperCase();
            } catch (_) {
                // Buffer no JSON (ej. multipart/form-data)
            }
        }

        // 3b. INTERCEPCIÓN DEL PAYLOAD HACIA DATA BRIDGE (MODO FERROVIARIO):
        // Si globalTransportMode === 'RAIL', inyecta parámetros estrictos obligando a la IA externa a saber
        // que es un convoy ferroviario y cambia el divisor de cálculo de flota a 50t (vagón tolva) en lugar de 24t.
        const isIncomingRail = incomingTransportMode === 'RAIL' ||
            Boolean(incomingPayload?.isRail) ||
            /tren|tolva|vag[oó]n|ferrocarril|rail/i.test(String(incomingPayload?.vehicle_type || incomingPayload?.payload?.vehicle_type || ''));

        if (isIncomingRail && incomingPayload) {
            incomingPayload.globalTransportMode = 'RAIL';
            incomingPayload.transport_mode = 'RAIL';
            incomingPayload.transportMode = 'RAIL';
            incomingPayload.isRail = true;
            incomingPayload.fleet_tonnage_divisor = 50;
            incomingPayload.divisor_flota = 50;
            incomingPayload.wagon_capacity = 50;
            incomingPayload.vagon_capacity = 50;
            incomingPayload.truck_capacity = 50;
            incomingPayload.vehicle_capacity = 50;
            incomingPayload.fleet_capacity = 50;
            incomingPayload.vehicle_type = 'Vagón Tolva (Ferrocarril)';
            incomingPayload.tipo_vehiculo = 'Vagón Tolva (Ferrocarril)';
            incomingPayload.tipo_transporte = 'RAIL';

            if (incomingPayload.payload && typeof incomingPayload.payload === 'object') {
                incomingPayload.payload.globalTransportMode = 'RAIL';
                incomingPayload.payload.transport_mode = 'RAIL';
                incomingPayload.payload.transportMode = 'RAIL';
                incomingPayload.payload.isRail = true;
                incomingPayload.payload.fleet_tonnage_divisor = 50;
                incomingPayload.payload.divisor_flota = 50;
                incomingPayload.payload.wagon_capacity = 50;
                incomingPayload.payload.vagon_capacity = 50;
                incomingPayload.payload.truck_capacity = 50;
                incomingPayload.payload.vehicle_capacity = 50;
                incomingPayload.payload.fleet_capacity = 50;
                incomingPayload.payload.vehicle_type = 'Vagón Tolva (Ferrocarril)';
                incomingPayload.payload.tipo_vehiculo = 'Vagón Tolva (Ferrocarril)';
            }

            if (incomingPayload.contexto_ui && typeof incomingPayload.contexto_ui === 'object') {
                incomingPayload.contexto_ui.globalTransportMode = 'RAIL';
                incomingPayload.contexto_ui.transport_mode = 'RAIL';
                incomingPayload.contexto_ui.isRail = true;
                incomingPayload.contexto_ui.fleet_tonnage_divisor = 50;
                incomingPayload.contexto_ui.divisor_flota = 50;
                incomingPayload.contexto_ui.wagon_capacity = 50;
                incomingPayload.contexto_ui.vagon_capacity = 50;
                incomingPayload.contexto_ui.truck_capacity = 50;
                incomingPayload.contexto_ui.vehicle_type = 'Vagón Tolva (Ferrocarril)';
                incomingPayload.contexto_ui.tipo_vehiculo = 'Vagón Tolva (Ferrocarril)';
            }

            if (incomingPayload.CalculationData && typeof incomingPayload.CalculationData === 'object') {
                incomingPayload.CalculationData.globalTransportMode = 'RAIL';
                incomingPayload.CalculationData.isRail = true;
                incomingPayload.CalculationData.fleet_tonnage_divisor = 50;
                incomingPayload.CalculationData.wagon_capacity = 50;
                incomingPayload.CalculationData.vehicle_type = 'Vagón Tolva (Ferrocarril)';
            }

            // Recalcular flota con divisor estricto de 50 toneladas
            const incomingTonnage = Number(
                incomingPayload.tonnage ||
                incomingPayload.total_weight_tons ||
                incomingPayload.totalTonnage ||
                incomingPayload.payload?.tonnage ||
                incomingPayload.payload?.total_weight_tons ||
                incomingPayload.CalculationData?.cargo?.tonnes ||
                incomingPayload.contexto_ui?.toneladas ||
                incomingPayload.contexto_ui?.tonnage || 0
            );
            if (incomingTonnage > 0) {
                const railWagons = Math.ceil(incomingTonnage / 50);
                incomingPayload.total_trucks = railWagons;
                incomingPayload.trucks = railWagons;
                incomingPayload.total_wagons = railWagons;
                incomingPayload.wagons = railWagons;
                incomingPayload.totalVehicles = railWagons;
                incomingPayload.flota = railWagons;
                if (incomingPayload.payload && typeof incomingPayload.payload === 'object') {
                    incomingPayload.payload.total_trucks = railWagons;
                    incomingPayload.payload.trucks = railWagons;
                    incomingPayload.payload.total_wagons = railWagons;
                    incomingPayload.payload.wagons = railWagons;
                    incomingPayload.payload.totalVehicles = railWagons;
                    incomingPayload.payload.flota = railWagons;
                }
            }

            const railDirective = " [DIRECTIVA FERROVIARIA ESTRICTA: El transporte se realiza mediante convoy ferroviario (tren con vagones tolva). La capacidad por vagón tolva es de 50 toneladas (divisor de cálculo de flota = 50t, NO 24t). Usa siempre la palabra 'vagones' en lugar de 'camiones' o 'trailers'. Operación ferroviaria sin peajes de carretera ni dietas de chófer.]";
            if (typeof incomingPayload.mensajeUsuario === 'string' && incomingPayload.mensajeUsuario.length > 0) {
                incomingPayload.mensajeUsuario += railDirective;
            } else if (typeof incomingPayload.message === 'string' && incomingPayload.message.length > 0) {
                incomingPayload.message += railDirective;
            } else if (typeof incomingPayload.mensaje === 'string' && incomingPayload.mensaje.length > 0) {
                incomingPayload.mensaje += railDirective;
            } else if (typeof incomingPayload.prompt === 'string' && incomingPayload.prompt.length > 0) {
                incomingPayload.prompt += railDirective;
            } else if (typeof incomingPayload.query === 'string' && incomingPayload.query.length > 0) {
                incomingPayload.query += railDirective;
            } else if (typeof incomingPayload.UserContext === 'string' && incomingPayload.UserContext.length > 0) {
                incomingPayload.UserContext += railDirective;
            }

            fetchOptions.body = JSON.stringify(incomingPayload);
            fetchOptions.headers["Content-Type"] = "application/json";
            fetchOptions.headers["X-Transport-Mode"] = "RAIL";
        }

        // 4. Reenviar todo al cerebro real en Data Bridge
        const response = await fetch(BACKEND_URL, fetchOptions);
        
        // 5. Capturar la respuesta de Data Bridge
        const responseData = await response.text();

        // 6. Devolverla a Core PRO aplicando la regla de cadencia dinámica en alto volumen (Fase 4):
        // Cadencia Diaria = Math.ceil(Total de Vehículos / Días de Buffer de Entrega)
        // MADRE / Cerebro jamás debe sugerir una cadencia de 1 vehículo al día en operaciones de alto volumen.
        // Y en modo RAIL (globalTransportMode === 'RAIL'), ignorar tarifas de asfalto y consolidar coste ferroviario.
        try {
            const parsed = JSON.parse(responseData);

            // Blindaje de modo RAIL:
            const isRailMode = isIncomingRail || incomingTransportMode === 'RAIL' ||
                String(parsed?.globalTransportMode || parsed?.payload?.globalTransportMode || '').toUpperCase() === 'RAIL';

            if (isRailMode) {
                parsed.globalTransportMode = 'RAIL';
                parsed.fleet_tonnage_divisor = 50;
                parsed.divisor_flota = 50;
                parsed.wagon_capacity = 50;
                if (parsed.payload) {
                    parsed.payload.globalTransportMode = 'RAIL';
                    parsed.payload.isRail = true;
                    parsed.payload.fleet_tonnage_divisor = 50;
                    parsed.payload.divisor_flota = 50;
                    parsed.payload.wagon_capacity = 50;
                    // En ferrocarril se anulan peajes y dietas de asfalto
                    parsed.payload.tollCost = 0;
                    parsed.payload.driverDiets = 0;
                    parsed.payload.tolls = 0;
                    parsed.payload.peajes = 0;
                    parsed.payload.dietas = 0;
                    // Si el backend Data Bridge envió costeTren / coste_tren, se consolida como precio de convoy cerrado
                    const rawCost = Number(
                        parsed.payload.costeTren || parsed.payload.coste_tren ||
                        parsed.costeTren || parsed.coste_tren ||
                        parsed.payload.traction_cost || parsed.payload.land_freight_cost || 0
                    );
                    if (rawCost > 0) {
                        parsed.payload.costeTrenConsolidado = rawCost;
                        parsed.payload.costeTren = rawCost;
                        parsed.payload.land_freight_cost = rawCost;
                        parsed.payload.estimatedCost = rawCost;
                    }
                }

                // Ajustar división de flota a 50t si el backend envió división a 24t
                const tonnage = Number(
                    parsed?.payload?.tonnage || parsed?.tonnage ||
                    incomingPayload?.tonnage || incomingPayload?.total_weight_tons ||
                    incomingPayload?.payload?.tonnage || incomingPayload?.payload?.total_weight_tons || 0
                );
                let railFleet = 0;
                if (tonnage > 0) {
                    railFleet = Math.ceil(tonnage / 50);
                } else {
                    const rawTrucks = Number(parsed?.payload?.total_trucks || parsed?.payload?.trucks || parsed?.total_trucks || parsed?.totalVehicles || 0);
                    if (rawTrucks > 0) {
                        railFleet = Math.ceil((rawTrucks * 24) / 50);
                    }
                }
                if (railFleet > 0) {
                    parsed.total_trucks = railFleet;
                    parsed.total_wagons = railFleet;
                    parsed.wagons = railFleet;
                    parsed.totalVehicles = railFleet;
                    parsed.flota = railFleet;
                    if (parsed.payload) {
                        parsed.payload.total_trucks = railFleet;
                        parsed.payload.total_wagons = railFleet;
                        parsed.payload.trucks = railFleet;
                        parsed.payload.wagons = railFleet;
                        parsed.payload.totalVehicles = railFleet;
                        parsed.payload.flota = railFleet;
                    }
                }

                // Interceptar respuesta de Data Bridge para reemplazar "camiones" o "trailers" por "vagones"
                sanitizeRoadTermsInObject(parsed);
            }
            const totalVehicles = Number(
                parsed?.payload?.total_wagons || parsed?.payload?.total_trucks || parsed?.payload?.trucks || parsed?.payload?.totalVehicles ||
                parsed?.total_wagons || parsed?.total_trucks || parsed?.totalVehicles ||
                (parsed?.payload?.tonnage ? Math.ceil(Number(parsed.payload.tonnage) / (isRailMode ? 50 : 24)) : 0) ||
                (parsed?.tonnage ? Math.ceil(Number(parsed.tonnage) / (isRailMode ? 50 : 24)) : 0) || 0
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
