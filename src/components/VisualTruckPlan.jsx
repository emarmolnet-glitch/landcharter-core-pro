import React from 'react';
import {
  TRUCK_PROFILES_METADATA,
  getTruckProfile,
  resolveTruckProfile
} from './visual-truck-plan-logic.mjs';

export {
  TRUCK_PROFILES_METADATA,
  getTruckProfile,
  resolveTruckProfile
};

/**
 * VisualTruckPlan React Component
 * Renders an architectural vector silhouette (Light Theme print-optimized SVG)
 * of the truck with stowed cargo block, LDM scaling, weight, and payload utilization.
 */
export default function VisualTruckPlan({
  vehicleType = 'Tráiler Tauliner (13.6m)',
  ldm = 13.6,
  maxLdm = 13.6,
  assignedWeightKg = 0,
  maxPayloadKg = 24000,
  className = ''
}) {
  const profileKey = getTruckProfile(vehicleType);
  const metadata = TRUCK_PROFILES_METADATA[profileKey] || TRUCK_PROFILES_METADATA.TAUTLINER;

  // Defensive values
  const effectiveMaxLdm = Number(maxLdm) > 0 ? Number(maxLdm) : metadata.standardLengthM;
  const effectiveLdm = Math.max(0, Math.min(Number(ldm) || 0, effectiveMaxLdm));
  const ldmRatio = effectiveMaxLdm > 0 ? Math.min(1, effectiveLdm / effectiveMaxLdm) : 0;

  const effectiveMaxPayload = Number(maxPayloadKg) > 0 ? Number(maxPayloadKg) : metadata.defaultPayloadKg;
  const effectiveWeight = Math.max(0, Number(assignedWeightKg) || 0);
  const payloadPercentage = effectiveMaxPayload > 0 ? Math.round((effectiveWeight / effectiveMaxPayload) * 100) : 0;

  // ViewBox coordinates for clean SVG composition
  // SVG Canvas: 800 x 240
  let bedX = 220;
  let bedWidth = 540;

  if (profileKey === 'RIGIDO') {
    // Rigid truck: continuous chassis, cab integrated
    bedX = 230;
    bedWidth = 500;
  } else if (profileKey === 'GONDOLA') {
    // Drop bed / lowbed: cargo bed is lowered between gooseneck and rear axles
    bedX = 275;
    bedWidth = 350;
  }

  const cargoBlockWidth = Math.max(0, Math.round(bedWidth * ldmRatio * 10) / 10);

  return (
    <div
      className={`visual-truck-plan-card bg-white border border-slate-300 rounded-xl p-4 shadow-xs text-slate-800 ${className}`}
      data-testid="visual-truck-plan"
    >
      {/* Header bar: Vehicle Profile, LDM, and Payload Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-600 text-white font-mono text-xs font-black">
            🚛
          </span>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 leading-tight">
              Configuración Vehículo & Estiba Terrestre
            </h4>
            <span className="text-[10.5px] font-bold text-blue-700 font-mono">
              {vehicleType} · <span className="text-slate-600 font-medium">{metadata.badge}</span>
            </span>
          </div>
        </div>

        {/* Quick summary badges */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <div className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
            <span className="text-slate-500 uppercase text-[9px] block font-sans font-bold">Metros Lineales (LDM)</span>
            <strong className="text-slate-900 font-black">{effectiveLdm.toFixed(2)} / {effectiveMaxLdm.toFixed(2)} LM</strong>
          </div>
          <div className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
            <span className="text-slate-500 uppercase text-[9px] block font-sans font-bold">Carga Útil Asignada</span>
            <strong className="text-slate-900 font-black">{effectiveWeight.toLocaleString('es-ES')} kg</strong>
            <span className={`ml-1.5 font-bold ${payloadPercentage > 100 ? 'text-rose-600' : 'text-emerald-700'}`}>
              ({payloadPercentage}%)
            </span>
          </div>
        </div>
      </div>

      {/* Primary SVG Graphic: Blueprint Silhouette with Proportional Cargo Block */}
      <div className="relative w-full bg-slate-50 rounded-lg border border-slate-200 p-2 overflow-hidden">
        <svg
          viewBox="0 0 800 240"
          className="w-full h-auto max-h-[220px]"
          xmlns="http://www.w3.org/2000/svg"
          data-profile={profileKey}
        >
          <defs>
            {/* Cargo Hatch Pattern */}
            <pattern id="cargoHatch" width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="12" stroke="#2563eb" strokeWidth="2.5" opacity="0.35" />
            </pattern>
            {/* Blueprint Grid Pattern */}
            <pattern id="blueprintGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2,2" />
            </pattern>
            <linearGradient id="cabGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <linearGradient id="cargoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.28" />
            </linearGradient>
          </defs>

          {/* Background Technical Grid */}
          <rect x="0" y="0" width="800" height="240" fill="#f8fafc" />
          <rect x="0" y="0" width="800" height="240" fill="url(#blueprintGrid)" />

          {/* Road Surface Line */}
          <line x1="20" y1="215" x2="780" y2="215" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6,4" />

          {/* ========================================================
              PROFILE 1: TAUTLINER / LONA CORREDERA (13.6m Enclosed)
             ======================================================== */}
          {profileKey === 'TAUTLINER' && (
            <g id="tautliner-assembly">
              {/* Tractor Unit */}
              <g data-element="tractor-cab">
                <path
                  d="M 50 195 L 50 95 Q 55 60 95 60 L 140 60 L 155 95 L 155 195 Z"
                  fill="url(#cabGradient)"
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                <path d="M 100 70 L 135 70 L 148 95 L 100 95 Z" fill="#93c5fd" opacity="0.85" stroke="#1e3a8a" strokeWidth="1" />
                <rect x="65" y="75" width="28" height="20" rx="3" fill="#bfdbfe" opacity="0.85" />
                <rect x="145" y="160" width="10" height="15" rx="2" fill="#fef08a" stroke="#ca8a04" />
                <rect x="45" y="180" width="112" height="15" rx="3" fill="#0f172a" />
                <rect x="175" y="172" width="25" height="8" rx="2" fill="#475569" stroke="#1e293b" />
                <circle cx="85" cy="195" r="18" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
                <circle cx="85" cy="195" r="8" fill="#94a3b8" />
                <circle cx="165" cy="195" r="18" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
                <circle cx="165" cy="195" r="8" fill="#94a3b8" />
              </g>

              {/* Semirremolque Enclosure (13.6m Standard) */}
              <g data-element="tautliner-enclosure">
                <rect x="200" y="70" width="560" height="110" rx="4" fill="#ffffff" stroke="#334155" strokeWidth="2.5" />
                <line x1="200" y1="75" x2="760" y2="75" stroke="#64748b" strokeWidth="3" />
                <rect x="200" y="70" width="15" height="110" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
                <rect x="745" y="70" width="15" height="110" fill="#94a3b8" stroke="#334155" strokeWidth="1.5" />
                {[260, 320, 380, 440, 500, 560, 620, 680].map((strapX) => (
                  <line
                    key={strapX}
                    x1={strapX}
                    y1="75"
                    x2={strapX}
                    y2="180"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeDasharray="4,3"
                  />
                ))}
                <rect x="200" y="178" width="560" height="8" fill="#1e293b" />
                <rect x="740" y="186" width="20" height="12" fill="#ef4444" opacity="0.9" />

                {/* Stowed Cargo Block (Dynamic proportional to LDM) */}
                <rect
                  data-element="cargo-block"
                  x="215"
                  y="90"
                  width={cargoBlockWidth}
                  height="85"
                  rx="3"
                  fill="url(#cargoGradient)"
                  stroke="#1d4ed8"
                  strokeWidth="2"
                />
                <rect
                  x="215"
                  y="90"
                  width={cargoBlockWidth}
                  height="85"
                  rx="3"
                  fill="url(#cargoHatch)"
                />

                {/* Trailer Triple Axles (Tridem standard 13.6m) */}
                {[640, 680, 720].map((wheelX) => (
                  <g key={wheelX}>
                    <circle cx={wheelX} cy="195" r="18" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
                    <circle cx={wheelX} cy="195" r="8" fill="#94a3b8" />
                  </g>
                ))}

                <rect x="280" y="186" width="8" height="20" fill="#475569" />
                <rect x="276" y="202" width="16" height="4" fill="#334155" />
              </g>
            </g>
          )}

          {/* ========================================================
              PROFILE 2: PLATAFORMA ABIERTA / FLATBED (Project Cargo)
             ======================================================== */}
          {profileKey === 'PLATAFORMA_ABIERTA' && (
            <g id="flatbed-assembly">
              {/* Tractor Unit */}
              <g data-element="tractor-cab">
                <path
                  d="M 50 195 L 50 95 Q 55 60 95 60 L 140 60 L 155 95 L 155 195 Z"
                  fill="url(#cabGradient)"
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                <path d="M 100 70 L 135 70 L 148 95 L 100 95 Z" fill="#93c5fd" opacity="0.85" stroke="#1e3a8a" strokeWidth="1" />
                <rect x="65" y="75" width="28" height="20" rx="3" fill="#bfdbfe" opacity="0.85" />
                <rect x="145" y="160" width="10" height="15" rx="2" fill="#fef08a" stroke="#ca8a04" />
                <rect x="45" y="180" width="112" height="15" rx="3" fill="#0f172a" />
                <circle cx="85" cy="195" r="18" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
                <circle cx="85" cy="195" r="8" fill="#94a3b8" />
                <circle cx="165" cy="195" r="18" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
                <circle cx="165" cy="195" r="8" fill="#94a3b8" />
              </g>

              {/* Open Flatbed Trailer (Sin techo ni laterales) */}
              <g data-element="flatbed-deck">
                <rect x="200" y="168" width="560" height="18" rx="2" fill="#334155" stroke="#0f172a" strokeWidth="2" />
                <rect
                  data-element="front-bulkhead"
                  x="200"
                  y="95"
                  width="14"
                  height="73"
                  rx="2"
                  fill="#64748b"
                  stroke="#1e293b"
                  strokeWidth="2"
                />
                {[230, 290, 350, 410, 470, 530, 590, 650, 710].map((ringX) => (
                  <circle key={ringX} cx={ringX} cy="177" r="3.5" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
                ))}

                {/* Stowed Cargo Block (Project Cargo on Flatbed) */}
                <rect
                  data-element="cargo-block"
                  x="215"
                  y="75"
                  width={cargoBlockWidth}
                  height="93"
                  rx="2"
                  fill="url(#cargoGradient)"
                  stroke="#1d4ed8"
                  strokeWidth="2"
                />
                <rect
                  x="215"
                  y="75"
                  width={cargoBlockWidth}
                  height="93"
                  rx="2"
                  fill="url(#cargoHatch)"
                />

                {ldmRatio > 0.1 && (
                  <>
                    <line x1="240" y1="75" x2="225" y2="168" stroke="#ea580c" strokeWidth="2" strokeDasharray="3,2" />
                    <line x1="310" y1="75" x2="330" y2="168" stroke="#ea580c" strokeWidth="2" strokeDasharray="3,2" />
                  </>
                )}
                {ldmRatio > 0.5 && (
                  <>
                    <line x1="420" y1="75" x2="400" y2="168" stroke="#ea580c" strokeWidth="2" strokeDasharray="3,2" />
                    <line x1="500" y1="75" x2="520" y2="168" stroke="#ea580c" strokeWidth="2" strokeDasharray="3,2" />
                  </>
                )}

                {[640, 680, 720].map((wheelX) => (
                  <g key={wheelX}>
                    <circle cx={wheelX} cy="195" r="18" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
                    <circle cx={wheelX} cy="195" r="8" fill="#94a3b8" />
                  </g>
                ))}
                <rect x="280" y="186" width="8" height="20" fill="#475569" />
                <rect x="276" y="202" width="16" height="4" fill="#334155" />
              </g>
            </g>
          )}

          {/* ========================================================
              PROFILE 3: GÓNDOLA / LOWBED / TIE-BOY (Drop Deck / Heavy)
             ======================================================== */}
          {profileKey === 'GONDOLA' && (
            <g id="lowbed-assembly">
              {/* Heavy Haul Tractor Unit */}
              <g data-element="tractor-cab">
                <path
                  d="M 40 195 L 40 85 Q 45 50 85 50 L 135 50 L 150 85 L 150 195 Z"
                  fill="url(#cabGradient)"
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                <path d="M 90 60 L 130 60 L 142 85 L 90 85 Z" fill="#93c5fd" opacity="0.85" stroke="#1e3a8a" strokeWidth="1" />
                <rect x="55" y="65" width="28" height="20" rx="3" fill="#bfdbfe" opacity="0.85" />
                <circle cx="65" cy="46" r="4" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
                <circle cx="115" cy="46" r="4" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
                <rect x="35" y="180" width="130" height="15" rx="3" fill="#0f172a" />
                <circle cx="75" cy="195" r="18" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
                <circle cx="75" cy="195" r="8" fill="#94a3b8" />
                <circle cx="125" cy="195" r="18" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
                <circle cx="125" cy="195" r="8" fill="#94a3b8" />
                <circle cx="165" cy="195" r="18" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
                <circle cx="165" cy="195" r="8" fill="#94a3b8" />
              </g>

              {/* Lowbed Gooseneck & Drop Bed Frame */}
              <g data-element="gooseneck">
                <path
                  d="M 180 160 L 220 160 L 250 185 L 270 185 L 270 195 L 235 195 L 210 172 L 180 172 Z"
                  fill="#334155"
                  stroke="#0f172a"
                  strokeWidth="2"
                />
              </g>

              <g data-element="lowered-drop-bed">
                <rect x="270" y="185" width="360" height="14" rx="2" fill="#475569" stroke="#0f172a" strokeWidth="2" />
                <path
                  d="M 630 185 L 660 165 L 770 165 L 770 180 L 665 180 L 640 198 L 630 198 Z"
                  fill="#334155"
                  stroke="#0f172a"
                  strokeWidth="2"
                />

                {/* Stowed Cargo Block on Lowered Deck */}
                <rect
                  data-element="cargo-block"
                  x="275"
                  y="90"
                  width={cargoBlockWidth}
                  height="95"
                  rx="3"
                  fill="url(#cargoGradient)"
                  stroke="#1d4ed8"
                  strokeWidth="2"
                />
                <rect
                  x="275"
                  y="90"
                  width={cargoBlockWidth}
                  height="95"
                  rx="3"
                  fill="url(#cargoHatch)"
                />

                <line x1="290" y1="90" x2="275" y2="185" stroke="#e11d48" strokeWidth="2" />
                <line x1="380" y1="90" x2="400" y2="185" stroke="#e11d48" strokeWidth="2" />
              </g>

              {/* Multi-Axles (4 Heavy duty low loader axles) */}
              <g data-element="multi-axles">
                {[675, 705, 735, 765].map((wheelX) => (
                  <g key={wheelX}>
                    <circle cx={wheelX} cy="198" r="14" fill="#1e293b" stroke="#0f172a" strokeWidth="2.5" />
                    <circle cx={wheelX} cy="198" r="6" fill="#94a3b8" />
                  </g>
                ))}
              </g>
            </g>
          )}

          {/* ========================================================
              PROFILE 4: RÍGIDO / FURGÓN (Chasis Único / Sin Articulación)
             ======================================================== */}
          {profileKey === 'RIGIDO' && (
            <g id="rigid-assembly">
              {/* Single Continuous Chassis Beam */}
              <g data-element="rigid-chassis">
                <rect x="70" y="178" width="670" height="15" rx="3" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
                <path
                  d="M 80 178 L 80 95 Q 85 65 120 65 L 180 65 L 210 105 L 210 178 Z"
                  fill="url(#cabGradient)"
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                <path d="M 130 75 L 175 75 L 198 105 L 130 105 Z" fill="#93c5fd" opacity="0.85" stroke="#1e3a8a" strokeWidth="1" />
                <rect x="95" y="80" width="26" height="22" rx="3" fill="#bfdbfe" opacity="0.85" />
                <rect x="70" y="165" width="20" height="16" rx="2" fill="#0f172a" />
              </g>

              {/* Rigid Integrated Cargo Box / Furgón */}
              <g data-element="rigid-box">
                <rect x="220" y="70" width="520" height="108" rx="4" fill="#ffffff" stroke="#334155" strokeWidth="2.5" />
                <line x1="225" y1="75" x2="735" y2="75" stroke="#cbd5e1" strokeWidth="2" />
                <line x1="225" y1="173" x2="735" y2="173" stroke="#cbd5e1" strokeWidth="2" />

                {/* Stowed Cargo Block */}
                <rect
                  data-element="cargo-block"
                  x="230"
                  y="85"
                  width={cargoBlockWidth}
                  height="88"
                  rx="3"
                  fill="url(#cargoGradient)"
                  stroke="#1d4ed8"
                  strokeWidth="2"
                />
                <rect
                  x="230"
                  y="85"
                  width={cargoBlockWidth}
                  height="88"
                  rx="3"
                  fill="url(#cargoHatch)"
                />

                <circle cx="130" cy="195" r="18" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
                <circle cx="130" cy="195" r="8" fill="#94a3b8" />
                <circle cx="630" cy="195" r="18" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
                <circle cx="630" cy="195" r="8" fill="#94a3b8" />
                <circle cx="675" cy="195" r="18" fill="#1e293b" stroke="#0f172a" strokeWidth="3" />
                <circle cx="675" cy="195" r="8" fill="#94a3b8" />
              </g>
            </g>
          )}

          {/* ========================================================
              TECHNICAL DATA LABELS & OVERLAYS ON GRAPHIC
             ======================================================== */}
          <g transform="translate(0, 222)">
            <line x1={bedX} y1="8" x2={bedX + bedWidth} y2="8" stroke="#64748b" strokeWidth="1" />
            <text x={bedX + bedWidth / 2} y="15" fill="#475569" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              Longitud Plataforma: {effectiveMaxLdm.toFixed(1)} LM (Ocupado: {effectiveLdm.toFixed(2)} LM · {Math.round(ldmRatio * 100)}%)
            </text>
          </g>

          {/* Cargo badge on cargo block */}
          {cargoBlockWidth > 40 && (
            <g transform={`translate(${bedX + Math.min(cargoBlockWidth / 2, bedWidth - 60)}, 135)`}>
              <rect
                x="-55"
                y="-18"
                width="110"
                height="34"
                rx="4"
                fill="#ffffff"
                fillOpacity="0.94"
                stroke="#2563eb"
                strokeWidth="1.5"
              />
              <text x="0" y="-3" fill="#1e3a8a" fontSize="10.5" fontWeight="900" textAnchor="middle" fontFamily="monospace">
                {effectiveWeight.toLocaleString('es-ES')} kg
              </text>
              <text x="0" y="11" fill="#2563eb" fontSize="8.5" fontWeight="800" textAnchor="middle" fontFamily="sans-serif">
                {payloadPercentage}% Carga Útil
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Footer Info: Operational specifications */}
      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200 text-center text-[10px]">
        <div>
          <span className="text-slate-400 uppercase font-bold block">Perfil Arquitectónico</span>
          <span className="text-slate-800 font-bold font-mono">{metadata.category}</span>
        </div>
        <div>
          <span className="text-slate-400 uppercase font-bold block">Estiba Lineal</span>
          <span className="text-blue-700 font-black font-mono">
            {effectiveLdm.toFixed(2)} / {effectiveMaxLdm.toFixed(2)} LDM ({Math.round(ldmRatio * 100)}%)
          </span>
        </div>
        <div>
          <span className="text-slate-400 uppercase font-bold block">Masa Máxima / Capacidad</span>
          <span className="text-emerald-700 font-black font-mono">
            {effectiveWeight.toLocaleString('es-ES')} / {effectiveMaxPayload.toLocaleString('es-ES')} kg
          </span>
        </div>
      </div>
    </div>
  );
}
