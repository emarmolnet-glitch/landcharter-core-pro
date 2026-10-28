import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const madreVoiceSource = await readFile(
  new URL('../netlify/functions/madre-voice.js', import.meta.url),
  'utf8'
);

const { handler, resolveNeuralVoice } = await import(
  `data:text/javascript;base64,${Buffer.from(madreVoiceSource, 'utf8').toString('base64')}`
);

test('1. NO GLOBAL CONSTANTS: avoids hardcoded global VOICE_ID and ELEVENLABS_TTS_URL in header', () => {
  // Ensure the top of the file doesn't have static global constants
  const header = madreVoiceSource.slice(0, 500);
  assert.ok(!header.includes('const VOICE_ID'), 'Should not have global const VOICE_ID');
  assert.ok(!header.includes('const ELEVENLABS_TTS_URL'), 'Should not have global const ELEVENLABS_TTS_URL');
});

test('2. VOICE CAPTURE & NEURAL MAPPING: captures requestedVoice and maps Clara/Nova to premium targetVoiceId', () => {
  assert.match(madreVoiceSource, /const requestedVoice = \(payload\?\.voice \|\| payload\?\.name \|\| ["']Clara["']\)\.toLowerCase\(\);/);
  assert.match(madreVoiceSource, /let targetVoiceId = ["']LudcwvHIZaqQOcQfVZSY["'];/);
  assert.match(madreVoiceSource, /if \(requestedVoice\.includes\(["']clara["']\) \|\| requestedVoice\.includes\(["']nova["']\)\)/);
  assert.match(madreVoiceSource, /targetVoiceId = process\.env\.CLARA_VOICE_ID \|\| ["']21m00Tcm4TlvDq8ikWAM["'];/);
  assert.match(madreVoiceSource, /const ELEVENLABS_TTS_URL = `https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/\${targetVoiceId}`;/);
});

test('3. NATURAL INTONATION: injects elevenLabsPayload with voice_settings', () => {
  assert.match(madreVoiceSource, /model_id:\s*["']eleven_multilingual_v2["']/);
  assert.match(madreVoiceSource, /stability:\s*0\.50/);
  assert.match(madreVoiceSource, /similarity_boost:\s*0\.75/);
  assert.match(madreVoiceSource, /use_speaker_boost:\s*true/);
});

test('4. CORS & PREFLIGHT: handles OPTIONS request with 204 and CORS headers', async () => {
  const optRequest = new Request("https://example.com/.netlify/functions/madre-voice", {
    method: "OPTIONS"
  });
  const optResponse = await handler(optRequest);
  assert.equal(optResponse.status, 204);
  assert.equal(optResponse.headers.get("access-control-allow-origin"), "*");
  assert.ok(optResponse.headers.get("access-control-allow-methods").includes("POST"));
});

test('5. VALIDATION: rejects empty text with 400', async () => {
  const req = new Request("https://example.com/.netlify/functions/madre-voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "", voice: "Clara" })
  });
  const res = await handler(req);
  assert.equal(res.status, 400);
});

test('6. BINARY FORMAT: returns binary audio/mpeg buffer for Web Audio API decodeAudioData', async () => {
  const req = new Request("https://example.com/.netlify/functions/madre-voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Operación de transporte terrestre optimizada por Clara.",
      voice: "Clara",
      name: "Clara"
    })
  });
  const res = await handler(req);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "audio/mpeg");
  const buffer = await res.arrayBuffer();
  assert.ok(buffer.byteLength > 1000, `Expected audio buffer length > 1000, got ${buffer.byteLength}`);
});
