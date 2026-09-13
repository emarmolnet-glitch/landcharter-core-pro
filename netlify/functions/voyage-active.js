const { Pool } = require('pg');

const DATABASE_CONNECTION_ENV_KEYS = [
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'NETLIFY_DB_URL',
  'NEON_DATABASE_URL',
];

function getDatabaseConnectionString() {
  for (const key of DATABASE_CONNECTION_ENV_KEYS) {
    const val = process.env[key];
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return null;
}

let poolInstance = null;

function getPool() {
  const connectionString = getDatabaseConnectionString();
  if (!connectionString) return null;
  if (poolInstance) return poolInstance;

  poolInstance = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false }
  });
  return poolInstance;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const phaseLabels = {
  APPROACHING_POL: 'Aproximación a puerto de carga',
  AT_POL: 'En puerto de carga',
  LOADING: 'En carga',
  IN_TRANSIT: 'En tránsito',
  AT_POD: 'En puerto de descarga',
  DISCHARGING: 'En descarga',
  COMPLETED: 'Completado',
};

function port(name, code, latitude, longitude) {
  return { name, id: code, lat: latitude, lng: longitude, latitude, longitude };
}

function cleanPortValue(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object' && val !== null) {
    return String(val.name || val.label || val.port || '').trim();
  }
  return String(val).trim();
}

function extractPortsFromGenericObject(obj) {
  if (!obj) return { pol: '', pod: '' };
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch (_) {
      return { pol: '', pod: '' };
    }
  }
  if (!obj || typeof obj !== 'object') return { pol: '', pod: '' };

  const rawPol =
    obj.pol ||
    obj.pol_name ||
    obj.polName ||
    obj.load_port ||
    obj.loadPort ||
    obj.port_of_loading ||
    obj.portOfLoading ||
    obj.port_pol ||
    obj.portPol ||
    obj['port-pol'] ||
    obj['map-port-pol'] ||
    obj.origin ||
    obj.origen ||
    obj.columna_correcta_pol ||
    obj.columna_pol ||
    '';

  const rawPod =
    obj.pod ||
    obj.pod_name ||
    obj.podName ||
    obj.discharge_port ||
    obj.dischargePort ||
    obj.port_of_discharge ||
    obj.portOfDischarge ||
    obj.port_pod ||
    obj.portPod ||
    obj['port-pod'] ||
    obj['map-port-pod'] ||
    obj.destination ||
    obj.destino ||
    obj.columna_correcta_pod ||
    obj.columna_pod ||
    '';

  return {
    pol: cleanPortValue(rawPol),
    pod: cleanPortValue(rawPod),
  };
}

exports.handler = async (event, context) => {
  const httpMethod = event?.httpMethod || event?.method || 'GET';

  // 0. CORS preflight
  if (httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Método no permitido.' }),
    };
  }

  const queryParams = event?.queryStringParameters || {};
  const contractRef = (
    queryParams.contractRef ||
    queryParams.ref ||
    queryParams.project_ref ||
    queryParams.reference ||
    ''
  ).trim();

  const normalizedRef = contractRef.toUpperCase();

  const dbPool = getPool();
  if (!dbPool) {
    console.warn('[voyage-active] Base de datos Neon no configurada.');
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        pol: '',
        pod: '',
        voyage: null,
      }),
    };
  }

  try {
    let pol = '';
    let pod = '';
    let matchedVoyage = null;

    // ------------------------------------------------------------------------
    // TABLA 1: charter_dossiers
    // Columnas exactas: reference, pol, pod, session_payload (JSONB)
    // ------------------------------------------------------------------------
    if ((!pol || !pod) && normalizedRef) {
      try {
        const dossierQuery = `
          SELECT 
            reference,
            pol AS db_pol,
            pod AS db_pod,
            session_payload,
            COALESCE(
              NULLIF(TRIM(pol), ''),
              NULLIF(TRIM(session_payload->'calculatorState'->>'pol'), ''),
              NULLIF(TRIM(session_payload->'fields'->>'port-pol'), ''),
              NULLIF(TRIM(session_payload->'fields'->>'map-port-pol'), ''),
              NULLIF(TRIM(session_payload->>'pol'), ''),
              NULLIF(TRIM(session_payload->>'port_of_loading'), ''),
              NULLIF(TRIM(session_payload->>'origen'), '')
            ) AS columna_correcta_pol,
            COALESCE(
              NULLIF(TRIM(pod), ''),
              NULLIF(TRIM(session_payload->'calculatorState'->>'pod'), ''),
              NULLIF(TRIM(session_payload->'fields'->>'port-pod'), ''),
              NULLIF(TRIM(session_payload->'fields'->>'map-port-pod'), ''),
              NULLIF(TRIM(session_payload->>'pod'), ''),
              NULLIF(TRIM(session_payload->>'port_of_discharge'), ''),
              NULLIF(TRIM(session_payload->>'destino'), '')
            ) AS columna_correcta_pod
          FROM charter_dossiers
          WHERE upper(reference) = $1 OR upper(reference) LIKE '%' || $1 || '%'
          ORDER BY updated_at DESC
          LIMIT 1
        `;
        const dResult = await dbPool.query(dossierQuery, [normalizedRef]);
        if (dResult.rows && dResult.rows[0]) {
          const row = dResult.rows[0];
          pol = cleanPortValue(row.columna_correcta_pol || row.db_pol);
          pod = cleanPortValue(row.columna_correcta_pod || row.db_pod);

          if (!pol || !pod) {
            let sp = row.session_payload;
            if (typeof sp === 'string') {
              try { sp = JSON.parse(sp); } catch (_) {}
            }
            if (sp && typeof sp === 'object') {
              const pCalc = extractPortsFromGenericObject(sp.calculatorState);
              const pFields = extractPortsFromGenericObject(sp.fields);
              const pObjs = extractPortsFromGenericObject(sp.workspaceState?.calculatorObjects);
              const pRoot = extractPortsFromGenericObject(sp);
              if (!pol) pol = pCalc.pol || pFields.pol || pObjs.pol || pRoot.pol;
              if (!pod) pod = pCalc.pod || pFields.pod || pObjs.pod || pRoot.pod;
            }
          }
        }
      } catch (err) {
        console.warn('[voyage-active] charter_dossiers query warning:', err?.message || err);
      }
    }

    // ------------------------------------------------------------------------
    // TABLA 2: voyages_tracking
    // Columnas exactas: contract_ref, pol_name, pod_name, commercial_details (JSONB)
    // ------------------------------------------------------------------------
    if (!pol || !pod) {
      try {
        let vQuery;
        let vParams = [];
        if (normalizedRef) {
          vQuery = `
            SELECT 
              contract_ref, vessel_name, imo_number, mmsi, cargo_name, cargo_quantity_mt,
              pol_code, pol_name, pol_latitude, pol_longitude,
              pod_code, pod_name, pod_latitude, pod_longitude,
              laydays_start_at, cancelling_at, current_status, current_phase,
              route_progress_pct, updated_at,
              COALESCE(
                NULLIF(TRIM(pol_name), ''),
                NULLIF(TRIM(commercial_details->>'pol'), ''),
                NULLIF(TRIM(commercial_details->>'port_of_loading'), ''),
                NULLIF(TRIM(commercial_details->>'origen'), '')
              ) AS columna_correcta_pol,
              COALESCE(
                NULLIF(TRIM(pod_name), ''),
                NULLIF(TRIM(commercial_details->>'pod'), ''),
                NULLIF(TRIM(commercial_details->>'port_of_discharge'), ''),
                NULLIF(TRIM(commercial_details->>'destino'), '')
              ) AS columna_correcta_pod
            FROM voyages_tracking
            WHERE upper(contract_ref) = $1 OR upper(contract_ref) LIKE '%' || $1 || '%'
            ORDER BY updated_at DESC
            LIMIT 1
          `;
          vParams = [normalizedRef];
        } else {
          vQuery = `
            SELECT 
              contract_ref, vessel_name, imo_number, mmsi, cargo_name, cargo_quantity_mt,
              pol_code, pol_name, pol_latitude, pol_longitude,
              pod_code, pod_name, pod_latitude, pod_longitude,
              laydays_start_at, cancelling_at, current_status, current_phase,
              route_progress_pct, updated_at,
              pol_name AS columna_correcta_pol,
              pod_name AS columna_correcta_pod
            FROM voyages_tracking
            WHERE closed_at IS NULL
            ORDER BY updated_at DESC
            LIMIT 1
          `;
        }
        const vResult = await dbPool.query(vQuery, vParams);
        if (vResult.rows && vResult.rows[0]) {
          matchedVoyage = vResult.rows[0];
          if (!pol) pol = cleanPortValue(matchedVoyage.columna_correcta_pol || matchedVoyage.pol_name);
          if (!pod) pod = cleanPortValue(matchedVoyage.columna_correcta_pod || matchedVoyage.pod_name);
        }
      } catch (err) {
        console.warn('[voyage-active] voyages_tracking query warning:', err?.message || err);
      }
    }

    // ------------------------------------------------------------------------
    // TABLA 3: forwarder_projects
    // Columnas exactas: project_ref, items (JSONB), documents (JSONB)
    // ------------------------------------------------------------------------
    if ((!pol || !pod) && normalizedRef) {
      try {
        const fwdQuery = `
          SELECT 
            project_ref,
            items,
            documents,
            client_name,
            COALESCE(
              NULLIF(TRIM(items->0->'payload_data'->'route_and_chartering'->>'pol'), ''),
              NULLIF(TRIM(items->0->'route_and_chartering'->>'pol'), ''),
              NULLIF(TRIM(items->0->'payload_data'->>'pol'), ''),
              NULLIF(TRIM(items->0->'payload_data'->>'port_of_loading'), ''),
              NULLIF(TRIM(items->0->'payload_data'->>'origen'), ''),
              NULLIF(TRIM(items->0->>'pol'), ''),
              NULLIF(TRIM(items->0->>'port_of_loading'), ''),
              NULLIF(TRIM(items->0->>'origen'), '')
            ) AS columna_correcta_pol,
            COALESCE(
              NULLIF(TRIM(items->0->'payload_data'->'route_and_chartering'->>'pod'), ''),
              NULLIF(TRIM(items->0->'route_and_chartering'->>'pod'), ''),
              NULLIF(TRIM(items->0->'payload_data'->>'pod'), ''),
              NULLIF(TRIM(items->0->'payload_data'->>'port_of_discharge'), ''),
              NULLIF(TRIM(items->0->'payload_data'->>'destino'), ''),
              NULLIF(TRIM(items->0->>'pod'), ''),
              NULLIF(TRIM(items->0->>'port_of_discharge'), ''),
              NULLIF(TRIM(items->0->>'destino'), '')
            ) AS columna_correcta_pod
          FROM forwarder_projects
          WHERE upper(project_ref) = $1 OR upper(project_ref) LIKE '%' || $1 || '%'
          ORDER BY created_at DESC
          LIMIT 1
        `;
        const fwdResult = await dbPool.query(fwdQuery, [normalizedRef]);
        if (fwdResult.rows && fwdResult.rows[0]) {
          const row = fwdResult.rows[0];
          if (!pol) pol = cleanPortValue(row.columna_correcta_pol);
          if (!pod) pod = cleanPortValue(row.columna_correcta_pod);

          if (!pol || !pod) {
            let itemsArr = row.items;
            if (typeof itemsArr === 'string') {
              try { itemsArr = JSON.parse(itemsArr); } catch (_) {}
            }
            if (Array.isArray(itemsArr)) {
              for (const item of itemsArr) {
                if (!item || typeof item !== 'object') continue;
                const p1 = extractPortsFromGenericObject(item.payload_data?.route_and_chartering);
                const p2 = extractPortsFromGenericObject(item.route_and_chartering);
                const p3 = extractPortsFromGenericObject(item.payload_data);
                const p4 = extractPortsFromGenericObject(item);
                if (!pol) pol = p1.pol || p2.pol || p3.pol || p4.pol;
                if (!pod) pod = p1.pod || p2.pod || p3.pod || p4.pod;
                if (pol && pod) break;
              }
            }
          }
        }
      } catch (err) {
        console.warn('[voyage-active] forwarder_projects query warning:', err?.message || err);
      }
    }

    // ------------------------------------------------------------------------
    // TABLA 4: app_state
    // Columnas exactas: key, value (TEXT/JSON), session_ref, current_session_ref
    // ------------------------------------------------------------------------
    if ((!pol || !pod) && normalizedRef) {
      try {
        const aResult = await dbPool.query(
          `SELECT key, value, session_ref, current_session_ref
           FROM app_state
           WHERE upper(session_ref) = $1 OR upper(current_session_ref) = $1 OR key = $1 OR key = 'core_pro_active_session'
           ORDER BY updated_at DESC
           LIMIT 1`,
          [normalizedRef]
        );
        if (aResult.rows && aResult.rows[0]) {
          const row = aResult.rows[0];
          let val = row.value;
          if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
            try { val = JSON.parse(val); } catch (_) {}
          }
          if (val && typeof val === 'object') {
            const pState = extractPortsFromGenericObject(val);
            if (!pol) pol = pState.pol;
            if (!pod) pod = pState.pod;
          }
        }
      } catch (err) {
        console.warn('[voyage-active] app_state query warning:', err?.message || err);
      }
    }

    // Retorno HTTP 200 obligatorio mapeado
    const responseBody = {
      success: true,
      pol: String(pol || '').trim(),
      pod: String(pod || '').trim(),
    };

    if (matchedVoyage) {
      responseBody.voyage = {
        reference: matchedVoyage.contract_ref,
        vesselName: matchedVoyage.vessel_name,
        imo: matchedVoyage.imo_number,
        mmsi: matchedVoyage.mmsi,
        cargoType: matchedVoyage.cargo_name,
        cargoQty: matchedVoyage.cargo_quantity_mt,
        cargoUnit: 'MT',
        loadPort: port(
          matchedVoyage.pol_name,
          matchedVoyage.pol_code,
          matchedVoyage.pol_latitude,
          matchedVoyage.pol_longitude
        ),
        dischargePort: port(
          matchedVoyage.pod_name,
          matchedVoyage.pod_code,
          matchedVoyage.pod_latitude,
          matchedVoyage.pod_longitude
        ),
        laydaysStartAt: matchedVoyage.laydays_start_at,
        cancellingAt: matchedVoyage.cancelling_at,
        operationalPhase: matchedVoyage.current_status,
        operationalPhaseLabel: phaseLabels[matchedVoyage.current_status] || matchedVoyage.current_status,
        currentPhase: matchedVoyage.current_phase,
        routeProgressPct: matchedVoyage.route_progress_pct,
        updatedAt: matchedVoyage.updated_at,
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(responseBody),
    };
  } catch (error) {
    console.error('[voyage-active] Request failed.', {
      requestId: context?.requestId,
      message: error?.message,
    });
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        pol: '',
        pod: '',
        error: error?.message || 'Error inesperado al buscar expediente.',
      }),
    };
  }
};
