const { Pool } = require('pg');

const DATABASE_CONNECTION_ENV_KEYS = [
  'DATABASE_URL',
  'NETLIFY_DATABASE_URL',
  'NETLIFY_DB_URL',
  'NEON_DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
];

function getConnectionString() {
  for (const key of DATABASE_CONNECTION_ENV_KEYS) {
    const val = process.env[key];
    if (val && typeof val === 'string' && val.trim() && val.trim() !== 'tu_valor_real_de_la_variable') {
      return val.trim();
    }
  }
  return null;
}

let pool = null;

function getPool() {
  if (pool) return pool;
  const connectionString = getConnectionString();
  if (!connectionString) return null;
  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false }
  });
  return pool;
}

let tableEnsured = false;

async function ensureForwarderProjectsTable(clientOrPool) {
  if (tableEnsured) return;
  try {
    await clientOrPool.query(`
      CREATE TABLE IF NOT EXISTS forwarder_projects (
        id SERIAL PRIMARY KEY,
        project_ref VARCHAR(255) UNIQUE,
        client_name VARCHAR(255) DEFAULT 'Nuevo Cliente',
        status VARCHAR(50) DEFAULT 'BORRADOR',
        global_margin_percentage VARCHAR(50) DEFAULT '0',
        documents JSONB DEFAULT '[]'::jsonb,
        items JSONB DEFAULT '[]'::jsonb,
        services JSONB DEFAULT '[]'::jsonb,
        land_origin VARCHAR(255),
        land_destination VARCHAR(255),
        land_distance NUMERIC,
        land_freight_cost NUMERIC,
        land_freight_sale NUMERIC,
        valor_total_mercancia_usd NUMERIC,
        total_trucks INTEGER,
        road_transit_days NUMERIC,
        road_net_margin NUMERIC,
        pre_carriage JSONB DEFAULT '{}'::jsonb,
        on_carriage JSONB DEFAULT '{}'::jsonb,
        land_route JSONB DEFAULT '{}'::jsonb,
        route_and_chartering JSONB,
        data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS land_origin VARCHAR(255);
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS land_destination VARCHAR(255);
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS land_distance NUMERIC;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS land_freight_cost NUMERIC;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS land_freight_sale NUMERIC;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS valor_total_mercancia_usd NUMERIC;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS total_trucks INTEGER;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS road_transit_days NUMERIC;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS road_net_margin NUMERIC;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS pre_carriage JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS on_carriage JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS land_route JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS route_and_chartering JSONB;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS dossier_ref VARCHAR(255);
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS parent_ref VARCHAR(255);
      CREATE INDEX IF NOT EXISTS idx_forwarder_projects_ref ON forwarder_projects (project_ref);
    `);
    tableEnsured = true;
  } catch (err) {
    console.warn('[forwarder-projects] Advertencia al verificar/crear tabla forwarder_projects:', err?.message || err);
  }
}

function isMissingTableError(error) {
  if (!error) return false;
  const code = error.code || error?.originalError?.code;
  const message = String(error.message || error || '').toLowerCase();
  return (
    code === '42P01' ||
    message.includes('relation "forwarder_projects" does not exist') ||
    message.includes('does not exist') ||
    message.includes('undefined_table')
  );
}

// Cabeceras CORS obligatorias para evitar bloqueos del navegador
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function adaptProjectItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((it, idx) => {
    if (!it || typeof it !== 'object') return it;
    const rawQty = it.quantity ?? it.qty ?? it.cant ?? it.cantidad ?? it.piezas ?? it.bultos ?? 1;
    const quantity = Math.max(1, Number(rawQty) || 1);
    const lengthVal = it.length !== undefined && it.length !== null && it.length !== ''
      ? it.length
      : (it.length_m !== undefined && it.length_m !== null && it.length_m !== ''
        ? it.length_m
        : (it.largo ?? ''));
    const widthVal = it.width !== undefined && it.width !== null && it.width !== ''
      ? it.width
      : (it.width_m !== undefined && it.width_m !== null && it.width_m !== ''
        ? it.width_m
        : (it.ancho ?? ''));
    const heightVal = it.height !== undefined && it.height !== null && it.height !== ''
      ? it.height
      : (it.height_m !== undefined && it.height_m !== null && it.height_m !== ''
        ? it.height_m
        : (it.alto ?? (it.heightM ?? '')));
    const weightVal = it.unit_weight_kg !== undefined && it.unit_weight_kg !== null && it.unit_weight_kg !== ''
      ? it.unit_weight_kg
      : (it.weight !== undefined && it.weight !== null && it.weight !== ''
        ? it.weight
        : (it.unitWeight ?? (it.weight_kg ?? (it.peso ?? ''))));

    const rawType = it.type || it.description || it.descripcion || it.name || it.cargo_type || it.cargoType || it.product || '';
    const rawCategory = it.category || '';

    // Big bag adaptation
    const typeOrCat = `${rawType} ${rawCategory}`;
    const isBigBagOrBogBag = /(?:big|bog)[-\s_]*bags?/i.test(typeOrCat) ||
      typeOrCat.toUpperCase().includes('BIGBAG') ||
      typeOrCat.toUpperCase().includes('BIG BAG') ||
      typeOrCat.toUpperCase().includes('BOGBAG') ||
      typeOrCat.toUpperCase().includes('BOG BAG');

    let category = rawCategory;
    let type = rawType;
    let shipping_mode_supported = it.shipping_mode_supported || 'Tráiler Lona (13.6m)';

    if (isBigBagOrBogBag) {
      category = 'Carga Unitizada / Envasada';
      const upper = typeOrCat.toUpperCase();
      if (upper.includes('CEM II 52.5N/R 50KG')) type = 'CEM II 52.5N/R 50KG';
      else if (upper.includes('CEM II 52.5N')) type = 'CEM II 52.5N BIGBAG';
      else if (upper.includes('FARDILLISE TAVCIM') || upper.includes('TAVCIM')) type = 'CEM II 42,5N/R FARDILLISE TAVCIM';
      else if (upper.includes('FARDILISE')) type = 'CEM II 42,5N/R FARDILISE';
      else if (upper.includes('CEM II 42,5 R')) type = 'CEM II 42,5 R BIGBAG';
      else if (upper.includes('CEM I 52,5 R')) type = 'CEM I 52,5 R BIGBAG';
      else if (upper.includes('CEM I 42,5N/R SAC')) type = 'CEM I 42,5N/R SAC 50KG';
      else if (upper.includes('CEM I 42,5N/R')) type = 'CEM I 42,5N/R BIGBAG';
      else if (upper.includes('CEM I 52,5N SAC')) type = 'CEM I 52,5N SAC 50KG';
      else type = 'CEM I 52,5N BIGBAG';
      shipping_mode_supported = 'Tráiler Lona (13.6m)';
    }

    return {
      ...it,
      id: it.id || `item-${Date.now()}-${idx}`,
      category: category || 'Carga Unitizada / Envasada',
      type: type || 'CEM I 52,5N BIGBAG',
      quantity,
      length: lengthVal,
      width: widthVal,
      height: heightVal,
      length_m: lengthVal,
      width_m: widthVal,
      height_m: heightVal,
      weight: weightVal,
      unit_weight_kg: weightVal,
      shipping_mode_supported
    };
  });
}

exports.handler = async (event) => {
  const { httpMethod, body } = event;

  // 0. Interceptar peticiones OPTIONS (CORS preflight)
  if (httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const dbPool = getPool();
  if (!dbPool) {
    console.warn('[forwarder-projects] Base de datos no configurada, devolviendo estado seguro sin error 500');
    if (httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      };
    }
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Modo local activo (sin conexión de base de datos)', project: null }),
    };
  }

  try {
    // Auto-Migración de Esquema (CREATE TABLE IF NOT EXISTS)
    await ensureForwarderProjectsTable(dbPool);

    // 1. CREAR O ACTUALIZAR UN EXPEDIENTE (POST)
    if (httpMethod === 'POST') {
      const data = JSON.parse(body || '{}');

      const isIntegerId = data.id !== undefined && data.id !== null && !isNaN(parseInt(data.id, 10)) && String(parseInt(data.id, 10)) === String(data.id).trim();
      const parsedId = isIntegerId ? parseInt(data.id, 10) : null;
      const isAdaptedDossier = Boolean(data.is_maritime_dossier || data.from_maritime || data.is_new_insert || data.source === 'core_pro');

      // Comprobar si ya existe un registro previo en forwarder_projects por ID o project_ref
      let existingRecord = null;
      if (parsedId || data.project_ref) {
        try {
          const checkQuery = `
            SELECT id, project_ref FROM forwarder_projects 
            WHERE ($1::integer IS NOT NULL AND id = $1)
               OR ($2::text IS NOT NULL AND UPPER(project_ref) = UPPER($2))
            LIMIT 1;
          `;
          const checkRes = await dbPool.query(checkQuery, [parsedId, data.project_ref ? String(data.project_ref).trim() : null]);
          if (checkRes.rows.length > 0) {
            existingRecord = checkRes.rows[0];
          }
        } catch (_checkErr) {
          console.warn('[forwarder-projects] Advertencia al comprobar existencia de proyecto:', _checkErr?.message);
        }
      }

      // CASO A: MODO INSERT PARA DOSSIER ADAPTADO DE CORE PRO
      // Si el proyecto proviene de Core PRO (dossier marítimo adaptado) y no existe previamente en forwarder_projects,
      // realizar un INSERT creando un nuevo registro terrestre con el mismo project_ref (vinculándolos comercialmente)
      // en lugar de intentar un UPDATE que fallaría por incompatibilidad de ID (UUID vs Serial).
      if (isAdaptedDossier && !existingRecord) {
        const statusValue = (data.status !== undefined && data.status !== null && String(data.status).trim())
          ? String(data.status).trim()
          : 'BORRADOR';
        const marginValue = (data.global_margin_percentage !== undefined && data.global_margin_percentage !== null)
          ? String(data.global_margin_percentage)
          : '0';

        const incomingItems = data.items || data.cargo_items || [];
        const incomingServices = (Array.isArray(data.services) && data.services.length > 0)
          ? data.services
          : (Array.isArray(data.line_items) && data.line_items.length > 0 ? data.line_items : []);
        const servicesJson = incomingServices && incomingServices.length > 0
          ? JSON.stringify(incomingServices)
          : '[]';
        const landFreightCost = Number(data.land_freight_cost ?? data.freight_cost ?? data.totalTripCost ?? data.cost) || null;
        const landFreightSale = Number(data.land_freight_sale ?? data.salePrice ?? data.sale ?? data.targetSalePrice) || null;
        const goodsValueUsd = Number(data.valor_total_mercancia_usd ?? data.goodsValue ?? data.merchandiseValue) || null;
        const totalTrucks = Number(data.total_trucks ?? data.trucks ?? data.totalTrucks) || null;
        const landOrigin = (data.land_origin || data.pol || '').trim() || null;
        const landDestination = (data.land_destination || data.pod || '').trim() || null;
        const landDistance = Number(data.land_distance ?? data.totalKilometers ?? data.distance) || null;
        const dataJson = data.data !== undefined ? JSON.stringify(data.data) : '{}';
        const routeCharteringJson = data.route_and_chartering !== undefined ? JSON.stringify(data.route_and_chartering) : null;
        const effectiveProjectRef = (data.project_ref && String(data.project_ref).trim())
          ? String(data.project_ref).trim()
          : (data.reference || `EXP-${Date.now().toString().slice(-6)}`);
        const effectiveDossierRef = data.dossier_ref || data.parent_ref || data.referenciaPadre || effectiveProjectRef;

        const insertAdaptedQuery = `
          INSERT INTO forwarder_projects (
            project_ref, client_name, status, global_margin_percentage,
            documents, items, services,
            land_origin, land_destination, land_distance,
            land_freight_cost, land_freight_sale, valor_total_mercancia_usd,
            total_trucks, road_transit_days, road_net_margin,
            route_and_chartering, data, dossier_ref, parent_ref
          ) VALUES (
            $1, $2, $3, $4,
            $5::jsonb, $6::jsonb, $7::jsonb,
            $8, $9, $10,
            $11, $12, $13,
            $14, $15, $16,
            $17::jsonb, $18::jsonb, $19, $20
          )
          RETURNING *;
        `;
        const insertAdaptedValues = [
          effectiveProjectRef,
          data.client_name || 'Cliente Core PRO',
          statusValue,
          marginValue,
          JSON.stringify(data.documents || []),
          JSON.stringify(adaptProjectItems(incomingItems)),
          servicesJson,
          landOrigin,
          landDestination,
          landDistance,
          landFreightCost,
          landFreightSale,
          goodsValueUsd,
          totalTrucks,
          Number(data.road_transit_days) || null,
          Number(data.road_net_margin) || null,
          routeCharteringJson,
          dataJson,
          effectiveDossierRef,
          effectiveDossierRef
        ];

        const insertAdaptedResult = await dbPool.query(insertAdaptedQuery, insertAdaptedValues);
        const row = insertAdaptedResult.rows[0];
        const srvs = Array.isArray(row?.services) && row.services.length > 0
          ? row.services
          : (Array.isArray(row?.line_items) ? row.line_items : []);
        const formattedProject = row ? {
          ...row,
          services: srvs,
          line_items: srvs,
          land_freight_cost: Number(row.land_freight_cost) || 0,
          land_freight_sale: Number(row.land_freight_sale) || 0,
          valor_total_mercancia_usd: Number(row.valor_total_mercancia_usd) || 0,
        } : null;

        return {
          statusCode: 201,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Expediente terrestre creado con éxito y vinculado comercialmente',
            project: formattedProject
          })
        };
      }

      // MODO ACTUALIZACIÓN (Si ya existe ID o REF en forwarder_projects)
      if (existingRecord || (!isAdaptedDossier && (parsedId || data.project_ref))) {
        const statusValue = (data.status !== undefined && data.status !== null && String(data.status).trim())
          ? String(data.status).trim()
          : null;
        const marginValue = (data.global_margin_percentage !== undefined && data.global_margin_percentage !== null)
          ? String(data.global_margin_percentage)
          : null;

        const incomingUpdateItems = data.items || data.cargo_items;
        const incomingServices = (Array.isArray(data.services) && data.services.length > 0)
          ? data.services
          : (Array.isArray(data.line_items) && data.line_items.length > 0 ? data.line_items : null);
        const servicesJson = incomingServices && incomingServices.length > 0
          ? JSON.stringify(incomingServices)
          : null;
        const landFreightCost = Number(data.land_freight_cost ?? data.freight_cost ?? data.totalTripCost ?? data.cost) || null;
        const landFreightSale = Number(data.land_freight_sale ?? data.salePrice ?? data.sale ?? data.targetSalePrice) || null;
        const goodsValueUsd = Number(data.valor_total_mercancia_usd ?? data.goodsValue ?? data.merchandiseValue) || null;
        const totalTrucks = Number(data.total_trucks ?? data.trucks ?? data.totalTrucks) || null;
        const landOrigin = (data.land_origin || data.pol || '').trim() || null;
        const landDestination = (data.land_destination || data.pod || '').trim() || null;
        const landDistance = Number(data.land_distance ?? data.totalKilometers ?? data.distance) || null;
        const dataJson = data.data !== undefined ? JSON.stringify(data.data) : null;
        const routeCharteringJson = data.route_and_chartering !== undefined ? JSON.stringify(data.route_and_chartering) : null;

        const updateQuery = `
          UPDATE forwarder_projects 
          SET documents = COALESCE($1::jsonb, documents),
              items = CASE WHEN $2::jsonb IS NOT NULL AND jsonb_array_length($2::jsonb) > 0 THEN $2::jsonb ELSE items END,
              client_name = COALESCE($3, client_name),
              status = COALESCE($6, status),
              global_margin_percentage = COALESCE($7, global_margin_percentage),
              services = CASE WHEN $8::jsonb IS NOT NULL AND jsonb_array_length($8::jsonb) > 0 THEN $8::jsonb ELSE services END,
              land_freight_cost = CASE WHEN $9::numeric > 0 THEN $9::numeric ELSE land_freight_cost END,
              land_freight_sale = CASE WHEN $10::numeric > 0 THEN $10::numeric ELSE land_freight_sale END,
              valor_total_mercancia_usd = CASE WHEN $11::numeric > 0 THEN $11::numeric ELSE valor_total_mercancia_usd END,
              total_trucks = CASE WHEN $12::integer > 0 THEN $12::integer ELSE total_trucks END,
              land_origin = COALESCE($13, land_origin),
              land_destination = COALESCE($14, land_destination),
              land_distance = CASE WHEN $15::numeric > 0 THEN $15::numeric ELSE land_distance END,
              route_and_chartering = COALESCE($16::jsonb, route_and_chartering),
              data = COALESCE($17::jsonb, data),
              updated_at = CURRENT_TIMESTAMP
          WHERE ($4::integer IS NOT NULL AND id = $4) OR ($5::text IS NOT NULL AND UPPER(project_ref) = UPPER($5))
          RETURNING *;
        `;
        const updateValues = [
          data.documents !== undefined ? JSON.stringify(data.documents) : null,
          incomingUpdateItems !== undefined
            ? JSON.stringify(adaptProjectItems(incomingUpdateItems))
            : null,
          data.client_name || null,
          parsedId,
          data.project_ref ? String(data.project_ref).trim() : null,
          statusValue,
          marginValue,
          servicesJson,
          landFreightCost,
          landFreightSale,
          goodsValueUsd,
          totalTrucks,
          landOrigin,
          landDestination,
          landDistance,
          routeCharteringJson,
          dataJson
        ];
        const updateResult = await dbPool.query(updateQuery, updateValues);
        const row = updateResult.rows[0];

        // Si no encontró fila a actualizar y se proveyó project_ref, hacer INSERT de recuperación
        if (!row && data.project_ref) {
          const fallbackInsertQuery = `
            INSERT INTO forwarder_projects (
              project_ref, client_name, status, global_margin_percentage,
              documents, items, services,
              land_origin, land_destination, land_distance,
              land_freight_cost, land_freight_sale, valor_total_mercancia_usd,
              total_trucks, route_and_chartering, data, dossier_ref, parent_ref
            ) VALUES (
              $1, $2, $3, $4,
              $5::jsonb, $6::jsonb, $7::jsonb,
              $8, $9, $10,
              $11, $12, $13,
              $14, $15::jsonb, $16::jsonb, $17, $18
            )
            RETURNING *;
          `;
          const fallbackValues = [
            String(data.project_ref).trim(),
            data.client_name || 'Nuevo Cliente',
            statusValue || 'BORRADOR',
            marginValue || '0',
            JSON.stringify(data.documents || []),
            JSON.stringify(adaptProjectItems(incomingUpdateItems || [])),
            servicesJson || '[]',
            landOrigin,
            landDestination,
            landDistance,
            landFreightCost,
            landFreightSale,
            goodsValueUsd,
            totalTrucks,
            routeCharteringJson,
            dataJson || '{}',
            data.dossier_ref || data.project_ref,
            data.parent_ref || data.project_ref
          ];
          const fallbackRes = await dbPool.query(fallbackInsertQuery, fallbackValues);
          const fbRow = fallbackRes.rows[0];
          const fbSrvs = Array.isArray(fbRow?.services) && fbRow.services.length > 0
            ? fbRow.services
            : (Array.isArray(fbRow?.line_items) ? fbRow.line_items : []);
          return {
            statusCode: 201,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: 'Expediente terrestre creado con éxito',
              project: fbRow ? {
                ...fbRow,
                services: fbSrvs,
                line_items: fbSrvs,
                land_freight_cost: Number(fbRow.land_freight_cost) || 0,
                land_freight_sale: Number(fbRow.land_freight_sale) || 0,
                valor_total_mercancia_usd: Number(fbRow.valor_total_mercancia_usd) || 0,
              } : null
            })
          };
        }

        const srvs = Array.isArray(row?.services) && row.services.length > 0
          ? row.services
          : (Array.isArray(row?.line_items) ? row.line_items : []);
        const formattedProject = row ? {
          ...row,
          services: srvs,
          line_items: srvs,
          land_freight_cost: Number(row.land_freight_cost) || 0,
          land_freight_sale: Number(row.land_freight_sale) || 0,
          valor_total_mercancia_usd: Number(row.valor_total_mercancia_usd) || 0,
        } : null;

        return {
          statusCode: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Expediente actualizado con éxito', project: formattedProject })
        };
      }

      // MODO CREACIÓN (Nuevo Proyecto)
      const { client_name, status, documents, items, line_items, cargo_items, services, global_margin_percentage, dossier_ref, parent_ref, referenciaPadre } = data;
      const effectiveDossierRef = dossier_ref || parent_ref || referenciaPadre || null;
      const effectiveParentRef = parent_ref || dossier_ref || referenciaPadre || null;
      const projectRef = `EXP-${Date.now().toString().slice(-6)}`;
      const projectStatus = (status && typeof status === 'string' && status.trim()) ? status.trim() : 'BORRADOR';
      const marginPercentage = (global_margin_percentage !== undefined && global_margin_percentage !== null)
        ? String(global_margin_percentage)
        : '0';

      const insertQuery = `
        INSERT INTO forwarder_projects (project_ref, client_name, status, global_margin_percentage, documents, items)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
        RETURNING *;
      `;
      const rawCreateItems = items || cargo_items || line_items || services || [];
      const insertValues = [
        projectRef, 
        client_name || 'Nuevo Cliente', 
        projectStatus,
        marginPercentage,
        JSON.stringify(documents || []),
        JSON.stringify(adaptProjectItems(rawCreateItems))
      ];
      const result = await dbPool.query(insertQuery, insertValues);

      const createdRow = result.rows[0];
      if (createdRow && (effectiveDossierRef || effectiveParentRef)) {
        try {
          await dbPool.query(
            `UPDATE forwarder_projects SET dossier_ref = COALESCE($1, dossier_ref), parent_ref = COALESCE($2, parent_ref) WHERE id = $3`,
            [effectiveDossierRef, effectiveParentRef, createdRow.id]
          );
        } catch (_ignore) {}
      }

      const createdProject = createdRow ? {
        ...createdRow,
        dossier_ref: createdRow.dossier_ref || effectiveDossierRef,
        parent_ref: createdRow.parent_ref || effectiveParentRef,
        referenciaPadre: effectiveDossierRef || effectiveParentRef,
        services: Array.isArray(createdRow.services) ? createdRow.services : [],
        line_items: Array.isArray(createdRow.services) ? createdRow.services : [],
        land_freight_cost: Number(createdRow.land_freight_cost) || 0,
        land_freight_sale: Number(createdRow.land_freight_sale) || 0,
        valor_total_mercancia_usd: Number(createdRow.valor_total_mercancia_usd) || 0,
      } : null;

      return {
        statusCode: 201,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Expediente creado con éxito',
          project: createdProject
        }),
      };
    }

    // 2. ACTUALIZAR EXPEDIENTE ESTRICTO (PUT)
    if (httpMethod === 'PUT') {
      const data = JSON.parse(body || '{}');
      
      const isIntegerId = data.id !== undefined && data.id !== null && !isNaN(parseInt(data.id, 10)) && String(parseInt(data.id, 10)) === String(data.id).trim();
      const parsedId = isIntegerId ? parseInt(data.id, 10) : null;

      const statusValue = (data.status !== undefined && data.status !== null && String(data.status).trim())
        ? String(data.status).trim()
        : null;
      const marginValue = (data.global_margin_percentage !== undefined && data.global_margin_percentage !== null)
        ? String(data.global_margin_percentage)
        : null;

      const incomingCargoItems = (Array.isArray(data.items) && data.items.length > 0)
        ? data.items
        : (Array.isArray(data.cargo_items) && data.cargo_items.length > 0 ? data.cargo_items : null);
      const incomingServices = (Array.isArray(data.services) && data.services.length > 0)
        ? data.services
        : (Array.isArray(data.line_items) && data.line_items.length > 0 ? data.line_items : null);
      const servicesJson = incomingServices && incomingServices.length > 0
        ? JSON.stringify(incomingServices)
        : null;
      const landFreightCost = Number(data.land_freight_cost ?? data.freight_cost ?? data.totalTripCost ?? data.cost) || null;
      const landFreightSale = Number(data.land_freight_sale ?? data.salePrice ?? data.sale ?? data.targetSalePrice) || null;
      const goodsValueUsd = Number(data.valor_total_mercancia_usd ?? data.goodsValue ?? data.merchandiseValue) || null;
      const totalTrucks = Number(data.total_trucks ?? data.trucks ?? data.totalTrucks) || null;
      const landOrigin = (data.land_origin || data.pol || '').trim() || null;
      const landDestination = (data.land_destination || data.pod || '').trim() || null;
      const landDistance = Number(data.land_distance ?? data.totalKilometers ?? data.distance) || null;
      const dataJson = data.data !== undefined ? JSON.stringify(data.data) : null;
      const routeCharteringJson = data.route_and_chartering !== undefined ? JSON.stringify(data.route_and_chartering) : null;

      const query = `
        UPDATE forwarder_projects 
        SET documents = COALESCE($1::jsonb, documents),
            items = CASE WHEN $2::jsonb IS NOT NULL AND jsonb_array_length($2::jsonb) > 0 THEN $2::jsonb ELSE items END,
            client_name = COALESCE($3, client_name),
            status = COALESCE($6, status),
            global_margin_percentage = COALESCE($7, global_margin_percentage),
            services = CASE WHEN $8::jsonb IS NOT NULL AND jsonb_array_length($8::jsonb) > 0 THEN $8::jsonb ELSE services END,
            land_freight_cost = CASE WHEN $9::numeric > 0 THEN $9::numeric ELSE land_freight_cost END,
            land_freight_sale = CASE WHEN $10::numeric > 0 THEN $10::numeric ELSE land_freight_sale END,
            valor_total_mercancia_usd = CASE WHEN $11::numeric > 0 THEN $11::numeric ELSE valor_total_mercancia_usd END,
            total_trucks = CASE WHEN $12::integer > 0 THEN $12::integer ELSE total_trucks END,
            land_origin = COALESCE($13, land_origin),
            land_destination = COALESCE($14, land_destination),
            land_distance = CASE WHEN $15::numeric > 0 THEN $15::numeric ELSE land_distance END,
            route_and_chartering = COALESCE($16::jsonb, route_and_chartering),
            data = COALESCE($17::jsonb, data),
            updated_at = CURRENT_TIMESTAMP
        WHERE ($4::integer IS NOT NULL AND id = $4) OR ($5::text IS NOT NULL AND UPPER(project_ref) = UPPER($5))
        RETURNING *;
      `;
      const values = [
        data.documents !== undefined ? JSON.stringify(data.documents) : null,
        incomingCargoItems !== null ? JSON.stringify(adaptProjectItems(incomingCargoItems)) : null,
        data.client_name || null,
        parsedId,
        data.project_ref ? String(data.project_ref).trim() : null,
        statusValue,
        marginValue,
        servicesJson,
        landFreightCost,
        landFreightSale,
        goodsValueUsd,
        totalTrucks,
        landOrigin,
        landDestination,
        landDistance,
        routeCharteringJson,
        dataJson
      ];
      
      const result = await dbPool.query(query, values);

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Proyecto no encontrado para actualizar' })
        };
      }

      const row = result.rows[0];
      const srvs = Array.isArray(row.services) && row.services.length > 0
        ? row.services
        : (Array.isArray(row.line_items) ? row.line_items : []);
      const formattedProject = {
        ...row,
        services: srvs,
        line_items: srvs,
        land_freight_cost: Number(row.land_freight_cost) || 0,
        land_freight_sale: Number(row.land_freight_sale) || 0,
        valor_total_mercancia_usd: Number(row.valor_total_mercancia_usd) || 0,
      };

      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Expediente actualizado con éxito',
          project: formattedProject
        }),
      };
    }

    // 3. CONSULTAR EXPEDIENTES (GET) - SEPARACIÓN DE LISTADO Y DETALLE (Anti-502 ResponseSizeTooLarge)
    if (httpMethod === 'GET') {
      const qParams = event.queryStringParameters || {};
      const idParam = (qParams.id || qParams.projectId || '').trim();
      const parsedId = idParam && !isNaN(parseInt(idParam, 10)) ? parseInt(idParam, 10) : null;
      const refFilter = (qParams.ref || qParams.project_ref || qParams.contractRef || (parsedId === null ? idParam : '')).trim();

      // CASO A: DETALLE DE UN PROYECTO ESPECÍFICO (?ref=... o ?id=...)
      // Si la petición incluye un parámetro para un registro específico, usa SELECT * ... LIMIT 1
      // para devolver el objeto completo (con todos sus arrays pesados y documents).
      if (parsedId !== null || refFilter) {
        const detailQuery = `
          SELECT *, TO_CHAR(created_at, 'DD/MM/YYYY') as date 
          FROM forwarder_projects 
          WHERE ($1::integer IS NOT NULL AND id = $1)
             OR ($2::text IS NOT NULL AND UPPER(project_ref) = UPPER($2))
          ORDER BY created_at DESC 
          LIMIT 1;
        `;
        const detailValues = [parsedId, refFilter || null];
        const detailResult = await dbPool.query(detailQuery, detailValues);

        if (detailResult.rows.length === 0) {
          return {
            statusCode: 404,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Expediente no encontrado', project: null }),
          };
        }

        const row = detailResult.rows[0];
        const srvs = Array.isArray(row.services) && row.services.length > 0
          ? row.services
          : (Array.isArray(row.line_items) ? row.line_items : []);

        const formattedProject = {
          ...row,
          services: srvs,
          line_items: srvs,
          land_freight_cost: Number(row.land_freight_cost) || 0,
          land_freight_sale: Number(row.land_freight_sale) || 0,
          valor_total_mercancia_usd: Number(row.valor_total_mercancia_usd) || 0,
        };

        return {
          statusCode: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify(formattedProject),
        };
      }

      // CASO B: LISTADO GENERAL PARA BARRA LATERAL (Carga masiva ligera)
      // SELECT explícito SOLO de columnas ligeras: id, project_ref, client_name, status, land_origin,
      // land_destination, land_distance, land_freight_cost, land_freight_sale, global_margin_percentage,
      // created_at, updated_at.
      // EXCLUYE categóricamente documents, data, route_and_chartering, items, services y line_items.
      // Añade LIMIT 50 para blindar la memoria y evitar error 502 Function.ResponseSizeTooLarge (6MB).
      const listQuery = `
        SELECT 
          id, 
          project_ref, 
          client_name, 
          status, 
          land_origin, 
          land_destination, 
          land_distance, 
          land_freight_cost, 
          land_freight_sale, 
          global_margin_percentage, 
          created_at, 
          updated_at,
          TO_CHAR(created_at, 'DD/MM/YYYY') as date 
        FROM forwarder_projects 
        ORDER BY created_at DESC 
        LIMIT 50;
      `;
      const listResult = await dbPool.query(listQuery);

      const mappedRows = listResult.rows.map((row) => ({
        id: row.id,
        project_ref: row.project_ref,
        client_name: row.client_name,
        status: row.status,
        land_origin: row.land_origin,
        land_destination: row.land_destination,
        land_distance: Number(row.land_distance) || 0,
        land_freight_cost: Number(row.land_freight_cost) || 0,
        land_freight_sale: Number(row.land_freight_sale) || 0,
        global_margin_percentage: row.global_margin_percentage,
        created_at: row.created_at,
        updated_at: row.updated_at,
        date: row.date,
      }));

      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(mappedRows),
      };
    }

    // 4. ELIMINAR EXPEDIENTE (DELETE)
    if (httpMethod === 'DELETE') {
      let data = {};
      if (body) {
        try {
          data = typeof body === 'string' ? JSON.parse(body) : body;
        } catch (e) {
          data = {};
        }
      }
      const qParams = event.queryStringParameters || {};
      const id = data.id || qParams.id;
      const projectRef = data.project_ref || qParams.project_ref;

      if (!id && !projectRef) {
        return {
          statusCode: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Se requiere id o project_ref para eliminar el proyecto' })
        };
      }

      const parsedId = id && !isNaN(parseInt(id, 10)) ? parseInt(id, 10) : null;

      const deleteQuery = `
        DELETE FROM forwarder_projects 
        WHERE ($1::integer IS NOT NULL AND id = $1)
           OR ($2::text IS NOT NULL AND project_ref = $2)
        RETURNING *;
      `;
      const deleteValues = [parsedId, projectRef || null];
      const deleteResult = await dbPool.query(deleteQuery, deleteValues);

      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: deleteResult.rowCount > 0 ? 'Expediente eliminado con éxito' : 'Proyecto no encontrado o ya eliminado',
          deletedCount: deleteResult.rowCount,
          project: deleteResult.rows[0] || null
        })
      };
    }

    return { 
      statusCode: 405, 
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };

  } catch (error) {
    console.error('Error en forwarder-projects:', error);

    // Manejo Graceful de Tabla Inexistente (42P01 / relation does not exist)
    if (isMissingTableError(error)) {
      console.warn('[forwarder-projects] Capturado error 42P01 (undefined_table). Devolviendo respuesta segura.');
      if (httpMethod === 'GET') {
        return {
          statusCode: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify([]),
        };
      }
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Tabla no inicializada aún, petición completada de forma segura', project: null }),
      };
    }

    // Para peticiones GET, si ocurre cualquier fallo inesperado de base de datos, evitar 500 hacia el frontend
    if (httpMethod === 'GET') {
      console.warn('[forwarder-projects] Fallo en GET de proyectos, devolviendo array vacío para no colapsar la interfaz.');
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      };
    }

    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Error interno del servidor' }),
    };
  }
};
