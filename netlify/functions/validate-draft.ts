import type { Config } from "@netlify/functions";
import { searchNominatimLocations } from "./ports-search.js";
import { validatePortDraft } from "./_shared/draft-validation.js";
import { getOrSetCachedJson } from "./_shared/response-cache.js";

interface ValidateDraftRequestBody {
  portName?: unknown;
  portUuid?: unknown;
  portUnlocode?: unknown;
  vesselDraft?: unknown;
  actualDraft?: unknown;
  calculatedDraft?: unknown;
  maxDraft?: unknown;
  manualPortDraft?: unknown;
  acceptUnknownDraft?: unknown;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstPositiveDraft(...values: unknown[]) {
  for (const value of values) {
    const draft = Number(value);
    if (Number.isFinite(draft) && draft > 0) return draft;
  }
  return null;
}

export default async function validateDraftHandler(request: Request) {
  if (request.method !== "POST") return Response.json({ error: "Método no permitido." }, { status: 405 });

  let body: ValidateDraftRequestBody;
  try {
    body = await request.json() as ValidateDraftRequestBody;
  } catch {
    return Response.json({ error: "El body debe ser un JSON válido." }, { status: 400 });
  }

  const portName = cleanText(body.portName);
  const portUuid = cleanText(body.portUuid);
  const portUnlocode = cleanText(body.portUnlocode).toUpperCase();
  const actualDraft = firstPositiveDraft(body.actualDraft, body.calculatedDraft);
  const maxDraft = firstPositiveDraft(body.maxDraft, body.vesselDraft);
  const manualPortDraft = firstPositiveDraft(body.manualPortDraft);
  if (!portName && !portUuid && !portUnlocode) {
    return Response.json({ error: "Debe indicarse la ubicación activa para validar coordenadas terrestres." }, { status: 400 });
  }

  try {
    const query = portName || portUnlocode || portUuid;
    const cacheKey = portUuid || portUnlocode || portName.toLowerCase();
    const cached = await getOrSetCachedJson({
      namespace: "osm-geographic-point-v1",
      key: cacheKey,
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      staleTtlMs: 90 * 24 * 60 * 60 * 1000,
      producer: async () => {
        const results = await searchNominatimLocations(query);
        return results[0] || null;
      },
    });
    const port = cached.value;
    if (!port) return Response.json({ error: "Nominatim no encontró el punto terrestre solicitado." }, { status: 404 });

    return Response.json({
      ...validatePortDraft({
        portName: port.portName,
        safeDepthMeters: manualPortDraft ?? 99,
        depthSource: manualPortDraft ? "MANUAL" : "TERRESTRIAL_CLEARED",
        actualDraft,
        maxDraft,
        acceptUnknownDraft: true,
      }),
      portUuid: port.uuid,
      portUnlocode: port.unlocode,
      latitude: port.latitude,
      longitude: port.longitude,
      officialLabel: port.officialLabel,
      providerDraftMeters: null,
      manualPortDraftMeters: manualPortDraft,
      draftSourceField: null,
      source: "Nominatim",
    });
  } catch (error) {
    console.error("[validate-draft] Geographic point validation failed.", error instanceof Error ? error.message : String(error));
    return Response.json({ error: "No fue posible validar las coordenadas geográficas del punto solicitado." }, { status: 500 });
  }
}

export const config: Config = {
  path: "/api/v1/ports/validate-draft",
};
