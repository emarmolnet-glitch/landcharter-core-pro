import type { Config } from "@netlify/functions";
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
    console.warn("[save-land-route] Warning ensuring forwarder_projects schema:", err?.message || err);
  }
}

function cleanString(val: unknown): string {
  return String(val ?? "").trim();
}

function cleanNumber(val: unknown, fallback = 0): number {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

export default async (req: Request) => {
  const corsHeaders = createCorsHeaders(req, "POST, OPTIONS");
  const headers = {
    "content-type": "application/json; charset=utf-8",
    ...corsHeaders,
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return Response.json(
      { success: false, error: "Method not allowed. Use POST." },
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

    const contractRef = cleanString(body.contractRef || body.contract_ref || body.reference || body.ref);
    if (!contractRef) {
      return Response.json(
        { success: false, error: "contractRef is required." },
        { status: 400, headers }
      );
    }

    const origin_name = cleanString(body.origin_name || body.origin || body.pol);
    const destination_name = cleanString(body.destination_name || body.destination || body.pod);
    const total_distance_km = cleanNumber(body.total_distance_km ?? body.distance_km ?? body.totalKilometers ?? body.distance);
    const freight_cost = cleanNumber(body.freight_cost ?? body.total_freight ?? body.cost);
    const total_trucks = cleanNumber(
      body.total_trucks ?? body.trucks ?? body.trucks_needed ?? body.totalTrucks ?? 1
    );
    const road_transit_days = cleanNumber(
      body.road_transit_days ?? body.transit_days ?? body.transitDays,
      total_distance_km > 0 ? Number((total_distance_km / 700).toFixed(2)) : 0
    );
    const road_net_margin = cleanNumber(
      body.road_net_margin ?? body.net_margin ?? body.netMargin ?? 0
    );
    const cargo_details = body.cargo_details && typeof body.cargo_details === "object"
      ? body.cargo_details
      : { description: cleanString(body.cargo_details) };

    const modeRaw = cleanString(body.mode || body.route_type || "").toLowerCase();
    const isImport = modeRaw.includes("import") || modeRaw.includes("on-carriage") || modeRaw.includes("oncarriage");
    const segment = isImport ? "on_carriage" : "pre_carriage";

    const landRoutePayload = {
      contract_ref: contractRef,
      origin_name,
      destination_name,
      total_distance_km,
      freight_cost,
      cargo_details,
      segment_type: segment,
      mode: isImport ? "import" : "export",
      total_trucks,
      road_transit_days,
      road_net_margin,
      driving_hours: cleanNumber(body.driving_hours, total_distance_km > 0 ? Number((total_distance_km / 75).toFixed(2)) : 0),
      updated_at: new Date().toISOString(),
    };

    const db = getDbPool();
    if (!db) {
      console.warn("[save-land-route] Neon DB connection string not available in environment. Simulating success for offline mode.");
      return Response.json(
        {
          success: true,
          offline_simulated: true,
          contractRef,
          land_route: landRoutePayload,
        },
        { status: 200, headers }
      );
    }

    await ensureProjectsTable(db);

    const updateQuery = `
      UPDATE forwarder_projects
      SET
        pre_carriage = CASE WHEN $2::text = 'pre_carriage' THEN $3::jsonb ELSE COALESCE(pre_carriage, '{}'::jsonb) END,
        on_carriage = CASE WHEN $2::text = 'on_carriage' THEN $3::jsonb ELSE COALESCE(on_carriage, '{}'::jsonb) END,
        land_route = $3::jsonb,
        land_origin = COALESCE(NULLIF($4::text, ''), land_origin),
        land_destination = COALESCE(NULLIF($5::text, ''), land_destination),
        land_distance = CASE WHEN $6::numeric > 0 THEN $6::numeric ELSE land_distance END,
        land_freight_cost = CASE WHEN $7::numeric > 0 THEN $7::numeric ELSE land_freight_cost END,
        total_trucks = CASE WHEN $8::integer > 0 THEN $8::integer ELSE total_trucks END,
        road_transit_days = CASE WHEN $9::numeric > 0 THEN $9::numeric ELSE road_transit_days END,
        road_net_margin = CASE WHEN $10::numeric <> 0 THEN $10::numeric ELSE road_net_margin END,
        updated_at = CURRENT_TIMESTAMP
      WHERE upper(project_ref) = upper($1::text) OR project_ref = $1::text
      RETURNING id, project_ref;
    `;

    const serializedPayload = JSON.stringify(landRoutePayload);
    let result = await db.query(updateQuery, [
      contractRef,
      segment,
      serializedPayload,
      origin_name,
      destination_name,
      total_distance_km,
      freight_cost,
      total_trucks,
      road_transit_days,
      road_net_margin,
    ]);

    if (result.rowCount === 0) {
      const insertQuery = `
        INSERT INTO forwarder_projects (
          project_ref,
          client_name,
          status,
          land_origin,
          land_destination,
          land_distance,
          land_freight_cost,
          total_trucks,
          road_transit_days,
          road_net_margin,
          pre_carriage,
          on_carriage,
          land_route,
          created_at,
          updated_at
        ) VALUES (
          $1::text,
          'Proyecto ' || $1::text,
          'BORRADOR',
          $4::text,
          $5::text,
          $6::numeric,
          $7::numeric,
          $8::integer,
          $9::numeric,
          $10::numeric,
          CASE WHEN $2::text = 'pre_carriage' THEN $3::jsonb ELSE '{}'::jsonb END,
          CASE WHEN $2::text = 'on_carriage' THEN $3::jsonb ELSE '{}'::jsonb END,
          $3::jsonb,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        RETURNING id, project_ref;
      `;
      result = await db.query(insertQuery, [
        contractRef,
        segment,
        serializedPayload,
        origin_name,
        destination_name,
        total_distance_km,
        freight_cost,
        total_trucks,
        road_transit_days,
        road_net_margin,
      ]);
    }

    try {
      await db.query(
        `UPDATE charter_dossiers
         SET session_payload = COALESCE(session_payload, '{}'::jsonb) || jsonb_build_object('land_route', $2::jsonb, $3::text, $2::jsonb),
             updated_at = CURRENT_TIMESTAMP
         WHERE upper(reference) = upper($1::text) OR reference = $1::text`,
        [contractRef, serializedPayload, segment]
      );
    } catch (_) {}

    try {
      await db.query(
        `UPDATE voyages_tracking
         SET commercial_details = COALESCE(commercial_details, '{}'::jsonb) || jsonb_build_object('land_route', $2::jsonb, $3::text, $2::jsonb),
             updated_at = CURRENT_TIMESTAMP
         WHERE upper(contract_ref) = upper($1::text) OR contract_ref = $1::text`,
        [contractRef, serializedPayload, segment]
      );
    } catch (_) {}

    return Response.json(
      {
        success: true,
        contractRef,
        data: landRoutePayload,
      },
      { status: 200, headers }
    );
  } catch (error: any) {
    console.error("[save-land-route] Error processing request:", error);
    return Response.json(
      {
        success: false,
        error: error?.message || "Internal server error saving land route.",
      },
      { status: 500, headers }
    );
  }
};

export const config: Config = {
  path: ["/api/save-land-route", "/.netlify/functions/save-land-route"],
};
