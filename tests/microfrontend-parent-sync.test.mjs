import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const contractRefSource = await readFile(new URL('../contract-reference.js', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function setupEnvironment({ isIframe = true, throwOnPostMessage = false, href = 'https://app.test/' } = {}) {
  const sessionStore = new Map();
  const localStore = new Map();
  const postedMessages = [];
  const warnings = [];
  const logs = [];
  const messageListeners = [];
  const location = new URL(href);

  class MockBroadcastChannel {
    constructor(channelName) {
      this.name = channelName;
    }
    postMessage() {}
    close() {}
  }

  const parentMock = {
    postMessage(data, targetOrigin) {
      if (throwOnPostMessage) {
        throw new Error('Sandbox postMessage blocked');
      }
      postedMessages.push({ data, targetOrigin });
    },
  };

  const windowMock = {
    BroadcastChannel: MockBroadcastChannel,
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    crypto: {
      getRandomValues(arr) {
        arr.fill(42);
        return arr;
      },
    },
    addEventListener(event, handler) {
      if (event === 'message') {
        messageListeners.push(handler);
      }
    },
    dispatchEvent() {},
    history: {
      state: null,
      replaceState(_state, _title, nextUrl) {
        windowMock.location = new URL(nextUrl, windowMock.location.href);
      },
    },
    location,
    sessionStorage: {
      getItem: (key) => sessionStore.get(key) || null,
      setItem: (key, val) => sessionStore.set(key, val),
      removeItem: (key) => sessionStore.delete(key),
    },
    localStorage: {
      getItem: (key) => localStore.get(key) || null,
      setItem: (key, val) => localStore.set(key, val),
      removeItem: (key) => localStore.delete(key),
    },
    console: {
      ...console,
      log(...args) {
        logs.push(args);
      },
      warn(...args) {
        warnings.push(args);
      },
    },
  };

  // If iframe, window.parent is different object; if standalone, window.parent === window
  if (isIframe) {
    windowMock.parent = parentMock;
  } else {
    windowMock.parent = windowMock;
  }

  vm.runInNewContext(contractRefSource, {
    window: windowMock,
    URL,
    URLSearchParams,
    Uint32Array,
    Date,
    Math,
    CustomEvent: windowMock.CustomEvent,
    console: windowMock.console,
  });

  return {
    api: windowMock.ContractRefManager,
    windowMock,
    parentMock,
    postedMessages,
    warnings,
    logs,
    dispatchMessage(data) {
      for (const listener of messageListeners) {
        listener({ data });
      }
    },
  };
}

test('Micro-frontend iframe mode: emits SYNC_REFERENCE to window.parent when reference changes', () => {
  const { api, postedMessages } = setupEnvironment({ isIframe: true, href: 'https://app.test/?ref=RDM%2F2026-1000' });

  // Initial call with URL ref already anchored
  assert.equal(api.getActiveContractRef(), 'RDM/2026-1000');
  const countBefore = postedMessages.length;

  // Change reference
  const newRef = api.setActiveContractRef('RDM/2026-5555');
  assert.equal(newRef, 'RDM/2026-5555');

  const syncMessages = postedMessages.filter(
    (msg) => msg.data?.type === 'SYNC_REFERENCE' && msg.data?.reference === 'RDM/2026-5555'
  );
  assert.equal(syncMessages.length, 1, 'Must emit exactly one SYNC_REFERENCE postMessage to parent');
  assert.equal(syncMessages[0].targetOrigin, '*', 'Must target all origins (*) as per contract');
});

test('Micro-frontend passive iframe subordination: prohibits auto-generation and is born in complete silence when no URL/cache ref', () => {
  const { api, postedMessages } = setupEnvironment({ isIframe: true, href: 'https://app.test/' });

  // When in iframe with no prior reference in URL or cache, auto-generation is prohibited
  const initialRef = api.getActiveContractRef();
  assert.equal(initialRef, null, 'getActiveContractRef must return null without prior reference in iframe mode');

  // createNewReference and generateVoyageRef must also return null
  assert.equal(api.createNewReference(), null, 'createNewReference must return null in subordinate iframe');
  assert.equal(api.createNewReference(true), null, 'createNewReference(force) must return null without reference in subordinate iframe');
  assert.equal(api.generateVoyageRef(), null, 'generateVoyageRef must return null in subordinate iframe');

  // Must be born in complete silence: no SYNC_REFERENCE postMessage sent to parent
  assert.equal(postedMessages.length, 0, 'Subordinate iframe must not emit any postMessage to parent on mount');
});

test('Micro-frontend iframe mode: does not emit extra postMessage when reference is unchanged', () => {
  const { api, postedMessages } = setupEnvironment({ isIframe: true, href: 'https://app.test/?ref=RDM%2F2026-3000' });

  api.setActiveContractRef('RDM/2026-3000');
  const messagesBefore = postedMessages.length;

  // Calling with identical reference again
  api.setActiveContractRef('RDM/2026-3000');
  api.setActiveContractRef('RDM/2026-3000');

  assert.equal(postedMessages.length, messagesBefore, 'Must not emit duplicate SYNC_REFERENCE for unchanged reference');
});

test('Standalone mode: does not emit postMessage when window.parent === window', () => {
  const { api, postedMessages } = setupEnvironment({ isIframe: false, href: 'https://app.test/?ref=RDM%2F2026-1000' });

  api.setActiveContractRef('RDM/2026-7777');
  assert.equal(postedMessages.length, 0, 'Standalone window must never postMessage to parent');
});

test('Micro-frontend error safety: postMessage errors are caught and logged as warnings without crashing', () => {
  const { api, warnings } = setupEnvironment({ isIframe: true, throwOnPostMessage: true, href: 'https://app.test/' });

  // Should not throw even if parent.postMessage throws
  assert.doesNotThrow(() => {
    api.setActiveContractRef('RDM/2026-9999');
  });

  const parentWarning = warnings.find(
    (w) => typeof w[0] === 'string' && w[0].includes('No se pudo emitir la referencia al parent')
  );
  assert.ok(parentWarning, 'Warning must be logged when postMessage fails');
});

test('Both contract-reference.js and index.html contain the required SYNC_REFERENCE validation', () => {
  assert.match(contractRefSource, /window\.parent !== window/);
  assert.match(contractRefSource, /type:\s*['"]SYNC_REFERENCE['"]/);
  assert.match(contractRefSource, /No se pudo emitir la referencia al parent/);

  assert.match(indexSource, /window\.parent !== window/);
  assert.match(indexSource, /type:\s*['"]SYNC_REFERENCE['"]/);
  assert.match(indexSource, /No se pudo emitir la referencia al parent/);
});

test('Micro-frontend iframe mode: obeys MASTER_FORCE_REFERENCE from MasterHub and updates reference', () => {
  const { api, postedMessages, logs, dispatchMessage } = setupEnvironment({
    isIframe: true,
    href: 'https://app.test/?ref=RDM%2F2026-1000',
  });

  assert.equal(api.getActiveContractRef(), 'RDM/2026-1000');
  postedMessages.length = 0;
  logs.length = 0;

  // MasterHub dictates a new reference
  dispatchMessage({
    type: 'MASTER_FORCE_REFERENCE',
    reference: 'RDM/2026-8888',
  });

  // Reference must be updated
  assert.equal(api.getActiveContractRef(), 'RDM/2026-8888');

  // Subordinate log must be present
  const subordinateLog = logs.find(
    (l) => typeof l[0] === 'string' && l[0].includes('[Subordinado] Acatando referencia maestra de MasterHub:')
  );
  assert.ok(subordinateLog, 'Must log subordinate message upon receiving MASTER_FORCE_REFERENCE');
  assert.equal(subordinateLog[1], 'RDM/2026-8888');

  // Must have emitted SYNC_REFERENCE confirmation back to parent
  const syncMsg = postedMessages.find(
    (msg) => msg.data?.type === 'SYNC_REFERENCE' && msg.data?.reference === 'RDM/2026-8888'
  );
  assert.ok(syncMsg, 'Must emit SYNC_REFERENCE confirming the forced reference');
});

test('Micro-frontend iframe mode: ignores MASTER_FORCE_REFERENCE if reference is already identical', () => {
  const { api, postedMessages, logs, dispatchMessage } = setupEnvironment({
    isIframe: true,
    href: 'https://app.test/?ref=RDM%2F2026-1000',
  });

  assert.equal(api.getActiveContractRef(), 'RDM/2026-1000');
  postedMessages.length = 0;
  logs.length = 0;

  // MasterHub sends identical reference
  dispatchMessage({
    type: 'MASTER_FORCE_REFERENCE',
    reference: 'RDM/2026-1000',
  });

  assert.equal(api.getActiveContractRef(), 'RDM/2026-1000');
  assert.equal(logs.length, 0, 'Must not log when reference is already identical');
  assert.equal(postedMessages.length, 0, 'Must not emit SYNC_REFERENCE when reference is identical');
});

test('Micro-frontend iframe mode: ignores non-force or malformed message events safely', () => {
  const { api, postedMessages, logs, dispatchMessage } = setupEnvironment({
    isIframe: true,
    href: 'https://app.test/?ref=RDM%2F2026-1000',
  });

  postedMessages.length = 0;
  logs.length = 0;

  // Various unrelated or malformed payloads
  dispatchMessage(null);
  dispatchMessage(undefined);
  dispatchMessage('raw string');
  dispatchMessage({ type: 'UNRELATED_TYPE', reference: 'RDM/2026-9999' });
  dispatchMessage({ type: 'MASTER_FORCE_REFERENCE' }); // missing reference

  assert.equal(api.getActiveContractRef(), 'RDM/2026-1000');
  assert.equal(logs.length, 0);
  assert.equal(postedMessages.length, 0);
});

test('Both contract-reference.js and index.html contain the MASTER_FORCE_REFERENCE listener', () => {
  assert.match(contractRefSource, /MASTER_FORCE_REFERENCE/);
  assert.match(contractRefSource, /\[Subordinado\] Acatando referencia maestra de MasterHub:/);
  assert.match(contractRefSource, /getActiveContractRef/);
  assert.match(contractRefSource, /setActiveContractRef/);

  assert.match(indexSource, /MASTER_FORCE_REFERENCE/);
  assert.match(indexSource, /\[Subordinado\] Acatando referencia maestra de MasterHub:/);
  assert.match(indexSource, /getActiveContractRef/);
  assert.match(indexSource, /setActiveContractRef/);
});

test('Both contract-reference.js and index.html enforce the Subordination Protocol (isSubordinateIframe & hasPriorReference)', () => {
  assert.match(contractRefSource, /isSubordinateIframe/);
  assert.match(contractRefSource, /hasPriorReference/);
  assert.match(contractRefSource, /Protocolo de Subordinación/);

  assert.match(indexSource, /isSubordinateIframe/);
  assert.match(indexSource, /hasPriorReference/);
  assert.match(indexSource, /Protocolo de Subordinación/);
});

