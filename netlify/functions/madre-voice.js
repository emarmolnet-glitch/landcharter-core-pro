import { Buffer } from "node:buffer";

/**
 * Mapeo de voz solicitada a modelos neuronales de alta fidelidad.
 */
export function resolveNeuralVoice(requestedVoice = "Clara") {
  const norm = String(requestedVoice || "Clara").toLowerCase().trim();

  let openAiVoice = "nova";
  if (norm.includes("shimmer")) {
    openAiVoice = "shimmer";
  } else if (norm.includes("nova") || norm.includes("clara") || !norm) {
    openAiVoice = "nova";
  } else if (["alloy", "echo", "fable", "onyx"].includes(norm)) {
    openAiVoice = norm;
  }

  let targetVoiceId = "LudcwvHIZaqQOcQfVZSY"; // Fallback original
  if (norm.includes("clara") || norm.includes("nova")) {
    targetVoiceId = process.env.CLARA_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Voice ID Premium (Clara/Rachel)
  }

  const googleVoice = {
    languageCode: "es-ES",
    name: process.env.GOOGLE_TTS_VOICE || "es-ES-Neural2-A",
    ssmlGender: "FEMALE"
  };

  const pollyVoice = {
    voiceId: process.env.POLLY_VOICE_ID || "Lucia",
    engine: "neural"
  };

  return {
    requestedVoice,
    openAiVoice,
    elevenLabsVoiceId: targetVoiceId,
    targetVoiceId,
    googleVoice,
    pollyVoice
  };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, xi-api-key, X-App-Context, x-api-key",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "audio/mpeg",
  "Cache-Control": "no-cache, no-store, must-revalidate"
};

/**
 * Handler principal para Netlify Functions (compatible con Request/Response moderno v2 y Lambda v1)
 */
export async function handler(eventOrRequest) {
  const isModernRequest =
    eventOrRequest &&
    (
      (typeof Request !== "undefined" && eventOrRequest instanceof Request) ||
      typeof eventOrRequest.text === "function" ||
      (eventOrRequest.headers && typeof eventOrRequest.headers.get === "function")
    );

  const method = (eventOrRequest?.method || eventOrRequest?.httpMethod || "POST").toUpperCase();

  // Manejo de preflight CORS
  if (method === "OPTIONS") {
    if (isModernRequest) {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: ""
    };
  }

  if (method !== "POST") {
    const notAllowed = JSON.stringify({ error: "Method Not Allowed" });
    if (isModernRequest) {
      return new Response(notAllowed, {
        status: 405,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: notAllowed
    };
  }

  // Normalización de evento y parsing de cuerpo
  let event = eventOrRequest;
  if (isModernRequest && typeof eventOrRequest.text === "function") {
    const rawText = await eventOrRequest.text().catch(() => "{}");
    event = {
      body: rawText,
      headers: eventOrRequest.headers,
      method: eventOrRequest.method,
      httpMethod: eventOrRequest.method
    };
  }

  try {
    // 1. Parsing robusto del payload de entrada
    let payload = {};
    let body;
    try {
      body = JSON.parse(event.body);
      payload = body;
    } catch (_) {
      payload = (event && typeof event.body === "object" && event.body !== null) ? event.body : {};
      body = payload;
    }

    const text = payload?.text || payload?.message || payload?.prompt || "";
    const textToSpeak = body.text;

    if (!text || String(text).trim() === "") {
      const emptyErr = JSON.stringify({ error: "Parámetro text es obligatorio" });
      if (isModernRequest) {
        return new Response(emptyErr, {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: emptyErr
      };
    }

    // 2. Capturar el parámetro de voz y mapear el ID neuronal
    const requestedVoice = (payload?.voice || payload?.name || "Clara").toLowerCase();

    // Mapear "clara" a un ID neuronal premium femenino (Rachel por defecto, o variable de entorno)
    let targetVoiceId = "LudcwvHIZaqQOcQfVZSY"; // Fallback original
    if (requestedVoice.includes("clara") || requestedVoice.includes("nova")) {
        targetVoiceId = process.env.CLARA_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Voice ID Premium (Clara/Rachel)
    }

    const ELEVENLABS_TTS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`;

    // 3. Forzar entonación natural (voice_settings)
    const elevenLabsPayload = {
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: payload?.voice_settings || {
            stability: 0.50,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
        }
    };

    let audioBuffer = null;

    // Prioridad 1: ElevenLabs directo con ELEVENLABS_TTS_URL
    const elevenLabsApiKey =
      process.env.ELEVENLABS_API_KEY ||
      process.env.XI_API_KEY ||
      process.env.ELEVEN_API_KEY;

    if (elevenLabsApiKey) {
      try {
        const elevenLabsRes = await fetch(ELEVENLABS_TTS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": elevenLabsApiKey,
            Accept: "audio/mpeg"
          },
          body: JSON.stringify(elevenLabsPayload)
        });

        if (elevenLabsRes.ok) {
          const ab = await elevenLabsRes.arrayBuffer();
          audioBuffer = Buffer.from(ab);
        } else {
          const errText = await elevenLabsRes.text().catch(() => "");
          console.error(`[madre-voice] ElevenLabs error (${elevenLabsRes.status}):`, errText);
        }
      } catch (elevenErr) {
        console.error("[madre-voice] Error invocando ElevenLabs:", elevenErr.message);
      }
    }

    // Prioridad 2: OpenAI TTS directo con voice "nova" si está configurado
    if (!audioBuffer && process.env.OPENAI_API_KEY) {
      try {
        const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
        const openAiRes = await fetch(`${baseUrl}/audio/speech`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: process.env.OPENAI_TTS_MODEL || "tts-1",
            input: text,
            voice: (requestedVoice.includes("shimmer") ? "shimmer" : "nova"),
            response_format: "mp3"
          })
        });

        if (openAiRes.ok) {
          const ab = await openAiRes.arrayBuffer();
          audioBuffer = Buffer.from(ab);
        }
      } catch (openAiErr) {
        console.error("[madre-voice] Error invocando OpenAI TTS:", openAiErr.message);
      }
    }

    // Prioridad 3: Proxy a Cerebro Central en Data Bridge con targetVoiceId neuronal
    if (!audioBuffer) {
      try {
        const baseUrl = process.env.DATA_BRIDGE_URL || "https://calm-shortbread-55bcfc.netlify.app";
        const remoteUrl = `${baseUrl.replace(/\/+$/, "")}/.netlify/functions/madre-voice`;

        const upstreamHeaders = { "Content-Type": "application/json" };
        if (process.env.DATA_BRIDGE_API_SECRET) {
          upstreamHeaders["Authorization"] = `Bearer ${process.env.DATA_BRIDGE_API_SECRET}`;
        }

        const upstreamRes = await fetch(remoteUrl, {
          method: "POST",
          headers: upstreamHeaders,
          body: JSON.stringify({
            ...elevenLabsPayload,
            voice: "nova",
            name: "Clara",
            requestedVoice,
            targetVoiceId
          })
        });

        if (upstreamRes.ok) {
          const ab = await upstreamRes.arrayBuffer();
          audioBuffer = Buffer.from(ab);
        }
      } catch (proxyErr) {
        console.error("[madre-voice] Error en upstream Data Bridge:", proxyErr.message);
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      const errorPayload = JSON.stringify({
        error: "No se pudo generar el audio con el modelo neuronal seleccionado.",
        voice: requestedVoice,
        targetVoiceId
      });
      if (isModernRequest) {
        return new Response(errorPayload, {
          status: 502,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: errorPayload
      };
    }

    // 4. Devolver formato binario correcto (audio/mpeg) compatible con Web Audio API
    if (isModernRequest) {
      return new Response(audioBuffer, {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: audioBuffer.toString("base64"),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error("[madre-voice] Error interno en procesamiento:", error.message);
    const errRes = JSON.stringify({ error: error.message });
    if (isModernRequest) {
      return new Response(errRes, {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: errRes
    };
  }
}

export default handler;
