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
    addEventListener() {},
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

test('Micro-frontend iframe mode: emits SYNC_REFERENCE to window.parent when new reference is generated', () => {
  const { api, postedMessages } = setupEnvironment({ isIframe: true, href: 'https://app.test/' });

  // Initially generates a fallback reference
  const initialGenerated = api.getActiveContractRef();
  assert.ok(initialGenerated.startsWith('RDM/'), 'Generated reference should follow RDM format');

  const initialMsg = postedMessages.find(
    (msg) => msg.data?.type === 'SYNC_REFERENCE' && msg.data?.reference === initialGenerated
  );
  assert.ok(initialMsg, 'Fallback generation must emit SYNC_REFERENCE to parent');

  // Generate new estimation reference
  postedMessages.length = 0;
  const createdRef = api.createNewReference(true);
  assert.ok(createdRef.startsWith('RDM/'));

  const createdMsg = postedMessages.find(
    (msg) => msg.data?.type === 'SYNC_REFERENCE' && msg.data?.reference === createdRef
  );
  assert.ok(createdMsg, 'createNewReference must emit SYNC_REFERENCE to parent');
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
