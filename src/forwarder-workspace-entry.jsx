import React from 'react';
import { createRoot } from 'react-dom/client';
import ForwarderWorkspace from './components/ForwarderWorkspace.jsx';

let forwarderRoot = null;

export function mountForwarderWorkspace(container, options = {}) {
  const mountPoint = container?.querySelector?.('#forwarder-workspace-root')
    || document.getElementById('forwarder-workspace-root')
    || container;

  if (!mountPoint) return null;

  if (!forwarderRoot) {
    forwarderRoot = createRoot(mountPoint);
  }
  const currentRoute = options?.currentRoute || (typeof window !== 'undefined' ? (window.currentRoute || window.State?.currentRoute) : null);
  if (currentRoute) {
    forwarderRoot.render(<ForwarderWorkspace currentRoute={currentRoute} />);
  } else {
    forwarderRoot.render(<ForwarderWorkspace />);
  }
  return forwarderRoot;
}

if (typeof window !== 'undefined') {
  window.mountForwarderWorkspace = mountForwarderWorkspace;
}

const initialContainer = document.getElementById('forwarder-workspace-root');
if (initialContainer) {
  mountForwarderWorkspace(initialContainer);
}
