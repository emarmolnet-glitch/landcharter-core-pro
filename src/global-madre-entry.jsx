import React from 'react';
import { createRoot } from 'react-dom/client';
import GlobalMadreDrawer from './components/GlobalMadreDrawer.jsx';

const container = document.getElementById('global-madre-root');
if (container) {
  createRoot(container).render(<GlobalMadreDrawer />);
}
