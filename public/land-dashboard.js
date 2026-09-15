/**
 * Land Charter Core PRO - land-dashboard.js
 * Módulo de gestión e inicialización del Dashboard Terrestre / Proyectos Forwarder.
 * Implementa manejo defensivo ante errores 500 y fallback silencioso al inicio.
 */

(function initializeLandDashboardModule(global) {
    'use strict';

    let forwarderProjects = [];
    let isDashboardInitialized = false;

    /**
     * Consulta proyectos de transitario en /api/forwarder-projects y /api/projects/forwarder.
     * Envuelve fetch y res.json() en try...catch defensivo.
     * En caso de error 500 o fallo de red, captura el error con console.warn,
     * asigna [] y permite continuar sin lanzar excepciones no capturadas.
     *
     * @param {string|object} [target] - Endpoint específico u opciones de configuración.
     * @param {object} [options] - Opciones adicionales de fetch (e.g. signal).
     * @returns {Promise<Array>} Lista de proyectos o array vacío en caso de fallo.
     */
    async function fetchForwarderProjects(target = null, options = {}) {
        let projects = [];
        const defaultEndpoints = [
            '/api/forwarder-projects',
            '/api/projects/forwarder'
        ];

        const endpoints = typeof target === 'string' && target ? [target] : defaultEndpoints;
        const opts = typeof target === 'object' && target !== null ? target : options;

        const getUrl = typeof global !== 'undefined' && typeof global.getApiUrl === 'function'
            ? global.getApiUrl
            : (typeof getApiUrl === 'function' ? getApiUrl : (url) => url);

        for (const endpoint of endpoints) {
            try {
                const targetUrl = getUrl(endpoint);
                const res = await fetch(targetUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    signal: opts?.signal
                });

                if (!res.ok) {
                    console.warn(`[land-dashboard] Error HTTP ${res.status} al consultar ${endpoint}:`, res.statusText || '');
                    continue;
                }

                const data = await res.json();
                if (data) {
                    const list = Array.isArray(data)
                        ? data
                        : (Array.isArray(data.projects) ? data.projects : (Array.isArray(data.items) ? data.items : []));
                    projects = list;
                    forwarderProjects = list;

                    if (typeof global !== 'undefined') {
                        if (global.State) {
                            global.State.projects = list;
                        }
                        global.forwarderProjects = list;
                    }
                    return list;
                }
            } catch (error) {
                // Fallback silencioso ante errores de red o servidor saturado (500)
                console.warn(`[land-dashboard] Fallback silencioso al consultar ${endpoint}:`, error?.message || error);
            }
        }

        // Si fallan las peticiones (e.g. Error 500 por saturación), se asigna un array vacío
        forwarderProjects = [];
        if (typeof global !== 'undefined') {
            if (global.State) {
                global.State.projects = [];
            }
            global.forwarderProjects = [];
        }
        return [];
    }

    /**
     * Inicializa el dashboard terrestre de forma defensiva.
     * Carga proyectos y renderiza la interfaz sin colapsar ante fallos del servidor.
     *
     * @param {object} [options]
     * @returns {Promise<{success: boolean, projects: Array}>}
     */
    async function initializeLandDashboard(options = {}) {
        try {
            const projects = await fetchForwarderProjects(options);
            isDashboardInitialized = true;

            renderLandDashboard(projects);

            if (typeof global !== 'undefined' && typeof global.dispatchEvent === 'function') {
                try {
                    global.dispatchEvent(new CustomEvent('land-dashboard:initialized', {
                        detail: { projects, count: projects.length }
                    }));
                } catch (_) {}
            }

            return { success: true, projects };
        } catch (error) {
            console.warn('[land-dashboard] Error controlado en initializeLandDashboard:', error?.message || error);
            forwarderProjects = [];
            if (typeof global !== 'undefined' && global.State) {
                global.State.projects = [];
            }
            renderLandDashboard([]);
            return { success: false, projects: [] };
        }
    }

    /**
     * Renderiza los elementos del dashboard terrestre en el DOM si existen.
     *
     * @param {Array} projects
     */
    function renderLandDashboard(projects = []) {
        if (typeof document === 'undefined' || !document) return;
        try {
            const listContainer = document.getElementById('forwarder-projects-list')
                || document.getElementById('land-dashboard-projects')
                || document.getElementById('projects-list');

            if (listContainer) {
                if (!projects || projects.length === 0) {
                    listContainer.innerHTML = '<div class="text-slate-400 text-sm p-4">No hay proyectos disponibles en este momento.</div>';
                } else {
                    listContainer.innerHTML = projects.map((p) => `
                        <div class="project-item p-3 rounded bg-slate-800 text-slate-100 mb-2" data-project-ref="${p.project_ref || p.id || ''}">
                            <span class="font-bold">${p.client_name || p.project_ref || 'Proyecto'}</span>
                            <span class="text-xs text-slate-400 ml-2">${p.status || 'Activo'}</span>
                        </div>
                    `).join('');
                }
            }
        } catch (err) {
            console.warn('[land-dashboard] Fallo no bloqueante al renderizar UI de proyectos:', err?.message || err);
        }
    }

    // Exposición en el objeto global (window / globalThis)
    const dashboardApi = {
        initializeLandDashboard,
        fetchForwarderProjects,
        renderLandDashboard,
        getProjects: () => forwarderProjects,
        isInitialized: () => isDashboardInitialized
    };

    if (typeof global !== 'undefined') {
        global.LandDashboard = dashboardApi;
        global.initializeLandDashboard = initializeLandDashboard;
        global.fetchForwarderProjects = fetchForwarderProjects;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = dashboardApi;
    }

    // Auto-inicialización segura en entorno de navegador
    if (typeof document !== 'undefined' && document) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                initializeLandDashboard();
            }, { once: true });
        } else {
            initializeLandDashboard();
        }
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
