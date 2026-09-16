import type { Config, Context } from "@netlify/functions";
import { Pool } from "pg";
import { getDatabaseConnectionString } from "../../db/connection-string.js";
import { createCorsHeaders } from "./_shared/cors.js";

let pool: Pool | null = null;
let schemaEnsured = false;

function getDbPool(): Pool | null {
  if (pool) return pool;
  const connectionString = getDatabaseConnectionString();
  if (!connectionString) return null;
  pool = new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
  });
  return pool;
}

async function ensureProjectsTable(clientOrPool: Pool) {
  if (schemaEnsured) return;
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
        land_origin VARCHAR(255),
        land_destination VARCHAR(255),
        land_distance NUMERIC,
        land_freight_cost NUMERIC,
        total_trucks INTEGER,
        road_transit_days NUMERIC,
        road_net_margin NUMERIC,
        pre_carriage JSONB DEFAULT '{}'::jsonb,
        on_carriage JSONB DEFAULT '{}'::jsonb,
        land_route JSONB DEFAULT '{}'::jsonb,
        data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS land_origin VARCHAR(255);
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS land_destination VARCHAR(255);
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS land_distance NUMERIC;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS land_freight_cost NUMERIC;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS total_trucks INTEGER;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS road_transit_days NUMERIC;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS road_net_margin NUMERIC;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS pre_carriage JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS on_carriage JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE forwarder_projects ADD COLUMN IF NOT EXISTS land_route JSONB DEFAULT '{}'::jsonb;
      CREATE INDEX IF NOT EXISTS idx_forwarder_projects_ref ON forwarder_projects (project_ref);
    `);
    schemaEnsured = true;
  } catch (err: any) {
    console.warn("[sync-road] Warning ensuring forwarder_projects schema:", err?.message || err);
  }
}

function cleanString(val: unknown): string {
  return String(val ?? "").trim();
}

function cleanNumber(val: unknown, fallback = 0): number {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

export default async (req: Request, _context: Context) => {
  const corsHeaders = createCorsHeaders(req, "POST, PUT, OPTIONS");
  const headers = {
    "content-type": "application/json; charset=utf-8",
    ...corsHeaders,
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST" && req.method !== "PUT") {
    return Response.json(
      { success: false, error: "Method not allowed. Use POST or PUT." },
      { status: 405, headers }
    );
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<string, any> | null;
    if (!body || typeof body !== "object") {
      return Response.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400, headers }
      );
    }

    // Aceptar project_ref o reference como fallback en el payload, pero mapear SIEMPRE a la columna project_ref de Neon
    const projectRef = cleanString(body.project_ref || body.projectRef || body.reference || body.ref || body.contractRef || body.contract_ref);
    if (!projectRef) {
      return Response.json(
        { success: false, error: "project_ref is required." },
        { status: 400, headers }
      );
    }

    const total_trucks = cleanNumber(body.total_trucks ?? body.trucks ?? body.trucks_needed ?? body.totalTrucks ?? 1);
    const road_transit_days = cleanNumber(body.road_transit_days ?? body.transit_days ?? body.transitDays ?? 0);
    const road_net_margin = cleanNumber(body.road_net_margin ?? body.net_margin ?? body.netMargin ?? 0);

    const land_origin = cleanString(body.land_origin || body.origin_name || body.origin || body.pol);
    const land_destination = cleanString(body.land_destination || body.destination_name || body.destination || body.pod);
    const land_distance = cleanNumber(body.land_distance ?? body.total_distance_km ?? body.distance_km ?? body.totalKilometers ?? body.distance);
    const land_freight_cost = cleanNumber(body.land_freight_cost ?? body.freight_cost ?? body.total_freight ?? body.cost);

    const db = getDbPool();
    if (!db) {
      console.warn("[sync-road] Neon DB connection string not available in environment. Simulating success for offline mode.");
      return Response.json(
        {
          success: true,
          offline_simulated: true,
          project_ref: projectRef,
          total_trucks,
          road_transit_days,
          road_net_margin,
        },
        { status: 200, headers }
      );
    }

    await ensureProjectsTable(db);

    const updateQuery = `
      UPDATE forwarder_projects
      SET
        total_trucks = CASE WHEN $2::integer > 0 THEN $2::integer ELSE total_trucks END,
        road_transit_days = CASE WHEN $3::numeric > 0 THEN $3::numeric ELSE road_transit_days END,
        road_net_margin = CASE WHEN $4::numeric <> 0 THEN $4::numeric ELSE road_net_margin END,
        land_origin = COALESCE(NULLIF($5::text, ''), land_origin),
        land_destination = COALESCE(NULLIF($6::text, ''), land_destination),
        land_distance = CASE WHEN $7::numeric > 0 THEN $7::numeric ELSE land_distance END,
        land_freight_cost = CASE WHEN $8::numeric > 0 THEN $8::numeric ELSE land_freight_cost END,
        updated_at = CURRENT_TIMESTAMP
      WHERE upper(project_ref) = upper($1::text) OR project_ref = $1::text
      RETURNING id, project_ref;
    `;

    let result = await db.query(updateQuery, [
      projectRef,
      total_trucks,
      road_transit_days,
      road_net_margin,
      land_origin,
      land_destination,
      land_distance,
      land_freight_cost,
    ]);

    if (result.rowCount === 0) {
      const insertQuery = `
        INSERT INTO forwarder_projects (
          project_ref,
          client_name,
          status,
          total_trucks,
          road_transit_days,
          road_net_margin,
          land_origin,
          land_destination,
          land_distance,
          land_freight_cost,
          created_at,
          updated_at
        ) VALUES (
          $1::text,
          'Proyecto ' || $1::text,
          'BORRADOR',
          $2::integer,
          $3::numeric,
          $4::numeric,
          $5::text,
          $6::text,
          $7::numeric,
          $8::numeric,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        RETURNING id, project_ref;
      `;
      result = await db.query(insertQuery, [
        projectRef,
        total_trucks,
        road_transit_days,
        road_net_margin,
        land_origin,
        land_destination,
        land_distance,
        land_freight_cost,
      ]);
    }

    return Response.json(
      {
        success: true,
        project_ref: projectRef,
        total_trucks,
        road_transit_days,
        road_net_margin,
      },
      { status: 200, headers }
    );
  } catch (error: any) {
    console.error("[sync-road] Error processing request:", error);
    return Response.json(
      {
        success: false,
        error: error?.message || "Internal server error syncing road metrics.",
      },
      { status: 500, headers }
    );
  }
};

export const config: Config = {
  path: ["/api/projects/sync-road", "/.netlify/functions/sync-road"],
};
