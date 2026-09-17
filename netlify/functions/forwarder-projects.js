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
        data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
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
      
      // MODO ACTUALIZACIÓN (Si ya existe ID o REF)
      if (data.id || data.project_ref) {
        const statusValue = (data.status !== undefined && data.status !== null && String(data.status).trim())
          ? String(data.status).trim()
          : null;
        const marginValue = (data.global_margin_percentage !== undefined && data.global_margin_percentage !== null)
          ? String(data.global_margin_percentage)
          : null;

        const updateQuery = `
          UPDATE forwarder_projects 
          SET documents = COALESCE($1::jsonb, documents),
              items = COALESCE($2::jsonb, items),
              client_name = COALESCE($3, client_name),
              status = COALESCE($6, status),
              global_margin_percentage = COALESCE($7, global_margin_percentage)
          WHERE id = $4 OR project_ref = $5
          RETURNING *;
        `;
        const incomingUpdateItems = data.items || data.cargo_items || data.line_items || data.services;
        const updateValues = [
          data.documents !== undefined ? JSON.stringify(data.documents) : null,
          incomingUpdateItems !== undefined
            ? JSON.stringify(adaptProjectItems(incomingUpdateItems))
            : null,
          data.client_name || null,
          data.id ? parseInt(data.id, 10) : null,
          data.project_ref || null,
          statusValue,
          marginValue
        ];
        const updateResult = await dbPool.query(updateQuery, updateValues);
        return {
          statusCode: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Expediente actualizado con éxito', project: updateResult.rows[0] })
        };
      }

      // MODO CREACIÓN (Nuevo Proyecto)
      const { client_name, status, documents, items, line_items, cargo_items, services, global_margin_percentage } = data;
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

      return {
        statusCode: 201,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Expediente creado con éxito',
          project: result.rows[0]
        }),
      };
    }

    // 2. ACTUALIZAR EXPEDIENTE ESTRICTO (PUT)
    if (httpMethod === 'PUT') {
      const data = JSON.parse(body || '{}');
      
      const statusValue = (data.status !== undefined && data.status !== null && String(data.status).trim())
        ? String(data.status).trim()
        : null;
      const marginValue = (data.global_margin_percentage !== undefined && data.global_margin_percentage !== null)
        ? String(data.global_margin_percentage)
        : null;

      const query = `
        UPDATE forwarder_projects 
        SET documents = COALESCE($1::jsonb, documents),
            items = COALESCE($2::jsonb, items),
            client_name = COALESCE($3, client_name),
            status = COALESCE($6, status),
            global_margin_percentage = COALESCE($7, global_margin_percentage)
        WHERE id = $4 OR project_ref = $5
        RETURNING *;
      `;
      const incomingPutItems = data.items || data.cargo_items || data.line_items || data.services;
      const values = [
        data.documents !== undefined ? JSON.stringify(data.documents) : null,
        incomingPutItems !== undefined
          ? JSON.stringify(adaptProjectItems(incomingPutItems))
          : null,
        data.client_name || null,
        data.id ? parseInt(data.id, 10) : null,
        data.project_ref || null,
        statusValue,
        marginValue
      ];
      
      const result = await dbPool.query(query, values);

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Proyecto no encontrado para actualizar' })
        };
      }

      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Expediente actualizado con éxito',
          project: result.rows[0]
        }),
      };
    }

    // 3. LISTAR TODOS LOS EXPEDIENTES (GET)
    if (httpMethod === 'GET') {
      const qParams = event.queryStringParameters || {};
      const refFilter = (qParams.ref || qParams.project_ref || qParams.contractRef || '').trim();
      let query;
      let values = [];
      if (refFilter) {
        query = `
          SELECT id, project_ref, client_name, status, global_margin_percentage, documents, items, data,
                 TO_CHAR(created_at, 'DD/MM/YYYY') as date 
          FROM forwarder_projects 
          WHERE UPPER(project_ref) = UPPER($1)
          ORDER BY created_at DESC;
        `;
        values = [refFilter];
      } else {
        query = `
          SELECT id, project_ref, client_name, status, global_margin_percentage, documents, items, data,
                 TO_CHAR(created_at, 'DD/MM/YYYY') as date 
          FROM forwarder_projects 
          ORDER BY created_at DESC;
        `;
      }
      const result = await dbPool.query(query, values);

      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(result.rows),
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
