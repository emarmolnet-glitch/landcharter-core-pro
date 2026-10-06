const DECISION_SUPPORT_TEMPLATE = String.raw`
            <div class="w-full px-4 md:px-8 space-y-6">

                <!-- CABECERA CON RESUMEN DEL VIAJE Y CONTROL DE ESTADO -->
                <header class="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 shadow-xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
                    <div class="flex flex-col md:flex-row md:items-center gap-3 flex-wrap">
                        <span class="text-xs text-slate-400 font-mono shrink-0">Audit Engine</span>
                        <h1 class="text-base font-bold tracking-tight text-slate-800 flex items-center gap-2 shrink-0 bg-transparent">
                            <span>Sistema de Soporte de Decisiones (DSS)</span>
                        </h1>
                        <span class="hidden md:inline text-slate-600">|</span>
                        <p id="voyage-summary-subtitle" class="text-xs md:text-sm text-slate-300 font-medium">
                            Origen: <span id="summary-pol" class="text-indigo-400 font-bold">—</span> ➔
                            Destino: <span id="summary-pod" class="text-indigo-400 font-bold">—</span> |
                            <span id="summary-qty" class="text-emerald-400 font-bold">0 MT</span> ·
                            <span id="summary-commodity" class="text-slate-200">Esperando datos de ruta</span>
                        </p>
                    </div>

                    <!-- Botones de Acción / Simulación y Volver -->
                    <div class="flex flex-wrap items-center gap-2 shrink-0">
                        <button type="button" id="btn-tab-actual" onclick="cargarEscenario('actual')" class="px-3 py-1.5 text-xs font-medium bg-indigo-900/40 text-indigo-300 hover:bg-indigo-900/60 border border-indigo-700/50 rounded-lg transition-all flex items-center gap-1.5 shadow-sm">
                            🔵 Situación Actual
                        </button>
                        <button type="button" id="btn-tab-riesgo" onclick="cargarEscenario('riesgo')" class="px-3 py-1.5 text-xs font-medium bg-red-900/40 text-red-300 hover:bg-red-900/60 border border-red-700/50 rounded-lg transition-all flex items-center gap-1.5">
                            🔴 Escenario Riesgo
                        </button>
                        <button type="button" id="btn-tab-alerta" onclick="cargarEscenario('equilibrado')" class="px-3 py-1.5 text-xs font-medium bg-amber-900/40 text-amber-300 hover:bg-amber-900/60 border border-amber-700/50 rounded-lg transition-all flex items-center gap-1.5">
                            🟡 Escenario Alerta
                        </button>
                        <button type="button" id="btn-tab-optimo" onclick="cargarEscenario('optimo')" class="px-3 py-1.5 text-xs font-medium bg-emerald-900/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-700/50 rounded-lg transition-all flex items-center gap-1.5">
                            🟢 Escenario Óptimo
                        </button>
                        <button type="button" id="btn-toggle-parametros" onclick="toggleParametros()" class="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 rounded-lg transition-all flex items-center gap-1">
                            ⚙️ Ajustar Variables <i id="icon-toggle-parametros" class="fa-solid fa-chevron-down text-[10px] ml-1 transition-transform duration-300"></i>
                        </button>
                        <button type="button" id="btn-auditoria-madre" onclick="ejecutarAuditoriaMadre()" class="px-3 py-1.5 text-xs font-semibold bg-transparent hover:bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 border border-indigo-400 hover:border-indigo-300 rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer" title="Ejecutar Auditoría Estratégica MADRE adaptada a Transporte Terrestre">
                            <i class="fa-solid fa-brain text-indigo-400"></i>
                            <span>Auditoría MADRE (Terrestre)</span>
                        </button>
                        <button type="button" id="btn-generate-audit-pdf" onclick="generateAuditPDF()" class="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer">
                            <i class="fa-solid fa-file-pdf text-red-600"></i>
                            <span>Generar Auditoría (PDF)</span>
                        </button>
                        <button type="button" id="btn-generate-fixture-recap-pdf" onclick="generateFixtureRecapPDF()" class="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer">
                            <i class="fa-solid fa-file-contract text-indigo-600"></i>
                            <span>Generar Oferta (Fixture Recap)</span>
                        </button>
                        <button type="button" id="btn-fijar-condiciones-top" onclick="fijarCondicionesDefinitivas()" class="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer">
                            <i class="fa-solid fa-lock"></i>
                            <span>Fijar Condiciones Definitivas</span>
                        </button>
                        <button type="button" onclick="switchTab('estimator')" class="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all flex items-center gap-1">
                            <i class="fa-solid fa-calculator mr-1"></i> Volver a Calculadora
                        </button>
                    </div>
                </header>

                <div id="dss-empty-state" class="rounded-xl border border-dashed border-slate-600 bg-slate-800/70 px-5 py-10 text-center text-sm" style="color: white !important;"></div>

                <!-- PANEL INTERACTIVO DE SIMULACIÓN DE PARÁMETROS (DESPLEGABLE / ACORDEONES) -->
                <section id="panel-parametros" class="hidden bg-white border border-slate-200 rounded-2xl p-5 shadow-xl transition-all text-slate-800 duration-300 ease-in-out overflow-hidden">
                    <!-- HEADER GENERAL CON BOTÓN TOGGLE / CHEVRON -->
                    <div class="flex items-center justify-between border-b border-slate-200 pb-3 mb-4 cursor-pointer select-none" onclick="toggleParametros()">
                        <h2 class="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                            <span>🎛️ Modificar Variables del Viaje y Calculadora de Fletes</span>
                        </h2>
                        <button type="button" aria-label="Toggle Panel Inputs" class="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex items-center gap-1 text-xs font-semibold">
                            <span class="hidden sm:inline">Desplegar / Plegar</span>
                            <i id="icon-toggle-panel-main" class="fa-solid fa-chevron-down text-xs transition-transform duration-300"></i>
                        </button>
                    </div>

                    <div class="space-y-4">
                        <!-- ACORDEÓN 1: VARIABLES DEL VIAJE -->
                        <div id="accordion-section-variables" class="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 shadow-sm">
                            <button type="button" id="btn-toggle-variables" onclick="toggleAccordion('variables')" class="w-full flex items-center justify-between px-4 py-3 bg-slate-100/90 hover:bg-slate-200/80 font-semibold text-xs text-slate-700 transition-colors select-none">
                                <span class="flex items-center gap-2">
                                    <i class="fa-solid fa-sliders text-indigo-600"></i>
                                    <span>Variables del Transporte (Ruta, Carga, Tiempos y Ritmos)</span>
                                    <span id="badge-variables-status" class="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">🔒 Solo Lectura (Situación Actual)</span>
                                </span>
                                <i id="icon-accordion-variables" class="fa-solid fa-chevron-up text-xs text-slate-500 transition-transform duration-300"></i>
                            </button>
                            <div id="body-accordion-variables" class="p-4 transition-all duration-300 ease-in-out">
                                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                    <div>
                                        <label class="block text-slate-600 font-semibold mb-1">Origen (Carga)</label>
                                        <input type="text" id="input-pol" value="" oninput="actualizarDesdeFormulario()" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                                    </div>
                                    <div>
                                        <label class="block text-slate-600 font-semibold mb-1">Destino (Descarga)</label>
                                        <input type="text" id="input-pod" value="" oninput="actualizarDesdeFormulario()" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                                    </div>
                                    <div>
                                        <label class="block text-slate-600 font-semibold mb-1">Cantidad Carga (MT)</label>
                                        <input type="number" id="input-cargoQty" value="0" min="0" oninput="actualizarDesdeFormulario()" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                                    </div>
                                    <div>
                                        <label class="block text-slate-600 font-semibold mb-1">Mercancía / Commodity</label>
                                        <input type="text" id="input-commodity" value="Siderúrgico / Carga General" oninput="actualizarDesdeFormulario()" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                                    </div>
                                    <div>
                                        <label class="block text-slate-600 font-semibold mb-1">Horas de Carga</label>
                                        <input type="number" id="input-laycanDaysLeft" value="10" oninput="actualizarDesdeFormulario()" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                                    </div>
                                    <div>
                                        <label class="block text-slate-600 font-semibold mb-1">Tiempo de Tránsito</label>
                                        <input type="number" id="input-estimatedVoyageDays" value="8" oninput="actualizarDesdeFormulario()" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                                    </div>
                                    <div>
                                        <label class="block text-slate-600 font-semibold mb-1">Ritmo Carga (MT/día)</label>
                                        <input type="number" id="input-loadRate" value="5000" oninput="actualizarDesdeFormulario()" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                                    </div>
                                    <div>
                                        <label class="block text-slate-600 font-semibold mb-1">Ritmo Descarga (MT/día)</label>
                                        <input type="number" id="input-dischargeRate" value="5000" oninput="actualizarDesdeFormulario()" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                                    </div>
                                    <div>
                                        <label class="block text-slate-600 font-semibold mb-1">Horas de Descarga</label>
                                        <input type="number" id="input-portDays" value="10" oninput="actualizarDesdeFormulario()" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                                    </div>
                                    <div>
                                        <label class="block text-slate-600 font-semibold mb-1">Tiempo en Tránsito Terrestre</label>
                                        <input type="number" id="input-seaDays" value="8" oninput="actualizarDesdeFormulario()" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ACORDEÓN 2: CALCULADORA DE FLETES -->
                        <div id="accordion-section-fletes" class="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 shadow-sm">
                            <button type="button" id="btn-toggle-fletes" onclick="toggleAccordion('fletes')" class="w-full flex items-center justify-between px-4 py-3 bg-slate-100/90 hover:bg-slate-200/80 font-semibold text-xs text-slate-700 transition-colors select-none">
                                <span class="flex items-center gap-2">
                                    <i class="fa-solid fa-calculator text-emerald-600"></i>
                                    <span>Calculadora de Fletes Terrestres</span>
                                </span>
                                <i id="icon-accordion-fletes" class="fa-solid fa-chevron-up text-xs text-slate-500 transition-transform duration-300"></i>
                            </button>
                            <div id="body-accordion-fletes" class="p-4 transition-all duration-300 ease-in-out">
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <label class="block text-slate-600 font-semibold mb-1">Tarifa Flete (€/camión o €/km)</label>
                                        <input type="number" id="input-fleteEstimado" value="35" step="any" oninput="actualizarDesdeFormulario()" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                                    </div>
                                    <div>
                                        <label class="block text-slate-600 font-semibold mb-1">Break-Even (€/camión o €/km)</label>
                                        <input type="number" id="input-breakEven" value="25" step="any" oninput="actualizarDesdeFormulario()" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ACORDEÓN 3: GESTIÓN DE RIESGO Y SOBRECOSTES TERRESTRES -->
                        <div id="accordion-section-riesgo-reposicionamiento" class="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 shadow-sm">
                            <button type="button" id="btn-toggle-riesgo" onclick="toggleAccordion('riesgo-reposicionamiento')" class="w-full flex items-center justify-between px-4 py-3 bg-slate-100/90 hover:bg-slate-200/80 font-semibold text-xs text-slate-700 transition-colors select-none">
                                <span class="flex items-center gap-2">
                                    <i class="fa-solid fa-shield-halved text-amber-600"></i>
                                    <span>Sobrecostes de Ruta y Retornos en Vacío (Primas de Riesgo & Reposicionamiento)</span>
                                </span>
                                <i id="icon-accordion-riesgo-reposicionamiento" class="fa-solid fa-chevron-up text-xs text-slate-500 transition-transform duration-300"></i>
                            </button>
                            <div id="body-accordion-riesgo-reposicionamiento" class="p-4 transition-all duration-300 ease-in-out">
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <label class="block text-slate-600 font-semibold mb-1">Kilómetros en Vacío (Aproximación / Retorno)</label>
                                        <input type="number" id="input-km-vacio" value="0" min="0" placeholder="0 km" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold">
                                    </div>
                                    <div>
                                        <label class="block text-slate-600 font-semibold mb-1">Sobrecostes de Ruta (Peajes / Desvíos €)</label>
                                        <input type="number" id="input-sobrecostes-ruta" value="0" min="0" placeholder="0 €" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold">
                                    </div>
                                    <!-- Inputs residuales mantenidos ocultos para compatibilidad técnica sin romper motores -->
                                    <div class="hidden">
                                        <input type="checkbox" id="input-jwlaRiskActive" disabled>
                                        <input type="number" id="input-jwlaPremiumUSD" value="0">
                                        <input type="number" id="input-ballastDays" value="0" readonly>
                                        <input type="number" id="input-actualCargoIntake" value="0">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- PANEL DESTACADO: FLETE ORIENTATIVO ALL-IN (FLOOR RATE) GROSS -->
                        <div id="section-flete-all-in-gross" class="mt-4 p-4 bg-slate-900 text-slate-100 border border-emerald-500/40 rounded-xl shadow-lg transition-all duration-200">
                            <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                                <div class="flex items-center gap-2">
                                    <span class="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 font-extrabold text-xs rounded-lg border border-emerald-500/30 flex items-center gap-1.5">
                                        <i class="fa-solid fa-chart-line text-emerald-400"></i>
                                        <span>DSS ALL-IN RATE ENGINE</span>
                                    </span>
                                    <h3 class="text-sm font-bold text-white">Tarifa Orientativa ALL-IN Flota Terrestre</h3>
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs mb-3">
                                <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                                    <span class="text-slate-400 block text-[11px]">Tarifa Neta Base (€)</span>
                                    <strong id="display-net-freight" class="text-slate-200 font-extrabold text-sm">€0.00</strong>
                                </div>
                                <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                                    <span class="text-slate-400 block text-[11px]">Sobrecostes Ruta / Peajes (€)</span>
                                    <strong id="display-surcharges-total" class="text-amber-300 font-extrabold text-sm">€0</strong>
                                </div>
                                <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                                    <span class="text-slate-400 block text-[11px]">Gross-Up Gestión (%)</span>
                                    <strong id="display-commission-pct" class="text-slate-200 font-extrabold text-sm">5.0%</strong>
                                </div>
                                <div class="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 flex flex-col justify-between">
                                    <span class="text-slate-300 font-bold text-[11px]">TARIFA ALL-IN GROSS</span>
                                    <strong id="display-all-in-gross" class="text-emerald-400 font-bold text-xl">€0.00</strong>
                                </div>
                            </div>

                            <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                                <span class="text-[11px] text-slate-400 font-medium">
                                    Cálculo aislado en DSS modo solo-lectura (no muta calculadoras base).
                                </span>
                                <button type="button" id="btn-aplicar-condiciones-recap" onclick="aplicarCondicionesAlRecap()" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                                    <i class="fa-solid fa-file-contract"></i>
                                    <span>Aplicar Condiciones al Recap</span>
                                </button>
                            </div>
                        </div>

                        <!-- ACCIÓN PRINCIPAL DE FIJACIÓN DE CONDICIONES DEFINITIVAS -->
                        <div class="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                            <div class="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                                <i class="fa-solid fa-circle-info text-indigo-500"></i>
                                <span>Consolida los datos simulados hacia la Calculadora y autocompleta la proforma en el Editor.</span>
                            </div>
                            <button type="button" id="btn-fijar-condiciones" onclick="fijarCondicionesDefinitivas()" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer">
                                <i class="fa-solid fa-lock"></i>
                                <span>Fijar Condiciones Definitivas</span>
                            </button>
                        </div>
                    </div>
                </section>

                <!-- GRID DE 3 COLUMNAS PARA SEMÁFOROS (RIESGO CRÍTICO, ADVERTENCIA, SEGURO) -->
                <section class="grid grid-cols-1 md:grid-cols-3 gap-6">

                    <!-- TARJETA 1: RIESGOS DE TRÁNSITO Y ENTREGA -->
                    <div id="card-laycan" class="bg-slate-800 border border-slate-700 border-l-4 border-l-red-500 rounded-xl p-5 shadow-lg flex flex-col justify-between space-y-4">
                        <div>
                            <div class="flex items-center justify-between mb-3">
                                <span class="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5" id="label-transit-risk">
                                    🔴 Riesgos de Tránsito y Entrega
                                </span>
                                <span id="badge-laycan-status" class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-950 text-red-300 border border-red-800">
                                    ALERTA CRÍTICA
                                </span>
                            </div>
                            <h3 id="laycan-title" class="text-lg font-bold text-white mb-2">
                                Riesgos de Tránsito y Entrega
                            </h3>
                            <p id="laycan-desc" class="text-sm text-slate-300 leading-relaxed">
                                Evaluando margen de tránsito terrestre...
                            </p>
                        </div>
                        <div class="pt-3 border-t border-slate-700/60 text-xs text-slate-400 space-y-1.5">
                            <div class="flex justify-between">
                                <span>Ventana de Despacho:</span>
                                <span id="val-ventana-despacho" class="font-bold text-slate-200">--</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Tiempo de Tránsito Estimado:</span>
                                <span id="val-transito-estimado" class="font-bold text-slate-200">--</span>
                            </div>
                            <div class="flex justify-between font-semibold pt-1 border-t border-slate-700/40">
                                <span>Buffer de Entrega:</span>
                                <span id="val-buffer-entrega" class="text-red-400">--</span>
                            </div>
                            <!-- Elementos de resguardo ocultos para compatibilidad -->
                            <span id="val-laycan-eta" class="hidden"></span>
                            <span id="val-laycan-cancelling" class="hidden"></span>
                            <span id="val-laycan-left" class="hidden"></span>
                            <span id="val-laycan-voyage" class="hidden"></span>
                            <span id="val-laycan-buffer" class="hidden"></span>
                        </div>
                    </div>

                    <!-- TARJETA 2: CADENCIA DE DESPACHO Y PLANTA -->
                    <div id="card-loadrate" class="bg-slate-800 border border-slate-700 border-l-4 border-l-amber-500 rounded-xl p-5 shadow-lg flex flex-col justify-between space-y-4">
                        <div>
                            <div class="flex items-center justify-between mb-3">
                                <span class="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5" id="label-dispatch-cadence">
                                    🟡 Cadencia de Despacho y Planta
                                </span>
                                <span id="badge-loadrate-status" class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-950 text-amber-300 border border-amber-800">
                                    ADVERTENCIA
                                </span>
                            </div>
                            <h3 id="loadrate-title" class="text-lg font-bold text-white mb-2">
                                Cadencia de Despacho y Planta
                            </h3>
                            <p id="loadrate-desc" class="text-sm text-slate-300 leading-relaxed">
                                Evaluando tiempos en planta y capacidad de flota...
                            </p>
                        </div>
                        
                        <div class="pt-3 border-t border-slate-700/60 text-xs text-slate-400 space-y-2.5">
                            <!-- Bloque Origen (Carga) -->
                            <div class="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50 space-y-1">
                                <div class="text-[11px] font-bold text-indigo-300 uppercase tracking-wide mb-1">Origen (Carga)</div>
                                <div class="flex justify-between">
                                    <span>Punto de Carga:</span>
                                    <span id="val-origen-carga" class="font-bold text-slate-200">--</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Tiempo Est. Carga:</span>
                                    <span id="val-tiempo-carga" class="font-bold text-amber-400">--</span>
                                </div>
                            </div>

                            <!-- Bloque Destino (Descarga) -->
                            <div class="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50 space-y-1">
                                <div class="text-[11px] font-bold text-indigo-300 uppercase tracking-wide mb-1">Destino (Descarga)</div>
                                <div class="flex justify-between">
                                    <span>Punto de Descarga:</span>
                                    <span id="val-destino-descarga" class="font-bold text-slate-200">--</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Tiempo Est. Descarga:</span>
                                    <span id="val-tiempo-descarga" class="font-bold text-amber-400">--</span>
                                </div>
                            </div>

                            <!-- Métrica Flota Total y Cadencia Sugerida -->
                            <div class="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50 space-y-1">
                                <div class="flex justify-between">
                                    <span>Flota Total:</span>
                                    <span id="val-flota-total" class="font-bold text-indigo-300">-- camiones</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Cadencia Sugerida:</span>
                                    <span id="val-cadencia-sugerida" class="font-bold text-emerald-400">-- camiones/día</span>
                                </div>
                            </div>

                            <!-- Indicador de Riesgo para Paralizaciones -->
                            <div class="flex justify-between font-bold text-slate-200 pt-1 border-t border-slate-700/60">
                                <span>Riesgo Paralizaciones:</span>
                                <span id="val-riesgo-paralizaciones" class="text-emerald-400">BAJO (Dentro de horas libres)</span>
                            </div>

                            <!-- Totalizador de tiempo en planta -->
                            <div class="flex justify-between font-medium text-slate-400 text-[11px]">
                                <span>Tiempo Total en Plantas:</span>
                                <span id="val-portdays-total" class="text-indigo-400">--</span>
                            </div>
                            <!-- Elementos de resguardo ocultos para compatibilidad -->
                            <span id="val-loadrate-current" class="hidden"></span>
                            <span id="val-loadrate-days" class="hidden"></span>
                            <span id="val-loadrate-required" class="hidden"></span>
                            <span id="val-dischargerate-current" class="hidden"></span>
                            <span id="val-dischargerate-days" class="hidden"></span>
                            <span id="val-dischargerate-required" class="hidden"></span>
                        </div>
                    </div>

                    <!-- TARJETA 3: SALUD FINANCIERA DE LA FLOTA -->
                    <div id="card-financial" class="bg-slate-800 border border-slate-700 border-l-4 border-l-emerald-500 rounded-xl p-5 shadow-lg flex flex-col justify-between space-y-4">
                        <div>
                            <div class="flex items-center justify-between mb-3">
                                <span class="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5" id="label-fleet-financial">
                                    🟢 Salud Financiera de la Flota
                                </span>
                                <span id="badge-financial-status" class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    APROBADO
                                </span>
                            </div>
                            <h3 id="financial-title" class="text-lg font-bold text-white mb-2">
                                Salud Financiera de la Flota
                            </h3>
                            <p id="financial-desc" class="text-sm text-slate-300 leading-relaxed">
                                Evaluando rentabilidad de la operación terrestre...
                            </p>
                        </div>
                        <div class="pt-3 border-t border-slate-700/60 text-xs text-slate-400 space-y-1.5">
                            <div class="flex justify-between">
                                <span>Margen Neto del Proyecto:</span>
                                <span id="val-margen-neto-proyecto" class="transition-all duration-300 font-bold text-slate-200">-- €</span>
                            </div>
                            <div class="flex justify-between font-semibold text-indigo-300">
                                <span>Beneficio Neto por Camión:</span>
                                <span id="val-beneficio-neto-camion" class="transition-all duration-300 font-bold text-indigo-300">-- €</span>
                            </div>
                            <div class="flex justify-between font-semibold text-amber-300 pt-1 border-t border-slate-700/40">
                                <span>Coste Base por Kilómetro (€/km):</span>
                                <span id="val-coste-base-km" class="font-bold text-amber-300">-- €/km</span>
                            </div>
                            <div class="flex justify-between font-bold pt-1 border-t border-slate-700/60">
                                <span>Margen Operativo Calculado:</span>
                                <span id="val-financial-margin" class="text-emerald-400">--%</span>
                            </div>
                            <!-- Elementos de resguardo ocultos para compatibilidad -->
                            <span id="val-financial-flete" class="hidden"></span>
                            <span id="val-financial-flete-unit" class="hidden"></span>
                            <span id="val-financial-breakeven" class="hidden"></span>
                            <span id="val-financial-breakeven-unit" class="hidden"></span>
                        </div>
                    </div>

                </section>

                <!-- SECCIÓN: MOTOR DE RECOMENDACIONES COMERCIALES Y RIESGOS OPERATIVOS -->
                <section class="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
                    <div class="flex items-center justify-between border-b border-slate-700 pb-4">
                        <div>
                            <h2 class="text-xl font-bold text-white flex items-center gap-2">
                                <span>🎯 Motor de Recomendaciones Comerciales</span>
                            </h2>
                            <p class="text-xs text-slate-400">
                                Estrategias terrestres de transporte por carretera y gestión de flota generadas en tiempo real.
                            </p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-slate-900 text-indigo-400 border border-indigo-500/30">
                            DSS Algorithmic Directives
                        </span>
                    </div>

                    <div id="contenedor-recomendaciones" class="space-y-3">
                        <!-- Se inyectan dinámicamente -->
                    </div>
                </section>

                <!-- BARRA DE PROGRESO VISUAL: RATIO DE TIEMPO (PLANTA VS CONDUCCIÓN) -->
                <section class="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-4">
                        <div>
                            <h2 class="text-lg font-bold text-white flex items-center gap-2">
                                <span>⏱️ Distribución de Tiempo Operativo (Planta vs Conducción)</span>
                            </h2>
                            <p class="text-xs text-slate-400">
                                Análisis visual de estancia en plantas frente a horas efectivas de conducción terrestre (OSRM).
                            </p>
                        </div>
                        <div class="flex items-center gap-4 text-xs font-semibold">
                            <div class="flex items-center gap-1.5">
                                <span class="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
                                <span class="text-slate-300">Tiempo en Plantas: <span id="label-port-days-count" class="text-amber-400">0</span> d (<span id="label-port-pct" class="text-amber-400">0%</span>)</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <span class="w-3 h-3 rounded-full bg-indigo-500 inline-block"></span>
                                <span class="text-slate-300">Tiempo Conducción: <span id="label-sea-days-count" class="text-indigo-400">0</span> d (<span id="label-sea-pct" class="text-indigo-400">0%</span>)</span>
                            </div>
                        </div>
                    </div>

                    <!-- Contenedor de la barra de progreso dual -->
                    <div class="space-y-2">
                        <div class="w-full bg-slate-900 h-6 rounded-full overflow-hidden flex border border-slate-700 shadow-inner">
                            <div id="bar-port" class="bg-amber-500 h-full text-[11px] font-extrabold text-slate-950 flex items-center justify-center transition-all duration-500" style="width: 50%;">
                                50% Planta
                            </div>
                            <div id="bar-sea" class="bg-indigo-600 h-full text-[11px] font-extrabold text-white flex items-center justify-center transition-all duration-500" style="width: 50%;">
                                50% Conducción
                            </div>
                        </div>

                        <!-- Leyenda e Interpretación de Diagnóstico de Tiempo -->
                        <div id="diagnostico-tiempo" class="text-xs text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 flex items-center justify-between">
                            <span>Cargando análisis de ratio de tiempo...</span>
                        </div>
                    </div>
                </section>

                <!-- ========================================== -->
                <!-- NIVEL 1: AUDITORÍA ESTRATÉGICA MADRE (TERRESTRE) -->
                <!-- ========================================== -->
                <section id="madre-audit-level1-card" class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all mt-6">
                    <div class="space-y-1.5 flex-1 min-w-0">
                        <div class="flex items-center gap-2.5 flex-wrap">
                            <span class="text-base font-bold text-slate-900 flex items-center gap-2">
                                <i class="fa-solid fa-brain text-teal-700"></i> Auditoría Estratégica MADRE (Terrestre)
                            </span>
                            <span id="madre-audit-veredicto-badge" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                Pendiente de Auditoría
                            </span>
                        </div>
                        <p id="madre-audit-resumen-texto" class="text-xs text-gray-800 max-w-3xl leading-relaxed">
                            Pulsa "Auditoría MADRE (Terrestre)" para evaluar la viabilidad de la ruta, detectar riesgos de paralización en frontera o muelles y proteger el margen de transporte.
                        </p>
                    </div>
                    <button type="button" id="btn-ver-auditoria-completa" onclick="abrirAuditoriaMadreOffcanvas()" class="ml-0 md:ml-4 px-4 py-2 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-all flex items-center gap-2 shadow-sm cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
                        <i class="fa-solid fa-file-shield"></i>
                        <span>Ver Auditoría Completa</span>
                    </button>
                </section>

            </div>

            <!-- ========================================== -->
            <!-- NIVEL 2: OFFCANVAS AUDITORÍA ESTRATÉGICA (ESTRICTO: BG-WHITE, TEXT-SLATE-900) -->
            <!-- ========================================== -->
            <div id="madre-audit-offcanvas-overlay" onclick="cerrarAuditoriaMadreOffcanvas()" class="fixed inset-0 bg-slate-900/60 z-[99998] transition-opacity duration-300 hidden opacity-0"></div>

            <aside id="madre-audit-offcanvas" class="fixed top-0 right-0 h-screen w-full sm:w-[520px] md:w-[620px] lg:w-[680px] max-w-2xl bg-white text-slate-900 z-[99999] shadow-2xl transition-transform duration-300 transform translate-x-full border-l border-slate-200 flex flex-col font-sans" aria-label="Panel Lateral de Auditoría Estratégica">
                <!-- Cabecera Corporativa -->
                <header class="px-6 py-5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-xs">
                            <i class="fa-solid fa-brain text-lg"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h2 class="text-base font-bold text-slate-900 tracking-tight">Auditoría Estratégica MADRE</h2>
                                <span id="offcanvas-veredicto-badge" class="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200">
                                    🟡 PENDIENTE
                                </span>
                            </div>
                            <p class="text-xs text-slate-500">Transporte Terrestre · Land Charter Core PRO</p>
                        </div>
                    </div>
                    <button type="button" onclick="cerrarAuditoriaMadreOffcanvas()" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Cerrar panel">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </header>

                <!-- Contenido Scrollable Corporativo (Limpio y Tabular con generoso p-6) -->
                <div class="flex-1 overflow-y-auto p-6 space-y-6 bg-white text-slate-900 text-sm">
                    
                    <!-- Tabla Resumen Parámetros Operativos -->
                    <section class="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 shadow-xs">
                        <div class="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                            <span class="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <i class="fa-solid fa-route text-teal-700"></i> Parámetros de Ruta & Porte
                            </span>
                            <span id="offcanvas-route-summary" class="text-xs font-mono font-bold text-slate-600">Ruta Terrestre</span>
                        </div>
                        <div class="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div>
                                <span class="block text-[11px] font-medium text-slate-500">Ruta (POL ➔ POD)</span>
                                <strong id="offcanvas-table-route" class="block text-slate-900 font-bold mt-1 truncate">— ➔ —</strong>
                            </div>
                            <div>
                                <span class="block text-[11px] font-medium text-slate-500">Capacidad / LDM</span>
                                <strong id="offcanvas-table-ldm" class="block text-slate-900 font-bold mt-1">13.6 LDM</strong>
                            </div>
                            <div>
                                <span class="block text-[11px] font-medium text-slate-500">Flete Cotizado</span>
                                <strong id="offcanvas-table-flete" class="block text-emerald-700 font-bold mt-1">0,00 €</strong>
                            </div>
                            <div>
                                <span class="block text-[11px] font-medium text-slate-500">Peajes / Costes</span>
                                <strong id="offcanvas-table-costes" class="block text-slate-900 font-bold mt-1">0,00 €</strong>
                            </div>
                        </div>
                    </section>

                    <!-- Reporte Estratégico -->
                    <section class="space-y-2.5">
                        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <i class="fa-solid fa-file-lines text-teal-700"></i> Reporte Estratégico
                        </h3>
                        <div id="offcanvas-reporte-estrategico" class="bg-white border border-slate-200 rounded-lg p-5 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-xs">
                            Ejecuta la auditoría para generar el análisis estratégico detallado.
                        </div>
                    </section>

                    <!-- Variables Perjudiciales con Badges de Alerta -->
                    <section class="space-y-2.5">
                        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <i class="fa-solid fa-triangle-exclamation text-amber-600"></i> Variables Perjudiciales
                        </h3>
                        <div id="offcanvas-variables-container" class="flex flex-wrap gap-2.5">
                            <span class="text-xs text-slate-400 italic">No se han evaluado variables aún.</span>
                        </div>
                    </section>

                    <!-- Recomendaciones con Iconos de Pro (verde) y Contra (rojo) -->
                    <section class="space-y-2.5">
                        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <i class="fa-solid fa-scale-balanced text-teal-700"></i> Recomendaciones Estratégicas
                        </h3>
                        <div id="offcanvas-recomendaciones-container" class="space-y-3">
                            <span class="text-xs text-slate-400 italic">Sin recomendaciones disponibles.</span>
                        </div>
                    </section>

                    <!-- Desglose de Modificaciones Opción B -->
                    <section id="offcanvas-modificaciones-section" class="border border-teal-200 rounded-lg p-5 bg-teal-50/40 space-y-2.5">
                        <h4 class="text-xs font-bold text-teal-950 uppercase tracking-wider flex items-center gap-1.5">
                            <i class="fa-solid fa-pen-to-square text-teal-700"></i> Modificaciones Contractuales (Opción B)
                        </h4>
                        <p class="text-xs text-slate-600">
                            MADRE propone actualizar el flete y añadir blindaje de paralizaciones para neutralizar los riesgos detectados.
                        </p>
                        <div id="offcanvas-modificaciones-preview" class="bg-white border border-teal-200 rounded p-4 text-xs text-slate-800 font-mono space-y-1.5">
                            <div>Tarifa sugerida: <strong id="offcanvas-mod-tarifa" class="text-teal-900 font-bold">—</strong></div>
                            <div>Cláusula de paralización: <span id="offcanvas-mod-paralizacion" class="font-sans text-slate-700 italic">—</span></div>
                        </div>
                    </section>
                </div>

                <!-- Footer Anclado (Sticky Footer) con Botón Final Opción B Destacado (w-full, bg-teal-700, text-white) -->
                <footer class="sticky bottom-0 p-5 bg-white border-t border-slate-200 shadow-lg flex flex-col sm:flex-row items-center gap-3 shrink-0 z-10">
                    <button type="button" onclick="cerrarAuditoriaMadreOffcanvas()" class="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition-colors shadow-2xs">
                        Cerrar
                    </button>
                    <button type="button" id="btn-generar-orden-carga-estrategica" onclick="aplicarModificacionesYGenerarOrdenCarga()" class="w-full flex-1 px-5 py-3 text-sm font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer">
                        <i class="fa-solid fa-file-signature text-base"></i>
                        <span>Generar Orden de Carga Estratégica (Opción B)</span>
                    </button>
                </footer>
            </aside>
`;

const DSS_EMPTY_STATE_TEMPLATE = `
    <strong class="block text-base text-white font-semibold" style="color: #ffffff !important;">
        Esperando datos de ruta
    </strong>
    <span class="mt-2 block text-gray-300" style="color: #d1d5db !important;">
        Define POL, POD y cantidad de carga en Mapa o Calculadora para activar Decisiones.
    </span>
`;

function renderDecisionSupportEmptyState() {
    const emptyState = document.getElementById("dss-empty-state");
    if (emptyState) emptyState.innerHTML = DSS_EMPTY_STATE_TEMPLATE;
}

function hydrateDecisionSupportState() {
    window.requestAnimationFrame(() => {
        if (typeof window.syncDecisionesFromCalculator === "function") {
            window.syncDecisionesFromCalculator();
            return;
        }
        window.actualizarDesdeFormulario?.();
    });
}

// Escuchar actualizaciones de ruta y cálculo en tiempo real
if (typeof window !== "undefined") {
    if (!window.__dssVoyageCalculatedListenerInstalled) {
        window.__dssVoyageCalculatedListenerInstalled = true;
        const onVoyageUpdated = (event) => {
            const detail = event?.detail || window.activeVoyage || window.State || {};
            if (typeof window.syncDecisionesFromCalculator === "function") {
                window.syncDecisionesFromCalculator();
            } else if (typeof window.actualizarDesdeFormulario === "function") {
                window.actualizarDesdeFormulario();
            }
        };
        window.addEventListener("voyageCalculated", onVoyageUpdated);
        window.addEventListener("CALCULATION_EVENT", onVoyageUpdated);
        window.addEventListener("AUTO_FLOW_CALCULATIONS_READY", onVoyageUpdated);
    }
}

function escapeAuditHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function renderizarMadreAuditLevel1(data = {}) {
    const badge = document.getElementById('madre-audit-veredicto-badge');
    const resumen = document.getElementById('madre-audit-resumen-texto');
    const btnVer = document.getElementById('btn-ver-auditoria-completa');

    const v = String(data.veredicto_general || '').trim();
    const isGreen = v.includes('🟢') || /viable|aprobado|optimo/i.test(v);
    const isRed = v.includes('🔴') || /critico|rechazar|riesgo/i.test(v);

    if (badge) {
        if (isGreen) {
            badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300';
            badge.textContent = '🟢 VIABLE / APROBADO';
        } else if (isRed) {
            badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300';
            badge.textContent = '🔴 RIESGO CRÍTICO / RECHAZAR';
        } else {
            badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300';
            badge.textContent = '🟡 PRECAUCIÓN / CONDICIONADO';
        }
    }

    if (resumen && data.reporte_estrategico) {
        const shortText = data.reporte_estrategico.split('\n')[0] || data.reporte_estrategico;
        resumen.textContent = shortText;
    }

    if (btnVer) {
        btnVer.disabled = false;
        btnVer.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

export function renderizarMadreAuditOffcanvas(data = {}, ctx = null) {
    const v = String(data.veredicto_general || '').trim();
    const isGreen = v.includes('🟢') || /viable|aprobado|optimo/i.test(v);
    const isRed = v.includes('🔴') || /critico|rechazar|riesgo/i.test(v);

    const offBadge = document.getElementById('offcanvas-veredicto-badge');
    if (offBadge) {
        if (isGreen) {
            offBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300';
            offBadge.textContent = '🟢 VIABLE (APROBADO)';
        } else if (isRed) {
            offBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300';
            offBadge.textContent = '🔴 RIESGO CRÍTICO';
        } else {
            offBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300';
            offBadge.textContent = '🟡 CONDICIONADO';
        }
    }

    // Parámetros tabulares
    const tableRoute = document.getElementById('offcanvas-table-route');
    const tableLdm = document.getElementById('offcanvas-table-ldm');
    const tableFlete = document.getElementById('offcanvas-table-flete');
    const tableCostes = document.getElementById('offcanvas-table-costes');
    const routeSummary = document.getElementById('offcanvas-route-summary');

    const pol = ctx?.ruta?.origen || document.getElementById('input-pol')?.value || window.State?.pol || 'Origen';
    const pod = ctx?.ruta?.destino || document.getElementById('input-pod')?.value || window.State?.pod || 'Destino';
    const dist = ctx?.ruta?.distanciaKm || window.State?.totalDistanceKm || 0;
    const ldm = ctx?.ldm || window.State?.ldm || 13.6;
    const flete = ctx?.porte?.fleteEstimado || document.getElementById('input-fleteEstimado')?.value || 0;
    const peajes = ctx?.peajes || window.State?.peajes || 0;

    if (tableRoute) tableRoute.textContent = `${pol} ➔ ${pod}`;
    if (routeSummary) routeSummary.textContent = dist > 0 ? `${dist} km` : 'Ruta activa';
    if (tableLdm) tableLdm.textContent = `${ldm} LDM`;
    if (tableFlete) tableFlete.textContent = `${Number(flete).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    if (tableCostes) tableCostes.textContent = `${Number(peajes).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € peajes`;

    // Reporte Estratégico
    const repEl = document.getElementById('offcanvas-reporte-estrategico');
    if (repEl) {
        repEl.textContent = data.reporte_estrategico || 'Sin reporte estratégico disponible.';
    }

    // Variables Perjudiciales con Badges de Alerta
    const varsContainer = document.getElementById('offcanvas-variables-container');
    if (varsContainer) {
        const vars = Array.isArray(data.variables_perjudiciales) ? data.variables_perjudiciales : [];
        if (vars.length > 0) {
            varsContainer.innerHTML = vars.map((item) => `
                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs">
                    <i class="fa-solid fa-triangle-exclamation text-amber-600"></i> ${escapeAuditHtml(item)}
                </span>
            `).join('');
        } else {
            varsContainer.innerHTML = '<span class="text-xs text-slate-500 italic">No se detectaron variables de riesgo severas.</span>';
        }
    }

    // Recomendaciones Estratégicas (Pros y Contras)
    const recsContainer = document.getElementById('offcanvas-recomendaciones-container');
    if (recsContainer) {
        const recs = Array.isArray(data.recomendaciones) ? data.recomendaciones : [];
        if (recs.length > 0) {
            recsContainer.innerHTML = recs.map((r) => {
                const isPro = String(r.tipo || '').toLowerCase().includes('pro') || r.isPro || (!String(r.tipo || '').toLowerCase().includes('contra') && !String(r.tipo || '').toLowerCase().includes('critico'));
                const icon = isPro
                    ? '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold shrink-0">🟢</span>'
                    : '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold shrink-0">🔴</span>';
                const bgBorder = isPro ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30';
                const titleColor = isPro ? 'text-emerald-950 font-bold' : 'text-red-950 font-bold';
                return `
                    <div class="border ${bgBorder} rounded-lg p-3.5 flex items-start gap-3">
                        ${icon}
                        <div class="flex-1 min-w-0">
                            <h4 class="text-xs ${titleColor}">${escapeAuditHtml(r.titulo || (isPro ? 'Pro / Recomendación Favorable' : 'Contra / Factor de Riesgo'))}</h4>
                            <p class="text-xs text-slate-700 mt-1 leading-relaxed">${escapeAuditHtml(r.descripcion || r.texto || '')}</p>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            recsContainer.innerHTML = '<span class="text-xs text-slate-500 italic">Sin recomendaciones específicas.</span>';
        }
    }

    // Modificaciones Contractuales (Opción B)
    const mods = data.modificaciones_recap || {};
    const modTarifa = document.getElementById('offcanvas-mod-tarifa');
    const modParalizacion = document.getElementById('offcanvas-mod-paralizacion');
    if (modTarifa) {
        const tVal = mods.tarifaSugerida || mods.fleteEstimado;
        modTarifa.textContent = tVal ? `${Number(tVal).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : 'Tarifa actual';
    }
    if (modParalizacion) {
        modParalizacion.textContent = mods.clausulaParalizacion || 'Franquicia estándar 3h y 60 €/h adicional.';
    }
}

export function abrirAuditoriaMadreOffcanvas() {
    const overlay = document.getElementById('madre-audit-offcanvas-overlay');
    const drawer = document.getElementById('madre-audit-offcanvas');
    if (overlay && drawer) {
        overlay.classList.remove('hidden');
        window.requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            drawer.classList.remove('translate-x-full');
        });
    }
}

export function cerrarAuditoriaMadreOffcanvas() {
    const overlay = document.getElementById('madre-audit-offcanvas-overlay');
    const drawer = document.getElementById('madre-audit-offcanvas');
    if (overlay && drawer) {
        overlay.classList.add('opacity-0');
        drawer.classList.add('translate-x-full');
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300);
    }
}

export async function ejecutarAuditoriaMadre() {
    const btn = document.getElementById('btn-auditoria-madre');
    const badge = document.getElementById('madre-audit-veredicto-badge');
    const resumen = document.getElementById('madre-audit-resumen-texto');

    const originalBtnText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin text-indigo-400"></i><span>Auditando con MADRE...</span>';
    }
    if (badge) {
        badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-900/50 text-indigo-300 border border-indigo-700 animate-pulse';
        badge.textContent = 'Analizando variables...';
    }
    if (resumen) {
        resumen.textContent = 'Consultando heurísticas estratégicas en MADRE para transporte terrestre...';
    }

    try {
        const dssState = typeof window.getDSSCurrentState === 'function' ? window.getDSSCurrentState() : {};
        const pol = dssState.pol || document.getElementById('input-pol')?.value || document.getElementById('port-pol')?.value || window.State?.pol || '';
        const pod = dssState.pod || document.getElementById('input-pod')?.value || document.getElementById('port-pod')?.value || window.State?.pod || '';
        const distanceKm = Number(window.LandData?.totalDistanceKm || window.State?.totalDistanceKm || window.State?.distanceKm || (dssState.estimatedVoyageDays ? dssState.estimatedVoyageDays * 800 : 0));
        const ldm = Number(window.State?.ldm || window.State?.cargo_sf || document.getElementById('cargo-sf')?.value || 13.6);
        const cargoQty = Number(dssState.cargoQty || document.getElementById('input-cargoQty')?.value || window.State?.cargo || 24000);
        const fleteEstimado = Number(dssState.fleteEstimado || document.getElementById('input-fleteEstimado')?.value || window.State?.freightSell || 1200);
        const breakEven = Number(dssState.breakEven || document.getElementById('input-breakEven')?.value || window.State?.breakEven || 950);
        const totalCostes = Number(dssState.totalVoyageCost || window.State?.totalVoyageCost || breakEven || 0);
        const peajes = Number(window.LandData?.totalTollsCost || window.State?.peajes || window.State?.pdaPol || document.getElementById('pda-pol')?.value || 0);
        const dietas = Number(window.State?.dietas || window.State?.pdaPod || 0);
        const combustible = Number(window.State?.combustible || window.State?.fuelCost || 0);
        const margenBruto = fleteEstimado > 0 ? ((fleteEstimado - breakEven) / fleteEstimado) * 100 : 0;

        const contexto_ui = {
            porte: {
                fleteEstimado,
                breakEven,
                margenBruto,
                tipoCarga: dssState.commodity || document.getElementById('input-commodity')?.value || 'Carga General',
                pesoKg: cargoQty
            },
            ruta: {
                origen: pol,
                destino: pod,
                distanciaKm: distanceKm
            },
            ldm: ldm,
            costes: {
                costeTotal: totalCostes,
                breakEvenKm: breakEven,
                combustible: combustible,
                dietas: dietas
            },
            peajes: peajes
        };

        const payload = {
            modulo: 'land_charter',
            vista_activa: 'decisiones',
            contexto_ui: contexto_ui,
            mensajeUsuario: 'Auditoría estratégica terrestre para porte actual'
        };

        const res = await fetch('/api/madre-ia', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-App-Context': 'land_charter'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`HTTP error ${res.status}`);
        }

        const data = await res.json();
        window.currentMadreAudit = data;
        window.lastMadreAudit = data;

        // 1. Renderizar Nivel 1 (Tarjeta Inferior)
        renderizarMadreAuditLevel1(data);

        // 2. Preparar Nivel 2 (Offcanvas)
        renderizarMadreAuditOffcanvas(data, contexto_ui);

        if (typeof window.showToast === 'function') {
            window.showToast(`✅ Auditoría MADRE completada: Veredicto ${data.veredicto_general || 'Evaluado'}`);
        }

        return data;
    } catch (error) {
        console.error('Error al ejecutar Auditoría MADRE:', error);
        if (resumen) {
            resumen.textContent = 'No se pudo conectar con el motor de auditoría MADRE. Revisa tu conexión o inténtalo nuevamente.';
        }
        if (badge) {
            badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-800';
            badge.textContent = 'Error de Conexión';
        }
        if (typeof window.showToast === 'function') {
            window.showToast('❌ Error al ejecutar Auditoría MADRE');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnText;
        }
    }
}

export async function aplicarModificacionesYGenerarOrdenCarga() {
    const auditData = window.currentMadreAudit || window.lastMadreAudit || null;
    const mods = auditData?.modificaciones_recap || {};

    // 1. Sobrescribir el estado del formulario actual con las modificaciones de MADRE
    if (mods.fleteEstimado || mods.tarifaSugerida) {
        const nuevoFlete = Number(mods.fleteEstimado || mods.tarifaSugerida);
        const inputFlete = document.getElementById('input-fleteEstimado');
        if (inputFlete) inputFlete.value = nuevoFlete;
        const freightSell = document.getElementById('freight-sell');
        if (freightSell) freightSell.value = nuevoFlete;
        if (window.State) {
            window.State.freightSell = nuevoFlete;
            window.State.fleteEstimado = nuevoFlete;
            window.State.allInRateGross = nuevoFlete;
        }
    }

    if (mods.breakEven) {
        const inputBreakEven = document.getElementById('input-breakEven');
        if (inputBreakEven) inputBreakEven.value = Number(mods.breakEven);
        if (window.State) window.State.breakEven = Number(mods.breakEven);
    }

    if (mods.clausulaParalizacion) {
        window.State = window.State || {};
        window.State.clausulaParalizacion = mods.clausulaParalizacion;
        window.dssInjectedClausulaParalizacion = mods.clausulaParalizacion;
    }

    if (mods.condicionesEspeciales) {
        window.State = window.State || {};
        window.State.condicionesEspeciales = mods.condicionesEspeciales;
    }

    // Sincronizar formulario y recálculos
    if (typeof window.actualizarDesdeFormulario === 'function') {
        window.actualizarDesdeFormulario();
    }
    if (typeof window.runEngine === 'function') {
        window.runEngine();
    }

    if (typeof window.showToast === 'function') {
        window.showToast('✅ Modificaciones de MADRE aplicadas. Generando Orden de Carga...', true);
    }

    // 2. Disparar generador de PDF de la Orden de Carga Estratégica
    return await generateOrdenDeCargaPDF(mods);
}

export function buildOrdenDeCargaHTMLTemplate(state = {}, mods = {}) {
    const safeState = state || {};
    const pol = String(safeState.pol || window.State?.pol || 'Origen').toUpperCase();
    const pod = String(safeState.pod || window.State?.pod || 'Destino').toUpperCase();
    const distanceKm = Number(window.LandData?.totalDistanceKm || window.State?.totalDistanceKm || window.State?.distanceKm || 0);
    const ldm = Number(window.State?.ldm || window.State?.cargo_sf || 13.6);
    const cargoQty = Number(safeState.cargoQty || window.State?.cargo || 24000);
    const commodity = String(safeState.commodity || 'CARGA GENERAL').toUpperCase();
    const fleteFinal = Number(mods.fleteEstimado || mods.tarifaSugerida || safeState.fleteEstimado || window.State?.freightSell || 1200);
    const peajes = Number(mods.peajes ?? safeState.peajes ?? window.State?.peajes ?? window.LandData?.totalTollsCost ?? 0);
    const clausulaParalizacion = String(mods.clausulaParalizacion || window.State?.clausulaParalizacion || 'Indemnización por paralización: 60,00 €/hora tras 3 horas de espera en carga/descarga o frontera.');
    const condicionesEspeciales = String(mods.condicionesEspeciales || window.State?.condicionesEspeciales || 'Opción B Estratégica MADRE: Retorno en vacío cubierto al 70%, peajes incluidos y franquicia de espera limitada a 3h.');
    const refNo = String(window.State?.project_ref || window.anchoredReference || `ORD-ROAD-${Date.now().toString().slice(-6)}`);
    const dateStr = new Date().toLocaleDateString('es-ES');

    return `
      <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 800px; margin: 0 auto; padding: 24px; font-size: 11px; line-height: 1.5; background: #ffffff;">
        <div style="border-bottom: 2px solid #1e40af; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #1e3a8a; letter-spacing: -0.5px;">ORDEN DE CARGA Y CONTRATO DE TRANSPORTE TERRESTRE</h1>
            <p style="margin: 3px 0 0; font-size: 11px; color: #475569; font-weight: 600;">RODAHMAR ROAD LOGISTICS · CONDICIONES ESTRATÉGICAS (OPCIÓN B)</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 13px; font-weight: 800; color: #1e40af;">Ref: ${refNo}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Fecha: ${dateStr}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="width: 50%; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; vertical-align: top;">
              <strong style="color: #1e3a8a; font-size: 11px;">1. OPERADOR DE TRANSPORTE / CARGADOR</strong><br/>
              <strong>RODAHMAR ROAD LOGISTICS S.L.</strong><br/>
              Dpto. Tráfico & Fletamento Terrestre<br/>
              Bussiness ID: ES-B88291024
            </td>
            <td style="width: 50%; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; vertical-align: top;">
              <strong style="color: #1e3a8a; font-size: 11px;">2. TRANSPORTISTA / FLOTA ASIGNADA</strong><br/>
              <strong>FLOTA TITULAR / SUBCONTRATISTA HOMOLOGADO</strong><br/>
              Vehículo: Tráiler Tauliner 13.6m (${ldm} LDM)<br/>
              Conformidad CMR / LOTT Estricta
            </td>
          </tr>
        </table>

        <div style="margin-bottom: 16px;">
          <h2 style="font-size: 12px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px;">3. ITINERARIO Y CONDICIONES DE RUTA</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              <tr>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; background: #f1f5f9; width: 25%;">Lugar de Carga (POL)</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 25%; font-weight: 600;">${pol}</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; background: #f1f5f9; width: 25%;">Lugar de Entrega (POD)</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; width: 25%; font-weight: 600;">${pod}</td>
              </tr>
              <tr>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; background: #f1f5f9;">Distancia Estimada</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${distanceKm > 0 ? `${distanceKm} km` : 'Ruta directa'}</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; background: #f1f5f9;">Mercancía</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${commodity} (${cargoQty} kg)</td>
              </tr>
              <tr>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; background: #f1f5f9;">Capacidad Asignada</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${ldm} Metros Lineales (LDM)</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; background: #f1f5f9;">Peajes e Impuestos</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${peajes > 0 ? `${peajes.toFixed(2)} € (Incluidos)` : 'Incluidos en tarifa'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-bottom: 16px;">
          <h2 style="font-size: 12px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px;">4. LIQUIDACIÓN COMERCIAL Y FLETE (OPCIÓN B)</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              <tr style="background: #eff6ff;">
                <td style="padding: 8px; border: 1px solid #bfdbfe; font-weight: 800; font-size: 12px; color: #1e3a8a;">TARIFA TOTAL PACTADA (ALL-IN):</td>
                <td style="padding: 8px; border: 1px solid #bfdbfe; font-weight: 800; font-size: 14px; color: #1d4ed8; text-align: right;">${fleteFinal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
              </tr>
              <tr>
                <td colspan="2" style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10px; color: #475569;">
                  Tarifa estratégica validada por MADRE DSS con cobertura de retorno y compensación de fluctuación de gasóleo profesional.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-bottom: 16px;">
          <h2 style="font-size: 12px; font-weight: 800; color: #b91c1c; border-bottom: 1px solid #fca5a5; padding-bottom: 4px; margin-bottom: 8px;">5. CLÁUSULAS ESPECIALES DE BLINDAJE ESTRATÉGICO</h2>
          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 8px 12px; margin-bottom: 8px;">
            <strong style="color: #92400e; font-size: 11px;">CLÁUSULA DE PARALIZACIÓN Y ESTADÍA:</strong><br/>
            <span style="color: #78350f;">${clausulaParalizacion}</span>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #dcfce7; border-left: 4px solid #10b981; padding: 8px 12px;">
            <strong style="color: #065f46; font-size: 11px;">CONDICIONES DE REPOSICIONAMIENTO Y ADUANAS:</strong><br/>
            <span style="color: #064e3b;">${condicionesEspeciales}</span>
          </div>
        </div>

        <div style="margin-top: 24px; display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; pt: 16px;">
          <div style="width: 45%; text-align: center;">
            <p style="font-size: 10px; color: #64748b; margin-bottom: 35px;">Por RODAHMAR ROAD LOGISTICS</p>
            <div style="border-top: 1px dashed #94a3b8; width: 70%; margin: 0 auto;"></div>
            <p style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Firma y Sello Autorizado</p>
          </div>
          <div style="width: 45%; text-align: center;">
            <p style="font-size: 10px; color: #64748b; margin-bottom: 35px;">Conforme Transportista / Conductor</p>
            <div style="border-top: 1px dashed #94a3b8; width: 70%; margin: 0 auto;"></div>
            <p style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Firma y Sello Conforme</p>
          </div>
        </div>
      </div>
    `;
}

export async function generateOrdenDeCargaPDF(mods = {}) {
    try {
        if (typeof window.showToast === 'function') {
            window.showToast('Generando Orden de Carga Estratégica (PDF)...', true);
        }

        const state = typeof window.getDSSCurrentState === 'function' ? window.getDSSCurrentState() : {};
        const htmlString = buildOrdenDeCargaHTMLTemplate(state, mods);
        const pol = state.pol || window.State?.pol || 'Origen';
        const pod = state.pod || window.State?.pod || 'Destino';
        const filename = `Orden_de_Carga_Estrategica_${pol}_${pod}_${new Date().toISOString().slice(0, 10)}.pdf`;

        if (typeof window.html2pdf === 'function') {
            const opt = {
                margin: 10,
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            await window.html2pdf().from(htmlString).set(opt).save();
        } else if (window.jspdf?.jsPDF || window.jsPDF) {
            const JsPDF = window.jspdf?.jsPDF || window.jsPDF;
            const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
            doc.setFontSize(16);
            doc.text('ORDEN DE CARGA Y CONTRATO DE TRANSPORTE TERRESTRE', 14, 20);
            doc.setFontSize(10);
            doc.text(`Ruta: ${pol} -> ${pod}`, 14, 30);
            doc.text(`Tarifa Pactada (Opción B): ${mods.tarifaSugerida || mods.fleteEstimado || state.fleteEstimado || 1200} EUR`, 14, 38);
            doc.text(`Clausula Paralizacion: ${mods.clausulaParalizacion || '60 EUR/hora tras 3h'}`, 14, 46);
            doc.save(filename);
        } else {
            console.warn('[generateOrdenDeCargaPDF] Librería PDF no disponible en este entorno.');
        }

        if (typeof window.showToast === 'function') {
            window.showToast('✅ Orden de Carga Estratégica (PDF) generada con éxito');
        }
        return true;
    } catch (err) {
        console.error('Error al generar Orden de Carga PDF:', err);
        if (typeof window.showToast === 'function') {
            window.showToast('❌ Error al generar Orden de Carga PDF');
        }
        return false;
    }
}

// Exponer en window para compatibilidad global y llamadas onclick
if (typeof window !== "undefined") {
    window.ejecutarAuditoriaMadre = ejecutarAuditoriaMadre;
    window.renderizarMadreAuditLevel1 = renderizarMadreAuditLevel1;
    window.renderizarMadreAuditOffcanvas = renderizarMadreAuditOffcanvas;
    window.abrirAuditoriaMadreOffcanvas = abrirAuditoriaMadreOffcanvas;
    window.cerrarAuditoriaMadreOffcanvas = cerrarAuditoriaMadreOffcanvas;
    window.aplicarModificacionesYGenerarOrdenCarga = aplicarModificacionesYGenerarOrdenCarga;
    window.generateOrdenDeCargaPDF = generateOrdenDeCargaPDF;
    window.buildOrdenDeCargaHTMLTemplate = buildOrdenDeCargaHTMLTemplate;
}

export function mountDecisionSupportModule(container) {
    if (!container || container.dataset.dssMounted === "true") return container;

    container.innerHTML = DECISION_SUPPORT_TEMPLATE;
    container.dataset.dssMounted = "true";
    renderDecisionSupportEmptyState();
    hydrateDecisionSupportState();
    return container;
}
