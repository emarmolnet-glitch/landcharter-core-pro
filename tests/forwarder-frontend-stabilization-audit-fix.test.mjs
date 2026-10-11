import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const forwarderJsxPath = path.resolve("src/components/ForwarderWorkspace.jsx");
const forwarderJsx = fs.readFileSync(forwarderJsxPath, "utf8");

test("1. Debounce and onBlur in warehouse load/discharge hours inputs", () => {
  assert.match(forwarderJsx, /hoursDebounceTimerRef\s*=\s*useRef\(/);
  assert.match(forwarderJsx, /loadingRateInput/);
  assert.match(forwarderJsx, /dischargingRateInput/);
  assert.match(forwarderJsx, /id="input-loading-rate"[\s\S]*?onBlur=/);
  assert.match(forwarderJsx, /id="input-discharging-rate"[\s\S]*?onBlur=/);
  assert.match(forwarderJsx, /setTimeout\([\s\S]*?500\)/);
});

test("2. Break ping-pong circular dependency with useRef in two-way binding hooks", () => {
  assert.match(forwarderJsx, /isSyncingFromAssessmentRef\s*=\s*useRef\(/);
  assert.match(forwarderJsx, /lastSyncedInputsRef\s*=\s*useRef\(/);
  assert.match(forwarderJsx, /if\s*\(isSyncingFromAssessmentRef\.current\)\s*return;/);
});

test("3. Anti-snowball protection: separates fleet total from unit cost multiplier", () => {
  assert.match(forwarderJsx, /BLINDAJE ANTI-BOLA DE NIEVE/);
  assert.match(forwarderJsx, /syncTruckCount\s*=\s*Math\.max\(1/);
  assert.match(forwarderJsx, /effectiveUnitCost\s*=\s*\(costEur\s*>\s*0\s*&&\s*syncTruckCount\s*>\s*1\)/);
});
