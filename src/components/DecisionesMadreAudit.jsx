import React, { useState, useEffect } from 'react';
import {
  ejecutarAuditoriaMadre,
  abrirAuditoriaMadreOffcanvas,
  cerrarAuditoriaMadreOffcanvas,
  aplicarModificacionesYGenerarOrdenCarga,
  generateOrdenDeCargaPDF
} from '../DecisionSupportModule.js';

/**
 * Componente React "DecisionesMadreAudit" para Land Charter Core PRO.
 * Proporciona el botón secundario (outline) "Auditoría MADRE (Terrestre)",
 * la tarjeta inferior Nivel 1 con el veredicto general (🟢 / 🟡 / 🔴) con fondo blanco y diseño limpio,
 * y el panel lateral derecho Offcanvas Nivel 2 con diseño estrictamente corporativo (bg-white, text-slate-900),
 * amplio y espacioso, con botón final Opción B de ancho total y anclado al fondo (bg-teal-700).
 */
export default function DecisionesMadreAudit({
  contextoUi = null,
  onAuditComplete = null,
  onGenerateContract = null
}) {
  const [auditData, setAuditData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffcanvasOpen, setIsOffcanvasOpen] = useState(false);

  // Sincronizar con eventos o estado global si MADRE corre vía script
  useEffect(() => {
    const handleGlobalAuditReady = (event) => {
      const data = event?.detail || window.currentMadreAudit;
      if (data) {
        setAuditData(data);
      }
    };
    window.addEventListener('madre:audit-complete', handleGlobalAuditReady);
    return () => {
      window.removeEventListener('madre:audit-complete', handleGlobalAuditReady);
    };
  }, []);

  const runAudit = async () => {
    setIsLoading(true);
    try {
      const data = await ejecutarAuditoriaMadre();
      if (data) {
        setAuditData(data);
        if (typeof onAuditComplete === 'function') {
          onAuditComplete(data);
        }
      }
    } catch (err) {
      console.error('[DecisionesMadreAudit] Error al ejecutar auditoría:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateContract = async () => {
    const mods = auditData?.modificaciones_recap || {};
    await aplicarModificacionesYGenerarOrdenCarga();
    if (typeof onGenerateContract === 'function') {
      onGenerateContract(mods);
    }
  };

  const veredicto = auditData?.veredicto_general || '';
  const isGreen = veredicto.includes('🟢') || /viable|aprobado|optimo/i.test(veredicto);
  const isRed = veredicto.includes('🔴') || /critico|rechazar|riesgo/i.test(veredicto);

  return (
    <div className="madre-audit-integration-wrapper space-y-4 font-sans">
      {/* Botón de Acción en la barra de Decisiones */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          id="react-btn-auditoria-madre"
          onClick={runAudit}
          disabled={isLoading}
          className="px-3 py-1.5 text-xs font-semibold bg-transparent hover:bg-teal-700/10 text-teal-700 hover:text-teal-800 border border-teal-600 hover:border-teal-700 rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          title="Auditoría MADRE (Terrestre)"
        >
          {isLoading ? (
            <i className="fa-solid fa-spinner animate-spin text-teal-700" />
          ) : (
            <i className="fa-solid fa-brain text-teal-700" />
          )}
          <span>{isLoading ? 'Auditando con MADRE...' : 'Auditoría MADRE (Terrestre)'}</span>
        </button>
      </div>

      {/* Nivel 1: Tarjeta Inferior de Veredicto (Fondo Blanco, Borde Gray-200, Shadow-sm, Text Gray-800) */}
      <section
        id="react-madre-audit-level1-card"
        className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
      >
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-base font-bold text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-brain text-teal-700" /> Auditoría Estratégica MADRE (Terrestre)
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                !auditData
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : isGreen
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : isRed
                  ? 'bg-red-100 text-red-800 border-red-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}
            >
              {!auditData
                ? 'Pendiente de Auditoría'
                : isGreen
                ? '🟢 VIABLE / APROBADO'
                : isRed
                ? '🔴 RIESGO CRÍTICO / RECHAZAR'
                : '🟡 PRECAUCIÓN / CONDICIONADO'}
            </span>
          </div>
          <p className="text-xs text-gray-800 max-w-3xl leading-relaxed">
            {auditData?.reporte_estrategico
              ? auditData.reporte_estrategico.split('\n')[0]
              : 'Pulsa "Auditoría MADRE (Terrestre)" para evaluar la viabilidad de la ruta, detectar riesgos de paralización en frontera o muelles y proteger el margen de transporte.'}
          </p>
        </div>
        <button
          type="button"
          id="react-btn-ver-auditoria-completa"
          onClick={() => {
            setIsOffcanvasOpen(true);
            abrirAuditoriaMadreOffcanvas();
          }}
          disabled={!auditData}
          className="ml-0 md:ml-4 px-4 py-2 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-all flex items-center gap-2 shadow-sm cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="fa-solid fa-file-shield" />
          <span>Ver Auditoría Completa</span>
        </button>
      </section>

      {/* Nivel 2: Panel Lateral Derecho Offcanvas Amplio (w-full sm:w-[520px] md:w-[620px] lg:w-[680px] max-w-2xl, bg-white, text-slate-900, p-6) */}
      {isOffcanvasOpen && (
        <>
          <div
            onClick={() => {
              setIsOffcanvasOpen(false);
              cerrarAuditoriaMadreOffcanvas();
            }}
            className="fixed inset-0 bg-slate-900/60 z-[99998] transition-opacity duration-300"
          />
          <aside
            className="fixed top-0 right-0 h-screen w-full sm:w-[520px] md:w-[620px] lg:w-[680px] max-w-2xl bg-white text-slate-900 z-[99999] shadow-2xl transition-transform duration-300 border-l border-slate-200 flex flex-col font-sans"
            aria-label="Panel Lateral de Auditoría Estratégica"
          >
            {/* Cabecera Corporativa con Padding Generoso */}
            <header className="px-6 py-5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-xs">
                  <i className="fa-solid fa-brain text-lg" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">Auditoría Estratégica MADRE</h2>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wide border ${
                        isGreen
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isRed
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {veredicto || '🟡 EVALUADO'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Transporte Terrestre · Land Charter Core PRO</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOffcanvasOpen(false);
                  cerrarAuditoriaMadreOffcanvas();
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Cerrar panel"
              >
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </header>

            {/* Contenido Scrollable con p-6 interno amplio y espacioso */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white text-slate-900 text-sm">
              {/* Reporte Estratégico */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <i className="fa-solid fa-file-lines text-teal-700" /> Reporte Estratégico
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-xs">
                  {auditData?.reporte_estrategico || 'Análisis estratégico completado para la ruta terrestre.'}
                </div>
              </section>

              {/* Variables Perjudiciales con Badges de Alerta */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <i className="fa-solid fa-triangle-exclamation text-amber-600" /> Variables Perjudiciales
                </h3>
                <div className="flex flex-wrap gap-2.5">
                  {Array.isArray(auditData?.variables_perjudiciales) && auditData.variables_perjudiciales.length > 0 ? (
                    auditData.variables_perjudiciales.map((vItem, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs"
                      >
                        <i className="fa-solid fa-triangle-exclamation text-amber-600" /> {vItem}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No se detectaron variables perjudiciales graves.</span>
                  )}
                </div>
              </section>

              {/* Recomendaciones con Iconos de Pro (verde) y Contra (rojo) */}
              <section className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <i className="fa-solid fa-scale-balanced text-teal-700" /> Recomendaciones Estratégicas
                </h3>
                <div className="space-y-3">
                  {Array.isArray(auditData?.recomendaciones) && auditData.recomendaciones.length > 0 ? (
                    auditData.recomendaciones.map((rec, idx) => {
                      const isPro = String(rec.tipo || '').toLowerCase().includes('pro') || rec.isPro || (!String(rec.tipo || '').toLowerCase().includes('contra') && !String(rec.tipo || '').toLowerCase().includes('critico'));
                      return (
                        <div
                          key={idx}
                          className={`border rounded-lg p-4 flex items-start gap-3.5 ${
                            isPro ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'
                          }`}
                        >
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                              isPro ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {isPro ? '🟢' : '🔴'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-xs font-bold ${isPro ? 'text-emerald-950' : 'text-red-950'}`}>
                              {rec.titulo || (isPro ? 'Pro / Recomendación Favorable' : 'Contra / Factor de Riesgo')}
                            </h4>
                            <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                              {rec.descripcion || rec.texto || ''}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-xs text-slate-400 italic">Sin recomendaciones específicas disponibles.</span>
                  )}
                </div>
              </section>

              {/* Modificaciones Opción B Preview */}
              {auditData?.modificaciones_recap && (
                <section className="border border-teal-200 rounded-lg p-5 bg-teal-50/40 space-y-2.5">
                  <h4 className="text-xs font-bold text-teal-950 uppercase tracking-wider flex items-center gap-1.5">
                    <i className="fa-solid fa-pen-to-square text-teal-700" /> Modificaciones Contractuales (Opción B)
                  </h4>
                  <div className="bg-white border border-teal-200 rounded p-4 text-xs text-slate-800 font-mono space-y-1.5">
                    <div>
                      Tarifa sugerida:{' '}
                      <strong className="text-teal-900 font-bold">
                        {auditData.modificaciones_recap.tarifaSugerida || auditData.modificaciones_recap.fleteEstimado} €
                      </strong>
                    </div>
                    <div>
                      Cláusula paralización:{' '}
                      <span className="font-sans text-slate-700 italic">
                        {auditData.modificaciones_recap.clausulaParalizacion || '60 €/h tras 3h'}
                      </span>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* Footer Anclado (Sticky Footer) con Botón Final Opción B Destacado (w-full, bg-teal-700, text-white) */}
            <footer className="sticky bottom-0 p-5 bg-white border-t border-slate-200 shadow-lg flex flex-col sm:flex-row items-center gap-3 shrink-0 z-10">
              <button
                type="button"
                onClick={() => {
                  setIsOffcanvasOpen(false);
                  cerrarAuditoriaMadreOffcanvas();
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition-colors shadow-2xs"
              >
                Cerrar
              </button>
              <button
                type="button"
                id="react-btn-generar-orden-carga-estrategica"
                onClick={handleGenerateContract}
                className="w-full flex-1 px-5 py-3 text-sm font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <i className="fa-solid fa-file-signature text-base" />
                <span>Generar Orden de Carga Estratégica (Opción B)</span>
              </button>
            </footer>
          </aside>
        </>
      )}
    </div>
  );
}
