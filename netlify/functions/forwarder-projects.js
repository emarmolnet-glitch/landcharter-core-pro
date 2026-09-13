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
        const updateValues = [
          data.documents !== undefined ? JSON.stringify(data.documents) : null,
          (data.items || data.line_items || data.services) !== undefined
            ? JSON.stringify(data.items || data.line_items || data.services)
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
      const { client_name, status, documents, items, line_items, services, global_margin_percentage } = data;
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
      const insertValues = [
        projectRef, 
        client_name || 'Nuevo Cliente', 
        projectStatus,
        marginPercentage,
        JSON.stringify(documents || []),
        JSON.stringify(items || line_items || services || [])
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
      const values = [
        data.documents !== undefined ? JSON.stringify(data.documents) : null,
        (data.items || data.line_items || data.services) !== undefined
          ? JSON.stringify(data.items || data.line_items || data.services)
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
